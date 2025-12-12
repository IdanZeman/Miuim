import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Shift, Person, TaskTemplate, Role, Team } from '../types';
import { getPersonInitials } from '../utils/nameUtils';
import { RotateCcw, Sparkles } from 'lucide-react';
import { ChevronLeft, ChevronRight, Plus, X, Check, AlertTriangle, Clock, User, MapPin, Calendar as CalendarIcon, Pencil, Save, Trash2, Copy, CheckCircle, Ban, Undo2, ChevronDown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirmation } from '../hooks/useConfirmation';
import { ConfirmationModal } from './ConfirmationModal';
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
    acknowledgedWarnings: Set<string>;
    onClearDay: () => void;
    onNavigate: (view: 'personnel' | 'tasks', tab?: 'people' | 'teams' | 'roles') => void;
    onAssign: (shiftId: string, personId: string) => void;
    onUnassign: (shiftId: string, personId: string) => void;
    onAddShift: (task: TaskTemplate, date: Date) => void;
    onUpdateShift: (shift: Shift) => void;
    onToggleCancelShift: (shiftId: string) => void;
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

const ShiftCard: React.FC<{
    shift: Shift;
    compact?: boolean;
    taskTemplates: TaskTemplate[];
    people: Person[];
    roles: Role[];
    onSelect: (shift: Shift) => void;
    onToggleCancel: (shiftId: string) => void;
    isViewer: boolean;
    acknowledgedWarnings: Set<string>;
    style?: React.CSSProperties;
}> = ({ shift, compact = false, taskTemplates, people, roles, onSelect, onToggleCancel, isViewer, acknowledgedWarnings, style }) => {
    const task = taskTemplates.find(t => t.id === shift.taskId);
    if (!task) return null;
    const isFull = shift.assignedPersonIds.length >= task.requiredPeople;

    const assigned = shift.assignedPersonIds
        .map(id => people.find(p => p.id === id))
        .filter(Boolean) as Person[];

    const requiredRoleIds = task.roleComposition.map(rc => rc.roleId);
    const hasMismatch = isViewer ? false : shift.assignedPersonIds.some(pid => {
        const person = people.find(p => p.id === pid);
        if (!person) return false;

        const warningId = `${shift.id}-${pid}`;
        if (acknowledgedWarnings.has(warningId)) return false;

        return !person.roleIds.some(rid => requiredRoleIds.includes(rid));
    });

    return (
        <div
            id={`shift-card-${shift.id}`}
            onClick={() => onSelect(shift)}
            style={style}
            className={`absolute w-full p-2 rounded-lg shadow-sm border-2 cursor-pointer hover:shadow-md transition-all group overflow-hidden flex flex-col ${shift.isCancelled
                ? 'bg-slate-100 border-slate-300 opacity-75 grayscale'
                : hasMismatch
                    ? 'bg-red-50 border-red-500 animate-pulse'
                    : 'bg-white border-slate-100'
                }`}
        >
            {/* Cancelled Overlay Line */}
            {shift.isCancelled && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                    <div className="w-full h-0.5 bg-red-500 rotate-12 transform origin-center"></div>
                </div>
            )}

            {/* Color Indicator Strip */}
            <div className={`absolute top-0 right-0 w-1 h-full ${task.color.replace('border-l-', 'bg-')}`}></div>

            {/* Cancel/Undo Action (Visible on Hover) - NO CONFIRM - Hidden for Viewers */}
            {!isViewer && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleCancel(shift.id);
                    }}
                    className={`absolute top-1 left-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 p-0.5 rounded-full transition-all z-20 ${shift.isCancelled
                        ? 'text-green-600 hover:text-green-700 bg-green-50'
                        : 'text-slate-400 hover:text-red-500 bg-white/80'
                        }`}
                    title={shift.isCancelled ? "שחזר משמרת" : "בטל משמרת"}
                >
                    {shift.isCancelled ? <Undo2 size={14} /> : <Ban size={14} />}
                </button>
            )}

            <div className={`flex justify-between items-start mb-1 pr-2 relative z-0 ${shift.isCancelled ? 'line-through decoration-red-500 decoration-2' : ''}`}>
                <div className="flex-1 min-w-0">
                    <div className="font-bold text-xs text-slate-800 leading-tight truncate">{task.name}</div>
                    <div className="text-[9px] font-bold text-slate-400 flex items-center gap-1">
                        <span dir="ltr" className="flex items-center gap-1">
                            {new Date(shift.startTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                            <span>-</span>
                            {new Date(shift.endTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                    {isFull
                        ? <div className="text-green-600"><Check size={10} /></div>
                        : <div className="bg-slate-100 text-slate-400 px-1 rounded text-[9px] font-bold">{shift.assignedPersonIds.length}/{task.requiredPeople}</div>
                    }
                    {hasMismatch && (
                        <AlertTriangle size={10} className="text-red-500" />
                    )}
                </div>
            </div>

            <div className="space-y-1 pr-2 relative z-0 overflow-y-auto custom-scrollbar">
                {assigned.length === 0 ? (
                    <div className="flex items-center gap-1 text-slate-400 text-[10px] bg-slate-50 p-1 rounded border border-slate-100 border-dashed">
                        <User size={10} />
                        <span>טרם שובצו</span>
                    </div>
                ) : (
                    assigned.map(p => {
                        const isQualified = isViewer ? true : p.roleIds.some(rid => requiredRoleIds.includes(rid));
                        const warningId = `${shift.id}-${p.id}`;
                        const isAcknowledged = isViewer ? true : acknowledgedWarnings.has(warningId);
                        const showAsQualified = isQualified || isAcknowledged;

                        return (
                            <div
                                key={p.id}
                                className={`flex items-center gap-1.5 p-1 rounded border ${showAsQualified
                                    ? 'bg-slate-50 border-slate-100'
                                    : 'bg-red-100 border-red-500'
                                    }`}
                            >
                                <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] text-white font-bold shadow-sm ${p.color}`}>
                                    {getPersonInitials(p.name)}
                                </div>
                                <span className={`text-[10px] font-bold truncate ${showAsQualified ? 'text-slate-700' : 'text-red-900'}`}>
                                    {p.name}
                                </span>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};
export const ScheduleBoard: React.FC<ScheduleBoardProps> = (props) => {
    const {
        shifts,
        people,
        taskTemplates,
        roles,
        teams,
        constraints, // Destructure constraints
        selectedDate,
        onDateChange,
        onAssign,
        onUnassign,
        onAddShift,
        onUpdateShift,
        onToggleCancelShift,
        onClearDay,
        onNavigate
    } = props;

    const { profile, organization } = useAuth();
    const isViewer = profile?.role === 'viewer';

    const isEmptyState = taskTemplates.length === 0 || people.length === 0 || roles.length === 0;

    if (isEmptyState && !isViewer) {
        return (
            <EmptyStateGuide
                hasTasks={taskTemplates.length > 0}
                hasPeople={people.length > 0}
                hasRoles={roles.length > 0}
                onNavigate={onNavigate}
            />
        );
    }
    const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
    const [viewerDaysLimit, setViewerDaysLimit] = useState(2);

    const { showToast } = useToast();
    const { confirm, modalProps } = useConfirmation();

    const [isLoadingWarnings, setIsLoadingWarnings] = useState(!isViewer);
    const [acknowledgedWarnings, setAcknowledgedWarnings] = useState<Set<string>>(new Set());
    const dateInputRef = useRef<HTMLInputElement>(null);
    const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(new Set());
    const toggleTeamCollapse = (teamId: string) => {
        setCollapsedTeams(prev => {
            const next = new Set(prev);
            if (next.has(teamId)) next.delete(teamId);
            else next.add(teamId);
            return next;
        });
    };



    // Time tracking for Global Time Line
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (isViewer) {
            setIsLoadingWarnings(false);
            return;
        }

        const loadAcknowledgedWarnings = async () => {
            if (!organization?.id) {
                setIsLoadingWarnings(false);
                return;
            }

            const { data, error } = await supabase
                .from('acknowledged_warnings')
                .select('warning_id')
                .eq('organization_id', organization.id);

            if (error) {
                console.error('Error loading acknowledged warnings:', error);
                setIsLoadingWarnings(false);
                return;
            }

            if (data) {
                const warningIds = new Set(data.map(w => w.warning_id));
                setAcknowledgedWarnings(warningIds);
            }

            setIsLoadingWarnings(false);
        };

        loadAcknowledgedWarnings();
    }, [organization?.id, isViewer]);

    useEffect(() => {
        if (organization?.id) {
            supabase
                .from('organization_settings')
                .select('viewer_schedule_days')
                .eq('organization_id', organization.id)
                .maybeSingle()
                .then(({ data, error }) => {
                    if (error) {
                        console.error('Error fetching viewer settings:', error);
                    }
                    if (data?.viewer_schedule_days) {
                        setViewerDaysLimit(data.viewer_schedule_days);
                    }
                });
        }
    }, [organization?.id]);

    const selectedShift = useMemo(() =>
        shifts.find(s => s.id === selectedShiftId) || null
        , [shifts, selectedShiftId]);

    const handleExportToClipboard = async () => {
        const dateKey = selectedDate.toLocaleDateString('en-CA');
        const dateDisplay = selectedDate.toLocaleDateString('he-IL', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });

        let output = `📅 לוח שיבוצים - ${dateDisplay}\n`;
        output += `${'='.repeat(50)}\n\n`;

        const dayShifts = shifts.filter(s => {
            const shiftDate = new Date(s.startTime).toLocaleDateString('en-CA');
            return shiftDate === dateKey;
        }).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

        const taskGroups = new Map<string, Shift[]>();
        dayShifts.forEach(shift => {
            const existing = taskGroups.get(shift.taskId) || [];
            taskGroups.set(shift.taskId, [...existing, shift]);
        });

        taskGroups.forEach((shifts, taskId) => {
            const task = taskTemplates.find(t => t.id === taskId);
            if (!task) return;

            output += `🔹 ${task.name}\n`;
            output += `${'-'.repeat(40)}\n`;

            shifts.forEach(shift => {
                const startTime = new Date(shift.startTime).toLocaleTimeString('he-IL', {
                    hour: '2-digit',
                    minute: '2-digit'
                });
                const endTime = new Date(shift.endTime).toLocaleTimeString('he-IL', {
                    hour: '2-digit',
                    minute: '2-digit'
                });

                const assignedPeople = shift.assignedPersonIds
                    .map(id => people.find(p => p.id === id))
                    .filter(Boolean) as Person[];

                const assignedNames = assignedPeople.length > 0
                    ? assignedPeople.map(p => p.name).join(', ')
                    : 'לא שובץ';

                const status = assignedPeople.length >= task.requiredPeople ? '✅' : '⚠️';

                output += `  ${status} ${startTime} - ${endTime}\n`;
                output += `     👥 ${assignedNames}\n`;

                if (assignedPeople.length < task.requiredPeople) {
                    output += `     📌 חסרים: ${task.requiredPeople - assignedPeople.length}\n`;
                }
                output += `\n`;
            });

            output += `\n`;
        });

        const totalShifts = dayShifts.length;
        const fullyAssigned = dayShifts.filter(s => {
            const task = taskTemplates.find(t => t.id === s.taskId);
            return task && s.assignedPersonIds.length >= task.requiredPeople;
        }).length;

        output += `${'='.repeat(50)}\n`;
        output += `📊 סיכום:\n`;
        output += `   • סה"כ משמרות: ${totalShifts}\n`;
        output += `   • מאוישות במלואן: ${fullyAssigned}\n`;
        output += `   • דורשות השלמה: ${totalShifts - fullyAssigned}\n`;

        try {
            await navigator.clipboard.writeText(output);
            analytics.trackScheduleExported(selectedDate.toISOString());
            showToast('הלוח הועתק ללוח ההדבקה', 'success');
        } catch (err) {
            analytics.trackError('Failed to copy schedule', 'Export');
            console.error('Failed to copy:', err);
            showToast('שגיאה בהעתקה ללוח ההדבקה', 'error');
        }
    };

    const renderFeaturedCard = () => {
        const now = new Date();

        if (isViewer) {
            const currentPerson = people.find(p => p.name === profile?.full_name || (p as any).email === profile?.email);
            const nextPersonalShift = currentPerson
                ? shifts
                    .filter(s => s.assignedPersonIds.includes(currentPerson.id) && new Date(s.startTime) > now)
                    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0]
                : null;

            const task = nextPersonalShift ? taskTemplates.find(t => t.id === nextPersonalShift.taskId) : null;

            return (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-0 overflow-hidden mb-6 md:mb-8">
                    <div className="p-4 md:p-6 lg:p-8">
                        <div className="mb-4 md:mb-6">
                            <h2 className="text-2xl md:text-3xl font-bold text-slate-800 mb-1">
                                שלום, {profile?.full_name?.split(' ')[0] || 'לוחם'}
                            </h2>
                            <p className="text-slate-500 text-base md:text-lg">הנה המשימה הבאה שלך להיום</p>
                        </div>

                        {nextPersonalShift && task ? (
                            <div className={`bg-white rounded-xl p-4 md:p-6 border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all`}>
                                <div className={`absolute top-0 right-0 w-1 md:w-1.5 h-full ${task.color.replace('border-l-', 'bg-')}`}></div>

                                <div className="flex flex-col gap-3 md:gap-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">המשמרת הבאה</span>
                                        </div>
                                        <h3 className="text-xl md:text-2xl font-bold text-slate-800 mb-2">{task.name}</h3>
                                        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-x-6 sm:gap-y-2 text-slate-600 text-sm md:text-base">
                                            <div className="flex items-center gap-2">
                                                <CalendarIcon size={16} className="text-slate-400 flex-shrink-0" />
                                                <span className="font-medium">{new Date(nextPersonalShift.startTime).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Clock size={16} className="text-slate-400 flex-shrink-0" />
                                                <span className="font-medium" dir="ltr">
                                                    {new Date(nextPersonalShift.startTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} - {new Date(nextPersonalShift.endTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="hidden sm:flex items-center justify-center bg-slate-50 rounded-full w-12 h-12 md:w-16 md:h-16 text-slate-400 self-end">
                                        <Clock size={20} />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-slate-50 rounded-xl p-6 md:p-8 text-center border border-slate-100">
                                <p className="text-slate-600 text-base md:text-lg font-medium">אין משמרות קרובות ביומן</p>
                                <p className="text-slate-400 text-xs md:text-sm mt-1">ניתן לנוח ולהתעדכן בהמשך</p>
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        const upcoming = shifts.find(s => new Date(s.startTime) > now);
        if (!upcoming) return null;
        const task = taskTemplates.find(t => t.id === upcoming.taskId);
        if (!task) return null;

        const isAssigned = upcoming.assignedPersonIds.length >= task.requiredPeople;

        return (
            <div className="bg-white rounded-xl shadow-portal p-0 overflow-hidden mb-6 md:mb-8">
                <div className="flex flex-col">
                    <div className="p-4 md:p-6 lg:p-8 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1">
                                <Clock size={12} /> משמרת קרובה
                            </span>
                            <span className="text-green-600 text-xs md:text-sm font-bold flex items-center gap-1">
                                <Check size={14} /> {isAssigned ? 'מאוישת' : 'נדרש איוש'}
                            </span>
                        </div>
                        <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-slate-900 mb-2">{task.name}</h2>
                        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-4 text-slate-500 text-sm mb-4 md:mb-6">
                            <div className="flex items-center gap-1.5">
                                <CalendarIcon size={16} className="flex-shrink-0" />
                                <span>{new Date(upcoming.startTime).toLocaleDateString('he-IL')}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Clock size={16} className="flex-shrink-0" />
                                <span dir="ltr">
                                    {new Date(upcoming.startTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} - {new Date(upcoming.endTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                onClick={() => setSelectedShiftId(upcoming.id)}
                                className="bg-idf-yellow hover:bg-idf-yellow-hover text-slate-900 px-4 md:px-6 py-2 md:py-2.5 rounded-full font-bold shadow-sm transition-colors text-sm md:text-base"
                            >
                                נהל משמרת
                            </button>
                        </div>
                    </div>
                    <div className="bg-slate-50 p-4 md:p-6 border-t md:border-t-0 md:border-r border-slate-100 flex flex-col justify-center">
                        <h4 className="font-bold text-slate-700 mb-3 text-sm md:text-base">צוות משובץ:</h4>
                        <div className="flex flex-wrap gap-2 md:-space-x-3 md:space-x-reverse md:flex-nowrap">
                            {upcoming.assignedPersonIds.length === 0 && <span className="text-slate-400 text-xs md:text-sm">טרם שובצו</span>}
                            {upcoming.assignedPersonIds.map(pid => {
                                const p = people.find(x => x.id === pid);
                                return p ? (
                                    <div key={pid} title={p.name} className={`w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-white flex items-center justify-center text-white font-bold shadow-sm text-xs md:text-sm ${p.color}`}>
                                        {getPersonInitials(p.name)}
                                    </div>
                                ) : null;
                            })}
                        </div>
                        {upcoming.assignedPersonIds.length < task.requiredPeople && (
                            <div className="mt-3 text-xs text-red-500 font-medium flex items-center gap-1">
                                <Sparkles size={12} />
                                חסרים {task.requiredPeople - upcoming.assignedPersonIds.length} חיילים
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const Modal = () => {
        if (!selectedShift) return null;
        const task = taskTemplates.find(t => t.id === selectedShift.taskId);
        if (!task) return null;

        const [isEditingTime, setIsEditingTime] = useState(false);
        const [newStart, setNewStart] = useState(new Date(selectedShift.startTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }));
        const [newEnd, setNewEnd] = useState(new Date(selectedShift.endTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }));

        const assignedPeople = selectedShift.assignedPersonIds.map(id => people.find(p => p.id === id)).filter(Boolean) as Person[];
        const availablePeople = people.filter(p => !selectedShift.assignedPersonIds.includes(p.id));

        const [suggestedCandidates, setSuggestedCandidates] = useState<{ person: Person, reason: string }[]>([]);
        const [suggestionIndex, setSuggestionIndex] = useState(0);

        const handleSuggestBest = () => {
            // 1. Filter by Role & Constraints
            const qualifiedPeople = availablePeople.filter(p => {
                // Role Check
                if (task.roleComposition && task.roleComposition.length > 0) {
                    if (!task.roleComposition.some(rc => p.roleIds.includes(rc.roleId))) return false;
                }

                // Constraint Check
                const userConstraints = constraints.filter(c => c.personId === p.id);

                // Never Assign
                if (userConstraints.some(c => c.type === 'never_assign' && c.taskId === task.id)) return false;

                // Always Assign (Exclusivity)
                const exclusive = userConstraints.find(c => c.type === 'always_assign');
                if (exclusive && exclusive.taskId !== task.id) return false;

                // Time Block
                const shiftStart = new Date(selectedShift.startTime).getTime();
                const shiftEnd = new Date(selectedShift.endTime).getTime();
                const hasTimeBlock = userConstraints.some(c => {
                    if (c.type === 'time_block' && c.startTime && c.endTime) {
                        const blockStart = new Date(c.startTime).getTime();
                        const blockEnd = new Date(c.endTime).getTime();
                        return shiftStart < blockEnd && shiftEnd > blockStart;
                    }
                    return false;
                });
                if (hasTimeBlock) return false;

                return true;
            });

            // 2. Calculate Scores
            const candidates = qualifiedPeople.map(p => {
                let score = 0;
                let reasons: string[] = [];

                // Load Balancing (fewer shifts is better)
                const personShifts = shifts.filter(s => s.assignedPersonIds.includes(p.id));
                score -= personShifts.length * 10; // Penalize for existing load

                // Rest Time Check
                const shiftStart = new Date(selectedShift.startTime);
                const minRest = task.minRestHoursBefore || 8;
                const hasRestViolation = personShifts.some(s => {
                    const sEnd = new Date(s.endTime);
                    const diffHours = (shiftStart.getTime() - sEnd.getTime()) / (1000 * 60 * 60);
                    return diffHours > 0 && diffHours < minRest;
                });

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

        return createPortal(
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 md:p-6 animate-fadeIn pt-16 md:pt-24">
                <div className="bg-white rounded-xl md:rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[calc(100vh-10rem)] md:max-h-[calc(100vh-12rem)] mb-16 md:mb-0">
                    <div className="p-3 md:p-6 border-b border-slate-100 bg-slate-50">
                        <div className="flex justify-between items-start gap-2">
                            <div className="flex-1 min-w-0">
                                <h3 className="text-base md:text-xl font-bold text-slate-900 truncate">{task.name} - {isViewer ? 'פרטי משמרת' : 'ניהול שיבוץ'}</h3>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    {!isEditingTime ? (
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="text-slate-500 text-xs md:text-sm flex items-center gap-1 md:gap-2">
                                                <span>{new Date(selectedShift.startTime).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })}</span>
                                                <span className="text-slate-300">|</span>
                                                <span dir="ltr" className="text-[11px] md:text-sm">
                                                    {new Date(selectedShift.startTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} - {new Date(selectedShift.endTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </p>
                                            {!isViewer && (
                                                <button onClick={() => setIsEditingTime(true)} className="text-blue-600 hover:text-blue-800 p-1 bg-blue-50 rounded-full transition-colors" title="ערוך שעות">
                                                    <Pencil size={12} />
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1 md:gap-2 animate-fadeIn flex-wrap">
                                            <input type="time" value={newStart} onChange={e => setNewStart(e.target.value)} className="text-xs md:text-sm p-1 rounded border border-slate-300 w-20 text-right" lang="he" />
                                            <span className="text-xs">-</span>
                                            <input type="time" value={newEnd} onChange={e => setNewEnd(e.target.value)} className="text-xs md:text-sm p-1 rounded border border-slate-300 w-20 text-right" lang="he" />
                                            <button onClick={handleSaveTime} className="text-green-600 hover:text-green-800 p-1 bg-green-50 rounded-full transition-colors"><Save size={12} /></button>
                                            <button onClick={() => setIsEditingTime(false)} className="text-red-500 hover:text-red-700 p-1 bg-red-50 rounded-full transition-colors"><X size={12} /></button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
                                {!isViewer && (
                                    <button onClick={() => { onToggleCancelShift(selectedShift.id); setSelectedShiftId(null); }} className={`p-1.5 md:p-2 rounded-full transition-colors ${selectedShift.isCancelled ? 'text-green-600 hover:bg-green-50' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'}`} title={selectedShift.isCancelled ? "שחזר משמרת" : "בטל משמרת"}>
                                        {selectedShift.isCancelled ? <Undo2 size={16} /> : <Ban size={16} />}
                                    </button>
                                )}
                                <button onClick={() => setSelectedShiftId(null)} className="p-1.5 md:p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-hidden flex flex-col md:flex-row min-h-0">
                        <div className="flex-1 overflow-y-auto flex flex-col md:flex-row">
                            <div className="md:flex-1 p-3 md:p-6 h-fit border-b md:border-b-0 md:border-l border-slate-100">
                                <h4 className="font-bold text-slate-800 mb-3 md:mb-4 text-xs md:text-sm uppercase tracking-wider">משובצים ({assignedPeople.length}/{task.requiredPeople})</h4>

                                {currentSuggestion && (
                                    <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3 animate-fadeIn">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold text-blue-800 flex items-center gap-1">
                                                <Sparkles size={12} />
                                                המלצה חכמה
                                            </span>
                                            <button onClick={() => setSuggestedCandidates([])} className="text-blue-400 hover:text-blue-600"><X size={12} /></button>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${currentSuggestion.person.color}`}>
                                                    {getPersonInitials(currentSuggestion.person.name)}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold text-slate-800">{currentSuggestion.person.name}</div>
                                                    <div className="text-[10px] text-slate-500">{currentSuggestion.reason}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {suggestedCandidates.length > 1 && (
                                                    <button
                                                        onClick={handleNextSuggestion}
                                                        className="text-blue-600 hover:bg-blue-100 px-2 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1"
                                                    >
                                                        <RotateCcw size={14} />
                                                        <span>הצעה חדשה</span>
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => {
                                                        onAssign(selectedShift.id, currentSuggestion.person.id);
                                                        setSuggestedCandidates([]);
                                                    }}
                                                    className="bg-blue-600 text-white text-xs px-3 py-1 rounded-full font-bold hover:bg-blue-700 transition-colors"
                                                >
                                                    שבץ
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div className="space-y-2 md:space-y-3">
                                    {assignedPeople.map(p => (
                                        <div key={p.id} className="flex items-center justify-between p-2 md:p-3 bg-green-50 border border-green-100 rounded-lg md:rounded-xl">
                                            <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                                                <div className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-white text-[10px] md:text-xs font-bold flex-shrink-0 ${p.color}`}>{getPersonInitials(p.name)}</div>
                                                <div className="flex flex-col min-w-0 flex-1">
                                                    <span className="font-bold text-slate-800 text-xs md:text-sm truncate">{p.name}</span>
                                                    {task.roleComposition && task.roleComposition.length > 0 && (
                                                        <span className="text-[9px] md:text-[10px] text-slate-500 truncate">
                                                            {roles.find(r => task.roleComposition.some(rc => rc.roleId === r.id) && p.roleIds.includes(r.id))?.name || ''}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            {!isViewer && (
                                                <button onClick={() => onUnassign(selectedShift.id, p.id)} className="text-red-500 p-1 md:p-1.5 hover:bg-red-100 rounded-lg flex-shrink-0">
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    {assignedPeople.length === 0 && <p className="text-slate-400 text-xs md:text-sm text-center py-4">לא שובצו חיילים</p>}
                                </div>
                            </div>

                            {!isViewer && (
                                <div className="flex-1 p-3 md:p-6 h-fit bg-slate-50/50">
                                    <div className="flex items-center justify-between mb-3 md:mb-4">
                                        <h4 className="font-bold text-slate-800 text-xs md:text-sm uppercase tracking-wider">מאגר זמין</h4>
                                        <button
                                            onClick={handleSuggestBest}
                                            className="flex items-center gap-1 text-[10px] md:text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-full transition-colors"
                                        >
                                            <Sparkles size={12} />
                                            תציע לי חייל זמין                                        </button>
                                    </div>
                                    <div className="space-y-4">
                                        {(() => {
                                            const peopleByTeam = teams.map(team => ({
                                                team,
                                                members: availablePeople.filter(p => p.teamId === team.id)
                                            }));

                                            const noTeamMembers = availablePeople.filter(p => !p.teamId || !teams.find(t => t.id === p.teamId));
                                            if (noTeamMembers.length > 0) {
                                                peopleByTeam.push({
                                                    team: { id: 'no-team', name: 'ללא צוות', color: 'border-slate-300' } as any,
                                                    members: noTeamMembers
                                                });
                                            }

                                            return peopleByTeam.map(({ team, members }) => {
                                                if (members.length === 0) return null;
                                                const isCollapsed = collapsedTeams.has(team.id);

                                                return (
                                                    <div key={team.id} className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
                                                        <div
                                                            className="px-2 py-1.5 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors"
                                                            onClick={() => toggleTeamCollapse(team.id)}
                                                        >
                                                            <div className="flex items-center gap-2 overflow-hidden">
                                                                <div className={`w-0.5 h-4 rounded-full ${team.color?.replace('border-', 'bg-') || 'bg-slate-400'}`}></div>
                                                                <span className="font-bold text-xs text-slate-700 truncate">{team.name}</span>
                                                                <span className="text-[10px] bg-white px-1.5 rounded-full border border-slate-200 text-slate-500 font-bold">{members.length}</span>
                                                            </div>
                                                            <button className="text-slate-400">
                                                                {isCollapsed ? <ChevronLeft size={14} /> : <ChevronDown size={14} />}
                                                            </button>
                                                        </div>

                                                        {!isCollapsed && (
                                                            <div className="space-y-1.5 p-2 pt-0 md:space-y-2 border-t border-slate-200/50 mt-1">
                                                                {members.map(p => {
                                                                    const hasRole = !task.roleComposition || task.roleComposition.length === 0 || task.roleComposition.some(rc => p.roleIds.includes(rc.roleId));
                                                                    const isFull = assignedPeople.length >= task.requiredPeople;
                                                                    const canAssign = hasRole && !isFull;

                                                                    return (
                                                                        <div key={p.id} className={`flex items-center justify-between p-2 md:p-3 rounded-lg md:rounded-xl border transition-all ${canAssign ? 'bg-white border-slate-200 hover:border-blue-300' : 'bg-slate-100 border-slate-200 opacity-60'}`}>
                                                                            <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                                                                                <div className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-white text-[10px] md:text-xs font-bold flex-shrink-0 ${p.color}`}>{getPersonInitials(p.name)}</div>
                                                                                <div className="flex flex-col min-w-0 flex-1">
                                                                                    <span className="font-bold text-slate-700 text-xs md:text-sm truncate">{p.name}</span>
                                                                                    {!hasRole && <span className="text-[9px] md:text-[10px] text-red-500">אין התאמה</span>}
                                                                                    {isFull && hasRole && <span className="text-[9px] md:text-[10px] text-amber-500">משמרת מלאה</span>}
                                                                                </div>
                                                                            </div>
                                                                            <button onClick={() => onAssign(selectedShift.id, p.id)} disabled={!canAssign} className={`px-2 md:px-3 py-1 rounded-full text-[10px] md:text-xs font-bold flex-shrink-0 ${canAssign ? 'bg-idf-yellow text-slate-900 hover:bg-idf-yellow-hover' : 'bg-slate-200 text-slate-400'}`}>שבץ</button>
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

                    </div>
                </div>
            </div>,
            document.body
        );
    };

    const mismatchWarnings = useMemo(() => {
        if (isViewer) return [];

        return shifts.flatMap(shift => {
            const task = taskTemplates.find(t => t.id === shift.taskId);
            if (!task) return [];
            const requiredRoleIds = task.roleComposition.map(rc => rc.roleId);
            return shift.assignedPersonIds
                .filter(pid => {
                    const person = people.find(p => p.id === pid);
                    if (!person) return false;

                    const warningId = `${shift.id}-${pid}`;

                    if (acknowledgedWarnings.has(warningId)) return false;

                    return !person.roleIds.some(rid => requiredRoleIds.includes(rid));
                })
                .map(pid => {
                    const person = people.find(p => p.id === pid)!;
                    return {
                        warningId: `${shift.id}-${pid}`,
                        shiftId: shift.id,
                        personId: pid,
                        taskName: task.name,
                        start: new Date(shift.startTime),
                        end: new Date(shift.endTime),
                        personName: person.name,
                        missingRoles: requiredRoleIds
                            .map(rid => roles.find(r => r.id === rid)?.name)
                            .filter(Boolean) as string[]
                    };
                });
        });
    }, [shifts, taskTemplates, people, roles, acknowledgedWarnings, isViewer]);

    const handleAcknowledgeWarning = async (warningId: string) => {
        setAcknowledgedWarnings(prev => new Set([...prev, warningId]));

        if (organization?.id) {
            const { error } = await supabase
                .from('acknowledged_warnings')
                .upsert({
                    organization_id: organization.id,
                    warning_id: warningId,
                    acknowledged_at: new Date().toISOString()
                }, {
                    onConflict: 'organization_id,warning_id'
                });

            if (error) {
                console.error('Error saving acknowledged warning:', error);
            }
        }
    };

    const visibleTasks = useMemo(() => {
        const dateKey = selectedDate.toLocaleDateString('en-CA');
        return taskTemplates.filter(task => {
            if (task.schedulingType === 'one-time' && task.specificDate) {
                return task.specificDate === dateKey;
            }
            return true;
        });
    }, [taskTemplates, selectedDate]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const maxViewerDate = new Date(today);
    maxViewerDate.setDate(today.getDate() + (viewerDaysLimit - 1));

    const isAtViewerLimit = selectedDate >= maxViewerDate;

    const canGoNext = !isViewer || !isAtViewerLimit;
    const canGoPrev = true;

    const handleJumpToShift = (shiftId: string, shiftStart: Date) => {
        const shiftDate = new Date(shiftStart);
        shiftDate.setHours(0, 0, 0, 0);
        onDateChange(shiftDate);

        setTimeout(() => {
            const shiftElement = document.getElementById(`shift-card-${shiftId}`);
            if (shiftElement) {
                shiftElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                shiftElement.classList.add('ring-4', 'ring-red-500', 'ring-offset-2');
                setTimeout(() => {
                    shiftElement.classList.remove('ring-4', 'ring-red-500', 'ring-offset-2');
                }, 2000);
            }
        }, 300);
    };

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
        confirm({
            title: 'ניקוי יום',
            message: 'האם אתה בטוח שברצונך למחוק את כל המשמרות של היום? פעולה זו אינה הפיכה.',
            confirmText: 'נקה יום',
            type: 'danger',
            onConfirm: () => {
                onClearDay();
                showToast('היום נוקה בהצלחה', 'success');
            }
        });
    };

    useEffect(() => {
        const dateKey = selectedDate.toLocaleDateString('en-CA');
        analytics.trackFilterApplied('date', dateKey);
    }, [selectedDate]);

    return (
        <div className="flex flex-col gap-2 h-full">
            {isViewer && renderFeaturedCard()}
            {selectedShift && <Modal />}
            <ConfirmationModal {...modalProps} />

            {/* Global Mismatch Warnings Panel */}
            {!isViewer && !isLoadingWarnings && mismatchWarnings.length > 0 && (
                <div className="rounded-xl border-2 border-red-500 bg-red-50 p-2 space-y-2 animate-fadeIn flex-shrink-0">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="text-red-600 flex-shrink-0" size={18} />
                            <h2 className="text-red-700 font-bold text-base md:text-lg">
                                אזהרות שיבוץ ({mismatchWarnings.length})
                            </h2>
                        </div>
                        <button
                            onClick={() => {
                                const allWarningIds = mismatchWarnings.map(w => w.warningId);
                                setAcknowledgedWarnings(new Set([...acknowledgedWarnings, ...allWarningIds]));
                            }}
                            className="text-xs text-red-600 hover:text-red-800 font-bold px-3 py-1 rounded-full bg-white hover:bg-red-100 transition-colors whitespace-nowrap"
                        >
                            אשר הכל
                        </button>
                    </div>
                    <ul className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar">
                        {mismatchWarnings.map((w) => (
                            <li key={w.warningId} className="text-xs md:text-sm flex flex-col gap-2 bg-white/60 rounded-md p-2 md:px-3 md:py-2 border border-red-300">
                                <div onClick={() => handleJumpToShift(w.shiftId, w.start)} className="flex-1 flex flex-col gap-1 cursor-pointer hover:bg-white/80">
                                    <div className="flex flex-wrap items-center gap-1">
                                        <span className="font-bold text-red-700">{w.personName}</span>
                                        <span className="text-red-600">במשימה "{w.taskName}"</span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 text-slate-600">
                                        <span className="font-medium text-xs">📅 {w.start.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })}</span>
                                        <span className="text-xs" dir="ltr">🕐 {w.start.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}–{w.end.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <span className="text-xs text-red-500">חסר: {w.missingRoles.join(', ')}</span>
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleAcknowledgeWarning(w.warningId); }}
                                    className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-full bg-green-600 hover:bg-green-700 text-white text-xs font-bold transition-colors"
                                >
                                    <CheckCircle size={14} />
                                    אישור
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Time Grid Board Container */}
            <div className="bg-white rounded-xl shadow-portal p-2 overflow-hidden flex flex-col flex-1 min-h-0">
                {/* Controls Header */}
                <div className="flex flex-col gap-2 mb-2 flex-shrink-0">
                    <div className="flex flex-wrap items-center gap-2 md:gap-3">
                        <h3 className="text-lg md:text-xl font-bold text-slate-800">מבט יומי</h3>
                        {!isViewer && (() => {
                            const dateKey = selectedDate.toLocaleDateString('en-CA');
                            const unavailableCount = people.filter(p => {
                                if (p.unavailableDates?.includes(dateKey)) return true;
                                if (p.dailyAvailability?.[dateKey]?.isAvailable === false) return true;
                                return false;
                            }).length;
                            const availableCount = people.length - unavailableCount;

                            return (
                                <div className="flex items-center gap-1.5 md:gap-2 bg-gradient-to-r from-emerald-50 to-green-50 px-2 md:px-4 py-1 md:py-2 rounded-full border border-emerald-200">
                                    <User size={14} className="text-emerald-600" />
                                    <span className="text-xs md:text-sm font-bold text-emerald-700">
                                        זמינים: {availableCount}/{people.length}
                                    </span>
                                </div>
                            );
                        })()}
                    </div>

                    <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2 md:gap-3">
                        <div className="flex gap-2 order-2 sm:order-1">
                            <button onClick={handleExportClick} className="flex items-center justify-center gap-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 md:py-2 rounded-full font-bold text-xs md:text-sm transition-colors">
                                <Copy size={14} />
                                <span className="hidden sm:inline">העתק ללוח</span>
                                <span className="sm:hidden">העתק</span>
                            </button>
                            {!isViewer && (
                                <button onClick={handleClearDayClick} className="flex items-center justify-center gap-1.5 text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 md:py-2 rounded-full font-bold text-xs md:text-sm transition-colors">
                                    <Trash2 size={14} />
                                    <span className="hidden sm:inline">נקה יום</span>
                                    <span className="sm:hidden">נקה</span>
                                </button>
                            )}
                        </div>

                        <div className="flex items-center justify-center bg-slate-100 rounded-full p-0.5 md:p-1 order-1 sm:order-2">
                            <button onClick={() => { if (canGoNext) { const d = new Date(selectedDate); d.setDate(d.getDate() + 1); handleDateChange(d); } }} disabled={!canGoNext} className={`p-1.5 md:p-2 rounded-full transition-all ${canGoNext ? 'hover:bg-white' : 'opacity-50 cursor-not-allowed'}`}>
                                <ChevronRight size={16} />
                            </button>

                            <div
                                className="relative group cursor-pointer px-2 md:px-4 min-w-[120px] md:min-w-[140px] text-center"
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
                                <span className="text-xs md:text-sm font-bold text-slate-600 group-hover:text-blue-600 transition-colors flex items-center justify-center gap-1">
                                    {selectedDate.toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'short' })}
                                    <CalendarIcon size={12} className="opacity-50 group-hover:opacity-100 transition-opacity" />
                                </span>
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

                            <button onClick={() => { if (canGoPrev) { const d = new Date(selectedDate); d.setDate(d.getDate() - 1); handleDateChange(d); } }} disabled={!canGoPrev} className={`p-1.5 md:p-2 rounded-full transition-all ${canGoPrev ? 'hover:bg-white' : 'opacity-50 cursor-not-allowed'}`}>
                                <ChevronLeft size={16} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Scrollable Grid Area */}
                <div className="flex-1 overflow-auto relative border-t border-slate-200">
                    <div className="flex min-w-max relative">


                        {/* Time Axis Column */}
                        <div className="w-10 md:w-16 flex-shrink-0 border-l border-slate-100 bg-slate-50 sticky right-0 z-40">
                            <div style={{ height: HEADER_HEIGHT }} className="border-b border-slate-200 bg-slate-50 sticky top-0 z-50"></div>
                            {Array.from({ length: 25 }).map((_, i) => (
                                <div key={i} className="h-[60px] border-t border-dashed border-slate-300 text-[9px] md:text-xs text-slate-400 font-bold flex justify-center pt-1 relative">
                                    <span className="bg-slate-50 px-0.5 md:px-1">{i.toString().padStart(2, '0')}:00</span>
                                </div>
                            ))}
                        </div>

                        {/* Task Columns */}
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
                                <div key={task.id} className="w-[130px] md:w-[260px] flex-shrink-0 border-l border-slate-100 relative bg-slate-50/30 h-[1540px]">
                                    {/* Column Header */}
                                    <div style={{ height: HEADER_HEIGHT }} className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200 p-1.5 md:p-2 shadow-sm text-center flex items-center justify-center">
                                        <h4 className="font-bold text-slate-800 text-xs md:text-sm truncate w-full">{task.name}</h4>
                                    </div>

                                    {/* Grid Lines */}
                                    <div className="absolute inset-0 pointer-events-none" style={{ top: HEADER_HEIGHT }}>
                                        {Array.from({ length: 25 }).map((_, i) => (
                                            <div key={i} className="h-[60px] border-t border-dashed border-slate-300/50"></div>
                                        ))}
                                    </div>

                                    {/* Shifts */}
                                    {taskShifts.map(shift => {
                                        const shiftStart = new Date(shift.startTime);
                                        const shiftEnd = new Date(shift.endTime);

                                        // Calculate effective start/end for the current day
                                        const dayStart = new Date(selectedDate);
                                        dayStart.setHours(0, 0, 0, 0);
                                        const dayEnd = new Date(selectedDate);
                                        dayEnd.setHours(24, 0, 0, 0);

                                        const effectiveStart = shiftStart < dayStart ? dayStart : shiftStart;
                                        const effectiveEnd = shiftEnd > dayEnd ? dayEnd : shiftEnd;

                                        const top = getPositionFromTime(effectiveStart) + HEADER_HEIGHT;
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

                        {/* Global Time Line (Moved to end for z-index safety) */}
                        {(() => {
                            const currentDayKey = now.toLocaleDateString('en-CA');
                            const selectedDayKey = selectedDate.toLocaleDateString('en-CA');
                            if (currentDayKey === selectedDayKey) {
                                const top = getPositionFromTime(now) + HEADER_HEIGHT;
                                return (
                                    <div
                                        className="absolute left-0 right-0 z-[60] flex items-center pointer-events-none"
                                        style={{ top: `${top}px` }}
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

                        {visibleTasks.length === 0 && (
                            <div className="flex-1 flex items-center justify-center text-slate-400 p-10">
                                אין משימות להצגה
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
