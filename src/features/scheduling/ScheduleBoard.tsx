import React, { useState, useMemo, useEffect, useRef, useLayoutEffect } from 'react';

import { GenericModal } from '../../components/ui/GenericModal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { DatePicker } from '../../components/ui/DatePicker';
import { Shift, Person, TaskTemplate, Role, Team, TeamRotation, MissionReport, Absence, DailyPresence } from '../../types';
import { generateShiftsForTask } from '../../utils/shiftUtils';
import { getEffectiveAvailability } from '../../utils/attendanceUtils';
import { getPersonInitials } from '../../utils/nameUtils';
import { DateNavigator } from '../../components/ui/DateNavigator';
import { ArrowsInSimple, ArrowsOutSimple, ArrowCounterClockwise as RotateCcw, Sparkle as Sparkles, FileText } from '@phosphor-icons/react';
import { CaretLeft as ChevronLeft, CaretRight as ChevronRight, Plus, X, Check, Warning as AlertTriangle, Clock, User, MapPin, CalendarBlank as CalendarIcon, PencilSimple as Pencil, FloppyDisk as Save, Trash as Trash2, Copy, CheckCircle, Prohibit as Ban, ArrowUUpLeft as Undo2, CaretDown as ChevronDown, MagnifyingGlass as Search, DotsThreeVertical as MoreVertical, MagicWand as Wand2, ClipboardText as ClipboardIcon } from '@phosphor-icons/react';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';
import { MobileScheduleList } from './MobileScheduleList';
import { MultiSelect } from '../../components/ui/MultiSelect';
import { useAuth } from '../../features/auth/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { analytics } from '../../services/analytics';
import { logger } from '../../services/loggingService';
import { supabase } from '../../services/supabaseClient';
import { EmptyStateGuide } from '../../components/ui/EmptyStateGuide';
import { AssignmentModal } from './AssignmentModal';
import { MissionReportModal } from './MissionReportModal';
import { PageInfo } from '../../components/ui/PageInfo';
import { ExportScheduleModal } from './ExportScheduleModal';
import { ExportButton } from '../../components/ui/ExportButton';
import { FloatingActionButton } from '../../components/ui/FloatingActionButton';
import { RotaWizardModal } from './RotaWizardModal';
import { FileArrowDown as FileDown } from '@phosphor-icons/react';

export interface ScheduleBoardProps {
    shifts: Shift[];
    people: Person[];
    taskTemplates: TaskTemplate[];
    roles: Role[];
    teams: Team[];
    constraints: import('../../types').SchedulingConstraint[];
    selectedDate: Date;
    onDateChange: (date: Date) => void;
    onSelect: (shift: Shift) => void;
    onDelete: (shiftId: string) => void;
    isViewer: boolean;
    acknowledgedWarnings?: Set<string>;
    onClearDay: (params: { startDate: Date; endDate: Date; taskIds?: string[] }) => void;
    onNavigate: (view: 'personnel' | 'tasks', tab?: 'people' | 'teams' | 'roles') => void;
    onAssign: (shiftId: string, personId: string) => void;
    onUnassign: (shiftId: string, personId: string) => void;
    onAddShift?: (task: TaskTemplate, date: Date) => void;
    onUpdateShift?: (shift: Shift) => void;
    onToggleCancelShift?: (shiftId: string) => void;
    teamRotations: TeamRotation[];
    missionReports: MissionReport[];
    absences?: Absence[];
    hourlyBlockages?: import('../../types').HourlyBlockage[];
    settings?: import('../../types').OrganizationSettings | null;
    onRefreshData?: () => void;
    onAutoSchedule?: () => void;
}

// Helper to calculate position based on time
const START_HOUR = 0;
const HEADER_HEIGHT = 40;

const getPositionFromTime = (date: Date, pixelsPerHour: number) => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const totalHours = hours + minutes / 60;
    return (totalHours - START_HOUR) * pixelsPerHour;
};

