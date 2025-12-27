import React, { useState, useMemo, useEffect } from 'react';
import { Shift, Person, TaskTemplate, Role, Team, TeamRotation, SchedulingConstraint } from '../../types';
import { Modal as GenericModal } from '../../components/ui/Modal';
import { SheetModal } from '../../components/ui/SheetModal';
import { Button } from '../../components/ui/Button';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';
import {
    X, Plus, Search, Wand2, RotateCcw, Sparkles, ChevronDown, ChevronRight,
    Calendar as CalendarIcon, Clock, MoreVertical, Pencil, Undo2, Ban, Save,
    CheckCircle, AlertTriangle, User
} from 'lucide-react';
import { getEffectiveAvailability } from '../../utils/attendanceUtils';
import { getPersonInitials } from '../../utils/nameUtils';
import { useToast } from '../../contexts/ToastContext';
import { analytics } from '../../services/analytics';

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
    // Robust check for task to prevent crashes
    if (!task) return null;

    const { showToast } = useToast();
    const [suggestedCandidates, setSuggestedCandidates] = useState<{ person: Person, reason: string }[]>([]);
    const [suggestionIndex, setSuggestionIndex] = useState(0);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(new Set());
    const [isAddMode, setIsAddMode] = useState(false); // Mobile Two-Step Flow

    // Time Editing State
    const [newStart, setNewStart] = useState('');
    const [newEnd, setNewEnd] = useState('');
    const [isEditingTime, setIsEditingTime] = useState(false);

    // Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('');

    // Confirmation State
    const [confirmationState, setConfirmationState] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        confirmText?: string;
        type?: 'danger' | 'warning' | 'info';
        onConfirm: () => void;
    }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    // Initialize Time Editing State
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

    // Calculate overlapping shifts
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
            // 1. Exclude if already assigned
            if (selectedShift.assignedPersonIds.includes(p.id)) return false;

            // 2. Check Availability
            const availability = getEffectiveAvailability(p, selectedDate, teamRotations);
            // Explicitly filter out 'home' status as requested
            if (availability.status === 'home') return false;

            if (availability.source === 'manual' && availability.isAvailable) {
                if (!availability.isAvailable) return false;
            } else if (!availability.isAvailable) {
                return false;
            }

            // 3. Overlap Check
            if (overlappingShifts.some(s => s.assignedPersonIds.includes(p.id))) return false;

            // 4. Role Filter
            if (selectedRoleFilter) {
                const currentRoleIds = p.roleIds || [p.roleId];
                if (!currentRoleIds.includes(selectedRoleFilter)) return false;
            }

            // 5. Constraints Check (New)
            const userConstraints = constraints.filter(c => c.personId === p.id);
            // 5a. Never Assign
            if (userConstraints.some(c => c.type === 'never_assign' && c.taskId === task.id)) return false;

            // 6. Search Term
            if (searchTerm) {
                return p.name.includes(searchTerm) || (p.phone && p.phone.includes(searchTerm));
            }

            return true;
        });
    }, [people, selectedShift, selectedDate, searchTerm, task, overlappingShifts, selectedRoleFilter, teamRotations, constraints]);

    // Derived Role Composition and Allocation Map (Smart Logic)
    const { roleComposition, allocationMap, totalRequired } = useMemo(() => {
        const segment = task.segments?.find(s => s.id === selectedShift.segmentId) || task.segments?.[0];
        const roleComposition = selectedShift.requirements?.roleComposition || segment?.roleComposition || [];
        const totalRequired = roleComposition.reduce((sum, rc) => sum + rc.count, 0) || selectedShift.requirements?.requiredPeople || segment?.requiredPeople || 1;

        // SMART ALLOCATION LOGIC
        const map = new Map<string, number>();
        if (roleComposition.length > 0) {
            const pool = [...assignedPeople];
            // 1. Sort requirements by required count (ascending)
            const prioritizedReqs = [...roleComposition].sort((a, b) => a.count - b.count);

            // 2. Phase 1: Fill up to Requirement Capacity
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

            // 3. Phase 2: Allocate Leftovers (Over-assignment)
            pool.forEach(p => {
                const match = roleComposition.find(rc => (p.roleIds || [p.roleId]).includes(rc.roleId));
                if (match) {
                    map.set(match.roleId, (map.get(match.roleId) || 0) + 1);
                }
            });
        }
        return { roleComposition, allocationMap: map, totalRequired };
    }, [task, selectedShift, assignedPeople]);

    const handleSuggestBest = () => {
        const segment = task.segments?.find(s => s.id === selectedShift.segmentId) || task.segments?.[0];
        const roleComposition = selectedShift.requirements?.roleComposition || segment?.roleComposition || [];
        const currentAssigned = assignedPeople;

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

            if (selectedShift.assignedPersonIds.includes(p.id)) score -= 10000;

            const personShifts = shifts.filter(s => s.assignedPersonIds.includes(p.id));
            const hasOverlap = personShifts.some(s => {
                const sStart = new Date(s.startTime);
                const sEnd = new Date(s.endTime);
                const thisStart = new Date(selectedShift.startTime);
                const thisEnd = new Date(selectedShift.endTime);
                return sStart < thisEnd && sEnd > thisStart;
            });

            if (hasOverlap) {
                score -= 5000;
                reasons.push('חפיפה עם משמרת אחרת');
            }

            if (missingRoleIds.length > 0) {
                const fillsMissingRole = (p.roleIds || [p.roleId]).some(rid => missingRoleIds.includes(rid));
                if (fillsMissingRole) {
                    score += 500;
                    reasons.push('מתאים לתפקיד חסר');
                }
            }

            if (task.assignedTeamId && p.teamId !== task.assignedTeamId) {
                score -= 2000;
                reasons.push('צוות לא תואם');
            }

            return { person: p, score, reasons };
        });

        const validCandidates = candidates
            .filter(c => c.score > -4000)
            .sort((a, b) => b.score - a.score)
            .map(c => ({
                person: c.person,
                reason: c.reasons.length > 0 ? c.reasons.join(', ') : 'זמינות וניקוד אופטימליים'
            }));

        if (validCandidates.length > 0) {
            setSuggestedCandidates(validCandidates);
            setSuggestionIndex(0);
        } else {
            showToast('לא נמצאו מועמדים מתאימים', 'error');
        }
    };

    const handleNextSuggestion = () => {
        setSuggestionIndex(prev => (prev + 1) % suggestedCandidates.length);
    };

    const currentSuggestion = suggestedCandidates[suggestionIndex];

    const handleSaveTime = () => {
        if (!newStart || !newEnd) return;
        const [sh, sm] = newStart.split(':').map(Number);
        const [eh, em] = newEnd.split(':').map(Number);

        const s = new Date(selectedShift.startTime);
        s.setHours(sh, sm);
        const e = new Date(selectedShift.endTime);
        e.setHours(eh, em);

        // Handle overnight
        if (e.getTime() < s.getTime()) {
            e.setDate(e.getDate() + 1);
        } else if (e.getDate() !== s.getDate()) {
            // Preserve day diff if existing
            const diff = new Date(selectedShift.endTime).getDate() - new Date(selectedShift.startTime).getDate();
            if (diff > 0) e.setDate(s.getDate() + diff);
            else e.setDate(s.getDate());
        }

        onUpdateShift({
            ...selectedShift,
            startTime: s.toISOString(),
            endTime: e.toISOString()
        });
        setIsEditingTime(false);
    };

    const handleClose = () => {
        if (isAddMode) {
            setIsAddMode(false);
        } else {
            onClose();
        }
    };

    const handleAttemptAssign = (personId: string) => {
        const p = people.find(x => x.id === personId);
        if (!p) return;

        // 1. Check Total Capacity
        if (assignedPeople.length >= totalRequired) {
            setConfirmationState({
                isOpen: true,
                title: 'חריגה מהתקן',
                message: `המשמרת מלאה (${assignedPeople.length}/${totalRequired}). האם אתה בטוח שברצונך להוסיף חייל נוסף?`,
                confirmText: "הוסף בכל זאת",
                type: "warning",
                onConfirm: () => {
                    setConfirmationState(prev => ({ ...prev, isOpen: false }));
                    // Proceed to Team Check
                    checkTeamAndAssign(p);
                }
            });
            return;
        }

        // 2. Check Specific Role Capacity (Surplus Warning)
        // Identify roles this person can fulfill
        const userRoleIds = p.roleIds || [p.roleId];
        // Identify which of these roles are NOT yet full
        const openMatchingRoles = roleComposition.filter(rc =>
            userRoleIds.includes(rc.roleId) && (allocationMap.get(rc.roleId) || 0) < rc.count
        );

        // If they match roles, but ALL of them are full (AND there are other empty roles they don't match), warn them
        // Note: If openMatchingRoles is empty, it means they are surplus for their capabilities.
        // We only warn if the shift is NOT full (handled above), but their specific slot IS full.
        if (openMatchingRoles.length === 0 && userRoleIds.some(rid => roleComposition.some(rc => rc.roleId === rid))) {
            // Calculate details for message
            const matchedRoleNames = roles
                .filter(r => userRoleIds.includes(r.id) && roleComposition.some(rc => rc.roleId === r.id))
                .map(r => r.name)
                .join(', ');
            setConfirmationState({
                isOpen: true,
                title: 'חריגה מתקן תפקיד',
                message: `תפקיד ${matchedRoleNames} כבר מלא, בעוד שתפקידים אחרים נדרשים טרם אוישו. האם אתה בטוח?`,
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
                message: `שים לב: משימה זו מוגדרת עבור צוות ${teams.find(t => t.id === task.assignedTeamId)?.name}. האם אתה בטוח שברצונך לשבץ את ${p.name}?`,
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

    if (!selectedShift) return null;

    return (
        <>
            <GenericModal
                isOpen={true}
                onClose={handleClose}
                closeIcon="back"
                title={
                    <div className="flex flex-col w-full">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex flex-col">
                                <span className="text-xl font-bold text-slate-900 leading-tight">{task.name}</span>
                                <div className="flex items-center gap-3 text-sm text-slate-500 font-medium mt-1">
                                    <div className="flex items-center gap-1.5">
                                        <CalendarIcon size={14} className="text-slate-400" />
                                        {new Date(selectedShift.startTime).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })}
                                    </div>
                                    <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                                    <div className="flex items-center gap-1.5" dir="ltr">
                                        {!isViewer && (
                                            <button
                                                onClick={() => setIsEditingTime(true)}
                                                className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                                                aria-label="ערוך זמני משמרת"
                                            >
                                                <MoreVertical size={16} aria-hidden="true" />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => !isViewer && setIsEditingTime(true)}
                                            className={`flex items-center gap-1.5 font-mono ${!isViewer ? 'hover:bg-slate-100 px-2 py-1 -mx-2 rounded-lg cursor-pointer transition-colors group' : ''}`}
                                            title={!isViewer ? "לחץ לעריכת זמנים" : ""}
                                        >
                                            {new Date(selectedShift.startTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                            -
                                            {new Date(selectedShift.endTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                            <Clock size={14} className={`text-slate-400 ${!isViewer ? 'group-hover:text-blue-500' : ''}`} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {!isViewer && (
                                <div className="relative">
                                    {/* Action buttons if needed, or keeping it clean */}
                                </div>
                            )}
                        </div>
                    </div>
                }
                size="2xl"
                scrollableContent={false}
            >


                <div className="flex flex-col h-full overflow-hidden max-h-[80dvh]">

                    {/* Confirmation Modal */}
                    <ConfirmationModal
                        isOpen={confirmationState.isOpen}
                        title={confirmationState.title}
                        message={confirmationState.message}
                        confirmText={confirmationState.confirmText}
                        type={confirmationState.type as any || 'warning'}
                        onConfirm={confirmationState.onConfirm}
                        onCancel={() => setConfirmationState(prev => ({ ...prev, isOpen: false }))}
                    />

                    {(() => {
                        if (roleComposition.length === 0) return null;

                        return (
                            <div className="flex flex-col gap-2.5 pb-4 border-b border-slate-100 sticky top-0 bg-white z-30">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">דרישות תפקיד</h4>
                                    <span className="text-[10px] font-bold text-slate-400">
                                        {/* Clarify that this is the sum of roles */}
                                        סד"כ נדרש: {totalRequired} (סה"כ תפקידים)
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {roleComposition.map((rc, idx) => {
                                        const role = roles.find(r => r.id === rc.roleId);
                                        // Use our smart count
                                        const currentCount = allocationMap.get(rc.roleId) || 0;
                                        const isMet = currentCount >= rc.count;

                                        return (
                                            <div
                                                key={idx}
                                                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all shadow-sm border ${isMet
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200/50'
                                                    : 'bg-red-50 text-red-700 font-black border-red-200 animate-in zoom-in-95'}`}
                                            >
                                                {isMet ? (
                                                    <CheckCircle size={14} className="text-emerald-500" />
                                                ) : (
                                                    <AlertTriangle size={14} className="text-red-500" />
                                                )}
                                                <span>{role?.name || 'תפקיד'}</span>
                                                <span className={`px-2 py-0.5 rounded-lg text-xs font-black ${isMet ? 'bg-emerald-100/50' : 'bg-red-100'}`}>
                                                    {currentCount}/{rc.count}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })()}

                    <div className="flex-1 overflow-hidden flex flex-col md:flex-row min-h-0 bg-white -mx-4 md:mx-0">
                        <div className={`${!isAddMode ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-80 md:border-l border-slate-100 h-full relative bg-white`}>
                            <div className="p-4 bg-slate-50/50 sticky top-0 z-10 border-b border-slate-100 flex justify-between items-center">
                                <h4 className="font-black text-slate-800 text-[11px] uppercase tracking-wider">
                                    חיילים משובצים ({assignedPeople.length})
                                </h4>
                            </div>

                            <div className="flex-1 overflow-y-auto p-0 pb-4 md:pb-0">
                                {assignedPeople.map(p => (
                                    <div key={p.id} className="flex items-center justify-between p-4 border-b border-slate-100 last:border-0 bg-white hover:bg-slate-50 transition-colors min-h-[72px]">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm ${p.color}`}>
                                                {getPersonInitials(p.name)}
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-800 text-sm">{p.name}</div>
                                                <div className="flex flex-wrap gap-1 mt-0.5">
                                                    {roles.filter(r => (p.roleIds || [p.roleId]).includes(r.id)).map(r => (
                                                        <span key={r.id} className="text-[10px] text-slate-500 bg-slate-100 px-1.5 rounded-md">
                                                            {r.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        {!isViewer && (
                                            <button
                                                onClick={() => onUnassign(selectedShift.id, p.id)}
                                                className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                                                aria-label={`הסר את ${p.name} מהמשמרת`}
                                            >
                                                <X size={18} aria-hidden="true" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                {assignedPeople.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400 gap-4">
                                        <div className="bg-slate-50 p-4 rounded-full">
                                            <User size={32} className="opacity-50" />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="font-bold text-slate-600">המשמרת ריקה</span>
                                            <span className="text-xs">הוסף חיילים כדי לאייש את המשמרת</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {currentSuggestion && (
                                <div className="mx-4 mt-4 mb-4 bg-blue-50 border border-blue-100 rounded-xl p-3 animate-fadeIn hidden md:block">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold ${currentSuggestion.person.color} ring-2 ring-white shadow-sm`}>
                                                {getPersonInitials(currentSuggestion.person.name)}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-slate-800">{currentSuggestion.person.name}</span>
                                                    <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 rounded-full font-bold flex items-center gap-0.5">
                                                        <Sparkles size={8} /> מומלץ
                                                    </span>
                                                </div>
                                                <div className="text-xs text-slate-500 leading-tight mt-0.5">{currentSuggestion.reason}</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 mt-3 pl-12">
                                        <button
                                            onClick={() => {
                                                const p = currentSuggestion.person;
                                                if (task.assignedTeamId && p.teamId !== task.assignedTeamId) {
                                                    setConfirmationState({
                                                        isOpen: true,
                                                        title: 'שיבוץ מחוץ לצוות',
                                                        message: `שים לב: משימה זו מוגדרת עבור צוות ${teams.find(t => t.id === task.assignedTeamId)?.name}. האם אתה בטוח שברצונך לשבץ את ${p.name}?`,
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
                                            }}
                                            className="flex-1 bg-blue-600 text-white text-xs h-8 rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-sm"
                                        >
                                            שבץ את {currentSuggestion.person.name.split(' ')[0]}
                                        </button>
                                        <button onClick={handleNextSuggestion} className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 text-slate-600 rounded-lg hover:border-blue-300 hover:text-blue-600">
                                            <RotateCcw size={14} />
                                        </button>
                                        <button onClick={() => setSuggestedCandidates([])} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600">
                                            <X size={14} />
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="p-4 bg-white border-t border-slate-100 flex flex-col gap-3 md:hidden z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                                <Button
                                    onClick={() => setIsAddMode(true)}
                                    className="w-full h-12 text-lg font-bold bg-blue-600 hover:bg-blue-700 shadow-blue-200 shadow-lg"
                                >
                                    <Plus className="ml-2" size={20} />
                                    הוסף חיילים
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={onClose}
                                    className="w-full h-10 border-slate-200 text-slate-600"
                                >
                                    סיום
                                </Button>
                            </div>
                        </div>

                        {!isViewer && (
                            <div className={`${isAddMode ? 'flex' : 'hidden'} md:flex flex-1 flex-col min-h-0 bg-slate-50/30`}>
                                <div className="p-4 bg-white border-b border-slate-100 sticky top-0 z-20">
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => setIsAddMode(false)}
                                            className="md:hidden w-10 h-10 flex items-center justify-center bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 active:scale-95 transition-all"
                                        >
                                            <ChevronRight size={20} />
                                        </button>
                                        <div className="relative flex items-center flex-1">
                                            <Search className="absolute right-3 text-slate-400" size={16} />
                                            <input
                                                type="text"
                                                placeholder="חפש חייל או תפקיד..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className="w-full pl-10 pr-9 py-2.5 bg-slate-100 border-transparent focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 rounded-xl text-sm font-medium transition-all outline-none"
                                            />
                                            <div className="absolute left-1.5 flex items-center gap-1">
                                                <button
                                                    onClick={handleSuggestBest}
                                                    title="הצע לי שיבוץ חכם"
                                                    className="w-7 h-7 flex items-center justify-center bg-white text-blue-600 rounded-lg shadow-sm border border-slate-100 hover:border-blue-300 hover:shadow-md transition-all active:scale-95"
                                                >
                                                    <Wand2 size={14} aria-hidden="true" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar pb-1">
                                        <button
                                            onClick={() => setSelectedRoleFilter('')}
                                            className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-bold transition-colors ${!selectedRoleFilter ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}
                                        >
                                            הכל
                                        </button>
                                        {roles.map(r => (
                                            <button
                                                key={r.id}
                                                onClick={() => setSelectedRoleFilter(selectedRoleFilter === r.id ? '' : r.id)}
                                                className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-bold transition-colors ${selectedRoleFilter === r.id ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-white border border-slate-200 text-slate-600'}`}
                                            >
                                                {r.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {currentSuggestion && (
                                    <div className="mx-4 mt-2 mb-2 bg-blue-50 border border-blue-100 rounded-xl p-3 animate-fadeIn block md:hidden">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold ${currentSuggestion.person.color} ring-2 ring-white shadow-sm`}>
                                                    {getPersonInitials(currentSuggestion.person.name)}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-slate-800">{currentSuggestion.person.name}</span>
                                                        <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 rounded-full font-bold flex items-center gap-0.5">
                                                            <Sparkles size={8} /> מומלץ
                                                        </span>
                                                    </div>
                                                    <div className="text-xs text-slate-500 leading-tight mt-0.5">{currentSuggestion.reason}</div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 mt-3 pl-12">
                                            <button
                                                onClick={() => handleAttemptAssign(currentSuggestion.person.id)}
                                                className="flex-1 bg-blue-600 text-white text-xs h-8 rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-sm"
                                            >
                                                שבץ את {currentSuggestion.person.name.split(' ')[0]}
                                            </button>
                                            <button onClick={handleNextSuggestion} className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 text-slate-600 rounded-lg hover:border-blue-300 hover:text-blue-600">
                                                <RotateCcw size={14} />
                                            </button>
                                            <button onClick={() => setSuggestedCandidates([])} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600">
                                                <X size={14} />
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="flex-1 overflow-y-auto px-4 pb-2">
                                    {(() => {
                                        const groupedPeople = teams.map(team => ({
                                            team,
                                            members: availablePeople.filter(p => p.teamId === team.id)
                                        })).filter(g => g.members.length > 0);

                                        if (task.assignedTeamId) {
                                            groupedPeople.sort((a, b) => {
                                                if (a.team.id === task.assignedTeamId) return -1;
                                                if (b.team.id === task.assignedTeamId) return 1;
                                                return 0;
                                            });
                                        }

                                        if (groupedPeople.length === 0) {
                                            return (
                                                <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2 opacity-60">
                                                    <Search size={32} strokeWidth={1.5} />
                                                    <span className="text-sm">לא נמצאו חיילים זמינים</span>
                                                </div>
                                            );
                                        }

                                        return groupedPeople.map(group => {
                                            const isCollapsed = collapsedTeams.has(group.team.id);
                                            return (
                                                <div key={group.team.id} className="mb-2 last:mb-20">
                                                    <div
                                                        onClick={() => toggleTeam(group.team.id)}
                                                        className="flex items-center justify-between gap-2 mb-2 sticky top-0 bg-slate-50 p-2 z-10 mx-[-16px] px-4 border-b border-slate-100 shadow-sm cursor-pointer hover:bg-slate-100"
                                                        role="button"
                                                        aria-expanded={!isCollapsed}
                                                        aria-controls={`team-panel-${group.team.id}`}
                                                        tabIndex={0}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' || e.key === ' ') {
                                                                e.preventDefault();
                                                                toggleTeam(group.team.id);
                                                            }
                                                        }}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-1 h-4 rounded-full ${group.team.color?.replace('border-', 'bg-') || 'bg-slate-400'}`}></div>
                                                            <h5 className="font-bold text-slate-500 text-xs uppercase tracking-wider">{group.team.name}</h5>
                                                            <span className="bg-white border border-slate-200 text-slate-600 text-[10px] px-1.5 rounded-full font-mono">{group.members.length}</span>
                                                        </div>
                                                        <ChevronDown
                                                            size={16}
                                                            className={`text-slate-400 transition-transform duration-200 ${isCollapsed ? '-rotate-90 rtl:rotate-90' : ''}`}
                                                            aria-hidden="true"
                                                        />
                                                    </div>

                                                    {!isCollapsed && (
                                                        <div className="bg-white border border-slate-100 rounded-xl shadow-sm divide-y divide-slate-50 overflow-hidden animate-in slide-in-from-top-2 duration-200">
                                                            {group.members.map(p => {
                                                                const hasRole = !task.roleComposition || task.roleComposition.length === 0 || task.roleComposition.some(rc => (p.roleIds || [p.roleId]).includes(rc.roleId));
                                                                const isFull = assignedPeople.length >= task.requiredPeople;
                                                                const canAssign = hasRole;

                                                                return (
                                                                    <div
                                                                        key={p.id}
                                                                        onClick={() => {
                                                                            if (!canAssign) return;
                                                                            handleAttemptAssign(p.id);
                                                                        }}
                                                                        className={`flex items-center justify-between p-3 transition-colors ${canAssign ? 'cursor-pointer hover:bg-blue-50/50' : 'opacity-50 cursor-not-allowed grayscale'}`}
                                                                        role={canAssign ? 'button' : undefined}
                                                                        tabIndex={canAssign ? 0 : -1}
                                                                        aria-label={`שבץ את ${p.name}`}
                                                                        aria-disabled={!canAssign}
                                                                        onKeyDown={(e) => {
                                                                            if (canAssign && (e.key === 'Enter' || e.key === ' ')) {
                                                                                e.preventDefault();
                                                                                handleAttemptAssign(p.id);
                                                                            }
                                                                        }}
                                                                    >
                                                                        <div className="flex items-center gap-3 min-w-0">
                                                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm ${p.color}`}>
                                                                                {getPersonInitials(p.name)}
                                                                            </div>
                                                                            <div className="flex flex-col min-w-0">
                                                                                <span className="font-bold text-slate-800 text-sm truncate bg-transparent">{p.name}</span>
                                                                                <div className="flex items-center gap-1 mt-0.5">
                                                                                    {roles.filter(r => (p.roleIds || [p.roleId]).includes(r.id)).map(r => (
                                                                                        <span key={r.id} className="text-[10px] text-slate-500 bg-slate-100 px-1.5 rounded-md truncate max-w-[80px]">
                                                                                            {r.name}
                                                                                        </span>
                                                                                    ))}
                                                                                    {!hasRole && <span className="text-[9px] text-red-500 font-bold px-1">אין התאמה</span>}
                                                                                </div>
                                                                            </div>
                                                                        </div>

                                                                        <button
                                                                            disabled={!canAssign}
                                                                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm ${canAssign ? 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-110 active:scale-95' : 'bg-slate-100 text-slate-300 shadow-none'}`}
                                                                        >
                                                                            <Plus size={20} strokeWidth={3} aria-hidden="true" />
                                                                        </button>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    })()}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="hidden md:flex p-4 bg-white border-t border-slate-100 justify-end shrink-0 z-20">
                        <Button
                            onClick={onClose}
                            className="bg-slate-800 text-white hover:bg-slate-900 w-full md:w-auto font-bold"
                        >
                            סיום
                        </Button>
                    </div>
                </div>
            </GenericModal>


            {/* Time Editor Bottom Sheet / Modal */}
            <SheetModal
                isOpen={isEditingTime}
                onClose={() => setIsEditingTime(false)}
                title="עריכת זמנים"
                zIndex={10000}
                closeIcon="back"
            >
                <div className="flex flex-col gap-6">
                    <div className="flex items-center justify-center gap-2" dir="ltr">
                        <div className="flex flex-col items-center gap-1 w-full">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">התחלה</label>
                            <input
                                type="time"
                                value={newStart}
                                onChange={(e) => setNewStart(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-lg font-mono text-center font-bold focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                            />
                        </div>
                        <span className="text-slate-300 text-xl font-light pt-5">-</span>
                        <div className="flex flex-col items-center gap-1 w-full">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">סיום</label>
                            <input
                                type="time"
                                value={newEnd}
                                onChange={(e) => setNewEnd(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-lg font-mono text-center font-bold focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 mt-2">
                        <button
                            onClick={handleSaveTime}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-bold text-lg shadow-lg shadow-blue-200 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            <CheckCircle size={20} />
                            שמור שינויים
                        </button>

                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => { onToggleCancelShift(selectedShift.id); setIsEditingTime(false); }}
                                className={`py-3 rounded-xl font-bold text-sm border transition-colors flex items-center justify-center gap-2 ${selectedShift.isCancelled
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                    : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'}`}
                            >
                                {selectedShift.isCancelled ? <><Undo2 size={16} /> שחזר משמרת</> : <><Ban size={16} /> בטל משמרת</>}
                            </button>

                            <button
                                onClick={() => setIsEditingTime(false)}
                                className="py-3 rounded-xl font-bold text-sm text-slate-500 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors"
                            >
                                ביטול
                            </button>
                        </div>
                    </div>
                </div>
            </SheetModal>
        </>
    );
};
