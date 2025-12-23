import React, { useState, useMemo, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Modal as GenericModal } from './ui/Modal';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Button } from './ui/Button';
import { Shift, Person, TaskTemplate, Role, Team } from '../types';
import { generateShiftsForTask } from '../utils/shiftUtils';
import { getEffectiveAvailability } from '../utils/attendanceUtils';
import { TeamRotation } from '../types';
import { getPersonInitials } from '../utils/nameUtils';
import { RotateCcw, Sparkles } from 'lucide-react';
import { ChevronLeft, ChevronRight, Plus, X, Check, AlertTriangle, Clock, User, MapPin, Calendar as CalendarIcon, Pencil, Save, Trash2, Copy, CheckCircle, Ban, Undo2, ChevronDown, Search, MoreVertical, Wand2 } from 'lucide-react';
import { ConfirmationModal } from './ConfirmationModal';
import { MobileScheduleList } from './MobileScheduleList';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { analytics } from '../services/analytics';
import { supabase } from '../services/supabaseClient';
import { EmptyStateGuide } from './EmptyStateGuide';

interface ScheduleBoardProps {
    shifts: Shift[];
    people: Person[];
    taskTemplates: TaskTemplate[];
    roles: Role[];
    teams: Team[];
    constraints: import('../types').SchedulingConstraint[];
    selectedDate: Date;
    onDateChange: (date: Date) => void;
    onSelect: (shift: Shift) => void;
    onDelete: (shiftId: string) => void;
    isViewer: boolean;
    acknowledgedWarnings?: Set<string>;
    onClearDay: () => void;
    onNavigate: (view: 'personnel' | 'tasks', tab?: 'people' | 'teams' | 'roles') => void;
    onAssign: (shiftId: string, personId: string) => void;
    onUnassign: (shiftId: string, personId: string) => void;
    onAddShift?: (task: TaskTemplate, date: Date) => void;
    onUpdateShift?: (shift: Shift) => void;
    onToggleCancelShift?: (shiftId: string) => void;
    teamRotations: TeamRotation[]; // NEW
}

// Helper to calculate position based on time
const PIXELS_PER_HOUR = 60;
const START_HOUR = 0;
const HEADER_HEIGHT = 40;

const getPositionFromTime = (date: Date) => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const totalHours = hours + minutes / 60;
    return (totalHours - START_HOUR) * PIXELS_PER_HOUR;
};

const getHeightFromDuration = (start: Date, end: Date) => {
    const durationMs = end.getTime() - start.getTime();
    const durationHours = durationMs / (1000 * 60 * 60);
    return durationHours * PIXELS_PER_HOUR;
};