const getHeightFromDuration = (start: Date, end: Date, pixelsPerHour: number) => {
    const durationMs = end.getTime() - start.getTime();
    const durationHours = durationMs / (1000 * 60 * 60);
    return durationHours * pixelsPerHour;
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
    missionReports: MissionReport[];
    style?: React.CSSProperties;
    onReportClick: (shift: Shift) => void;
    onAutoSchedule?: () => void;
    isContinuedFromPrev?: boolean;
    isContinuedToNext?: boolean;
    isCompact?: boolean;
}> = ({ shift, taskTemplates, people, roles, teams, onSelect, onToggleCancel, onReportClick, isViewer, acknowledgedWarnings, missionReports, style, onAutoSchedule, isContinuedFromPrev, isContinuedToNext, isCompact }) => {
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
            className={`absolute flex flex-col ${isCompact ? 'p-0.5' : 'p-1.5'} rounded-md border text-xs cursor-pointer transition-all overflow-hidden ${bgColor} ${borderColor} hover:border-blue-400 group justify-between shadow-sm`}
            style={style}
            onClick={(e) => { e.stopPropagation(); onSelect(shift); }}
            title={hasMissingRoles ? `חסרים תפקידים: ${missingRoles.join(', ')}` : undefined}
        >
            {/* Action Buttons - Absolute Positioned (Top Left) */}
            <div className="absolute top-1 left-1 flex items-center gap-0.5 z-20">

                <button
                    onClick={(e) => { e.stopPropagation(); onReportClick(shift); }}
                    className={`p-0.5 md:p-1.5 rounded shadow-sm text-slate-500 hover:text-blue-600 transition-all border border-transparent hover:border-slate-200
                        ${missionReports.find(r => r.shift_id === shift.id)?.submitted_at ? 'bg-blue-100 text-blue-600 border-blue-200' : 'bg-white/50 hover:bg-white'}
                    `}
                    title={missionReports.find(r => r.shift_id === shift.id)?.submitted_at ? "דוח הוגש - לחץ לצפייה" : "דוח משימה"}
                >
                    <FileText size={14} weight={missionReports.find(r => r.shift_id === shift.id)?.submitted_at ? "fill" : "duotone"} className={missionReports.find(r => r.shift_id === shift.id)?.submitted_at ? "text-blue-600" : ""} />
                </button>
                {!isViewer && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onToggleCancel(shift.id); }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 bg-white/50 hover:bg-white rounded shadow-sm text-slate-400 hover:text-red-500 transition-all border border-transparent hover:border-slate-200"
                        title={shift.isCancelled ? 'הפעל משמרת' : 'בטל משמרת'}
                    >
                        {shift.isCancelled ? <RotateCcw size={12} className="text-blue-500" weight="duotone" /> : <Ban size={12} weight="duotone" />}
                    </button>
                )}
            </div>

            {/* Top Row: Task Name */}
            <div className={`flex font-bold truncate text-slate-800 ${isCompact ? 'text-[9px] pl-10' : 'text-[11px] md:text-sm pl-12'} items-start w-full`}>
                <div className="flex items-center gap-1 truncate w-full">
                    {shift.isCancelled && <Ban size={12} className="text-red-500 mr-1 shrink-0" weight="duotone" />}

                    {/* Inline Warnings */}
                    {hasRoleMismatch && !hasMissingRoles && (
                        <AlertTriangle size={12} className="text-amber-500 shrink-0" weight="duotone" />
                    )}
                    {hasMissingRoles && (
                        <AlertTriangle size={12} className="text-red-500 drop-shadow-sm shrink-0" weight="duotone" />
                    )}
                    {hasTeamMismatch && (
                        <span title="ישנם משובצים שאינם מהצוות המוגדר!">
                            <AlertTriangle size={12} className="text-orange-500 shrink-0" weight="duotone" />
                        </span>
                    )}

                    {task.assignedTeamId && (
                        <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded shadow-sm mr-1 shrink-0 font-bold tracking-tight">
                            {teams.find(t => t.id === task.assignedTeamId)?.name}
                        </span>
                    )}
                    <span className="truncate">{task.name}</span>
                </div>
            </div>

            {/* Middle Row - Names (Adaptive - Desktop Only) */}
            {
                (style?.height && parseInt(String(style.height)) >= 45 && assigned.length > 0) && (() => {
                    const cardHeight = parseInt(String(style.height));

                    // A full name chip + gap is roughly 28px. 
                    // Header/Footer take about 32px of space.
                    const maxVerticalNames = Math.max(1, Math.floor((cardHeight - 32) / 28));

                    // Dynamic threshold based on height: taller cards can afford more full names
                    // But we physically cannot fit more than maxVerticalNames vertically.
                    let initialsThreshold = Math.min(
                        cardHeight >= 150 ? 8 : (cardHeight >= 100 ? 5 : 3),
                        maxVerticalNames
                    );

                    // Midnight Crosser Fix: If cut off by day boundaries and visible height is limited, 
                    // be even more aggressive since vertical space is precious.
                    if ((isContinuedFromPrev || isContinuedToNext) && cardHeight < 120) {
                        initialsThreshold = 1; // Show initials even for 2 people if height is tight
                    }

                    const isCrowded = assigned.length > initialsThreshold;

                    return (
                        <div className={`hidden md:flex flex-1 ${isCrowded ? 'flex-row flex-wrap content-center justify-center' : 'flex-col justify-center items-center'} gap-1 overflow-hidden py-0.5 w-full px-1`}>
                            {assigned.map(p => {
                                // Only use initials if it's crowded OR if the name is very long and the card isn't tall enough to wrap it well
                                const useInitials = isCrowded || (assigned.length > 1 && p.name.length > 14 && cardHeight < 120);
                                return (
                                    <div
                                        key={p.id}
                                        className={`shadow-sm border border-slate-200/60 bg-white/95 
                                        ${isCrowded ? 'px-1.5 py-0.5 text-[10px]' : 'w-full max-w-[95%] px-2 py-0.5 text-xs'} 
                                        rounded-full font-bold text-slate-800 truncate text-center hover:scale-105 transition-transform hover:shadow-md cursor-help z-10`}
                                        title={p.name}
                                        onClick={(e) => { e.stopPropagation(); onSelect(shift); }}
                                    >
                                        {useInitials ? getPersonInitials(p.name) : p.name}
                                    </div>
                                );
                            })}
                        </div>
                    );
                })()
            }

            {/* Bottom Row: Info & Avatars (Fallback) */}
            <div className={`flex items-end justify-between ${!(style?.height && parseInt(String(style.height)) >= 50 && assigned.length > 0) ? 'mt-auto' : ''} pt-1 w-full overflow-hidden`}>

                {/* Staffing Count */}
                {(!isCompact || (style?.height && parseInt(String(style.height)) >= 28)) && (
                    <div className={`text-[10px] font-medium leading-none flex-shrink-0 ml-1 mb-0.5 ${hasMissingRoles ? 'text-red-500 font-bold' : 'text-slate-400'}`}>
                        {assigned.length}/{req}
                    </div>
                )}

                {/* Avatars Logic */}
                {(assigned.length > 0 && (!isCompact || (style?.height && parseInt(String(style.height)) >= 32))) && (
                    <div className={`flex -space-x-1.5 space-x-reverse overflow-hidden px-1 pb-0.5 ${(style?.height && parseInt(String(style.height)) >= 50) ? 'md:hidden' : ''}`}>
                        {assigned.map(p => (
                            <div key={p.id} className={`w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center text-[9px] md:text-[10px] text-white font-bold ring-2 ring-white ${p.color} shadow-sm`} title={p.name}>
                                {getPersonInitials(p.name)}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div >
    );
};

interface ClearScheduleModalProps {
    isOpen: boolean;
    onClose: () => void;
    onClear: (params: { startDate: Date; endDate: Date; taskIds?: string[] }) => void;
    tasks: TaskTemplate[];
    initialDate: Date;
}

const ClearScheduleModal: React.FC<ClearScheduleModalProps> = ({ isOpen, onClose, onClear, tasks, initialDate }) => {
    const [mode, setMode] = useState<'single' | 'range'>('single');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (isOpen) {
            const dateStr = initialDate.toISOString().split('T')[0];
            setStartDate(dateStr);
            setEndDate(dateStr);
            setSelectedTaskIds(new Set(tasks.map(t => t.id)));
        }
    }, [isOpen, initialDate, tasks]);

    const handleClear = () => {
        const start = new Date(startDate);
        const end = mode === 'single' ? new Date(startDate) : new Date(endDate);
        onClear({
            startDate: start,
            endDate: end,
            taskIds: Array.from(selectedTaskIds)
        });
        onClose();
    };

    return (
        <GenericModal
            isOpen={isOpen}
            onClose={onClose}
            title={
                <div className="flex flex-col gap-0.5">
                    <h2 className="text-xl md:text-2xl font-black text-slate-800 leading-tight flex items-center gap-2">
                        <Trash2 className="text-red-500" size={20} weight="duotone" />
                        <span>ניקוי לוח</span>
                    </h2>
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-bold uppercase tracking-wider">
                        <span>הסרת שיבוצים בטווח תאריכים</span>
                    </div>
                </div>
            }
            size="md"
            footer={
                <div className="flex gap-3 w-full">
                    <Button variant="ghost" onClick={onClose} className="flex-1">ביטול</Button>
                    <Button
                        onClick={handleClear}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-200"
                        disabled={!startDate || (mode === 'range' && !endDate) || selectedTaskIds.size === 0}
                    >
                        נקה שיבוצים
                    </Button>
                </div>
            }
        >
            <div className="flex flex-col gap-4">
                <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button
                        onClick={() => setMode('single')}
                        className={`flex-1 py-2 px-4 rounded-lg text-xs font-black transition-all ${mode === 'single' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
                    >
                        יום בודד
                    </button>
                    <button
                        onClick={() => setMode('range')}
                        className={`flex-1 py-2 px-4 rounded-lg text-xs font-black transition-all ${mode === 'range' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
                    >
                        טווח תאריכים
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <DatePicker label={mode === 'single' ? 'תאריך' : 'מתאריך'} value={startDate} onChange={setStartDate} />
                    {mode === 'range' && <DatePicker label="עד תאריך" value={endDate} onChange={setEndDate} />}
                </div>

                <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-black text-slate-500 uppercase">בחירת משימות לניקוי ({selectedTaskIds.size})</span>
                        <button
                            onClick={() => setSelectedTaskIds(selectedTaskIds.size === tasks.length ? new Set() : new Set(tasks.map(t => t.id)))}
                            className="text-xs font-bold text-blue-600 hover:underline"
                        >
                            {selectedTaskIds.size === tasks.length ? 'נקה הכל' : 'בחר הכל'}
                        </button>
                    </div>

                    <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
                        {tasks.slice().sort((a, b) => a.name.localeCompare(b.name, 'he')).map(task => (
                            <label
                                key={task.id}
                                className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${selectedTaskIds.has(task.id) ? 'bg-white border-blue-200' : 'bg-slate-50 border-slate-100 opacity-60'}`}
                            >
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    checked={selectedTaskIds.has(task.id)}
                                    onChange={() => {
                                        const next = new Set(selectedTaskIds);
                                        if (next.has(task.id)) next.delete(task.id);
                                        else next.add(task.id);
                                        setSelectedTaskIds(next);
                                    }}
                                />
                                <span className="font-bold text-slate-700 text-sm">{task.name}</span>
                            </label>
                        ))}
                    </div>
                </div>
            </div>
        </GenericModal>
    );
};

export const ScheduleBoard: React.FC<ScheduleBoardProps> = ({
    shifts, missionReports, people, taskTemplates, roles, teams, constraints,
    selectedDate, onDateChange, onSelect, onDelete, isViewer,
    acknowledgedWarnings: propAcknowledgedWarnings, onClearDay, onNavigate, onAssign,
    onUnassign, onAddShift, onUpdateShift, onToggleCancelShift, teamRotations, onRefreshData,
    absences = [], hourlyBlockages = [], settings = null, onAutoSchedule
}) => {
    const activePeople = useMemo(() => people.filter(p => p.isActive !== false), [people]);
    const { profile } = useAuth();
    // Scroll Synchronization Refs
    const verticalScrollRef = useRef<HTMLDivElement>(null);
    const [isCompact, setIsCompact] = useState(false);
    const pixelsPerHour = isCompact ? 26 : 60;
    const headerHeight = isCompact ? 34 : 40;

    // Simplified layout avoids fixed height containers

    // Auto-scroll to current time on mount or date change (if Today)
    // Auto-scroll to current time on mount or date change (if Today)
    useEffect(() => {
        if (verticalScrollRef.current) {
            const now = new Date();
            const isToday = selectedDate.getDate() === now.getDate() &&
                selectedDate.getMonth() === now.getMonth() &&
                selectedDate.getFullYear() === now.getFullYear();

            if (isToday) {
                // Scroll to 1 hour before now for context
                const currentHour = now.getHours();
                const targetHour = Math.max(0, currentHour - 1);
                // Dynamic pixelsPerHour
                const scrollPosition = targetHour * pixelsPerHour;

                // Use requestAnimationFrame to ensure layout is ready
                requestAnimationFrame(() => {
                    if (verticalScrollRef.current) {
                        // Skip auto-scroll on mobile (width < 768px)
                        if (window.innerWidth < 768) return;

                        verticalScrollRef.current.scrollTo({ top: scrollPosition, behavior: 'smooth' });

                        // Fallback check - ensures we scroll even if smooth scroll is interrupted or fails
                        setTimeout(() => {
                            if (verticalScrollRef.current) {
                                const { scrollHeight, clientHeight, scrollTop } = verticalScrollRef.current;
                                const diff = Math.abs(scrollTop - scrollPosition);

                                // Only force scroll if we're significantly off and it's possible to scroll that far
                                if (diff > 20 && (scrollHeight - clientHeight >= scrollPosition)) {
                                    verticalScrollRef.current.scrollTop = scrollPosition;
                                }
                            }
                        }, 500);
                    }
                });
            } else {
                verticalScrollRef.current.scrollTop = 0;
            }
        }
    }, [selectedDate]);

    const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
    const [selectedReportShiftId, setSelectedReportShiftId] = useState<string | null>(null);
    const [filterTaskIds, setFilterTaskIds] = useState<string[]>([]); // NEW: Task Filter State
    const selectedShift = useMemo(() => shifts.find(s => s.id === selectedShiftId), [shifts, selectedShiftId]);
    const selectedReportShift = useMemo(() => shifts.find(s => s.id === selectedReportShiftId), [shifts, selectedReportShiftId]);
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

    const [viewerDaysLimit, setViewerDaysLimit] = useState(2);
    const now = new Date();
    // Local state for warnings
    const [localAcknowledgedWarnings, setLocalAcknowledgedWarnings] = useState<Set<string>>(new Set());
    const acknowledgedWarnings = propAcknowledgedWarnings || localAcknowledgedWarnings;


    const setAcknowledgedWarnings = setLocalAcknowledgedWarnings;

    // Export Modal State
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // New state for mobile action menu
    const [showRotaWizard, setShowRotaWizard] = useState(false);
    const [isClearModalOpen, setIsClearModalOpen] = useState(false);

    // For now assuming local handling to match previous logic found in file.

    const renderFeaturedCard = () => null; // Placeholder to fix build error

    const handleExportToClipboard = async () => {
        try {
            const dateStr = selectedDate.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });
            let text = `📋 *סידור עבודה - ${dateStr}*\n\n`;

            visibleTasks.forEach(task => {
                const taskShifts = shifts.filter(s => {
                    if (s.taskId !== task.id) return false;
                    const shiftStart = new Date(s.startTime);
                    const shiftEnd = new Date(s.endTime);
                    const dayStart = new Date(selectedDate);
                    dayStart.setHours(0, 0, 0, 0);
                    const dayEnd = new Date(selectedDate);
                    dayEnd.setHours(24, 0, 0, 0);
                    return shiftStart < dayEnd && shiftEnd > dayStart;
                }).sort((a, b) => a.startTime.localeCompare(b.startTime));

                if (taskShifts.length > 0) {
                    text += `*${task.name}:*\n`;
                    taskShifts.forEach(shift => {
                        const personnelNames = shift.assignedPersonIds
                            .map(id => people.find(p => p.id === id)?.name)
                            .filter(Boolean)
                            .join(', ');

                        const sStart = new Date(shift.startTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
                        const sEnd = new Date(shift.endTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

                        text += `• ${sStart}-${sEnd}: ${personnelNames || 'לא שובץ'}\n`;
                    });
                    text += '\n';
                }
            });

            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
                showToast('הסידור הועתק ללוח', 'success');
            } else {
                throw new Error('Clipboard API not available');
            }
        } catch (err) {
            console.error('Failed to copy', err);
            showToast('שגיאה בהעתקת הסידור', 'error');
        }
    };
    const dateInputRef = useRef<HTMLInputElement>(null);

    // Measure header height for sticky stacking - REMOVED per user request
    // The simplified layout relies on flexbox and overflow-auto



    const { organization } = useAuth();
    const { showToast } = useToast();

    // Use settings from prop as primary source, fallback to state or default
    const currentViewerDaysLimit = settings?.viewer_schedule_days || viewerDaysLimit;

    useEffect(() => {
        const fetchSettings = async () => {
            if (!organization || settings?.viewer_schedule_days) return;
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
    }, [organization, settings?.viewer_schedule_days]);

    const toggleTeamCollapse = (teamId: string) => {
        const newSet = new Set(collapsedTeams);
        if (newSet.has(teamId)) newSet.delete(teamId);
        else newSet.add(teamId);
        setCollapsedTeams(newSet);
    };







    const visibleTasks = useMemo(() => {
        const dateKey = selectedDate.toLocaleDateString('en-CA');
        const dayOfWeek = selectedDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

        return taskTemplates.filter(task => {
            // 1. Check Global Task Validity (Start/End Date)
            // Ensure we use the same date format as shiftUtils
            const year = selectedDate.getFullYear();
            const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
            const day = String(selectedDate.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;

            // 2. Filter by User Selection
            if (filterTaskIds.length > 0 && !filterTaskIds.includes(task.id)) {
                return false;
            }

            if (task.startDate && dateStr < task.startDate) return false;
            if (task.endDate && dateStr > task.endDate) return false;

            if (!task.segments || task.segments.length === 0) return false;

            return task.segments.some(segment => {
                if (segment.frequency === 'daily') return true;
                if (segment.frequency === 'weekly') {
                    return segment.daysOfWeek?.map(d => d.toLowerCase()).includes(dayOfWeek);
                }
                if (segment.frequency === 'specific_date') {
                    return segment.specificDate === dateKey;
                }
                return false;
            });
        }).sort((a, b) => a.name.localeCompare(b.name, 'he'));
    }, [taskTemplates, selectedDate, filterTaskIds]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const maxViewerDate = useMemo(() => {
        const d = new Date(today);
        d.setDate(today.getDate() + (currentViewerDaysLimit - 1));
        return d;
    }, [today, currentViewerDaysLimit]);

    const isAtViewerLimit = useMemo(() => {
        const startOfSelected = new Date(selectedDate);
        startOfSelected.setHours(0, 0, 0, 0);
        return startOfSelected >= maxViewerDate;
    }, [selectedDate, maxViewerDate]);

    const canGoNext = !isViewer || !isAtViewerLimit;
    const canGoPrev = true;


    const handleDateChange = (newDate: Date) => {
        // Enforce limit in code as well
        if (isViewer && maxViewerDate) {
            const startOfNewDate = new Date(newDate);
            startOfNewDate.setHours(0, 0, 0, 0);
            const startOfMaxDate = new Date(maxViewerDate);
            startOfMaxDate.setHours(0, 0, 0, 0);

            if (startOfNewDate > startOfMaxDate) {
                showToast(`לפי הגדרות המערכת, ניתן לצפות עד ${maxViewerDate.toLocaleDateString('he-IL')}`, 'info');
                return;
            }
        }

        onDateChange(newDate);
        analytics.trackDateChanged(newDate.toISOString());
        logger.log({
            action: 'VIEW',
            entityType: 'page',
            entityName: 'schedule_board',
            metadata: { date: newDate.toISOString().split('T')[0] },
            category: 'navigation'
        });
    };

    const handleShiftSelect = (shift: Shift) => {
        const task = taskTemplates.find(t => t.id === shift.taskId);
        if (task) {
            analytics.trackModalOpen(`shift_management:${task.name}`);
            logger.logClick('shift_card', `task:${task.name}`);
        }
        setSelectedShiftId(shift.id);
    };

    const handleExportClick = async () => {
        analytics.trackButtonClick('export_schedule', 'schedule_board');
        logger.info('EXPORT', 'Copied schedule board to clipboard', { date: selectedDate.toISOString().split('T')[0], category: 'data' });
        await handleExportToClipboard();
    };

    const handleClearDayClick = () => {
        analytics.trackButtonClick('clear_day', 'schedule_board');
        logger.log({ action: 'CLICK', entityType: 'button', entityName: 'clear_day', category: 'scheduling' });
        setIsClearModalOpen(true);
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
    }, [shifts, activePeople, selectedDate, teamRotations]);

    const getShiftConflicts = (shiftId: string) => {
        const shift = shifts.find(s => s.id === shiftId);
        if (!shift) return [];

        const shiftStart = new Date(`${selectedDate.toISOString().split('T')[0]}T${shift.startTime}`);
        const shiftEnd = new Date(`${selectedDate.toISOString().split('T')[0]}T${shift.endTime}`);
        if (shiftEnd < shiftStart) shiftEnd.setDate(shiftEnd.getDate() + 1);

        return conflicts.filter(c => c.shiftId === shiftId);
    };

    return (
        <div className={`flex flex-col gap-2`}>
            {isViewer && renderFeaturedCard()}



            {/* Time Grid Board Container */}
            <div className={`bg-white rounded-[2rem] border border-slate-100 ${isCompact ? 'p-2 md:p-3' : 'p-4 md:p-6'} flex flex-col flex-1 relative overflow-hidden`}>

                <ExportScheduleModal
                    isOpen={isExportModalOpen}
                    onClose={() => setIsExportModalOpen(false)}
                    shifts={shifts}
                    people={activePeople}
                    tasks={visibleTasks}
                />

                <ClearScheduleModal
                    isOpen={isClearModalOpen}
                    onClose={() => setIsClearModalOpen(false)}
                    onClear={onClearDay}
                    tasks={taskTemplates}
                    initialDate={selectedDate}
                />

                {/* Controls Header - Sticky - SINGLE ROW LAYOUT */}
                <div className={`flex flex-col md:flex-row items-center justify-between gap-2 ${isCompact ? 'mb-1' : 'mb-2'} flex-shrink-0 sticky top-0 z-50 bg-white pb-2 border-b border-transparent`}>

                    {/* Right Side: Title, Info, Stats */}
                    <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
                        <div className="flex items-center gap-2">
                            <h3 className="text-xl font-black text-slate-800 tracking-tight">לוח שיבוצים</h3>
                            <PageInfo
                                title="על לוח השיבוצים"
                                description={
                                    <>
                                        <p className="mb-2">כאן תוכלו לראות את סידור השיבוצים למשימות של הפלוגה.</p>
                                        <ul className="list-disc list-inside space-y-1 mb-2 text-right">
                                            <li>ניתן לגרור משמרות כדי לשנות שיבוץ (במחשב).</li>
                                            <li>לחיצה על משמרת פותחת פרטים נוספים ואפשרויות עריכה.</li>
                                        </ul>
                                        <p className="font-bold mb-1">שיבוץ אוטומטי:</p>
                                        <p className="mb-2">
                                            המערכת יודעת לשבץ את הלוחמים בצורה חכמה תוך התחשבות בזמינות, אילוצים, והיסטוריית שיבוצים כדי לשמור על הוגנות.
                                        </p>
                                    </>
                                }
                            />
                        </div>

                        {/* Availability Badge (Hidden on very small screens if crowded, but useful) */}
                        {!isViewer && (() => {
                            const dateKey = selectedDate.toLocaleDateString('en-CA');
                            const unavailableCount = activePeople.filter(p => {
                                // if (p.unavailableDates?.includes(dateKey)) return true; // Removed invalid property
                                if (p.dailyAvailability?.[dateKey]?.isAvailable === false) return true;
                                return false;
                            }).length;
                            const availableCount = activePeople.length - unavailableCount;

                            return (
                                <div className="flex items-center gap-2 bg-gradient-to-r from-emerald-50 to-green-50 px-3 py-1.5 rounded-full border border-emerald-200">
                                    <User size={14} className="text-emerald-600" weight="duotone" />
                                    <span className="text-xs font-bold text-emerald-700">
                                        זמינים: {availableCount}/{activePeople.length}
                                    </span>
                                </div>
                            );
                        })()}
                    </div>

                    {/* Center/Left: Date Navigation & Actions */}
                    <div className="flex flex-row items-center gap-2 w-full md:w-auto">

                        {/* Task Filter (Desktop) */}
                        <div className="hidden xl:block w-64 z-50">
                            <MultiSelect
                                options={taskTemplates.map(t => ({ value: t.id, label: t.name }))}
                                value={filterTaskIds}
                                onChange={setFilterTaskIds}
                                placeholder="סנן לפי משימות..."
                                className="bg-white"
                            />
                        </div>

                        {/* Date Navigation */}
                        <DateNavigator
                            date={selectedDate}
                            onDateChange={handleDateChange}
                            canGoPrev={canGoPrev}
                            canGoNext={canGoNext}
                            maxDate={isViewer ? maxViewerDate : undefined}
                            className="flex-1 md:w-auto"
                        />

                        {/* Action Buttons */}
                        <div className="flex gap-2 w-auto relative">
                            {/* Desktop Actions */}
                            <div className="hidden md:flex gap-2">

                                <ExportButton
                                    onExport={async () => { setIsExportModalOpen(true); }}
                                    label="ייצוא"
                                    variant="secondary"
                                    size="sm"
                                    className="h-9 px-4"
                                />

                                <button onClick={handleExportClick} className="flex items-center justify-center gap-2 text-slate-700 hover:text-indigo-700 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 h-9 px-4 rounded-xl text-xs font-bold transition-all shadow-sm">
                                    <Copy size={14} weight="duotone" />
                                    <span>העתק</span>
                                </button>

                                {!isViewer && (
                                    <button onClick={handleClearDayClick} className="flex items-center justify-center gap-2 text-slate-700 hover:text-red-700 bg-white hover:bg-red-50 border border-slate-200 hover:border-red-300 h-9 px-4 rounded-xl text-xs font-bold transition-all shadow-sm">
                                        <Trash2 size={14} weight="duotone" />
                                        <span>נקה</span>
                                    </button>
                                )}

                                <button
                                    onClick={() => setIsCompact(!isCompact)}
                                    className={`flex items-center justify-center gap-2 h-9 px-4 rounded-xl text-xs font-bold transition-all shadow-sm border ${isCompact
                                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-inner'
                                        : 'bg-white text-slate-700 border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300'
                                        }`}
                                    title={isCompact ? "הרחב" : "כווץ"}
                                >
                                    {isCompact ? <ArrowsOutSimple size={14} weight="bold" /> : <ArrowsInSimple size={14} weight="bold" />}
                                    <span>{isCompact ? "הרחב" : "כווץ"}</span>
                                </button>
                            </div>

                            {/* Mobile Actions Dropdown */}
                            <div className="md:hidden">
                                <button
                                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                    className="w-12 h-12 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-700 active:bg-slate-50 transition-colors !shadow-none" // Rule 1: 48px touch target
                                    aria-label="More actions"
                                >
                                    <MoreVertical size={24} weight="bold" /> {/* Rule 2: Larger icon for readability */}
                                </button>

                                <GenericModal
                                    isOpen={isMobileMenuOpen}
                                    onClose={() => setIsMobileMenuOpen(false)}
                                    title="פעולות נוספות"
                                    size="sm"
                                >
                                    <div className="flex flex-col gap-2">
                                        <div className="mb-2">
                                            <span className="text-xs font-bold text-slate-500 mb-1 block">סינון משימות</span>
                                            <MultiSelect
                                                options={taskTemplates.map(t => ({ value: t.id, label: t.name }))}
                                                value={filterTaskIds}
                                                onChange={setFilterTaskIds}
                                                placeholder="סנן משימות..."
                                                className="bg-slate-50 w-full"
                                            />
                                        </div>
                                        <button
                                            onClick={() => { setIsExportModalOpen(true); setIsMobileMenuOpen(false); }}
                                            className="flex items-center gap-4 px-4 py-3.5 bg-slate-50 text-slate-700 hover:bg-slate-100 active:bg-slate-200 rounded-xl transition-colors text-right w-full"
                                        >
                                            <div className="p-2 bg-emerald-50 rounded-lg flex items-center justify-center">
                                                <img src="/images/excel.svg" alt="Excel" width={22} height={22} className="object-contain" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-base text-slate-800">ייצוא נתונים</span>
                                                <span className="text-xs text-slate-500">הורדת סידור העבודה כקובץ</span>
                                            </div>
                                        </button>

                                        <button
                                            onClick={() => { handleExportClick(); setIsMobileMenuOpen(false); }}
                                            className="flex items-center gap-4 px-4 py-3.5 bg-slate-50 text-slate-700 hover:bg-slate-100 active:bg-slate-200 rounded-xl transition-colors text-right w-full"
                                        >
                                            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                                                <Copy size={22} weight="duotone" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-base text-slate-800">העתק לוח</span>
                                                <span className="text-xs text-slate-500">העתקת תמונת מצב לווצאפ</span>
                                            </div>
                                        </button>

                                        <button
                                            onClick={() => { setIsCompact(!isCompact); setIsMobileMenuOpen(false); }}
                                            className="flex items-center gap-4 px-4 py-3.5 bg-slate-50 text-slate-700 hover:bg-slate-100 active:bg-slate-200 rounded-xl transition-colors text-right w-full"
                                        >
                                            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                                                {isCompact ? <ArrowsOutSimple size={22} weight="duotone" /> : <ArrowsInSimple size={22} weight="duotone" />}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-base text-slate-800">{isCompact ? "הרחב" : "כווץ"}</span>
                                                <span className="text-xs text-slate-500">{isCompact ? "חזרה לתצוגה מרווחת" : "כיווץ הלוח למסך אחד"}</span>
                                            </div>
                                        </button>

                                        {!isViewer && (
                                            <button
                                                onClick={() => { handleClearDayClick(); setIsMobileMenuOpen(false); }}
                                                className="flex items-center gap-4 px-4 py-3.5 bg-red-50 text-red-700 hover:bg-red-100 active:bg-red-200 rounded-xl transition-colors text-right w-full mt-2"
                                            >
                                                <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                                                    <Trash2 size={22} weight="duotone" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-base text-red-700">נקה יום</span>
                                                    <span className="text-xs text-red-500/80">מחיקת כל השיבוצים ליום זה</span>
                                                </div>
                                            </button>
                                        )}
                                    </div>
                                </GenericModal>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Scrollable Grid Area */}
                <div
                    ref={verticalScrollRef}
                    className="flex-1 overflow-auto relative border-t border-slate-200"
                >

                    {/* MOBILE VIEW - Removed internal scroll to let parent handle it */}
                    <div className="block md:hidden p-4">
                        <MobileScheduleList
                            shifts={shifts}
                            people={activePeople}
                            missionReports={missionReports}
                            taskTemplates={visibleTasks} // RESPECT FILTERS
                            roles={roles}
                            teams={teams}
                            selectedDate={selectedDate}
                            isViewer={isViewer}
                            onSelectShift={handleShiftSelect}
                            onToggleCancelShift={onToggleCancelShift}
                            onReportClick={(shift) => setSelectedReportShiftId(shift.id)}
                        />
                    </div>


                    <div
                        className="hidden md:grid relative min-w-max"
                        // Grid: עמודה 1 (ציר שעות) רוחב קבוע. עמודה 2 תופסת את השאר.
                        style={{ gridTemplateColumns: 'min-content 1fr' }}
                    >

                        {/* ======================================================== */}
                        {/* CELL 1,1: CORNER (הפינה הקבועה) - Sticky Right/Top */}
                        {/* ======================================================== */}
                        <div
                            className="sticky right-0 top-0 z-40 bg-slate-50 border-b border-l border-slate-200"
                            style={{ height: headerHeight }}
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
                            // הכותרת נדבקת למעלה. גלילה אופקית מנוהלת ע"י ההורה verticalScrollRef.
                            className="sticky top-0 z-30 bg-white shadow-sm border-b border-slate-200"
                            style={{ height: headerHeight }}
                        >
                            {/* Task Headers: הרוחב המינימלי יוצר את הגלילה ב-overflow-x-auto של ההורה */}
                            <div className="flex relative">
                                {visibleTasks.map(task => (
                                    <div
                                        key={task.id}
                                        className="min-w-[130px] md:min-w-[260px] flex-1 border-l border-b-2"
                                        style={{
                                            height: headerHeight,
                                            backgroundColor: hexToRgba(task.color, 0.4), // Increased visibility
                                            borderTopColor: task.color,
                                            borderTopWidth: 3,
                                            borderColor: 'rgb(241 245 249)', // slate-200 for side borders
                                        }}
                                    >
                                        <h4 className={`font-bold text-slate-800 ${isCompact ? 'text-[10px] pt-1' : 'text-xs md:text-sm pt-2'} truncate w-full px-2 text-center`}>{task.name}</h4>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* ======================================================== */}
                        {/* CELL 2,1: SIDE AXIS (ציר השעות האנכי) - Sticky רק ב-RIGHT */}
                        {/* ======================================================== */}
                        <div className="sticky right-0 z-20 bg-slate-50 border-l border-slate-100">
                            {Array.from({ length: 25 }).map((_, i) => (
                                <div key={i} className="border-t border-dashed border-slate-300 text-[9px] md:text-xs text-slate-400 font-bold flex justify-center pt-1 relative" style={{ height: pixelsPerHour }}>
                                    <span className="bg-slate-50 px-0.5 md:px-1">{i.toString().padStart(2, '0')}:00</span>
                                </div>
                            ))}
                        </div>

                        {/* ======================================================== */}
                        {/* CELL 2,2: MAIN CONTENT (גוף המשימות) - גלילה אופקית פנימית */}
                        {/* ======================================================== */}
                        <div
                            className="relative"
                        >
                            {/* ה-min-w-max כאן חשוב כדי שכל המשמרות יכנסו */}
                            <div className="flex relative">

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
                                            className="min-w-[130px] md:min-w-[260px] flex-1 border-l border-slate-100 relative"
                                            style={{ backgroundColor: hexToRgba(task.color, 0.2), height: pixelsPerHour * 24 }} // Increased visibility
                                        >
                                            {/* Grid Lines */}
                                            <div className="absolute inset-0 pointer-events-none">
                                                {Array.from({ length: 25 }).map((_, i) => (
                                                    <div key={i} className="border-t border-dashed border-slate-300/50" style={{ height: pixelsPerHour }}></div>
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

                                                const top = getPositionFromTime(effectiveStart, pixelsPerHour);
                                                const height = getHeightFromDuration(effectiveStart, effectiveEnd, pixelsPerHour);
                                                const isContinuedFromPrev = shiftStart < dayStart;
                                                const isContinuedToNext = shiftEnd > dayEnd;

                                                return (
                                                    <ShiftCard
                                                        key={shift.id}
                                                        shift={shift}
                                                        missionReports={missionReports}
                                                        taskTemplates={taskTemplates}
                                                        people={activePeople}
                                                        roles={roles}
                                                        teams={teams}
                                                        onSelect={handleShiftSelect}
                                                        onToggleCancel={onToggleCancelShift || (() => { })}
                                                        isViewer={isViewer}
                                                        acknowledgedWarnings={acknowledgedWarnings}
                                                        onReportClick={(shift) => setSelectedReportShiftId(shift.id)}
                                                        isContinuedFromPrev={isContinuedFromPrev}
                                                        isContinuedToNext={isContinuedToNext}
                                                        isCompact={isCompact}
                                                        style={{
                                                            top: `${top}px`,
                                                            height: `${Math.max(height, isCompact ? 18 : 30)}px`,
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
                                const top = getPositionFromTime(now, pixelsPerHour) + headerHeight;
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
                        <div className="absolute inset-0 col-span-full flex flex-col items-center justify-center p-12 text-center animate-in fade-in zoom-in duration-500">
                            <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mb-6 shadow-sm border border-slate-100/50">
                                <ClipboardIcon size={48} className="text-slate-300" weight="duotone" />
                            </div>
                            <h3 className="text-2xl font-black text-slate-800 mb-2 tracking-tight">אין עדיין משימות להצגה</h3>
                            <p className="text-slate-500 max-w-sm mb-8 font-medium leading-relaxed">
                                כדי להתחיל לשבץ, עליך להגדיר את משימות הפלוגה (שמירות, סיורים, תורנויות וכו').
                            </p>
                            {!isViewer && (
                                <Button
                                    onClick={() => onNavigate('tasks')}
                                    variant="primary"
                                    className="px-8 py-6 rounded-2xl shadow-xl shadow-blue-200 font-black text-lg group active:scale-95 transition-all"
                                >
                                    <Plus size={20} weight="bold" className="ml-2 group-hover:rotate-90 transition-transform" />
                                    צור משימה ראשונה
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </div>
            {selectedShift && (
                <AssignmentModal
                    selectedShift={selectedShift}
                    task={taskTemplates.find(t => t.id === selectedShift.taskId)!}
                    people={activePeople}
                    roles={roles}
                    teams={teams}
                    shifts={shifts}
                    selectedDate={selectedDate}
                    teamRotations={teamRotations}
                    constraints={constraints}
                    interPersonConstraints={settings?.interPersonConstraints || []}
                    settings={settings}
                    absences={absences}
                    hourlyBlockages={hourlyBlockages}
                    isViewer={isViewer}
                    onClose={() => setSelectedShiftId(null)}
                    onAssign={onAssign}
                    onUnassign={onUnassign}
                    onUpdateShift={onUpdateShift}
                    onToggleCancelShift={onToggleCancelShift}
                />
            )}

            {selectedReportShift && (() => {
                const task = taskTemplates.find(t => t.id === selectedReportShift.taskId);
                if (!task) return null;
                return (
                    <MissionReportModal
                        shift={selectedReportShift}
                        task={task}
                        people={activePeople}
                        roles={roles}
                        isViewer={isViewer}
                        onClose={() => setSelectedReportShiftId(null)}
                        onRefreshData={onRefreshData}
                    />
                );
            })()}

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

            {showRotaWizard && (
                <RotaWizardModal
                    isOpen={showRotaWizard}
                    onClose={() => setShowRotaWizard(false)}
                    people={activePeople}
                    teams={teams}
                    roles={roles}
                    tasks={taskTemplates}
                    constraints={constraints}
                    absences={absences}
                    settings={settings}
                    teamRotations={teamRotations}
                    hourlyBlockages={hourlyBlockages}
                    onSaveRoster={(roster: DailyPresence[]) => { }}
                />
            )}

            <FloatingActionButton
                icon={Wand2}
                onClick={onAutoSchedule || (() => { })}
                ariaLabel="שיבוץ אוטומטי"
                show={!isViewer && !!onAutoSchedule}
                variant="action"
            />
        </div>
    );
};
