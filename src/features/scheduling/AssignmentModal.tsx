import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Shift, Person, TaskTemplate, Role, Team, TeamRotation, SchedulingConstraint } from '../../types';
import { Modal as GenericModal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';
import {
    X, Plus, Search, Wand2, RotateCcw, Sparkles, ChevronDown, ChevronRight, ChevronUp,
    Calendar as CalendarIcon, Clock, MoreVertical, CheckCircle, AlertTriangle, User,
    Filter, LayoutGrid, Users, Shield, ArrowRight, Pencil
} from 'lucide-react';
import { getEffectiveAvailability } from '../../utils/attendanceUtils';
import { getPersonInitials } from '../../utils/nameUtils';
import { useToast } from '../../contexts/ToastContext';
import { logger } from '../../services/loggingService';

interface AssignmentModalProps {
    selectedShift: Shift;
    task: TaskTemplate;
    people: Person[];
    roles: Role[];
    teams: Team[];
    shifts: Shift[];
    selectedDate: Date;
    teamRotations: TeamRotation[];
    isViewer: boolean;
    onClose: () => void;
    onAssign: (shiftId: string, personId: string) => void;
    onUnassign: (shiftId: string, personId: string) => void;
    onUpdateShift: (shift: Shift) => void;
    onToggleCancelShift: (shiftId: string) => void;
    constraints: SchedulingConstraint[];
}

export const AssignmentModal: React.FC<AssignmentModalProps> = ({
    selectedShift,
    task,
    people,
    roles,
    teams,
    shifts,
    selectedDate,
    teamRotations,
    isViewer,
    onClose,
    onAssign,
    onUnassign,
    onUpdateShift,
    onToggleCancelShift,
    constraints
}) => {
    // -------------------------------------------------------------------------
    // 1. STATE & HOOKS (Preserved Logic)
    // -------------------------------------------------------------------------
    if (!task) return null;

    const { showToast } = useToast();
    const [suggestedCandidates, setSuggestedCandidates] = useState<{ person: Person, reason: string }[]>([]);
    const [suggestionIndex, setSuggestionIndex] = useState(0);
    const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(new Set());

    // Mobile Drawer State
    const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

    // Time Editing State
    const [newStart, setNewStart] = useState('');
    const [newEnd, setNewEnd] = useState('');
    const [isEditingTime, setIsEditingTime] = useState(false);

    // Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('');
    const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>('');

    // Confirmation State
    const [confirmationState, setConfirmationState] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        confirmText?: string;
        type?: 'danger' | 'warning' | 'info';
        onConfirm: () => void;
    }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    // Initialize Time
    useEffect(() => {
        if (selectedShift) {
            try {
                setNewStart(new Date(selectedShift.startTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }));
                setNewEnd(new Date(selectedShift.endTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }));
            } catch (e) {
                console.error("Invalid time format", e);
            }
        }
    }, [selectedShift]);

    // -------------------------------------------------------------------------
    // 2. DATA PROCESSING (Preserved Logic)
    // -------------------------------------------------------------------------
    const toggleTeam = (teamId: string) => {
        setCollapsedTeams(prev => {
            const next = new Set(prev);
            if (next.has(teamId)) next.delete(teamId);
            else next.add(teamId);
            return next;
        });
    };

    const assignedPeople = useMemo(() =>
        selectedShift ? selectedShift.assignedPersonIds.map(id => people.find(p => p.id === id)).filter(Boolean) as Person[] : []
        , [selectedShift, people]);

    const overlappingShifts = useMemo(() => {
        if (!selectedShift) return [];
        const thisStart = new Date(selectedShift.startTime);
        const thisEnd = new Date(selectedShift.endTime);

        return shifts.filter(s => {
            if (s.id === selectedShift.id) return false;
            if (s.isCancelled) return false;
            const sStart = new Date(s.startTime);
            const sEnd = new Date(s.endTime);
            return sStart < thisEnd && sEnd > thisStart;
        });
    }, [shifts, selectedShift]);

    const availablePeople = useMemo(() => {
        if (!selectedShift || !task) return [];

        return people.filter(p => {
            if (p.isActive === false) return false;
            if (selectedShift.assignedPersonIds.includes(p.id)) return false;

            const availability = getEffectiveAvailability(p, selectedDate, teamRotations);
            if (availability.status === 'home') return false;

            if (availability.source === 'manual' && availability.isAvailable) {
                if (!availability.isAvailable) return false;
            } else if (!availability.isAvailable) {
                return false;
            }

            if (overlappingShifts.some(s => s.assignedPersonIds.includes(p.id))) return false;

            // Apply Filters
            if (selectedRoleFilter) {
                const currentRoleIds = p.roleIds || [p.roleId];
                if (!currentRoleIds.includes(selectedRoleFilter)) return false;
            }

            if (selectedTeamFilter) {
                if (p.teamId !== selectedTeamFilter) return false;
            }

            // Constraints
            const userConstraints = constraints.filter(c => c.personId === p.id);
            if (userConstraints.some(c => c.type === 'never_assign' && c.taskId === task.id)) return false;

            if (searchTerm) {
                return p.name.includes(searchTerm) || (p.phone && p.phone.includes(searchTerm));
            }

            return true;
        });
    }, [people, selectedShift, selectedDate, searchTerm, task, overlappingShifts, selectedRoleFilter, selectedTeamFilter, teamRotations, constraints]);

    const { roleComposition, allocationMap, totalRequired } = useMemo(() => {
        const segment = task.segments?.find(s => s.id === selectedShift.segmentId) || task.segments?.[0];
        const roleComposition = selectedShift.requirements?.roleComposition || segment?.roleComposition || [];
        const totalRequired = roleComposition.reduce((sum, rc) => sum + rc.count, 0) || selectedShift.requirements?.requiredPeople || segment?.requiredPeople || 1;

        const map = new Map<string, number>();
        if (roleComposition.length > 0) {
            const pool = [...assignedPeople];
            const prioritizedReqs = [...roleComposition].sort((a, b) => a.count - b.count);

            prioritizedReqs.forEach(rc => {
                const needed = rc.count;
                let taken = 0;
                const candidates = pool.filter(p => (p.roleIds || [p.roleId]).includes(rc.roleId));
                const toTake = candidates.slice(0, needed);
                toTake.forEach(p => {
                    const idx = pool.findIndex(x => x.id === p.id);
                    if (idx !== -1) pool.splice(idx, 1);
                    taken++;
                });
                map.set(rc.roleId, (map.get(rc.roleId) || 0) + taken);
            });

            pool.forEach(p => {
                const match = roleComposition.find(rc => (p.roleIds || [p.roleId]).includes(rc.roleId));
                if (match) {
                    map.set(match.roleId, (map.get(match.roleId) || 0) + 1);
                }
            });
        }
        return { roleComposition, allocationMap: map, totalRequired };
    }, [task, selectedShift, assignedPeople]);

    // -------------------------------------------------------------------------
    // 3. ACTION HANDLERS (Preserved)
    // -------------------------------------------------------------------------
    const handleSuggestBest = () => {
        const segment = task.segments?.find(s => s.id === selectedShift.segmentId) || task.segments?.[0];
        const roleComposition = selectedShift.requirements?.roleComposition || segment?.roleComposition || [];
        const currentAssigned = assignedPeople;
        const requiredRest = segment?.minRestHoursAfter || 8;

        const missingRoleIds = roleComposition.filter(rc => {
            const currentCount = currentAssigned.filter(p => {
                const rIds = p.roleIds || [p.roleId];
                return rIds.includes(rc.roleId);
            }).length;
            return currentCount < rc.count;
        }).map(rc => rc.roleId);

        const candidates = people.map(p => {
            let score = 0;
            const reasons: string[] = [];

            if (p.isActive === false) score -= 20000;
            if (selectedShift.assignedPersonIds.includes(p.id)) score -= 10000;

            const personShifts = shifts.filter(s => s.assignedPersonIds.includes(p.id) && !s.isCancelled);
            const thisStart = new Date(selectedShift.startTime);
            const thisEnd = new Date(selectedShift.endTime);

            const hasOverlap = personShifts.some(s => {
                const sStart = new Date(s.startTime);
                const sEnd = new Date(s.endTime);
                return sStart < thisEnd && sEnd > thisStart;
            });
            if (hasOverlap) { score -= 5000; reasons.push('חפיפה'); }

            const nextShift = personShifts
                .filter(s => new Date(s.startTime) >= thisEnd)
                .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0];

            if (nextShift) {
                const nextStart = new Date(nextShift.startTime);
                const gapMs = nextStart.getTime() - thisEnd.getTime();
                const gapHours = gapMs / (1000 * 60 * 60);

                if (gapHours < requiredRest) {
                    score -= 3000; reasons.push(`מנוחה קצרה (${gapHours.toFixed(1)})`);
                } else if (gapHours < requiredRest + 4) {
                    score -= 500; reasons.push(`מנוחה גבולית`);
                }
            }

            if (missingRoleIds.length > 0) {
                const fillsMissingRole = (p.roleIds || [p.roleId]).some(rid => missingRoleIds.includes(rid));
                if (fillsMissingRole) { score += 500; reasons.push('מתאים לתפקיד'); }
            }

            if (task.assignedTeamId && p.teamId !== task.assignedTeamId) {
                score -= 2000; reasons.push('צוות לא תואם');
            }

            return { person: p, score, reasons };
        });

        const validCandidates = candidates
            .filter(c => c.score > -6000)
            .sort((a, b) => b.score - a.score)
            .map(c => ({
                person: c.person,
                reason: c.reasons.length > 0 ? c.reasons.join(', ') : 'זמינות אופטימלית'
            }));

        if (validCandidates.length > 0) {
            setSuggestedCandidates(validCandidates);
            setSuggestionIndex(0);
            return true;
        } else {
            showToast('לא נמצאו מועמדים מתאימים', 'error');
            return false;
        }
    };

    const handleNextSuggestion = () => {
        setSuggestionIndex(prev => (prev + 1) % suggestedCandidates.length);
    };

    const handleSaveTime = () => {
        if (!newStart || !newEnd) return;
        const [sh, sm] = newStart.split(':').map(Number);
        const [eh, em] = newEnd.split(':').map(Number);

        const s = new Date(selectedShift.startTime);
        s.setHours(sh, sm);
        const e = new Date(selectedShift.endTime);
        e.setHours(eh, em);

        if (e.getTime() < s.getTime()) { e.setDate(e.getDate() + 1); }
        else if (e.getDate() !== s.getDate()) {
            const diff = new Date(selectedShift.endTime).getDate() - new Date(selectedShift.startTime).getDate();
            if (diff > 0) e.setDate(s.getDate() + diff);
            else e.setDate(s.getDate());
        }

        onUpdateShift({ ...selectedShift, startTime: s.toISOString(), endTime: e.toISOString() });
        setIsEditingTime(false);
    };

    const handleAttemptAssign = (personId: string) => {
        const p = people.find(x => x.id === personId);
        if (!p) return;

        if (assignedPeople.length >= totalRequired) {
            setConfirmationState({
                isOpen: true,
                title: 'חריגה מהתקן',
                message: `המשמרת מלאה (${assignedPeople.length}/${totalRequired}). הוסף בכל זאת?`,
                confirmText: "הוסף",
                type: "warning",
                onConfirm: () => {
                    setConfirmationState(prev => ({ ...prev, isOpen: false }));
                    checkTeamAndAssign(p);
                }
            });
            return;
        }

        const userRoleIds = p.roleIds || [p.roleId];
        const openMatchingRoles = roleComposition.filter(rc =>
            userRoleIds.includes(rc.roleId) && (allocationMap.get(rc.roleId) || 0) < rc.count
        );

        if (openMatchingRoles.length === 0 && userRoleIds.some(rid => roleComposition.some(rc => rc.roleId === rid))) {
            setConfirmationState({
                isOpen: true,
                title: 'חריגה מתקן תפקיד',
                message: `תפקיד זה כבר מלא. לשבץ בכל זאת?`,
                confirmText: "שבץ",
                type: "warning",
                onConfirm: () => {
                    setConfirmationState(prev => ({ ...prev, isOpen: false }));
                    checkTeamAndAssign(p);
                }
            });
            return;
        }
        checkTeamAndAssign(p);
    };

    const checkTeamAndAssign = (p: Person) => {
        if (task.assignedTeamId && p.teamId !== task.assignedTeamId) {
            setConfirmationState({
                isOpen: true,
                title: 'שיבוץ מחוץ לצוות',
                message: `חייל זה אינו שייך לצוות המשויך למשימה. המשך?`,
                confirmText: "שבץ",
                type: "warning",
                onConfirm: () => {
                    onAssign(selectedShift.id, p.id);
                    setSuggestedCandidates([]);
                    setConfirmationState(prev => ({ ...prev, isOpen: false }));
                }
            });
            return;
        }
        onAssign(selectedShift.id, p.id);
        setSuggestedCandidates([]);
    };

    const currentSuggestion = suggestedCandidates[suggestionIndex];

    // -------------------------------------------------------------------------
    // 4. UI COMPONENTS (NEW DENSE LAYOUT)
    // -------------------------------------------------------------------------

    return (
        <GenericModal
            isOpen={true}
            onClose={onClose}
            closeIcon="back"
            title={null} // Custom Header
            size="2xl"
            scrollableContent={false}
            hideDefaultHeader={true}
            className="p-0 overflow-hidden flex flex-col max-h-[90vh] md:max-h-[85vh]" // Custom class for modal body
        >
            {/* --- CONFIRMATION MODAL --- */}
            <ConfirmationModal
                isOpen={confirmationState.isOpen}
                title={confirmationState.title}
                message={confirmationState.message}
                confirmText={confirmationState.confirmText}
                type={confirmationState.type as any || 'warning'}
                onConfirm={confirmationState.onConfirm}
                onCancel={() => setConfirmationState(prev => ({ ...prev, isOpen: false }))}
            />

            {/* --- CUSTOM HEADER (Sticky) --- */}
            <div className="bg-white border-b border-slate-200 p-3 md:p-4 flex flex-col gap-3 shrink-0 z-40 shadow-sm relative">
                <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-0.5">
                        <h2 className="text-lg md:text-xl font-black text-slate-800 leading-none">{task.name}</h2>

                        {/* Time & Date Display/Edit */}
                        <div className="flex items-center gap-3 text-xs md:text-sm text-slate-500 font-medium">
                            <div className="flex items-center gap-1.5">
                                <CalendarIcon size={14} className="text-slate-400" />
                                {new Date(selectedShift.startTime).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })}
                            </div>
                            <span className="text-slate-300">|</span>
                            {!isEditingTime ? (
                                <button
                                    onClick={() => !isViewer && setIsEditingTime(true)}
                                    className={`flex items-center gap-1.5 font-mono ${!isViewer ? 'hover:text-blue-600 cursor-pointer' : ''}`}
                                >
                                    {new Date(selectedShift.startTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                    -
                                    {new Date(selectedShift.endTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                    {!isViewer && <Pencil size={12} className="opacity-50" />}
                                </button>
                            ) : (
                                <div className="flex items-center gap-1 animate-in fade-in">
                                    <input type="time" value={newStart} onChange={e => setNewStart(e.target.value)} className="w-20 px-1 py-0.5 text-xs border rounded" />
                                    <span>-</span>
                                    <input type="time" value={newEnd} onChange={e => setNewEnd(e.target.value)} className="w-20 px-1 py-0.5 text-xs border rounded" />
                                    <button onClick={handleSaveTime} className="p-1 bg-green-100 text-green-700 rounded hover:bg-green-200"><CheckCircle size={14} /></button>
                                    <button onClick={() => setIsEditingTime(false)} className="p-1 bg-slate-100 text-slate-700 rounded hover:bg-slate-200"><X size={14} /></button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Progress / Smart Suggest */}
                    <div className="flex items-center gap-2">
                        {!isViewer && (
                            <button
                                onClick={() => {
                                    const found = handleSuggestBest();
                                    if (found) showToast('נמצא שיבוץ מומלץ', 'success');
                                }}
                                className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-full hover:bg-blue-100 transition-colors"
                            >
                                <Wand2 size={14} /> שיבוץ חכם
                            </button>
                        )}
                        <Button variant="ghost" size="sm" onClick={onClose} className="md:hidden">
                            <X size={20} />
                        </Button>
                    </div>
                </div>

                {/* Requirements Slots */}
                {roleComposition.length > 0 && (
                    <div className="flex flex-wrap gap-x-4 gap-y-2 mt-1">
                        {roleComposition.map((rc) => {
                            const taken = allocationMap.get(rc.roleId) || 0;
                            const total = rc.count;
                            const roleName = roles.find(r => r.id === rc.roleId)?.name || 'תפקיד';

                            return (
                                <div key={rc.roleId} className="flex items-center gap-2 text-xs">
                                    <span className={`font-semibold ${taken >= total ? 'text-emerald-600' : 'text-slate-500'}`}>{roleName}</span>
                                    <div className="flex gap-1">
                                        {Array.from({ length: total }).map((_, i) => (
                                            <div
                                                key={i}
                                                className={`w-3 h-4 rounded-sm border ${i < taken
                                                    ? 'bg-emerald-500 border-emerald-600'
                                                    : 'bg-slate-50 border-slate-300 border-dashed'
                                                    }`}
                                            />
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Suggestion Alert (Inline) */}
                {currentSuggestion && (
                    <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs animate-in slide-in-from-top-2">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-blue-800">המלצה:</span>
                            <span className="font-bold">{currentSuggestion.person.name}</span>
                            <span className="text-slate-500 truncate max-w-[150px] md:max-w-xs">- {currentSuggestion.reason}</span>
                        </div>
                        <div className="flex gap-1">
                            <button onClick={() => handleAttemptAssign(currentSuggestion.person.id)} className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold">שבץ</button>
                            <button onClick={handleNextSuggestion} className="p-1 hover:bg-blue-100 rounded text-blue-600"><RotateCcw size={14} /></button>
                            <button onClick={() => setSuggestedCandidates([])} className="p-1 hover:bg-blue-100 rounded text-slate-500"><X size={14} /></button>
                        </div>
                    </div>
                )}
            </div>

            {/* --- MAIN BODY (3-Column Layout) --- */}
            <div className="flex flex-col md:flex-row flex-1 overflow-hidden relative">

                {/* 1. LEFT COLUMN: FILTERS (Desktop: 20%, Mobile: Horizontal Bar) */}
                <div className="md:w-[20%] md:min-w-[180px] bg-slate-50 md:border-l border-b md:border-b-0 border-slate-200 p-2 md:p-3 flex md:flex-col gap-2 md:overflow-y-auto shrink-0 z-30">
                    {/* Search */}
                    <div className="relative w-full md:w-auto shrink-0">
                        <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                            type="text"
                            placeholder="חיפוש חייל..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-2 pr-8 py-1.5 text-xs border border-slate-200 rounded-md focus:border-blue-500 focus:outline-none"
                        />
                    </div>

                    {/* Filters (Desktop Vertical, Mobile Horizontal Scroll) */}
                    <div className="flex md:flex-col gap-1.5 overflow-x-auto md:overflow-visible no-scrollbar">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden md:block mt-2 mb-1">תפקידים</div>
                        <button
                            onClick={() => setSelectedRoleFilter('')}
                            className={`whitespace-nowrap px-2.5 py-1 rounded-md text-xs font-medium text-right transition-colors ${!selectedRoleFilter ? 'bg-blue-100 text-blue-700 font-bold' : 'hover:bg-slate-200 text-slate-600'}`}
                        >
                            הכל
                        </button>
                        {roles.map(r => (
                            <button
                                key={r.id}
                                onClick={() => setSelectedRoleFilter(selectedRoleFilter === r.id ? '' : r.id)}
                                className={`whitespace-nowrap px-2.5 py-1 rounded-md text-xs font-medium text-right transition-colors ${selectedRoleFilter === r.id ? 'bg-blue-100 text-blue-700 font-bold' : 'hover:bg-slate-200 text-slate-600'}`}
                            >
                                {r.name}
                            </button>
                        ))}

                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden md:block mt-4 mb-1">צוותים</div>
                        {teams.map(t => (
                            <button
                                key={t.id}
                                onClick={() => setSelectedTeamFilter(selectedTeamFilter === t.id ? '' : t.id)}
                                className={`whitespace-nowrap px-2.5 py-1 rounded-md text-xs font-medium text-right transition-colors flex items-center justify-between group ${selectedTeamFilter === t.id ? 'bg-indigo-50 text-indigo-700 font-bold' : 'hover:bg-slate-200 text-slate-600'}`}
                            >
                                <span>{t.name}</span>
                                <div className={`w-1.5 h-1.5 rounded-full ${t.color?.replace('border-', 'bg-') || 'bg-slate-300'}`}></div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* 2. MIDDLE COLUMN: POOL (Desktop: 50%, Mobile: Flex-1) */}
                <div className="flex-1 bg-white md:bg-white flex flex-col min-h-0 overflow-hidden relative">
                    {/* Header for Pool */}
                    <div className="p-2 border-b border-slate-100 flex justify-between items-center text-xs bg-white sticky top-0 z-20">
                        <span className="font-bold text-slate-700">מאגר זמין ({availablePeople.length})</span>
                    </div>

                    <div className="overflow-y-auto flex-1 p-2 md:p-3 space-y-1">
                        {availablePeople.map(p => {
                            const availability = getEffectiveAvailability(p, selectedDate, teamRotations);
                            // Determine status color logic briefly
                            const isAvailable = availability.isAvailable;

                            return (
                                <div
                                    key={p.id}
                                    onClick={() => handleAttemptAssign(p.id)}
                                    className="group flex items-center justify-between p-2 rounded-lg border border-slate-100 hover:border-blue-300 hover:bg-blue-50/50 cursor-pointer transition-all active:scale-[0.99] bg-white"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-sm ${p.color} shrink-0`}>
                                            {getPersonInitials(p.name)}
                                        </div>
                                        <div className="flex flex-col">
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-sm font-bold text-slate-800">{p.name}</span>
                                                {/* Role Tags */}
                                                <div className="flex gap-1">
                                                    {roles.filter(r => (p.roleIds || [p.roleId]).includes(r.id)).map(r => (
                                                        <span key={r.id} className="text-[9px] px-1 bg-slate-100 text-slate-500 rounded">{r.name}</span>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Metadata row */}
                                            <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                                <span className="flex items-center gap-1">
                                                    <Shield size={10} />
                                                    {teams.find(t => t.id === p.teamId)?.name}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-sm">
                                            <Plus size={14} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {availablePeople.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-10 text-slate-400 opacity-60">
                                <Users size={32} strokeWidth={1.5} className="mb-2" />
                                <span className="text-xs">לא נמצאו חיילים זמינים</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* 3. RIGHT COLUMN: ASSIGNED (Desktop: 30% Sticky, Mobile: Drawer) */}

                {/* Mobile Drawer Toggle / Summary Bar */}
                <div className="md:hidden border-t border-slate-200 bg-white p-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-50 shrink-0 flex items-center justify-between">
                    <div
                        className="flex items-center gap-2 cursor-pointer"
                        onClick={() => setIsMobileDrawerOpen(!isMobileDrawerOpen)}
                    >
                        <div className="bg-slate-900 text-white text-xs font-bold px-2 py-1 rounded-md">
                            {assignedPeople.length} משובצים
                        </div>
                        <ChevronUp size={16} className={`transition-transform text-slate-500 ${isMobileDrawerOpen ? 'rotate-180' : ''}`} />
                    </div>
                    <Button onClick={onClose} size="md" className="px-6 h-9 font-bold">
                        סיום
                    </Button>
                </div>

                {/* The "Panel" - Sticky on Desktop, Fixed Drawer on Mobile */}
                <div className={`
                    bg-slate-50/80 md:bg-slate-50 border-l border-slate-200 
                    md:w-[30%] md:static 
                    fixed bottom-[60px] md:bottom-auto left-0 right-0 
                    ${isMobileDrawerOpen ? 'h-[60vh] border-t shadow-2xl' : 'h-0 overflow-hidden md:h-auto md:overflow-visible'}
                    md:flex md:flex-col transition-all duration-300 ease-in-out z-40
                `}>
                    <div className="p-3 border-b border-slate-200/50 flex justify-between items-center bg-slate-50/95 backdrop-blur sticky top-0 z-10">
                        <h4 className="font-black text-slate-600 text-xs uppercase tracking-wider">משובצים ({assignedPeople.length})</h4>
                        {isMobileDrawerOpen && (
                            <button onClick={() => setIsMobileDrawerOpen(false)} className="md:hidden p-1 bg-slate-200 rounded-full">
                                <ChevronDown size={14} />
                            </button>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {assignedPeople.map(p => (
                            <div key={p.id} className="flex items-center justify-between p-2 rounded-md bg-white border border-slate-200 shadow-sm">
                                <div className="flex items-center gap-2">
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[9px] font-bold ${p.color}`}>
                                        {getPersonInitials(p.name)}
                                    </div>
                                    <div className="flex flex-col leading-tight">
                                        <span className="text-xs font-bold text-slate-800">{p.name}</span>
                                        <div className="flex gap-1 flex-wrap">
                                            {roles.filter(r => (p.roleIds || [p.roleId]).includes(r.id)).map(r => (
                                                <span key={r.id} className="text-[9px] text-slate-500">{r.name}</span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                {!isViewer && (
                                    <button
                                        onClick={() => onUnassign(selectedShift.id, p.id)}
                                        className="text-slate-300 hover:text-red-500 p-1 hover:bg-red-50 rounded transition-colors"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Desktop "Finish" Button Anchor */}
                    <div className="hidden md:block p-3 border-t border-slate-200 bg-white sticky bottom-0">
                        <Button onClick={onClose} className="w-full font-bold shadow-sm" size="md">
                            סיום וסגירה
                        </Button>
                    </div>
                </div>

            </div>
        </GenericModal>
    );
};