const hexToRgba = (hex: string, alpha: number) => {
    if (!hex) return `rgba(226, 232, 240, ${alpha})`; // Slate-200 equivalent
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const ShiftCard: React.FC<{
    shift: Shift;
    taskTemplates: TaskTemplate[];
    people: Person[];
    roles: Role[];
    teams: Team[];
    onSelect: (shift: Shift) => void;
    onToggleCancel: (shiftId: string) => void;
    isViewer: boolean;
    acknowledgedWarnings?: Set<string>;
    style?: React.CSSProperties;
}> = ({ shift, taskTemplates, people, roles, teams, onSelect, onToggleCancel, isViewer, acknowledgedWarnings, style }) => {
    const task = taskTemplates.find(t => t.id === shift.taskId);
    if (!task) return null;
    const assigned = shift.assignedPersonIds.map(id => people.find(p => p.id === id)).filter(Boolean) as Person[];

    // Calc required for display
    const segment = task.segments?.find(s => s.id === shift.segmentId) || task.segments?.[0];
    const req = shift.requirements?.requiredPeople || segment?.requiredPeople || 1;

    // Check for missing roles (not just mismatches)
    const roleComposition = shift.requirements?.roleComposition || segment?.roleComposition || [];
    const missingRoles = roleComposition.filter(rc => {
        const currentCount = assigned.filter(p => p.roleIds.includes(rc.roleId)).length;
        return currentCount < rc.count;
    }).map(rc => roles.find(r => r.id === rc.roleId)?.name).filter(Boolean);

    const hasMissingRoles = missingRoles.length > 0;

    // Determine status color
    let bgColor = 'bg-blue-50';
    let borderColor = 'border-blue-200';
    if (shift.isCancelled) { bgColor = 'bg-slate-100'; borderColor = 'border-slate-300'; }
    else if (shift.assignedPersonIds.length === 0) { bgColor = 'bg-white'; }
    else if (task.segments && task.segments.length > 0) {
        if (shift.assignedPersonIds.length >= req && !hasMissingRoles) {
            bgColor = 'bg-green-50';
            borderColor = 'border-green-200';
        } else if (hasMissingRoles) {
            // Even if full by count, if missing roles, warning color
            bgColor = 'bg-amber-50';
            borderColor = 'border-amber-200';
        }
    }

    // Role mismatch check (existing logic, checks if assigned person fits ANY required role)
    const hasRoleMismatch = assigned.some(p => {
        const requiredRoleIds = roleComposition.map(rc => rc.roleId);
        if (requiredRoleIds.length === 0) return false;

        const isMismatch = !p.roleIds.some(rid => requiredRoleIds.includes(rid));
        return isMismatch && (!acknowledgedWarnings || !acknowledgedWarnings.has(`${shift.id}-${p.id}`));
    });

    // NEW: Check for Team Mismatch
    const assignedTeamId = task.assignedTeamId;
    const hasTeamMismatch = assignedTeamId && assigned.some(p => p.teamId !== assignedTeamId);

    return (
        <div
            id={`shift-card-${shift.id}`}
            className={`absolute flex flex-col p-1.5 rounded-md border text-xs cursor-pointer transition-all overflow-hidden ${bgColor} ${borderColor} hover:border-blue-400 group justify-between shadow-sm`}
            style={style}
            onClick={(e) => { e.stopPropagation(); onSelect(shift); }}
            title={hasMissingRoles ? `חסרים תפקידים: ${missingRoles.join(', ')}` : undefined}
        >
            {/* Top Row: Task Name & Actions */}
            <div className="flex font-bold truncate text-slate-800 text-[11px] md:text-sm justify-between items-start">
                <div className="flex items-center gap-1 truncate w-full">
                    {shift.isCancelled && <Ban size={12} className="text-red-500 mr-1 shrink-0" />}

                    {/* Inline Warnings */}
                    {hasRoleMismatch && !hasMissingRoles && (
                        <AlertTriangle size={12} className="text-amber-500 shrink-0" />
                    )}
                    {hasMissingRoles && (
                        <AlertTriangle size={12} className="text-red-500 drop-shadow-sm shrink-0" />
                    )}
                    {hasTeamMismatch && (
                        <AlertTriangle size={12} className="text-orange-500 shrink-0" title="ישנם משובצים שאינם מהצוות המוגדר!" />
                    )}

                    {task.assignedTeamId && (
                        <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded shadow-sm mr-1 shrink-0 font-bold tracking-tight">
                            {teams.find(t => t.id === task.assignedTeamId)?.name}
                        </span>
                    )}
                    <span className="truncate">{task.name}</span>
                </div>
                {!isViewer && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onToggleCancel(shift.id); }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-slate-200 rounded transition-opacity shrink-0 ml-1"
                        title={shift.isCancelled ? 'הפעל משמרת' : 'בטל משמרת'}
                    >
                        {shift.isCancelled ? <RotateCcw size={12} className="text-blue-500" /> : <Ban size={12} className="text-slate-400 hover:text-red-500" />}
                    </button>
                )}
            </div>

            {/* Middle Row - Names (Adaptive - Desktop Only) */}
            {(style?.height && parseInt(String(style.height)) >= 50 && assigned.length > 0) && (
                <div className="hidden md:flex flex-1 flex-col justify-center items-center gap-1 overflow-hidden py-1 w-full px-1">
                    {assigned.map(p => (
                        <div
                            key={p.id}
                            className={`shadow-sm border border-slate-200/60 bg-white/95 px-3 py-1 rounded-full text-xs font-bold text-slate-800 truncate w-full max-w-[95%] text-center hover:scale-105 transition-transform hover:shadow-md cursor-help z-10`}
                            title={p.name}
                            onClick={(e) => { e.stopPropagation(); onSelect(shift); }}
                        >
                            {p.name}
                        </div>
                    ))}
                </div>
            )}

            {/* Bottom Row: Info & Avatars (Fallback) */}
            <div className={`flex items-end justify-between ${!(style?.height && parseInt(String(style.height)) >= 50 && assigned.length > 0) ? 'mt-auto' : ''} pt-1 w-full overflow-hidden`}>

                {/* Staffing Count */}
                <div className={`text-[10px] font-medium leading-none flex-shrink-0 ml-1 mb-0.5 ${hasMissingRoles ? 'text-red-500 font-bold' : 'text-slate-400'}`}>
                    {assigned.length}/{req}
                </div>

                {/* Avatars Logic */}
                {(assigned.length > 0) && (
                    <div className={`flex -space-x-1.5 space-x-reverse overflow-hidden px-1 pb-0.5 ${(style?.height && parseInt(String(style.height)) >= 50) ? 'md:hidden' : ''}`}>
                        {assigned.map(p => (
                            <div key={p.id} className={`w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center text-[9px] md:text-[10px] text-white font-bold ring-2 ring-white ${p.color} shadow-sm`} title={p.name}>
                                {getPersonInitials(p.name)}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export const ScheduleBoard: React.FC<ScheduleBoardProps> = ({
    shifts, people, taskTemplates, roles, teams, constraints,
    selectedDate, onDateChange, onSelect, onDelete, isViewer,
    acknowledgedWarnings: propAcknowledgedWarnings, onClearDay, onNavigate, onAssign,
    onUnassign, onAddShift, onUpdateShift, onToggleCancelShift, teamRotations
}) => {
    // Scroll Synchronization Refs
    const headerScrollRef = useRef<HTMLDivElement>(null);
    const bodyScrollRef = useRef<HTMLDivElement>(null);

    // Synchronize horizontal scrolling between header and body
    useEffect(() => {
        const headerElement = headerScrollRef.current;
        const bodyElement = bodyScrollRef.current;

        if (!headerElement || !bodyElement) return;

        const handleHeaderScroll = () => {
            if (bodyElement.scrollLeft !== headerElement.scrollLeft) {
                bodyElement.scrollLeft = headerElement.scrollLeft;
            }
        };

        const handleBodyScroll = () => {
            if (headerElement.scrollLeft !== bodyElement.scrollLeft) {
                headerElement.scrollLeft = bodyElement.scrollLeft;
            }
        };

        headerElement.addEventListener('scroll', handleHeaderScroll);
        bodyElement.addEventListener('scroll', handleBodyScroll);

        return () => {
            headerElement.removeEventListener('scroll', handleHeaderScroll);
            bodyElement.removeEventListener('scroll', handleBodyScroll);
        };
    }, []);
    const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
    const selectedShift = useMemo(() => shifts.find(s => s.id === selectedShiftId), [shifts, selectedShiftId]);
    const [isLoadingWarnings, setIsLoadingWarnings] = useState(false);
    const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(new Set());
    const [confirmationState, setConfirmationState] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        confirmText?: string;
        type?: 'warning' | 'danger' | 'info';
    }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });
    const [newStart, setNewStart] = useState('');
    const [newEnd, setNewEnd] = useState('');
    const [isEditingTime, setIsEditingTime] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('');
    const [viewerDaysLimit, setViewerDaysLimit] = useState(2);
    const now = new Date();
    // Local state for warnings
    const [localAcknowledgedWarnings, setLocalAcknowledgedWarnings] = useState<Set<string>>(new Set());
    const acknowledgedWarnings = propAcknowledgedWarnings || localAcknowledgedWarnings;
    const setAcknowledgedWarnings = setLocalAcknowledgedWarnings;

    // Helper to resolve warnings based on prop or local state
    // If prop is provided, we can't set it locally easily without callback. 
    // For now assuming local handling to match previous logic found in file.

    const renderFeaturedCard = () => null; // Placeholder to fix build error
    const handleExportToClipboard = async () => { }; // Placeholder
    const dateInputRef = useRef<HTMLInputElement>(null);

    // Measure header height for sticky stacking - REMOVED per user request
    // The simplified layout relies on flexbox and overflow-auto



    const { organization } = useAuth();
    const { showToast } = useToast();


    useEffect(() => {
        if (selectedShift) {
            setNewStart(new Date(selectedShift.startTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }));
            setNewEnd(new Date(selectedShift.endTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }));
        }
    }, [selectedShift]);

    useEffect(() => {
        const fetchSettings = async () => {
            if (!organization) return;
            try {
                const { data, error } = await supabase
                    .from('organization_settings')
                    .select('viewer_schedule_days')
                    .eq('organization_id', organization.id)
                    .maybeSingle();

                if (data) {
                    setViewerDaysLimit(data.viewer_schedule_days || 7);
                }
            } catch (err) {
                console.error('Failed to fetch board settings', err);
            }
        };
        fetchSettings();
    }, [organization]);

    const toggleTeamCollapse = (teamId: string) => {
        const newSet = new Set(collapsedTeams);
        if (newSet.has(teamId)) newSet.delete(teamId);
        else newSet.add(teamId);
        setCollapsedTeams(newSet);
    };

    const assignedPeople = useMemo(() =>
        selectedShift ? selectedShift.assignedPersonIds.map(id => people.find(p => p.id === id)).filter(Boolean) as Person[] : []
        , [selectedShift, people]);


    // Calculate overlapping shifts for the selected shift
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
        if (!selectedShift) return [];
        const task = taskTemplates.find(t => t.id === selectedShift.taskId);
        if (!task) return [];

        return people.filter(p => {
            // 1. Exclude if already assigned (to this shift)
            if (selectedShift.assignedPersonIds.includes(p.id)) return false;

            // 2. Check Availability (Rotations + Manual + Unavailability)
            // 2. Check Availability (Rotations + Manual + Unavailability)
            const availability = getEffectiveAvailability(p, selectedDate, teamRotations);

            // If Manually marked "Present" (available), we explicitly show them
            if (availability.source === 'manual' && availability.isAvailable) {
                // Keep them, ignore legacy unavailableDates
                // Otherwise check calculated availability
                if (!availability.isAvailable) return false;
            }

            // 3. Overlap Check (Busy in other shift)
            if (overlappingShifts.some(s => s.assignedPersonIds.includes(p.id))) return false;

            // 4. Role check - REMOVED strict filter to allow viewing mismatched candidates (UI handles disabling)
            // The render loop will mark them as "No Match"

            // 5. Role Filter (Dropdown in UI) - This is a user-initiated filter, so we KEEP it
            if (selectedRoleFilter) {
                const currentRoleIds = p.roleIds || [p.roleId];
                if (!currentRoleIds.includes(selectedRoleFilter)) return false;
            }

            // 6. Search Term
            if (searchTerm) {
                return p.name.includes(searchTerm) || (p.phone && p.phone.includes(searchTerm));
            }

            return true;
        });
    }, [people, selectedShift, selectedDate, searchTerm, taskTemplates, overlappingShifts, selectedRoleFilter, teamRotations]);


    const AssignmentModal = () => {
        const [suggestedCandidates, setSuggestedCandidates] = useState<{ person: Person, reason: string }[]>([]);
        const [suggestionIndex, setSuggestionIndex] = useState(0);
        const [isMenuOpen, setIsMenuOpen] = useState(false);
        const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(new Set());

        const toggleTeam = (teamId: string) => {
            setCollapsedTeams(prev => {
                const next = new Set(prev);
                if (next.has(teamId)) next.delete(teamId);
                else next.add(teamId);
                return next;
            });
        };

        if (!selectedShift) return null;
        const task = taskTemplates.find(t => t.id === selectedShift.taskId)!;

        const handleSuggestBest = () => {
            // 1. Identify Missing Roles
            const segment = task.segments?.find(s => s.id === selectedShift.segmentId) || task.segments?.[0];
            const roleComposition = selectedShift.requirements?.roleComposition || segment?.roleComposition || [];

            // Get currently assigned people for this comparison
            const currentAssigned = selectedShift.assignedPersonIds.map(id => people.find(p => p.id === id)).filter(Boolean) as Person[];

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

                // Basic Availability Checks
                if (selectedShift.assignedPersonIds.includes(p.id)) score -= 10000;

                // Reconstruct variables for orphaned code
                const personShifts = shifts.filter(s => s.assignedPersonIds.includes(p.id));
                const hasRestViolation = false;

                // ORPHANED CODE CONNECTS HERE
                if (hasRestViolation) {
                    score -= 1000; // Heavy penalty for rest violation
                    reasons.push('מנוחה לא מספקת');
                }

                // Conflict Check (Overlapping)
                const hasOverlap = personShifts.some(s => {
                    const sStart = new Date(s.startTime);
                    const sEnd = new Date(s.endTime);
                    const thisStart = new Date(selectedShift.startTime);
                    const thisEnd = new Date(selectedShift.endTime);
                    return sStart < thisEnd && sEnd > thisStart;
                });

                if (hasOverlap) {
                    score -= 5000; // Disqualify
                    reasons.push('חפיפה עם משמרת אחרת');
                }

                // NEW: Missing Role Bonus
                if (missingRoleIds.length > 0) {
                    const fillsMissingRole = p.roleIds.some(rid => missingRoleIds.includes(rid));
                    if (fillsMissingRole) {
                        score += 500;
                        reasons.push('מתאים לתפקיד חסר');
                    }
                }

                // NEW: Team Check
                if (task.assignedTeamId && p.teamId !== task.assignedTeamId) {
                    score -= 2000; // Penalize non-team members
                    reasons.push('צוות לא תואם');
                }

                return { person: p, score, reasons };
            });

            // 3. Sort and Filter
            const validCandidates = candidates
                .filter(c => c.score > -4000) // Filter out hard conflicts
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
            const [sh, sm] = newStart.split(':').map(Number);
            const [eh, em] = newEnd.split(':').map(Number);

            const s = new Date(selectedShift.startTime);
            s.setHours(sh, sm);
            const e = new Date(selectedShift.endTime);
            e.setHours(eh, em);

            if (e.getTime() < s.getTime()) {
                e.setDate(e.getDate() + 1);
            } else if (e.getDate() !== s.getDate()) {
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

        return (
            <GenericModal
                isOpen={true}
                onClose={() => setSelectedShiftId(null)}
                title={
                    isEditingTime ? (
                        <div className="flex items-center gap-2 animate-fadeIn bg-slate-50 p-1.5 rounded-lg border border-blue-200 shadow-sm w-full">
                            <span className="text-sm font-bold text-slate-500 whitespace-nowrap">עריכת זמנים:</span>
                            <input type="time" value={newStart} onChange={e => setNewStart(e.target.value)} className="p-1 rounded border border-slate-300 text-xs w-20 text-center font-bold" />
                            <span className="text-slate-400">-</span>
                            <input type="time" value={newEnd} onChange={e => setNewEnd(e.target.value)} className="p-1 rounded border border-slate-300 text-xs w-20 text-center font-bold" />
                            <div className="flex-1"></div>
                            <button onClick={handleSaveTime} className="p-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"><Save size={16} /></button>
                            <button onClick={() => setIsEditingTime(false)} className="p-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"><X size={16} /></button>
                        </div>
                    ) : (
                        <div className="flex flex-col">
                            <div className="flex items-start justify-between">
                                <span className="text-xl font-bold text-slate-900">{task.name}</span>
                                {!isViewer && (
                                    <div className="relative -mt-1 -ml-2">
                                        <button
                                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                                            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
                                        >
                                            <MoreVertical size={20} />
                                        </button>
                                        {isMenuOpen && (
                                            <div className="absolute left-0 top-full mt-1 bg-white shadow-xl rounded-xl border border-slate-100 w-48 z-50 overflow-hidden text-right animate-in fade-in zoom-in-95 origin-top-left">
                                                <button
                                                    onClick={() => { setIsEditingTime(true); setIsMenuOpen(false); }}
                                                    className="w-full px-4 py-3 hover:bg-slate-50 flex items-center gap-2 text-sm text-slate-700 font-medium"
                                                >
                                                    <Pencil size={16} className="text-blue-500" /> ערוך זמנים
                                                </button>
                                                <div className="h-px bg-slate-100 my-0"></div>
                                                <button
                                                    onClick={() => { onToggleCancelShift(selectedShift.id); setSelectedShiftId(null); }}
                                                    className={`w-full px-4 py-3 flex items-center gap-2 text-sm font-medium ${selectedShift.isCancelled ? 'hover:bg-green-50 text-green-600' : 'hover:bg-red-50 text-red-600'}`}
                                                >
                                                    {selectedShift.isCancelled ? <><Undo2 size={16} /> שחזר משמרת</> : <><Ban size={16} /> בטל משמרת</>}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-3 text-sm text-slate-500 font-medium mt-1">
                                <div className="flex items-center gap-1.5">
                                    <CalendarIcon size={14} className="text-slate-400" />
                                    {new Date(selectedShift.startTime).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })}
                                </div>
                                <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                                <div dir="ltr" className="flex items-center gap-1.5 font-mono">
                                    <Clock size={14} className="text-slate-400" />
                                    {new Date(selectedShift.startTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                    -
                                    {new Date(selectedShift.endTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        </div>
                    )
                }
                size="2xl"
                scrollableContent={false}
            >
                <div className="flex flex-col h-full overflow-hidden max-h-[80dvh]">

                    {/* Requirements Header & Badges */}
                    {(() => {
                        const segment = task.segments?.find(s => s.id === selectedShift.segmentId) || task.segments?.[0];
                        const roleComposition = selectedShift.requirements?.roleComposition || segment?.roleComposition || [];
                        if (roleComposition.length === 0) return null;

                        return (
                            <div className="flex flex-col gap-2.5 pb-4 border-b border-slate-100 sticky top-0 bg-white z-30">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">דרישות תפקיד</h4>
                                    <span className="text-[10px] font-bold text-slate-400">
                                        סד"כ נדרש: {selectedShift.requirements?.requiredPeople || segment?.requiredPeople || 0}
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {roleComposition.map((rc, idx) => {
                                        const role = roles.find(r => r.id === rc.roleId);
                                        const currentCount = assignedPeople.filter(p => (p.roleIds || [p.roleId]).includes(rc.roleId)).length;
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
                        {/* LEFT COLUMN: Assigned */}
                        <div className="flex-none max-h-[30vh] md:max-h-none md:w-80 overflow-y-auto flex flex-col border-b md:border-b-0 md:border-l border-slate-100">
                            <div className="p-4 bg-slate-50/50 sticky top-0 z-10 border-b border-slate-100">
                                <h4 className="font-black text-slate-800 text-[11px] uppercase tracking-wider">
                                    חיילים משובצים ({assignedPeople.length})
                                </h4>
                            </div>


                            <div className="p-0">
                                {assignedPeople.map(p => (
                                    <div key={p.id} className="flex items-center justify-between p-4 border-b border-slate-100 last:border-0 bg-white hover:bg-slate-50 transition-colors group">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm ${p.color}`}>
                                                {getPersonInitials(p.name)}
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-800 text-sm">{p.name}</div>
                                                {/* Role Tags */}
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
                                            >
                                                <X size={18} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                {assignedPeople.length === 0 && (
                                    <div className="py-8 text-center text-slate-400 text-sm italic">
                                        טרם שובצו חיילים
                                    </div>
                                )}
                            </div>

                            {/* Smart Suggestion Block (Compact) */}
                            {currentSuggestion && (
                                <div className="mx-4 mt-4 mb-4 bg-blue-50 border border-blue-100 rounded-xl p-3 animate-fadeIn">
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

                        </div>

                        {/* RIGHT COLUMN: Available (Search + List) */}
                        {!isViewer && (
                            <div className="flex-1 flex flex-col min-h-0 bg-slate-50/30">
                                {/* Search Bar Area */}
                                <div className="p-4 bg-white border-b border-slate-100 sticky top-0 z-20">
                                    <div className="relative flex items-center">
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
                                                <Wand2 size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Quick Filters (Optional, implied by 'Clean High Density') */}
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

                                {/* List of Candidates */}
                                <div className="flex-1 overflow-y-auto px-4 pb-2">
                                    {(() => {
                                        // Flatten the list logic for clean view
                                        const groupedPeople = teams.map(team => ({
                                            team,
                                            members: availablePeople.filter(p => p.teamId === team.id)
                                        })).filter(g => g.members.length > 0);

                                        // Sort by "Assigned Team" relevance
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
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-1 h-4 rounded-full ${group.team.color?.replace('border-', 'bg-') || 'bg-slate-400'}`}></div>
                                                            <h5 className="font-bold text-slate-500 text-xs uppercase tracking-wider">{group.team.name}</h5>
                                                            <span className="bg-white border border-slate-200 text-slate-600 text-[10px] px-1.5 rounded-full font-mono">{group.members.length}</span>
                                                        </div>
                                                        <ChevronDown
                                                            size={16}
                                                            className={`text-slate-400 transition-transform duration-200 ${isCollapsed ? '-rotate-90 rtl:rotate-90' : ''}`}
                                                        />
                                                    </div>

                                                    {!isCollapsed && (
                                                        <div className="bg-white border border-slate-100 rounded-xl shadow-sm divide-y divide-slate-50 overflow-hidden animate-in slide-in-from-top-2 duration-200">
                                                            {group.members.map(p => {
                                                                const hasRole = !task.roleComposition || task.roleComposition.length === 0 || task.roleComposition.some(rc => (p.roleIds || [p.roleId]).includes(rc.roleId));
                                                                // Disable logic from before
                                                                const isFull = assignedPeople.length >= task.requiredPeople;
                                                                const canAssign = hasRole && !isFull;

                                                                return (
                                                                    <div
                                                                        key={p.id}
                                                                        onClick={(e) => {
                                                                            if (!canAssign) return;
                                                                            // Assign Logic (Duplicated for click-row interaction)
                                                                            if (task.assignedTeamId && p.teamId !== task.assignedTeamId) {
                                                                                setConfirmationState({
                                                                                    isOpen: true,
                                                                                    title: 'שיבוץ מחוץ לצוות',
                                                                                    message: `שים לב: משימה זו מוגדרת עבור צוות ${teams.find(t => t.id === task.assignedTeamId)?.name}. האם אתה בטוח שברצונך לשבץ את ${p.name}?`,
                                                                                    onConfirm: () => {
                                                                                        onAssign(selectedShift.id, p.id);
                                                                                        setConfirmationState(prev => ({ ...prev, isOpen: false }));
                                                                                    }
                                                                                });
                                                                                return;
                                                                            }
                                                                            onAssign(selectedShift.id, p.id);
                                                                        }}
                                                                        className={`flex items-center justify-between p-3 transition-colors ${canAssign ? 'cursor-pointer hover:bg-blue-50/50' : 'opacity-50 cursor-not-allowed grayscale'}`}
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
                                                                            <Plus size={20} strokeWidth={3} />
                                                                        </button>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-4 bg-white border-t border-slate-100 flex justify-end shrink-0 z-20">
                        <Button
                            onClick={() => setSelectedShiftId(null)}
                            className="bg-slate-800 text-white hover:bg-slate-900 w-full md:w-auto font-bold"
                        >
                            סיום
                        </Button>
                    </div>
                </div>
            </GenericModal>
        );
    };





    const visibleTasks = useMemo(() => {
        const dateKey = selectedDate.toLocaleDateString('en-CA');
        const dayOfWeek = selectedDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

        return taskTemplates.filter(task => {
            if (!task.segments || task.segments.length === 0) return false;

            return task.segments.some(segment => {
                if (segment.frequency === 'daily') return true;
                if (segment.frequency === 'weekly') {
                    return segment.daysOfWeek?.includes(dayOfWeek);
                }
                if (segment.frequency === 'specific_date') {
                    return segment.specificDate === dateKey;
                }
                return false;
            });
        });
    }, [taskTemplates, selectedDate]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const maxViewerDate = new Date(today);
    maxViewerDate.setDate(today.getDate() + (viewerDaysLimit - 1));

    const isAtViewerLimit = selectedDate >= maxViewerDate;

    const canGoNext = !isViewer || !isAtViewerLimit;
    const canGoPrev = true;


    const handleDateChange = (newDate: Date) => {
        onDateChange(newDate);
        analytics.trackDateChanged(newDate.toISOString());
    };

    const handleShiftSelect = (shift: Shift) => {
        const task = taskTemplates.find(t => t.id === shift.taskId);
        if (task) {
            analytics.trackModalOpen(`shift_management:${task.name}`);
        }
        setSelectedShiftId(shift.id);
    };

    const handleExportClick = async () => {
        analytics.trackButtonClick('export_schedule', 'schedule_board');
        await handleExportToClipboard();
    };

    const handleClearDayClick = () => {
        analytics.trackButtonClick('clear_day', 'schedule_board');
        setConfirmationState({
            isOpen: true,
            title: 'ניקוי יום',
            message: 'האם אתה בטוח שברצונך למחוק את כל המשמרות של היום? פעולה זו אינה הפיכה.',
            confirmText: 'נקה יום',
            type: 'danger',
            onConfirm: () => {
                onClearDay();
                showToast('היום נוקה בהצלחה', 'success');
                setConfirmationState(prev => ({ ...prev, isOpen: false }));
            }
        });
    };

    useEffect(() => {
        const dateKey = selectedDate.toLocaleDateString('en-CA');
        analytics.trackFilterApplied('date', dateKey);
    }, [selectedDate]);

    // Calculate conflicts
    const conflicts = useMemo(() => {
        return (shifts || []).flatMap(shift => {
            const shiftStart = new Date(`${selectedDate.toISOString().split('T')[0]}T${shift.startTime}`);
            const shiftEnd = new Date(`${selectedDate.toISOString().split('T')[0]}T${shift.endTime}`);
            if (shiftEnd < shiftStart) shiftEnd.setDate(shiftEnd.getDate() + 1);

            // Ensure assignedPersonIds is an array before filtering
            const assignedIds = shift.assignedPersonIds || [];

            return assignedIds.filter(personId => {
                const person = people.find(p => p.id === personId);
                if (!person) return false;

                // Check availability
                const availability = getEffectiveAvailability(person, selectedDate, teamRotations);
                if (!availability.isAvailable) return true;

                // Check double booking
                const otherShifts = (shifts || []).filter(s =>
                    s.id !== shift.id &&
                    (s.assignedPersonIds || []).includes(personId) // Safe check here too
                );

                return otherShifts.some(s => {
                    const sStart = new Date(`${selectedDate.toISOString().split('T')[0]}T${s.startTime}`);
                    const sEnd = new Date(`${selectedDate.toISOString().split('T')[0]}T${s.endTime}`);
                    if (sEnd < sStart) sEnd.setDate(sEnd.getDate() + 1);

                    return (shiftStart < sEnd && shiftEnd > sStart);
                });
            }).map(personId => ({ shiftId: shift.id, personId }));
        });
    }, [shifts, people, selectedDate, teamRotations]);

    const getShiftConflicts = (shiftId: string) => {
        const shift = shifts.find(s => s.id === shiftId);
        if (!shift) return [];

        const shiftStart = new Date(`${selectedDate.toISOString().split('T')[0]}T${shift.startTime}`);
        const shiftEnd = new Date(`${selectedDate.toISOString().split('T')[0]}T${shift.endTime}`);
        if (shiftEnd < shiftStart) shiftEnd.setDate(shiftEnd.getDate() + 1);

        return conflicts.filter(c => c.shiftId === shiftId);
    };

    return (
        <div className="flex flex-col gap-2 h-full">
            {isViewer && renderFeaturedCard()}
            {selectedShift && <AssignmentModal />}



            {/* Time Grid Board Container */}
            <div className="bg-white rounded-xl shadow-portal p-2 flex flex-col flex-1 min-h-0">
                {/* Controls Header - Sticky */}
                <div className="flex flex-col gap-2 mb-2 flex-shrink-0 sticky top-0 z-50 bg-white pb-2 border-b border-transparent">
                    {/* Desktop Title & Stats */}
                    <div className="hidden md:flex flex-wrap items-center gap-3">
                        <h3 className="text-xl font-bold text-slate-800">מבט יומי</h3>
                        {!isViewer && (() => {
                            const dateKey = selectedDate.toLocaleDateString('en-CA');
                            const unavailableCount = people.filter(p => {
                                if (p.unavailableDates?.includes(dateKey)) return true;
                                if (p.dailyAvailability?.[dateKey]?.isAvailable === false) return true;
                                return false;
                            }).length;
                            const availableCount = people.length - unavailableCount;

                            return (
                                <div className="flex items-center gap-2 bg-gradient-to-r from-emerald-50 to-green-50 px-4 py-2 rounded-full border border-emerald-200">
                                    <User size={14} className="text-emerald-600" />
                                    <span className="text-sm font-bold text-emerald-700">
                                        זמינים: {availableCount}/{people.length}
                                    </span>
                                </div>
                            );
                        })()}
                    </div>

                    {/* Main Toolbar (Mobile Optimized) */}
                    <div className="flex flex-col md:flex-row justify-between items-center gap-2">
                        {/* Date Navigation - Primary on Mobile */}
                        <div className="w-full md:w-auto flex items-center justify-between md:justify-center bg-slate-100/50 md:bg-slate-100 rounded-xl p-1 order-1 md:order-2">
                            <Button variant="ghost" size="sm" onClick={() => { if (canGoNext) { const d = new Date(selectedDate); d.setDate(d.getDate() + 1); handleDateChange(d); } }} disabled={!canGoNext} className="rounded-lg">
                                <ChevronRight size={20} />
                            </Button>

                            <div
                                className="relative group cursor-pointer px-4 text-center flex-1 md:flex-none"
                                onClick={() => {
                                    if (dateInputRef.current) {
                                        if ('showPicker' in dateInputRef.current) {
                                            (dateInputRef.current as any).showPicker();
                                        } else {
                                            dateInputRef.current.focus();
                                            dateInputRef.current.click();
                                        }
                                    }
                                }}
                            >
                                <div className="flex flex-col items-center">
                                    <span className="text-sm md:text-base font-bold text-slate-800 group-hover:text-blue-600 transition-colors flex items-center gap-2">
                                        {selectedDate.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}
                                        <CalendarIcon size={14} className="md:hidden opacity-50" />
                                    </span>
                                </div>
                                <input
                                    ref={dateInputRef}
                                    type="date"
                                    value={selectedDate.toLocaleDateString('en-CA')}
                                    onChange={(e) => {
                                        if (e.target.valueAsDate) handleDateChange(e.target.valueAsDate);
                                    }}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    lang="he"
                                    title="בחר תאריך"
                                />
                            </div>

                            <Button variant="ghost" size="sm" onClick={() => { if (canGoPrev) { const d = new Date(selectedDate); d.setDate(d.getDate() - 1); handleDateChange(d); } }} disabled={!canGoPrev} className="rounded-lg">
                                <ChevronLeft size={20} />
                            </Button>
                        </div>

                        {/* Actions - Secondary on Mobile */}
                        <div className="w-full md:w-auto flex justify-center md:justify-start gap-2 order-2 md:order-1">
                            <button onClick={handleExportClick} className="flex-1 md:flex-none flex items-center justify-center gap-1.5 text-slate-600 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 px-3 py-2 rounded-lg font-bold text-xs transition-colors">
                                <Copy size={14} />
                                <span>העתק</span>
                            </button>
                            {!isViewer && (
                                <button onClick={handleClearDayClick} className="flex-1 md:flex-none flex items-center justify-center gap-1.5 text-slate-600 hover:text-red-600 bg-slate-50 hover:bg-red-50 border border-slate-200 hover:border-red-200 px-3 py-2 rounded-lg font-bold text-xs transition-colors">
                                    <Trash2 size={14} />
                                    <span>נקה יום</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Scrollable Grid Area */}
                <div className="flex-1 overflow-y-auto relative border-t border-slate-200">

                    {/* MOBILE VIEW */}
                    <div className="block md:hidden h-full overflow-y-auto p-4">
                        <MobileScheduleList
                            shifts={shifts}
                            people={people}
                            taskTemplates={visibleTasks} // RESPECT FILTERS
                            roles={roles}
                            teams={teams}
                            selectedDate={selectedDate}
                            isViewer={isViewer}
                            onSelectShift={handleShiftSelect}
                            onToggleCancelShift={onToggleCancelShift}
                        />
                    </div>


                    {/* DESKTOP VIEW */}
                    {/* ************************************************* */}
                    {/* GRID CONTAINER - הפריסה הדו-ממדית. אין גלילה כאן! */}
                    {/* ************************************************* */}
                    <div
                        className="hidden md:grid relative"
                        // Grid: עמודה 1 (ציר שעות) רוחב קבוע. עמודה 2 תופסת את השאר.
                        style={{ gridTemplateColumns: 'min-content 1fr' }}
                    >

                        {/* ======================================================== */}
                        {/* CELL 1,1: CORNER (הפינה הקבועה) - Sticky Right/Top */}
                        {/* ======================================================== */}
                        <div
                            className="sticky right-0 top-0 z-40 bg-slate-50 border-b border-l border-slate-200"
                            style={{ height: HEADER_HEIGHT }}
                        >
                            <div className="w-10 md:w-16 h-full flex items-center justify-center">
                                <span className="text-[10px] text-slate-500 font-bold">זמנים</span>
                            </div>
                        </div>

                        {/* ======================================================== */}
                        {/* CELL 1,2: TOP ROW (כותרות המשימות) - Sticky רק ב-TOP */}
                        {/* זה חייב להכיל את הגלילה האופקית כדי להיות מסונכרן עם CELL 2,2 */}
                        {/* ======================================================== */}
                        <div
                            // הכותרת נדבקת למעלה, ומאלצת את התוכן הפנימי לגלול אופקית.
                            ref={headerScrollRef}
                            className="sticky top-0 z-30 bg-white shadow-sm border-b border-slate-200 overflow-x-auto"
                            style={{ height: HEADER_HEIGHT }}
                        >
                            {/* Task Headers: הרוחב המינימלי יוצר את הגלילה ב-overflow-x-auto של ההורה */}
                            <div className="flex relative" style={{ minWidth: 'max-content' }}>
                                {visibleTasks.map(task => (
                                    <div
                                        key={task.id}
                                        className="w-[130px] md:w-[260px] flex-shrink-0 border-l border-b-2"
                                        style={{
                                            height: HEADER_HEIGHT,
                                            backgroundColor: hexToRgba(task.color, 0.4), // Increased visibility
                                            borderTopColor: task.color,
                                            borderTopWidth: 3,
                                            borderColor: 'rgb(241 245 249)', // slate-200 for side borders
                                            borderBottomColor: task.color
                                        }}
                                    >
                                        <h4 className="font-bold text-slate-800 text-xs md:text-sm truncate w-full px-2 pt-2 text-center">{task.name}</h4>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* ======================================================== */}
                        {/* CELL 2,1: SIDE AXIS (ציר השעות האנכי) - Sticky רק ב-RIGHT */}
                        {/* ======================================================== */}
                        <div className="sticky right-0 z-20 bg-slate-50 border-l border-slate-100">
                            {Array.from({ length: 25 }).map((_, i) => (
                                <div key={i} className="h-[60px] border-t border-dashed border-slate-300 text-[9px] md:text-xs text-slate-400 font-bold flex justify-center pt-1 relative">
                                    <span className="bg-slate-50 px-0.5 md:px-1">{i.toString().padStart(2, '0')}:00</span>
                                </div>
                            ))}
                        </div>

                        {/* ======================================================== */}
                        {/* CELL 2,2: MAIN CONTENT (גוף המשימות) - גלילה אופקית פנימית */}
                        {/* ======================================================== */}
                        <div
                            ref={bodyScrollRef}
                            className="relative overflow-x-auto"
                        >
                            {/* ה-min-w-max כאן חשוב כדי שכל המשמרות יכנסו */}
                            <div className="flex relative min-w-max">

                                {visibleTasks.map(task => {
                                    const dateKey = selectedDate.toLocaleDateString('en-CA');
                                    const taskShifts = shifts.filter(s => {
                                        if (s.taskId !== task.id) return false;
                                        const shiftStart = new Date(s.startTime);
                                        const shiftEnd = new Date(s.endTime);

                                        const dayStart = new Date(selectedDate);
                                        dayStart.setHours(0, 0, 0, 0);
                                        const dayEnd = new Date(selectedDate);
                                        dayEnd.setHours(24, 0, 0, 0);

                                        return shiftStart < dayEnd && shiftEnd > dayStart;
                                    });

                                    return (
                                        <div
                                            key={task.id}
                                            className="w-[130px] md:w-[260px] flex-shrink-0 border-l border-slate-100 relative h-[1540px]"
                                            style={{ backgroundColor: hexToRgba(task.color, 0.2) }} // Increased visibility
                                        >
                                            {/* Grid Lines */}
                                            <div className="absolute inset-0 pointer-events-none">
                                                {Array.from({ length: 25 }).map((_, i) => (
                                                    <div key={i} className="h-[60px] border-t border-dashed border-slate-300/50"></div>
                                                ))}
                                            </div>

                                            {/* Shifts */}
                                            {taskShifts.map(shift => {
                                                const shiftStart = new Date(shift.startTime);
                                                const shiftEnd = new Date(shift.endTime);
                                                const dayStart = new Date(selectedDate);
                                                dayStart.setHours(0, 0, 0, 0);
                                                const dayEnd = new Date(selectedDate);
                                                dayEnd.setHours(24, 0, 0, 0);

                                                const effectiveStart = shiftStart < dayStart ? dayStart : shiftStart;
                                                const effectiveEnd = shiftEnd > dayEnd ? dayEnd : shiftEnd;

                                                const top = getPositionFromTime(effectiveStart);
                                                const height = getHeightFromDuration(effectiveStart, effectiveEnd);
                                                const isContinuedFromPrev = shiftStart < dayStart;
                                                const isContinuedToNext = shiftEnd > dayEnd;

                                                return (
                                                    <ShiftCard
                                                        key={shift.id}
                                                        shift={shift}
                                                        taskTemplates={taskTemplates}
                                                        people={people}
                                                        roles={roles}
                                                        teams={teams}
                                                        onSelect={handleShiftSelect}
                                                        onToggleCancel={onToggleCancelShift}
                                                        isViewer={isViewer}
                                                        acknowledgedWarnings={acknowledgedWarnings}
                                                        style={{
                                                            top: `${top}px`,
                                                            height: `${Math.max(height, 30)}px`,
                                                            left: '2px',
                                                            right: '2px',
                                                            width: 'auto',
                                                            borderTopLeftRadius: isContinuedFromPrev ? 0 : undefined,
                                                            borderTopRightRadius: isContinuedFromPrev ? 0 : undefined,
                                                            borderBottomLeftRadius: isContinuedToNext ? 0 : undefined,
                                                            borderBottomRightRadius: isContinuedToNext ? 0 : undefined,
                                                            borderTop: isContinuedFromPrev ? '2px dashed rgba(0,0,0,0.1)' : undefined,
                                                            borderBottom: isContinuedToNext ? '2px dashed rgba(0,0,0,0.1)' : undefined,
                                                        }}
                                                    />
                                                );
                                            })}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Global Time Line */}
                        {/* ... (השאר את קוד קו הזמן כפי שהוא ב-Grid) ... */}
                        {(() => {
                            const currentDayKey = now.toLocaleDateString('en-CA');
                            const selectedDayKey = selectedDate.toLocaleDateString('en-CA');
                            if (currentDayKey === selectedDayKey) {
                                const top = getPositionFromTime(now) + HEADER_HEIGHT;
                                return (
                                    <div
                                        className="absolute z-[60] flex items-center pointer-events-none"
                                        style={{
                                            top: `${top}px`,
                                            gridColumn: '1 / span 2', // מכסה את שתי עמודות ה-Grid
                                            left: 0,
                                            right: 0
                                        }}
                                    >
                                        <div className="w-full h-[2px] bg-red-500 shadow-sm"></div>
                                        <div className="absolute right-0 translate-x-1/2 w-3 h-3 bg-red-600 rounded-full shadow-md"></div>
                                        <div className="absolute left-10 -translate-y-[120%] bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                                            {now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        })()}

                    </div>

                    {visibleTasks.length === 0 && (
                        <div className="absolute inset-0 col-span-full flex items-center justify-center text-slate-400 p-10">
                            אין משימות להצגה
                        </div>
                    )}

                </div>
            </div>
            {/* Confirmation Modal */}
            <ConfirmationModal
                isOpen={confirmationState.isOpen}
                title={confirmationState.title}
                message={confirmationState.message}
                onConfirm={confirmationState.onConfirm}
                onCancel={() => setConfirmationState(prev => ({ ...prev, isOpen: false }))}
                confirmText={confirmationState.confirmText || "אשר שיבוץ"}
                cancelText="ביטול"
                type={confirmationState.type || "warning"}
            />
        </div>
    );
};
