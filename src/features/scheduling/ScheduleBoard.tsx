import React, { useState, useMemo, useEffect, useRef, useLayoutEffect } from 'react';

import { GenericModal } from '../../components/ui/GenericModal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { DatePicker } from '../../components/ui/DatePicker';
import { Shift, Person, TaskTemplate, Role, Team, TeamRotation, MissionReport, Absence, DailyPresence } from '../../types';
import { generateShiftsForTask } from '../../utils/shiftUtils';
import { getEffectiveAvailability } from '../../utils/attendanceUtils';
import { validateAssignment } from '../../utils/assignmentValidation';
import { getPersonInitials } from '../../utils/nameUtils';
import { DateNavigator } from '../../components/ui/DateNavigator';
import {
    ArrowsInSimple, ArrowsOutSimple, ArrowCounterClockwise as RotateCcw,
    Sparkle, Sparkle as Sparkles, FileText, Warning, ArrowsOut, ArrowsIn,
    CaretLeft as ChevronLeft, CaretRight as ChevronRight, Plus, X, Check,
    Warning as AlertTriangle, Clock, ClockCounterClockwise, User, MapPin,
    CalendarBlank as CalendarIcon, PencilSimple as Pencil, FloppyDisk as Save,
    Trash as Trash2, Copy, CheckCircle, Prohibit as Ban, ArrowUUpLeft as Undo2,
    CaretDown as ChevronDown, MagnifyingGlass as Search, DotsThreeVertical as MoreVertical,
    MagicWand as Wand2, ClipboardText as ClipboardIcon, Funnel, Info, WhatsappLogo,
    CornersOut, CornersIn, MicrosoftExcelLogo, DotsThreeOutline, Flask, Coffee, Crown
} from '@phosphor-icons/react';
import { DropdownMenu } from '../../components/ui/DropdownMenu';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';
import { MobileScheduleList } from './MobileScheduleList';
import { MultiSelect } from '../../components/ui/MultiSelect';
import { Tooltip } from '../../components/ui/Tooltip';
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
import { IdlePersonnelInsights } from './IdlePersonnelInsights';
import { ComplianceInsights } from './ComplianceInsights';
import { FeatureTour, TourStep } from '@/components/ui/FeatureTour';
import { FileArrowDown as FileDown } from '@phosphor-icons/react';
import { DraftControl } from './DraftControl';
import { ActivityFeed } from '../../components/ui/ActivityFeed';
import { AuditLog, fetchSchedulingLogs, subscribeToAuditLogs } from '../../services/auditService';
import { AutoScheduleModal } from './AutoScheduleModal';
import { solveSchedule, SchedulingSuggestion } from '../../services/scheduler';
import { fetchUserHistory, calculateHistoricalLoad } from '../../services/historyService';
import { mapShiftToDB } from '../../services/supabaseClient';
import { WeeklyPersonnelGrid } from './WeeklyPersonnelGrid';
import { UnassignedTaskBank } from './UnassignedTaskBank';
import { List, Calendar as CalendarIconAlt, Layout, Columns } from '@phosphor-icons/react';

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
    onAssign: (shiftId: string, personId: string, taskName?: string, forceAssignment?: boolean) => void;
    onUnassign: (shiftId: string, personId: string, taskName?: string) => void;
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
    initialPersonFilterId?: string;
    onClearNavigationAction?: () => void;
    onBulkUpdateShifts?: (shifts: Shift[]) => Promise<void>;
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

export const hexToRgba = (hex: string, alpha: number) => {
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
    hasAbsenceConflict?: boolean;
    hasRestViolation?: boolean; // NEW
    shiftConflicts?: { personId: string; type: string; reason?: string }[]; // NEW
    isDraft?: boolean;
    isModified?: boolean;
}> = ({ shift, taskTemplates, people, roles, teams, onSelect, onToggleCancel, onReportClick, isViewer, acknowledgedWarnings, missionReports, style, onAutoSchedule, isContinuedFromPrev, isContinuedToNext, isCompact, hasAbsenceConflict, hasRestViolation, shiftConflicts = [], isDraft, isModified }) => {
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
    const isUnderStaffed = assigned.length < req;
    const isOverStaffed = assigned.length > req;

    // Determine status color
    let bgColor = 'bg-blue-50';
    let borderColor = 'border-blue-200';
    if (shift.isCancelled) {
        bgColor = 'bg-slate-100'; borderColor = 'border-slate-300';
    }
    else if (assigned.length === 0) {
        bgColor = 'bg-white';
    }
    else {
        if (!isUnderStaffed && !isOverStaffed && !hasMissingRoles) {
            bgColor = isDraft && isModified ? 'bg-emerald-100 hover:bg-emerald-200' : 'bg-green-50';
            borderColor = isDraft && isModified ? 'border-emerald-400' : 'border-green-200';
        } else if (isUnderStaffed || hasMissingRoles) {
            bgColor = isDraft && isModified ? 'bg-amber-100 hover:bg-amber-200' : 'bg-amber-50';
            borderColor = isDraft && isModified ? 'border-amber-400' : 'border-amber-200';
        } else if (isOverStaffed) {
            bgColor = 'bg-purple-50';
            borderColor = 'border-purple-200';
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
                    <FileText size={14} weight={missionReports.find(r => r.shift_id === shift.id)?.submitted_at ? "fill" : "bold"} className={missionReports.find(r => r.shift_id === shift.id)?.submitted_at ? "text-blue-600" : ""} />
                </button>
                {!isViewer && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onToggleCancel(shift.id); }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 bg-white/50 hover:bg-white rounded shadow-sm text-slate-400 hover:text-red-500 transition-all border border-transparent hover:border-slate-200"
                        title={shift.isCancelled ? 'הפעל משמרת' : 'בטל משמרת'}
                    >
                        {shift.isCancelled ? <RotateCcw size={12} className="text-blue-500" weight="bold" /> : <Ban size={12} weight="bold" />}
                    </button>
                )}
            </div>

            {/* Top Row: Task Name */}
            <div className={`flex font-bold truncate text-slate-800 ${isCompact ? 'text-[9px] pl-10' : 'text-[11px] md:text-sm pl-12'} items-start w-full`}>
                <div className="flex items-center gap-1 truncate w-full">
                    {shift.isCancelled && <Ban size={12} className="text-red-500 mr-1 shrink-0" weight="bold" />}

                    {/* Inline Warnings */}
                    {hasRoleMismatch && !hasMissingRoles && (
                        <AlertTriangle size={12} className="text-amber-500 shrink-0" weight="bold" />
                    )}
                    {hasMissingRoles && (
                        <AlertTriangle size={12} className="text-red-500 drop-shadow-sm shrink-0" weight="bold" />
                    )}
                    {hasTeamMismatch && (
                        <span title="ישנם משובצים שאינם מהצוות המוגדר!">
                            <AlertTriangle size={12} className="text-orange-500 shrink-0" weight="bold" />
                        </span>
                    )}
                    {hasAbsenceConflict && (
                        <span title="חייל בבית / לא זמין במערכת הנוכחות">
                            <Ban size={12} className="text-red-500 shrink-0 animate-pulse" weight="bold" />
                        </span>
                    )}
                    {hasRestViolation && (
                        <span title="חייל ללא זמן מנוחה מספיק">
                            <ClockCounterClockwise size={12} className="text-red-600 shrink-0" weight="bold" />
                        </span>
                    )}
                    {isOverStaffed && (
                        <span title="חריגה מהתקן (יותר מדי אנשים)">
                            <Plus size={12} className="text-purple-600 shrink-0" weight="bold" />
                        </span>
                    )}

                    {task.assignedTeamId && (
                        <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded shadow-sm mr-1 shrink-0 font-bold tracking-tight">
                            {teams.find(t => t.id === task.assignedTeamId)?.name}
                        </span>
                    )}
                    <span className="truncate">{task.name}</span>
                    {isDraft && isModified && (
                        <div className="bg-blue-600 text-white text-[8px] font-black px-1 rounded-sm uppercase tracking-tighter shrink-0 animate-pulse ml-auto">טיוטה</div>
                    )}
                </div>
            </div>

            {/* Middle Row - Names (Adaptive - Desktop Only) */}
            {
                (style?.height && parseInt(String(style.height)) >= 45 && assigned.length > 0) && (() => {
                    const cardHeight = parseInt(String(style.height));

                    // A full name chip + gap is roughly 24px vertically. 
                    // Header/Footer take about 32px of space.
                    const maxVerticalNames = Math.max(1, Math.floor((cardHeight - 32) / 24));

                    // If we have fewer people than available vertical slots, we can show full names in a column
                    // We only use horizontal wrapping if we have many people OR if the box is relatively short
                    const isCrowded = assigned.length > maxVerticalNames || cardHeight < 120;

                    return (
                        <div className={`hidden md:flex flex-1 ${isCrowded ? 'flex-row flex-wrap content-center justify-center' : 'flex-col justify-center items-center'} gap-1 overflow-hidden py-0.5 w-full px-1`}>
                            {assigned.map(p => {
                                // Only use initials if it's EXTREMELY crowded (e.g. 3x the vertical capacity)
                                // Otherwise, show full names and let truncation/wrapping handle it.
                                const useInitials = assigned.length > (maxVerticalNames * 3) && cardHeight < 150;
                                const conflict = shiftConflicts.find(c => c.personId === p.id && c.type === 'absence');
                                const isProblematic = !!conflict;
                                return (
                                    <div
                                        key={p.id}
                                        className={`shadow-sm border 
                                        ${isProblematic ? 'border-red-400 bg-red-50 text-red-600 animate-pulse' : 'border-slate-200/60 bg-white/95 text-slate-800'}
                                        ${isCrowded ? 'px-2 py-0.5 text-[10px] max-w-[120px]' : 'w-full max-w-[95%] px-2 py-0.5 text-xs'} 
                                        rounded-full font-bold truncate text-center hover:scale-105 transition-transform hover:shadow-md cursor-help z-10 flex items-center justify-center gap-1`}
                                        title={isProblematic ? `${p.name}: ${conflict.reason}` : (shift.metadata?.commanderId === p.id ? `${p.name} (מפקד)` : p.name)}
                                        onClick={(e) => { e.stopPropagation(); onSelect(shift); }}
                                    >
                                        {useInitials ? getPersonInitials(p.name) : p.name}
                                        {shift.metadata?.commanderId === p.id && <Crown size={10} weight="fill" className="text-amber-500 shrink-0" />}
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
                    <div className={`text-[10px] font-medium leading-none flex-shrink-0 ml-1 mb-0.5 ${hasMissingRoles || isUnderStaffed ? 'text-red-500 font-bold' : (isOverStaffed ? 'text-purple-600 font-bold' : 'text-slate-400')}`}>
                        {assigned.length}/{req}
                    </div>
                )}

                {/* Avatars Logic */}
                {(assigned.length > 0 && (!isCompact || (style?.height && parseInt(String(style.height)) >= 32))) && (
                    <div className={`flex -space-x-1.5 space-x-reverse overflow-hidden px-1 pb-0.5 ${(style?.height && parseInt(String(style.height)) >= 50) ? 'md:hidden' : ''}`}>
                        {assigned.map(p => {
                            const conflict = shiftConflicts.find(c => c.personId === p.id && c.type === 'absence');
                            const isProblematic = !!conflict;
                            return (
                                <div key={p.id} className={`w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center text-[9px] md:text-[10px] text-white font-bold ring-2 ${isProblematic ? 'ring-red-500 animate-pulse' : (shift.metadata?.commanderId === p.id ? 'ring-amber-400' : 'ring-white')} ${p.color} shadow-sm relative`} title={isProblematic ? `${p.name}: ${conflict.reason}` : p.name}>
                                    {getPersonInitials(p.name)}
                                    {isProblematic && (
                                        <div className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full p-0.5 border border-white">
                                            <Ban size={6} weight="bold" />
                                        </div>
                                    )}
                                    {shift.metadata?.commanderId === p.id && (
                                        <div className="absolute -top-1 -right-1 bg-amber-500 text-white rounded-full p-[1px] border border-white z-10">
                                            <Crown size={8} weight="fill" />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
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
                        <Trash2 className="text-red-500" size={20} weight="bold" />
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
    absences = [], hourlyBlockages = [], settings = null, onAutoSchedule,
    initialPersonFilterId, onClearNavigationAction, onBulkUpdateShifts
}) => {
    const [isDraftMode, setIsDraftMode] = useState(false);
    const [draftShifts, setDraftShifts] = useState<Shift[]>([]);
    const [isPublishing, setIsPublishing] = useState(false);

    // Initial sync when entering Draft Mode
    const toggleDraftMode = () => {
        if (!isDraftMode) {
            setDraftShifts(shifts);
            setIsDraftMode(true);
            showToast('נכנסת למצב טיוטה - השינויים לא יישמרו עד לפרסום', 'info');
        } else {
            if (changeCount > 0) {
                setConfirmationState({
                    isOpen: true,
                    title: 'ביטול מצב טיוטה',
                    message: 'ישנם שינויים שלא נשמרו. האם אתה בטוח שברצונך לבטל אותם?',
                    onConfirm: () => {
                        setIsDraftMode(false);
                        setDraftShifts([]);
                        setConfirmationState(prev => ({ ...prev, isOpen: false }));
                    },
                    type: 'danger',
                    confirmText: 'בטל שינויים'
                });
            } else {
                setIsDraftMode(false);
                setDraftShifts([]);
            }
        }
    };

    const handlePublishDraft = async () => {
        if (!onBulkUpdateShifts) return;
        setIsPublishing(true);
        try {
            // Find ALL modified shifts in draft
            const modifiedShifts = draftShifts.filter(ds => {
                const os = shifts.find(s => s.id === ds.id);
                if (!os) return true;
                return JSON.stringify(ds.assignedPersonIds) !== JSON.stringify(os.assignedPersonIds) ||
                    ds.isCancelled !== os.isCancelled ||
                    ds.startTime !== os.startTime ||
                    ds.endTime !== os.endTime;
            });

            if (modifiedShifts.length > 0) {
                await onBulkUpdateShifts(modifiedShifts);
            }
            setIsDraftMode(false);
            setDraftShifts([]);
        } catch (err) {
            // Error handled by parent
        } finally {
            setIsPublishing(false);
        }
    };

    const effectiveShifts = isDraftMode ? draftShifts : shifts;

    const changeCount = useMemo(() => {
        if (!isDraftMode) return 0;
        return draftShifts.filter(ds => {
            const os = shifts.find(s => s.id === ds.id);
            if (!os) return true;
            return JSON.stringify(ds.assignedPersonIds) !== JSON.stringify(os.assignedPersonIds) ||
                ds.isCancelled !== os.isCancelled;
        }).length;
    }, [isDraftMode, draftShifts, shifts]);

    // Wrapped Handlers
    const performAssign = (shiftId: string, personId: string, taskName?: string) => {
        if (isDraftMode) {
            setDraftShifts(prev => prev.map(s => s.id === shiftId ? { ...s, assignedPersonIds: [...s.assignedPersonIds, personId] } : s));
        } else {
            onAssign(shiftId, personId, taskName, true); // Forced call
        }
    };

    const handleDraftAssign = (shiftId: string, personId: string, taskName?: string, forceAssignment = false) => {
        if (isViewer) return;
        const shift = effectiveShifts.find(s => s.id === shiftId);
        if (!shift) return;

        // Skip validations if forced
        if (!forceAssignment) {
            const person = people.find(p => p.id === personId);
            if (!person) return;

            const validation = validateAssignment({
                shift,
                person,
                allShifts: effectiveShifts,
                constraints: constraints, // Ensure constraints are passed via props or state
                teamRotations,
                absences,
                hourlyBlockages,
                roles // Ensure roles are passed via props or state
            });

            // REVISED STRATEGY:
            // Group reasons.
            const reasons = [];
            if (validation.hardConstraintReason) reasons.push(validation.hardConstraintReason);
            if (validation.attendanceReason) reasons.push(validation.attendanceReason);
            if (validation.operationalReason) reasons.push(validation.operationalReason);

            if (reasons.length > 0) {
                setConfirmationState({
                    isOpen: true,
                    title: 'אזהרת שיבוץ',
                    message: `שים לב: ${person.name} ${reasons.join(', ')}. האם ברצונך לבצע את השיבוץ בכל זאת?`,
                    onConfirm: () => {
                        performAssign(shiftId, personId, taskName);
                        setConfirmationState(prev => ({ ...prev, isOpen: false }));
                    },
                    type: validation.isHardConstraintViolation ? 'danger' : 'warning',
                    confirmText: 'שבץ בכל זאת'
                });
                return;
            }
        }

        performAssign(shiftId, personId, taskName);
    };

    const handleDraftUnassign = (shiftId: string, personId: string, taskName?: string) => {
        if (isViewer) return;
        if (isDraftMode) {
            setDraftShifts(prev => prev.map(s => s.id === shiftId ? { ...s, assignedPersonIds: s.assignedPersonIds.filter(id => id !== personId) } : s));
        } else {
            onUnassign(shiftId, personId, taskName);
        }
    };

    const handleDraftToggleCancel = (shiftId: string) => {
        if (isViewer) return;
        if (isDraftMode) {
            setDraftShifts(prev => prev.map(s => s.id === shiftId ? { ...s, isCancelled: !s.isCancelled } : s));
        } else {
            onToggleCancelShift?.(shiftId);
        }
    };

    const handleDraftUpdateShift = (updatedShift: Shift) => {
        if (isDraftMode) {
            setDraftShifts(prev => prev.map(s => s.id === updatedShift.id ? updatedShift : s));
        } else {
            onUpdateShift?.(updatedShift);
        }
    };


    const { profile } = useAuth();

    // Handle initial person filter from Command Palette
    useEffect(() => {
        if (initialPersonFilterId) {
            setFilterPersonIds([initialPersonFilterId]);
            onClearNavigationAction?.();
        }
    }, [initialPersonFilterId, onClearNavigationAction]);
    // Scroll Synchronization Refs
    const verticalScrollRef = useRef<HTMLDivElement>(null);
    const [isCompact, setIsCompact] = useState(true); // Default to compact view
    const pixelsPerHour = isCompact ? 26 : 60;
    const headerHeight = isCompact ? 34 : 40;

    /**
     * DEEP ANALYSIS: GRID & LAYOUT ARCHITECTURE (FINAL REFINE)
     * -------------------------------------------------------
     * 1. THE VIEWPORT LOCK (FLEXBOX STRATEGY):
     *    Problem: Locking the *internal* grid height caused overflow when padding changed (Normal View).
     *    Solution: Lock the **PARENT CONTAINER** (White Box) and let the grid fill remaining space.
     *    
     *    Height Calculation (Desktop):
     *    100vh - (Navbar 64px + Layout Padding 48px + Margins 8px) ≈ 120px offset.
     * 
     * 2. COMPONENT HIERARCHY:
     *    - Board Container: `h-[calc(100vh-120px)] flex flex-col overflow-hidden`.
     *      This strictly bounds the entire white card to the screen.
     *    - Action Bar: `flex-shrink-0`. Fixed at top.
     *    - Grid Scroll Area: `flex-1 overflow-auto`. 
     *      Automatically shrinks/grows to fit the remaining space inside the White Box.
     * 
     * 3. RESULT:
     *    - Compact View: Grid gets more space.
     *    - Normal View: Grid gets slightly less space (due to larger padding), 
     *      but the CONTAINER stays screen-sized, keeping the scrollbar visible.
     */
    // Auto-scroll to current time on mount or date change (if Today)


    const { organization } = useAuth();
    const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
    const [selectedReportShiftId, setSelectedReportShiftId] = useState<string | null>(null);
    const [filterTaskIds, setFilterTaskIds] = useState<string[]>([]);
    const [filterPersonIds, setFilterPersonIds] = useState<string[]>([]);
    const [filterTeamIds, setFilterTeamIds] = useState<string[]>([]);

    const activePeople = useMemo(() => {
        let filtered = people.filter(p => p.isActive !== false);

        if (filterPersonIds.length > 0 || filterTeamIds.length > 0) {
            filtered = filtered.filter(p => {
                const matchesPerson = filterPersonIds.includes(p.id);
                const matchesTeam = p.teamId && filterTeamIds.includes(p.teamId);

                if (filterPersonIds.length > 0 && filterTeamIds.length === 0) return matchesPerson;
                if (filterTeamIds.length > 0 && filterPersonIds.length === 0) return matchesTeam;
                return matchesPerson || matchesTeam;
            });
        }
        return filtered;
    }, [people, filterPersonIds, filterTeamIds]);
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

    const [isScheduling, setIsScheduling] = useState(false);
    const [schedulingSuggestions, setSchedulingSuggestions] = useState<SchedulingSuggestion[]>([]);
    const [showSuggestionsModal, setShowSuggestionsModal] = useState(false); // Local suggestions modal state if needed
    const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('daily');
    const [showScheduleModal, setShowScheduleModal] = useState(false);

    // Internal Auto Schedule Handler to support Draft Mode
    const handleInternalAutoSchedule = async ({ startDate, endDate, selectedTaskIds, prioritizeTeamOrganic }: { startDate: Date; endDate: Date; selectedTaskIds?: string[]; prioritizeTeamOrganic?: boolean }) => {
        if (!settings?.organization_id) return;
        setIsScheduling(true);
        setSchedulingSuggestions([]);

        try {
            const currentDate = new Date(startDate);
            const end = new Date(endDate);
            const orgId = settings.organization_id;

            if (currentDate > end) {
                showToast('תאריך התחלה חייב להיות לפני תאריך סיום', 'error');
                setIsScheduling(false);
                return;
            }

            let newShiftsAcc: Shift[] = [];
            let successDays = 0;
            let failDays = 0;

            while (currentDate <= end) {
                const dateStart = new Date(currentDate);
                dateStart.setHours(0, 0, 0, 0);
                const dateEnd = new Date(currentDate);
                dateEnd.setHours(23, 59, 59, 999);

                try {
                    // 1. Fetch history for load calculation
                    const historyShifts = await fetchUserHistory(orgId, dateStart, 30);
                    // Use activePeople (filtered) or people? Using people ensures full context.
                    const historyScores = calculateHistoricalLoad(historyShifts, taskTemplates, people.map(p => p.id));

                    // 2. Get existing shifts (from MEMORY - effectiveShifts - to respect drafts!)
                    // We only care about shifts in the current window + 48h to check rest times
                    const futureEndLimit = new Date(dateEnd);
                    futureEndLimit.setHours(futureEndLimit.getHours() + 48);

                    const existingShifts = effectiveShifts.filter(s => {
                        const sTime = new Date(s.startTime).getTime();
                        return sTime >= dateStart.getTime() && sTime <= futureEndLimit.getTime();
                    });

                    // 3. Filter tasks
                    const tasksToSchedule = selectedTaskIds
                        ? taskTemplates.filter(t => selectedTaskIds.includes(t.id))
                        : taskTemplates;

                    // 4. Run Scheduler
                    const appState: import('../../types').AppState = {
                        people: activePeople,
                        taskTemplates: taskTemplates, // Pass all, let scheduler filter
                        shifts: existingShifts,
                        roles: roles,
                        teams: teams,
                        constraints: constraints,
                        teamRotations: teamRotations,
                        settings: settings || null,
                        absences: absences || [],
                        hourlyBlockages: [],
                        equipment: [],
                        equipmentDailyChecks: []
                    };

                    const { shifts: solvedShifts, suggestions } = solveSchedule(
                        appState,
                        dateStart,
                        dateStart,
                        historyScores,
                        [], // futureAssignments
                        selectedTaskIds && selectedTaskIds.length > 0 ? selectedTaskIds : undefined,
                        undefined,
                        prioritizeTeamOrganic
                    );

                    if (suggestions.length > 0) {
                        setSchedulingSuggestions(prev => [...prev, ...suggestions]);
                    }

                    if (solvedShifts.length > 0) {
                        const shiftsWithOrg = solvedShifts.map(s => ({ ...s, organization_id: orgId }));
                        newShiftsAcc.push(...shiftsWithOrg);
                        successDays++;
                    }

                } catch (err) {
                    console.error(`Error scheduling for ${currentDate.toISOString()}:`, err);
                    failDays++;
                }

                currentDate.setDate(currentDate.getDate() + 1);
            }

            if (newShiftsAcc.length > 0) {
                if (isDraftMode) {
                    // In Draft Mode: Add to draftShifts
                    // Check for IDs? solveSchedule usually assigns 'temp-' IDs or UUIDs?
                    // solveSchedule usage of uuidv4 should be ensured in service. 
                    // Usually it returns shifts with IDs.

                    setDraftShifts(prev => [...prev, ...newShiftsAcc]);
                    showToast(`נוספו ${newShiftsAcc.length} שיבוצים לטיוטה (${successDays} ימים)`, 'success');
                } else {
                    // In Live Mode: Save to DB
                    if (onBulkUpdateShifts) {
                        await onBulkUpdateShifts(newShiftsAcc);
                        showToast(`שיבוץ הושלם עבור ${successDays} ימים`, 'success');
                    } else {
                        // Fallback direct DB if prop missing (shouldn't happen in main app)
                        const { error } = await supabase.from('shifts').upsert(newShiftsAcc.map(mapShiftToDB));
                        if (error) throw error;
                        showToast(`שיבוץ נשמר עבור ${successDays} ימים`, 'success');
                        onRefreshData?.();
                    }
                }

                if (schedulingSuggestions.length > 0) {
                    // logic to show suggestions modal if needed, or toast
                    // showToast(`${schedulingSuggestions.length} הצעות שיפור זמינות`, 'info');
                }
            } else if (failDays > 0) {
                showToast('שגיאה בתהליך השיבוץ', 'error');
            } else {
                showToast('לא נמצאו שיבוצים אפשריים', 'info');
            }

            setShowScheduleModal(false);

        } catch (e: any) {
            console.error('Auto Schedule Error:', e);
            showToast('שגיאה כללית בשיבוץ', 'error');
        } finally {
            setIsScheduling(false);
        }
    };

    const selectedShift = useMemo(() => effectiveShifts.find(s => s.id === selectedShiftId), [effectiveShifts, selectedShiftId]);
    const selectedReportShift = useMemo(() => effectiveShifts.find(s => s.id === selectedReportShiftId), [effectiveShifts, selectedReportShiftId]);
    const [isLoadingWarnings, setIsLoadingWarnings] = useState(false);
    const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(new Set());

    const handleViewHistory = (filters: any) => {
        setHistoryFilters(filters);
        setShowHistory(true);
    };

    const handleHistoryClose = () => {
        setShowHistory(false);
        setHistoryFilters(undefined);
    };
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
    const acknowledgedWarnings = (propAcknowledgedWarnings instanceof Set) ? propAcknowledgedWarnings : localAcknowledgedWarnings;


    const setAcknowledgedWarnings = setLocalAcknowledgedWarnings;

    // Export Modal State
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // New state for mobile action menu
    const [showRotaWizard, setShowRotaWizard] = useState(false);

    // Fullscreen Logic
    const boardRef = useRef<HTMLDivElement>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            boardRef.current?.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
            });
            // State update handled by event listener
        } else {
            document.exitFullscreen();
        }
    };

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);
    const [isClearModalOpen, setIsClearModalOpen] = useState(false);
    const [showLegend, setShowLegend] = useState(false);
    const [showInsights, setShowInsights] = useState(false);
    const [showCompliance, setShowCompliance] = useState(false);
    const [isTourActive, setIsTourActive] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [historyFilters, setHistoryFilters] = useState<import('@/services/auditService').LogFilters | undefined>(undefined);
    const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 768 : false);






    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const tourSteps: TourStep[] = useMemo(() => {
        if (isMobile) {
            return [
                {
                    targetId: '#tour-mobile-menu',
                    title: 'תפריט הפעולות',
                    content: 'כל הכלים במקום אחד: סינון, ייצוא, מצב טיוטה, תובנות פנויים והתראות חריגה.',
                    position: 'left'
                },
                {
                    targetId: '#tour-date-nav',
                    title: 'ניווט',
                    content: 'מעבר בין ימים ובחירת תאריך.',
                    position: 'bottom'
                },
                {
                    targetId: '#tour-mobile-list',
                    title: 'השיבוצים שלי',
                    content: 'רשימת המשמרות היומית. ניתן לגלול וללחוץ על כרטיס לפרטים נוספים.',
                    position: 'top'
                }
            ];
        }


        return [
            {
                targetId: '#tour-filters',
                title: 'סינון',
                content: 'אפשרויות סינון מתקדמות לפי משימות, אנשים או צוותים.',
                position: 'bottom'
            },
            {
                targetId: '#tour-export-file',
                title: 'ייצוא לאקסל',
                content: 'הורדת סידור העבודה כקובץ אקסל למחשב.',
                position: 'bottom'
            },
            {
                targetId: '#tour-copy',
                title: 'העתקה לווצאפ',
                content: 'העתקת תמונת מצב טקסטואלית של הלוח להדבקה מהירה בווצאפ.',
                position: 'bottom'
            },
            (filterPersonIds.length === 1) && {
                targetId: '#tour-whatsapp',
                title: 'שליחה אישית',
                content: 'שליחת הודעת ווצאפ מרוכזת לחייל עם המשימות שלו.',
                position: 'bottom'
            },
            !isViewer && {
                targetId: '#tour-clear',
                title: 'ניקוי יום',
                content: 'מחיקת כל השיבוצים ליום זה בלחיצה אחת (דרוש אישור).',
                position: 'bottom'
            },
            {
                targetId: '#tour-legend',
                title: 'מקרא',
                content: 'הסבר על הצבעים והאייקונים השונים בלוח.',
                position: 'bottom'
            },
            !isViewer && {
                targetId: '#tour-idle',
                title: 'תובנות פנויים',
                content: 'כלי עזר שמראה מי נמצא בבסיס אך לא משובץ כרגע.',
                position: 'bottom'
            },
            !isViewer && {
                targetId: '#tour-compliance',
                title: 'חריגות והתראות',
                content: 'ריכוז כל בעיות השיבוץ: כפל שיבוצים, חוסר מנוחה, אי התאמת תפקיד ועוד.',
                position: 'bottom'
            },
            !isViewer && {
                targetId: '#tour-draft',
                title: 'מצב טיוטה',
                content: 'אפשרות לבצע שינויים "על יבש" ולפרסם אותם רק כשהלוח מוכן.',
                position: 'bottom'
            },
            {
                targetId: '#tour-compact',
                title: 'תצוגה',
                content: 'שינוי גודל התצוגה בין מצב רגיל למצב דחוס שמאפשר לראות יותר מידע.',
                position: 'bottom'
            }
        ].filter(Boolean) as TourStep[];
    }, [isViewer, filterPersonIds, isMobile]);

    // For now assuming local handling to match previous logic found in file.

    // Auto-scroll to current time on mount or date change (if Today)
    useEffect(() => {
        const now = new Date();
        const isToday = selectedDate.getDate() === now.getDate() &&
            selectedDate.getMonth() === now.getMonth() &&
            selectedDate.getFullYear() === now.getFullYear();

        // 1. Mobile Optimization: Default to ALL teams collapsed
        // We check if teams are loaded and if we haven't manually modified it yet (or just force it on load)
        if (typeof window !== 'undefined' && window.innerWidth < 768 && teams.length > 0) {
            // Only set if we haven't already set it (to avoid over-writing user interaction if this effect re-runs)
            // But since 'teams' dependency triggers this, we need to be careful.
            // Best approach for "default": just set it once when teams become available.
            // We'll trust that if this component mounts, we want to start collapsed.
            setCollapsedTeams((prev) => {
                if (prev.size === 0) {
                    return new Set(teams.map(t => t.id));
                }
                return prev;
            });
        }

        // 2. Auto-scroll logic (Desktop only mainly)
        if (verticalScrollRef.current && isToday) {
            const currentHour = now.getHours();
            const targetHour = Math.max(0, currentHour - 1);
            const scrollPosition = targetHour * pixelsPerHour;

            requestAnimationFrame(() => {
                if (verticalScrollRef.current) {
                    if (window.innerWidth < 768) return;
                    verticalScrollRef.current.scrollTo({ top: scrollPosition, behavior: 'smooth' });

                    setTimeout(() => {
                        if (verticalScrollRef.current) {
                            const { scrollHeight, clientHeight, scrollTop } = verticalScrollRef.current;
                            const diff = Math.abs(scrollTop - scrollPosition);
                            if (diff > 20 && (scrollHeight - clientHeight >= scrollPosition)) {
                                verticalScrollRef.current.scrollTop = scrollPosition;
                            }
                        }
                    }, 500);
                }
            });
        }
    }, [selectedDate, pixelsPerHour, teams]); // Added teams dependency

    const renderFeaturedCard = () => null; // Placeholder to fix build error

    const handleExportToClipboard = async (rolesToInclude?: string[]) => {
        try {
            if (viewMode === 'weekly') {
                let text = `📋 *סידור עבודה שבועי - החל מ ${selectedDate.toLocaleDateString('he-IL')}*\n\n`;

                for (let i = 0; i < 7; i++) {
                    const currentDay = new Date(selectedDate);
                    currentDay.setDate(currentDay.getDate() + i);
                    const dayDateStr = currentDay.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric' });

                    text += `\n📅 *${dayDateStr}*\n==================\n`;

                    let hasShiftsForDay = false;

                    visibleTasks.forEach(task => {
                        const taskShifts = (effectiveShifts || []).filter(s => {
                            if (s.taskId !== task.id) return false;
                            const shiftStart = new Date(s.startTime);
                            const shiftEnd = new Date(s.endTime);
                            const dayStart = new Date(currentDay);
                            dayStart.setHours(0, 0, 0, 0);
                            const dayEnd = new Date(currentDay);
                            dayEnd.setHours(24, 0, 0, 0);
                            return shiftStart < dayEnd && shiftEnd > dayStart;
                        }).sort((a, b) => a.startTime.localeCompare(b.startTime));

                        if (taskShifts.length > 0) {
                            let hasShiftsForTask = false;

                            taskShifts.forEach(shift => {
                                // Filter logic: If filtering by person, strictly show only shifts assigned to them
                                if (filterPersonIds.length > 0) {
                                    if (!shift.assignedPersonIds.some(id => filterPersonIds.includes(id))) {
                                        return;
                                    }
                                }

                                // If filtering by team, strictly show only shifts with team members
                                if (filterTeamIds.length > 0) {
                                    // Use activePeople to map IDs to Teams
                                    const hasTeamMember = shift.assignedPersonIds.some(id => {
                                        const p = activePeople.find(ap => ap.id === id);
                                        return p?.teamId && filterTeamIds.includes(p.teamId);
                                    });
                                    if (!hasTeamMember) return;
                                }

                                if (!hasShiftsForTask) {
                                    text += `*${task.name}:*\n`;
                                    hasShiftsForTask = true;
                                    hasShiftsForDay = true;
                                }

                                const personnelNames = shift.assignedPersonIds
                                    .map(id => {
                                        const person = people.find(p => p.id === id);
                                        if (!person) return null;

                                        let name = person.name;

                                        if (shift.metadata?.commanderId === person.id) {
                                            name += ` (מפקד משימה)`;
                                        }

                                        if (rolesToInclude && rolesToInclude.length > 0) {
                                            const pRoleIds = person.roleIds || [person.roleId];
                                            const matchingRoleIds = pRoleIds.filter(rid => rolesToInclude.includes(rid));
                                            if (matchingRoleIds.length > 0) {
                                                const roleNames = matchingRoleIds
                                                    .map(rid => roles.find(r => r.id === rid)?.name)
                                                    .filter(Boolean)
                                                    .join(', ');
                                                if (roleNames) {
                                                    name += ` (${roleNames})`;
                                                }
                                            }
                                        }
                                        return name;
                                    })
                                    .filter(Boolean)
                                    .join(', ');

                                const startD = new Date(shift.startTime);
                                const endD = new Date(shift.endTime);
                                const sStart = startD.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
                                const sEnd = endD.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
                                const isCrossDay = startD.getDate() !== endD.getDate();
                                const timeStr = `\u202A${sStart} - ${sEnd}\u202C${isCrossDay ? ' (יום למחרת)' : ''}`;

                                text += `• ${timeStr}: ${personnelNames || 'לא שובץ'}\n`;
                            });
                            if (hasShiftsForTask) text += '\n';
                        }
                    });

                    if (!hasShiftsForDay) {
                        text += "(אין שיבוצים ליום זה)\n";
                    }
                }

                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(text);
                    showToast('הסידור השבועי הועתק ללוח', 'success');
                }
                return;
            }

            const dateStr = selectedDate.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });
            let text = `📋 *סידור עבודה - ${dateStr}*\n\n`;

            visibleTasks.forEach(task => {
                const taskShifts = (effectiveShifts || []).filter(s => {
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
                            .map(id => {
                                const person = activePeople.find(p => p.id === id);
                                if (!person) return null;

                                let name = person.name;

                                if (shift.metadata?.commanderId === person.id) {
                                    name += ` (מפקד משימה)`;
                                }

                                if (rolesToInclude && rolesToInclude.length > 0) {
                                    const pRoleIds = person.roleIds || [person.roleId];
                                    const matchingRoleIds = pRoleIds.filter(rid => rolesToInclude.includes(rid));
                                    if (matchingRoleIds.length > 0) {
                                        const roleNames = matchingRoleIds
                                            .map(rid => roles.find(r => r.id === rid)?.name)
                                            .filter(Boolean)
                                            .join(', ');
                                        if (roleNames) {
                                            name += ` (${roleNames})`;
                                        }
                                    }
                                }
                                return name;
                            })
                            .filter(Boolean)
                            .join(', ');

                        const startD = new Date(shift.startTime);
                        const endD = new Date(shift.endTime);

                        const sStart = startD.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
                        const sEnd = endD.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

                        const isCrossDay = startD.getDate() !== endD.getDate();
                        const timeStr = `\u202A${sStart} - ${sEnd}\u202C${isCrossDay ? ' (יום למחרת)' : ''}`;

                        text += `• ${timeStr}: ${personnelNames || 'לא שובץ'}\n`;
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

    // WhatsApp Integration Logic
    const handleWhatsAppClick = () => {
        if (filterPersonIds.length !== 1) return;

        const personId = filterPersonIds[0];
        const person = people.find(p => p.id === personId);
        if (!person) return;

        let text = '';

        if (viewMode === 'weekly') {
            const startDateStr = selectedDate.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
            text = `היי ${person.name}, להלן הלוז השבועי שלך (החל מ-${startDateStr}):\n\n`;

            let hasAnyShifts = false;

            for (let i = 0; i < 7; i++) {
                const currentDay = new Date(selectedDate);
                currentDay.setDate(currentDay.getDate() + i);
                const dateStr = currentDay.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric' });

                const personShifts = shifts.filter(s => {
                    if (!s.assignedPersonIds.includes(personId)) return false;
                    const shiftStart = new Date(s.startTime);
                    const shiftEnd = new Date(s.endTime);
                    const dayStart = new Date(currentDay);
                    dayStart.setHours(0, 0, 0, 0);
                    const dayEnd = new Date(currentDay);
                    dayEnd.setHours(24, 0, 0, 0);
                    return shiftStart < dayEnd && shiftEnd > dayStart;
                }).sort((a, b) => a.startTime.localeCompare(b.startTime));

                if (personShifts.length > 0) {
                    hasAnyShifts = true;
                    text += `📅 *${dateStr}*:\n`;
                    personShifts.forEach(shift => {
                        const task = taskTemplates.find(t => t.id === shift.taskId);
                        if (!task) return;
                        const startD = new Date(shift.startTime);
                        const endD = new Date(shift.endTime);
                        const sStart = startD.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
                        const sEnd = endD.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
                        const isCrossDay = startD.getDate() !== endD.getDate();
                        const personnelNames = shift.assignedPersonIds
                            .map(id => {
                                const person = people.find(p => p.id === id);
                                if (!person) return null;
                                let name = person.name;
                                if (shift.metadata?.commanderId === person.id) {
                                    name += ` (מפקד משימה)`;
                                }
                                return name;
                            })
                            .filter(Boolean)
                            .join(', ');
                        const timeStr = `\u202A${sStart} - ${sEnd}\u202C${isCrossDay ? ' (יום למחרת)' : ''}`;
                        text += `• *${task.name}* | ${timeStr}: ${personnelNames}\n`;
                    });
                    text += '\n';
                }
            }
            if (!hasAnyShifts) text += "אין משימות לשבוע הקרוב.";
        } else {
            const dateStr = selectedDate.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });
            text = `היי ${person.name}, להלן הלוז שלך לתאריך ${dateStr}:\n\n`;

            // Find shifts for this person
            const personShifts = shifts.filter(s => {
                if (!s.assignedPersonIds.includes(personId)) return false;

                const shiftStart = new Date(s.startTime);
                const shiftEnd = new Date(s.endTime);
                const dayStart = new Date(selectedDate);
                dayStart.setHours(0, 0, 0, 0);
                const dayEnd = new Date(selectedDate);
                dayEnd.setHours(24, 0, 0, 0);

                return shiftStart < dayEnd && shiftEnd > dayStart;
            }).sort((a, b) => a.startTime.localeCompare(b.startTime));

            if (personShifts.length === 0) {
                text += "אין משימות להיום.";
            } else {
                personShifts.forEach(shift => {
                    const task = taskTemplates.find(t => t.id === shift.taskId);
                    if (!task) return;

                    const startD = new Date(shift.startTime);
                    const endD = new Date(shift.endTime);

                    const sStart = startD.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
                    const sEnd = endD.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

                    const isCrossDay = startD.getDate() !== endD.getDate();

                    const personnelNames = shift.assignedPersonIds
                        .map(id => {
                            const person = people.find(p => p.id === id);
                            if (!person) return null;
                            let name = person.name;
                            if (shift.metadata?.commanderId === person.id) {
                                name += ` (מפקד משימה)`;
                            }
                            return name;
                        })
                        .filter(Boolean)
                        .join(', ');

                    // Unicode LTR embedding (\u202A) to ensure times appear Left-to-Right
                    const timeStr = `\u202A${sStart} - ${sEnd}\u202C${isCrossDay ? ' (יום למחרת)' : ''}`;

                    text += `• *${task.name}* | ${timeStr}: ${personnelNames}\n`;
                });
            }

            // Add daily availability status if relevant
            const da = person.dailyAvailability?.[selectedDate.toLocaleDateString('en-CA')];
            if (da && !da.isAvailable) {
                text += `\nסטטוס: ${da.status === 'sick' ? 'גימלים' : da.status === 'vacation' ? 'חופש' : 'לא זמין'}`;
            }
        }

        let phone = person.phone?.replace(/\D/g, '') || '';
        if (phone.startsWith('0')) phone = '972' + phone.slice(1);

        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
    };
    const dateInputRef = useRef<HTMLInputElement>(null);

    // Measure header height for sticky stacking - REMOVED per user request
    // The simplified layout relies on flexbox and overflow-auto



    // const { organization } = useAuth(); // Moved to top
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







    const isShiftMatchingFilters = (shift: Shift) => {
        const hasPersonFilter = filterPersonIds.length > 0;
        const hasTeamFilter = filterTeamIds.length > 0;

        // If no person/team filters, everything matches
        if (!hasPersonFilter && !hasTeamFilter) return true;

        const assignedIds = shift.assignedPersonIds || [];

        // If filtering by person/team, but shift is unassigned, it doesn't match
        if (assignedIds.length === 0) return false;

        if (hasPersonFilter) {
            if (assignedIds.some(pid => filterPersonIds.includes(pid))) return true;
        }

        if (hasTeamFilter) {
            const hasTeamMatch = assignedIds.some(pid => {
                const person = people.find(p => p.id === pid);
                return person?.teamId && filterTeamIds.includes(person.teamId);
            });
            if (hasTeamMatch) return true;
        }

        return false;
    };

    const visibleTasks = useMemo(() => {
        const dateKey = selectedDate.toLocaleDateString('en-CA');
        const dayOfWeek = selectedDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

        // Ensure we use the same date format as shiftUtils
        const year = selectedDate.getFullYear();
        const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
        const day = String(selectedDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        const baseFiltered = taskTemplates.filter(task => {
            // 1. Check Global Task Validity (Start/End Date)
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
        });

        // 2. Apply Custom Filters
        return baseFiltered.filter(task => {
            // A. Task Filter
            if (filterTaskIds.length > 0 && !filterTaskIds.includes(task.id)) {
                return false;
            }

            // B. Person/Team Filter
            if (filterPersonIds.length > 0 || filterTeamIds.length > 0) {
                const dayShifts = shifts.filter(s => {
                    if (s.taskId !== task.id || s.isCancelled) return false;

                    const shiftStart = new Date(s.startTime);
                    const shiftEnd = new Date(s.endTime);
                    const dayStart = new Date(selectedDate);
                    dayStart.setHours(0, 0, 0, 0);
                    const dayEnd = new Date(selectedDate);
                    dayEnd.setHours(24, 0, 0, 0);

                    return shiftStart < dayEnd && shiftEnd > dayStart;
                });

                const hasMatch = dayShifts.some(isShiftMatchingFilters);
                if (!hasMatch) return false;
            }

            return true;
        }).sort((a, b) => a.name.localeCompare(b.name, 'he'));
    }, [taskTemplates, selectedDate, filterTaskIds, filterPersonIds, filterTeamIds, shifts, people]);

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
        logger.info('EXPORT', 'Copied schedule board to clipboard', {
            date: selectedDate.toISOString().split('T')[0],
            category: 'data'
        });
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
            const shiftStart = new Date(shift.startTime);
            const shiftEnd = new Date(shift.endTime);

            // Note: If shifts are full ISO strings, they already have the correct dates.
            // If they were just "HH:mm", we'd need to append dates, but they aren't.

            // Ensure assignedPersonIds is an array before filtering
            const assignedIds = shift.assignedPersonIds || [];

            return assignedIds.filter(personId => {
                const person = people.find(p => p.id === personId);
                if (!person) return false;

                // Check availability
                const availability = getEffectiveAvailability(person, selectedDate, teamRotations, absences, hourlyBlockages);
                if (!availability.isAvailable) return true;

                // Check double booking
                const otherShifts = (shifts || []).filter(s =>
                    s.id !== shift.id &&
                    (s.assignedPersonIds || []).includes(personId) // Safe check here too
                );

                const hasOverlap = otherShifts.some(s => {
                    const sStart = new Date(s.startTime);
                    const sEnd = new Date(s.endTime);
                    return (shiftStart < sEnd && shiftEnd > sStart);
                });
                if (hasOverlap) return true;

                // Check rest violation
                const prevShift = (shifts || []).filter(s =>
                    s.id !== shift.id &&
                    (s.assignedPersonIds || []).includes(personId) &&
                    new Date(s.endTime) <= shiftStart
                ).sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime())[0];

                if (prevShift) {
                    const gapMs = shiftStart.getTime() - new Date(prevShift.endTime).getTime();
                    const gapHours = gapMs / (1000 * 60 * 60);
                    const requiredRest = prevShift.requirements?.minRest || 8;
                    if (gapHours < requiredRest) return true;
                }

                return false;
            }).map(personId => {
                const person = people.find(p => p.id === personId);
                const availability = person
                    ? getEffectiveAvailability(person, selectedDate, teamRotations, absences, hourlyBlockages)
                    : { isAvailable: true, status: 'full', source: 'default', unavailableBlocks: [] as any[], startHour: '00:00', endHour: '23:59' };

                // Determine conflict type
                let type: 'absence' | 'overlap' | 'rest_violation' = !availability.isAvailable ? 'absence' : 'overlap';
                let reason = '';

                if (type === 'overlap') {
                    const otherShifts = (shifts || []).filter(s =>
                        s.id !== shift.id &&
                        (s.assignedPersonIds || []).includes(personId)
                    );
                    const hasOverlap = otherShifts.some(s => {
                        const sStart = new Date(s.startTime);
                        const sEnd = new Date(s.endTime);
                        return (shiftStart < sEnd && shiftEnd > sStart);
                    });

                    if (!hasOverlap) {
                        type = 'rest_violation';
                        reason = 'חוסר בזמן מנוחה';
                    } else {
                        reason = 'כפל שיבוץ';
                    }
                } else {
                    // Elaborate on absence reason
                    if (availability.status === 'home') {
                        if (availability.source === 'absence') {
                            const block = availability.unavailableBlocks?.find(b => b.type === 'absence' && b.status === 'approved');
                            reason = `בבית (${block?.reason || 'היעדרות'})`;
                        } else if (availability.source === 'rotation') reason = 'בבית (סבב צוותי)';
                        else if (availability.source === 'personal_rotation') reason = 'בבית (סבב אישי)';
                        else reason = 'בבית (ידני)';
                    } else if (availability.status === 'arrival') {
                        reason = `טרם הגיע ליחידה (צפוי ב-${availability.startHour})`;
                    } else if (availability.status === 'departure') {
                        reason = `עוזב את היחידה (יוצא ב-${availability.endHour})`;
                    } else if (availability.unavailableBlocks?.length > 0) {
                        const overlappingBlock = availability.unavailableBlocks.find(block => {
                            const [bh, bm] = block.start.split(':').map(Number);
                            const [eh, em] = block.end.split(':').map(Number);
                            const bs = new Date(shiftStart); bs.setHours(bh, bm, 0, 0);
                            const be = new Date(shiftStart); be.setHours(eh, em, 0, 0);
                            if (be < bs) be.setDate(be.getDate() + 1);
                            return bs < shiftEnd && be > shiftStart;
                        });
                        if (overlappingBlock) reason = `חסימה שעתית (${overlappingBlock.reason || 'מושבת'})`;
                    }

                    if (!reason) reason = 'לא זמין במערכת הנוכחות';
                }

                return {
                    shiftId: shift.id,
                    personId,
                    type,
                    reason
                };
            });
        });
    }, [effectiveShifts, activePeople, selectedDate, teamRotations, absences, hourlyBlockages]);

    const getShiftConflicts = (shiftId: string) => {
        const shift = effectiveShifts.find(s => s.id === shiftId);
        if (!shift) return [];

        const shiftStart = new Date(`${selectedDate.toISOString().split('T')[0]}T${shift.startTime}`);
        const shiftEnd = new Date(`${selectedDate.toISOString().split('T')[0]}T${shift.endTime}`);
        if (shiftEnd < shiftStart) shiftEnd.setDate(shiftEnd.getDate() + 1);

        return conflicts.filter(c => c.shiftId === shiftId);
    };

    const isShiftConflictDueToAbsence = (shiftId: string) => {
        return getShiftConflicts(shiftId).some(c => c.type === 'absence');
    };

    return (
        <div className="flex flex-col gap-2 relative">
            <FeatureTour
                steps={tourSteps}
                tourId={isMobile ? "schedule_board_v2_mobile" : "schedule_board_v2"}
            />
            <DraftControl
                isVisible={isDraftMode}
                changeCount={changeCount}
                onDiscard={() => {
                    setConfirmationState({
                        isOpen: true,
                        title: 'ביטול שינויים',
                        message: 'האם אתה בטוח שברצונך לבטל את כל השינויים שבוצעו במצב טיוטה?',
                        onConfirm: () => {
                            setIsDraftMode(false);
                            setDraftShifts([]);
                            setConfirmationState(prev => ({ ...prev, isOpen: false }));
                        },
                        type: 'danger',
                        confirmText: 'בטל שינויים'
                    });
                }}
                onPublish={handlePublishDraft}
                isPublishing={isPublishing}
                onExit={() => setIsDraftMode(false)}
            />
            {isViewer && renderFeaturedCard()}



            {/* Time Grid Board Container - FLEX LOCK STRATEGY */}
            <div
                ref={boardRef}
                className={`bg-white rounded-[2rem] border ${isDraftMode ? 'border-dashed border-2 border-blue-400/50 shadow-[0_0_0_4px_rgba(59,130,246,0.1)]' : 'border-slate-100'} ${isCompact ? 'p-2 md:p-3' : 'p-4 md:p-6'} flex flex-col relative overflow-hidden ${isFullscreen ? 'fixed inset-0 z-[100] rounded-none p-4 w-screen h-screen' : 'h-[calc(100vh-190px)] md:h-[calc(100vh-140px)]'} shadow-sm transition-all duration-300`}
            >

                {/* Draft Mode Watermark Background */}
                {isDraftMode && (
                    <div
                        className="absolute inset-0 z-0 pointer-events-none opacity-[0.03]"
                        style={{
                            backgroundImage: `repeating-linear-gradient(45deg, #3b82f6 0, #3b82f6 1px, transparent 0, transparent 50%)`,
                            backgroundSize: '24px 24px'
                        }}
                    />
                )}

                <ExportScheduleModal
                    isOpen={isExportModalOpen}
                    onClose={() => setIsExportModalOpen(false)}
                    shifts={effectiveShifts}
                    people={people}
                    tasks={visibleTasks}
                />

                <ClearScheduleModal
                    isOpen={isClearModalOpen}
                    onClose={() => setIsClearModalOpen(false)}
                    onClear={onClearDay}
                    tasks={taskTemplates}
                    initialDate={selectedDate}
                />

                {/* Controls Header - Sticky - OPTIMIZED LAYOUT */}
                <div className={`flex flex-col md:flex-row items-center justify-between gap-3 ${isCompact ? 'mb-1' : 'mb-2'} flex-shrink-0 sticky top-0 z-[100] bg-white pb-3 pt-1 border-b border-transparent`}>

                    {/* Right Side: Title, Date, & Info */}
                    <div className="flex flex-col md:flex-row items-center gap-3 md:gap-4 w-full md:w-auto">

                        {/* Top Row on Mobile: Title + Menu */}
                        <div className="flex items-center justify-between w-full md:w-auto gap-3">
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg md:text-xl font-black text-slate-800 tracking-tight">לוח שיבוצים</h3>

                            </div>

                            {/* Mobile Menu Button */}
                            <div className="md:hidden">
                                <button
                                    id="tour-mobile-menu"
                                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                    className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-700 active:bg-slate-50 transition-colors shadow-sm"
                                    aria-label="More actions"
                                >
                                    <MoreVertical size={20} weight="bold" />
                                </button>
                            </div>
                        </div>

                        {/* Date Navigator - Attached to Title on Desktop */}
                        <div id="tour-date-nav" className="w-full md:w-auto flex justify-center md:justify-start">
                            <DateNavigator
                                date={selectedDate}
                                onDateChange={handleDateChange}
                                mode={viewMode === 'weekly' ? 'week' : 'day'}
                                canGoPrev={canGoPrev}
                                canGoNext={canGoNext}
                                maxDate={isViewer ? maxViewerDate : undefined}
                                className="bg-white hover:bg-slate-50 transition-colors shadow-sm rounded-xl border border-slate-200 p-0.5"
                            />
                        </div>

                        {/* Availability Badge - Only Desktop */}

                    </div>

                    {/* Left Side: Actions Toolbar & View Toggle */}
                    <div className="hidden md:flex items-center gap-2">

                        {/* Main Toolbar */}
                        <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">

                            {/* Filter */}
                            <Tooltip content="מסננים">
                                <Button
                                    variant={filterTaskIds.length > 0 || filterPersonIds.length > 0 || filterTeamIds.length > 0 ? 'primary' : 'ghost'}
                                    size="sm"
                                    onClick={() => setIsFilterModalOpen(true)}
                                    className={`w-9 h-9 rounded-xl p-0 flex items-center justify-center relative transition-all ${filterTaskIds.length > 0 || filterPersonIds.length > 0 || filterTeamIds.length > 0 ? 'shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                                    id="tour-filters"
                                >
                                    <Funnel size={20} weight={(filterTaskIds.length > 0 || filterPersonIds.length > 0 || filterTeamIds.length > 0) ? "fill" : "regular"} />
                                    {(filterTaskIds.length > 0 || filterPersonIds.length > 0 || filterTeamIds.length > 0) && (
                                        <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold border-2 border-white">
                                            {(filterTaskIds.length > 0 ? 1 : 0) + (filterPersonIds.length > 0 ? 1 : 0) + (filterTeamIds.length > 0 ? 1 : 0)}
                                        </span>
                                    )}
                                </Button>
                            </Tooltip>

                            <div className="w-px h-5 bg-slate-200 mx-1" />

                            {/* Editing & Draft */}
                            {!isViewer && (
                                <>
                                    <Tooltip content="נקה הכל">
                                        <button onClick={handleClearDayClick} className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors" id="tour-clear">
                                            <Trash2 size={20} />
                                        </button>
                                    </Tooltip>
                                    <Tooltip content={isDraftMode ? "בטל מצב טיוטה" : "הפעל מצב טיוטה (Shift+D)"}>
                                        <button
                                            id="tour-draft"
                                            onClick={toggleDraftMode}
                                            className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${isDraftMode ? 'bg-blue-100 text-blue-600' : 'text-slate-500 hover:bg-blue-50 hover:text-blue-600'}`}
                                        >
                                            <Flask size={20} weight={isDraftMode ? "fill" : "regular"} />
                                        </button>
                                    </Tooltip>
                                    <div className="w-px h-5 bg-slate-200 mx-1" />
                                </>
                            )}

                            {/* Exports */}
                            <Tooltip content="העתק לוח">
                                <button onClick={handleExportClick} className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 transition-colors" id="tour-copy">
                                    <Copy size={20} />
                                </button>
                            </Tooltip>
                            <Tooltip content="ייצוא לאקסל">
                                <button onClick={() => setIsExportModalOpen(true)} className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 transition-colors" id="tour-export-file">
                                    <MicrosoftExcelLogo size={20} />
                                </button>
                            </Tooltip>

                            {filterPersonIds.length === 1 && (
                                <Tooltip content="שלח ב-WhatsApp">
                                    <button
                                        onClick={handleWhatsAppClick}
                                        className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 hover:bg-green-50 hover:text-green-600 transition-colors"
                                        id="tour-whatsapp"
                                    >
                                        <WhatsappLogo size={20} weight="regular" />
                                    </button>
                                </Tooltip>
                            )}

                            <div className="w-px h-5 bg-slate-200 mx-1" />

                            {/* Analysis */}
                            <Tooltip content={showLegend ? "הסתר מקרא" : "הצג מקרא"}>
                                <button onClick={() => setShowLegend(!showLegend)} className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${showLegend ? 'bg-amber-100 text-amber-600' : 'text-slate-500 hover:bg-amber-50 hover:text-amber-600'}`} id="tour-legend">
                                    <Info size={20} weight={showLegend ? "fill" : "regular"} />
                                </button>
                            </Tooltip>
                            {!isViewer && (
                                <>
                                    <Tooltip content={showHistory ? "הסתר היסטוריה" : "היסטוריית שינויים"}>
                                        <button onClick={() => setShowHistory(!showHistory)} className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${showHistory ? 'bg-blue-100 text-blue-600' : 'text-slate-500 hover:bg-blue-50 hover:text-blue-600'}`}>
                                            <ClockCounterClockwise size={20} weight={showHistory ? "bold" : "regular"} />
                                        </button>
                                    </Tooltip>
                                    <Tooltip content={showInsights ? "הסתר תובנות" : "הצג תובנות פנויים"}>
                                        <button
                                            onClick={() => setShowInsights(!showInsights)}
                                            className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${showInsights ? 'bg-indigo-100 text-indigo-600' : 'text-slate-500 hover:bg-indigo-50 hover:text-indigo-600'}`}
                                            id="tour-idle"
                                        >
                                            <Coffee size={20} weight={showInsights ? "fill" : "regular"} />
                                        </button>
                                    </Tooltip>
                                    <Tooltip content={showCompliance ? "הסתר חריגות" : "הצג חריגות והתראות"}>
                                        <button
                                            onClick={() => setShowCompliance(!showCompliance)}
                                            className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${showCompliance ? 'bg-red-100 text-red-600' : 'text-slate-500 hover:bg-red-50 hover:text-red-600'}`}
                                            id="tour-compliance"
                                        >
                                            <Warning size={20} weight={showCompliance ? "fill" : "regular"} />
                                        </button>
                                    </Tooltip>
                                </>
                            )}

                            {/* View Mode Toggle - Integrated to save space */}
                            <div className="w-px h-5 bg-slate-200 mx-1" />

                            <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                                <button
                                    onClick={() => setViewMode('daily')}
                                    className={`flex items-center justify-center w-8 h-8 rounded-md transition-all ${viewMode === 'daily'
                                        ? 'bg-white text-blue-600 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                    title="תצוגה יומית"
                                >
                                    <Layout size={18} weight={viewMode === 'daily' ? "fill" : "bold"} />
                                </button>
                                <button
                                    onClick={() => setViewMode('weekly')}
                                    className={`flex items-center justify-center w-8 h-8 rounded-md transition-all ${viewMode === 'weekly'
                                        ? 'bg-white text-blue-600 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                    title="תצוגה שבועית"
                                >
                                    <Columns size={18} weight={viewMode === 'weekly' ? "fill" : "bold"} />
                                </button>
                            </div>

                            <div className="w-px h-5 bg-slate-200 mx-1" />

                            {/* Expand/Collapse */}
                            <Tooltip content={isCompact ? "הרחב תצוגה" : "צמצם תצוגה"}>
                                <button
                                    onClick={() => setIsCompact(!isCompact)}
                                    className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 transition-colors"
                                >
                                    {isCompact ? <ArrowsOutSimple size={20} /> : <ArrowsInSimple size={20} />}
                                </button>
                            </Tooltip>
                        </div>
                    </div>
                </div>

                {/* Mobile Actions Dropdown - Just the Content */}
                <div className="md:hidden">
                    <GenericModal
                        isOpen={isMobileMenuOpen}
                        onClose={() => setIsMobileMenuOpen(false)}
                        title="פעולות נוספות"
                        size="sm"
                    >
                        <div className="flex flex-col gap-2">
                            {/* ... actions ... */}
                            {/* Content preserved, wrapping structure simplified */}
                            <button
                                onClick={() => { setIsFilterModalOpen(true); setIsMobileMenuOpen(false); }}
                                className="flex items-center gap-4 px-4 py-3.5 bg-blue-50 text-blue-700 hover:bg-blue-100 active:bg-blue-200 rounded-xl transition-colors text-right w-full"
                            >
                                <div className="p-2 bg-white rounded-lg flex items-center justify-center shadow-sm">
                                    <Funnel size={22} weight={(filterTaskIds.length > 0 || filterPersonIds.length > 0 || filterTeamIds.length > 0) ? "fill" : "regular"} />
                                </div>
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-base">מסננים</span>
                                        {(filterTaskIds.length > 0 || filterPersonIds.length > 0 || filterTeamIds.length > 0) && (
                                            <span className="bg-blue-600 text-white rounded-full min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold px-1">
                                                {(filterTaskIds.length > 0 ? 1 : 0) + (filterPersonIds.length > 0 ? 1 : 0) + (filterTeamIds.length > 0 ? 1 : 0)}
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-xs opacity-80">סינון לפי משימה, חייל או צוות</span>
                                </div>
                            </button>

                            {!isViewer && (
                                <button
                                    onClick={() => { setShowInsights(true); setIsMobileMenuOpen(false); }}
                                    className="flex items-center gap-4 px-4 py-3.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 active:bg-indigo-200 rounded-xl transition-colors text-right w-full"
                                >
                                    <div className="p-2 bg-white rounded-lg flex items-center justify-center shadow-sm">
                                        <Coffee size={22} weight="bold" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-bold text-base text-indigo-700">תובנות פנויים</span>
                                        <span className="text-xs text-indigo-500/80">מי בבסיס וזמין לשיבוץ כרגע</span>
                                    </div>
                                </button>
                            )}

                            {!isViewer && (
                                <button
                                    onClick={() => { setShowCompliance(true); setIsMobileMenuOpen(false); }}
                                    className="flex items-center gap-4 px-4 py-3.5 bg-red-50 text-red-700 hover:bg-red-100 active:bg-red-200 rounded-xl transition-colors text-right w-full"
                                >
                                    <div className="p-2 bg-white rounded-lg flex items-center justify-center shadow-sm">
                                        <Warning size={22} weight="bold" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-bold text-base text-red-700">חריגות והתראות</span>
                                        <span className="text-xs text-red-500/80">דוח חריגות שיבוץ מהיר</span>
                                    </div>
                                </button>
                            )}

                            {!isViewer && (
                                <button
                                    onClick={() => { setShowHistory(true); setIsMobileMenuOpen(false); }}
                                    className="flex items-center gap-4 px-4 py-3.5 bg-blue-50 text-blue-700 hover:bg-blue-100 active:bg-blue-200 rounded-xl transition-colors text-right w-full"
                                >
                                    <div className="p-2 bg-white rounded-lg flex items-center justify-center shadow-sm">
                                        <ClockCounterClockwise size={22} weight="bold" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-bold text-base text-blue-700">היסטורייית שינויים (Beta)</span>
                                        <span className="text-xs text-blue-500/80">מי שיבץ את מי ומתי</span>
                                    </div>
                                </button>
                            )}

                            {!isViewer && (
                                <button
                                    onClick={() => { toggleDraftMode(); setIsMobileMenuOpen(false); }}
                                    className={`flex items-center gap-4 px-4 py-3.5 ${isDraftMode ? 'bg-blue-100 text-blue-700' : 'bg-blue-50 text-blue-700'} hover:bg-blue-100 rounded-xl transition-colors text-right w-full`}
                                >
                                    <div className="p-2 bg-white rounded-lg flex items-center justify-center shadow-sm">
                                        <Flask size={22} weight={isDraftMode ? "fill" : "bold"} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-bold text-base">{isDraftMode ? 'בטל מצב טיוטה' : 'מצב טיוטה'}</span>
                                        <span className="text-xs opacity-80">שינויים זמניים ללא שמירה מיידית</span>
                                    </div>
                                </button>
                            )}
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
                                    <Copy size={22} weight="bold" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-bold text-base text-slate-800">העתק לוח</span>
                                    <span className="text-xs text-slate-500">העתקת תמונת מצב לווצאפ</span>
                                </div>
                            </button>

                            {(filterPersonIds.length === 1) && (
                                <button
                                    onClick={() => { handleWhatsAppClick(); setIsMobileMenuOpen(false); }}
                                    className="flex items-center gap-4 px-4 py-3.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 active:bg-emerald-200 rounded-xl transition-colors text-right w-full"
                                >
                                    <div className="p-2 bg-white text-emerald-600 rounded-lg shadow-sm border border-emerald-100">
                                        <WhatsappLogo size={22} weight="bold" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-bold text-base text-emerald-800">שלח ב-WhatsApp</span>
                                        <span className="text-xs text-emerald-600/80">שליחת המשימות לחייל</span>
                                    </div>
                                </button>
                            )}

                            {/* Mobile Compact Toggle Removed as requested */}

                            {!isViewer && (
                                <button
                                    onClick={() => { handleClearDayClick(); setIsMobileMenuOpen(false); }}
                                    className="flex items-center gap-4 px-4 py-3.5 bg-red-50 text-red-700 hover:bg-red-100 active:bg-red-200 rounded-xl transition-colors text-right w-full mt-2"
                                >
                                    <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                                        <Trash2 size={22} weight="bold" />
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

                {/* Scrollable Grid Area - FLEX FILL STRATEGY (Auto-resize) */}
                <div
                    ref={verticalScrollRef}
                    className="flex-1 overflow-auto relative border-t border-slate-200 min-h-0"
                >
                    {viewMode === 'weekly' ? (
                        <div className="flex flex-col lg:flex-row h-full animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden">
                            <UnassignedTaskBank
                                shifts={effectiveShifts}
                                taskTemplates={taskTemplates}
                                selectedDate={selectedDate}
                                isViewer={isViewer}
                            />
                            <div className="flex-1 overflow-hidden p-2 md:p-4 bg-slate-50/50">
                                <WeeklyPersonnelGrid
                                    startDate={selectedDate}
                                    people={activePeople}
                                    allPeople={people}
                                    shifts={effectiveShifts}
                                    taskTemplates={taskTemplates}
                                    teams={teams}
                                    roles={roles}
                                    onAssign={handleDraftAssign}
                                    onSelectShift={setSelectedShiftId}
                                    isViewer={isViewer}
                                    absences={absences}
                                    hourlyBlockages={hourlyBlockages}
                                    teamRotations={teamRotations}
                                />
                            </div>
                        </div>
                    ) : (
                        <>

                            {/* MOBILE VIEW - Removed internal scroll to let parent handle it */}
                            <div className="block md:hidden p-4" id="tour-mobile-list">
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
                                    conflicts={conflicts}
                                    filterPersonIds={filterPersonIds}
                                    filterTeamIds={filterTeamIds}
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
                                                    backgroundColor: hexToRgba(task.color, 0.8), // Increased visibility significantly
                                                    borderTopColor: task.color,
                                                    borderTopWidth: 3,
                                                    borderColor: 'rgb(226, 232, 240)',
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
                                            // Corrected shift overlap check for desktop grid
                                            const dayStart = new Date(selectedDate);
                                            dayStart.setHours(0, 0, 0, 0);
                                            const dayEnd = new Date(selectedDate);
                                            dayEnd.setHours(24, 0, 0, 0);

                                            const taskShifts = (effectiveShifts || []).filter(s => {
                                                if (s.taskId !== task.id) return false;

                                                const sStart = new Date(s.startTime);
                                                const sEnd = new Date(s.endTime);
                                                const overlaps = sStart < dayEnd && sEnd > dayStart;
                                                if (!overlaps) return false;

                                                // If filters are active, only show the shifts that match the filters
                                                if (filterPersonIds.length > 0 || filterTeamIds.length > 0) {
                                                    return isShiftMatchingFilters(s);
                                                }

                                                return true;
                                            });

                                            return (
                                                <div
                                                    className="min-w-[130px] md:min-w-[260px] flex-1 border-l border-slate-100 relative"
                                                    style={{ backgroundColor: hexToRgba(task.color, 0.25), height: pixelsPerHour * 24 }} // Increased visibility
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
                                                        const timeBasedHeight = getHeightFromDuration(effectiveStart, effectiveEnd, pixelsPerHour);

                                                        // Dynamic Height Calculation for Expanded View
                                                        let visualHeight = timeBasedHeight;
                                                        const assignedCount = shift.assignedPersonIds.length;
                                                        if (!isCompact && assignedCount > 0) {
                                                            // Calculate required height to show all names vertically
                                                            // ~24px per name + ~36px for header/footer/padding
                                                            const contentHeight = (assignedCount * 28) + 40;
                                                            visualHeight = Math.max(timeBasedHeight, contentHeight);
                                                        }

                                                        const isContinuedFromPrev = shiftStart < dayStart;
                                                        const isContinuedToNext = shiftEnd > dayEnd;

                                                        return (
                                                            <ShiftCard
                                                                key={shift.id}
                                                                shift={shift}
                                                                isDraft={isDraftMode}
                                                                isModified={isDraftMode && (
                                                                    (() => {
                                                                        const os = shifts.find(s => s.id === shift.id);
                                                                        if (!os) return true;
                                                                        return JSON.stringify(shift.assignedPersonIds) !== JSON.stringify(os.assignedPersonIds) ||
                                                                            shift.isCancelled !== os.isCancelled;
                                                                    })()
                                                                )}
                                                                missionReports={missionReports}
                                                                taskTemplates={taskTemplates}
                                                                people={activePeople}
                                                                roles={roles}
                                                                teams={teams}
                                                                onSelect={handleShiftSelect}
                                                                onToggleCancel={handleDraftToggleCancel}
                                                                isViewer={isViewer}
                                                                acknowledgedWarnings={acknowledgedWarnings}
                                                                onReportClick={(shift) => setSelectedReportShiftId(shift.id)}
                                                                isContinuedFromPrev={isContinuedFromPrev}
                                                                isContinuedToNext={isContinuedToNext}
                                                                isCompact={isCompact}
                                                                hasAbsenceConflict={isShiftConflictDueToAbsence(shift.id)}
                                                                shiftConflicts={conflicts.filter(c => c.shiftId === shift.id)}
                                                                hasRestViolation={conflicts.some(c => c.shiftId === shift.id && c.type === 'rest_violation')}
                                                                style={{
                                                                    top: `${top}px`,
                                                                    height: `${Math.max(visualHeight, isCompact ? 18 : 30)}px`,
                                                                    left: '2px',
                                                                    right: '2px',
                                                                    width: 'auto',
                                                                    borderTopLeftRadius: isContinuedFromPrev ? 0 : undefined,
                                                                    borderTopRightRadius: isContinuedFromPrev ? 0 : undefined,
                                                                    borderBottomLeftRadius: isContinuedToNext ? 0 : undefined,
                                                                    borderBottomRightRadius: isContinuedToNext ? 0 : undefined,
                                                                    borderTop: isContinuedFromPrev ? '2px dashed rgba(0,0,0,0.1)' : undefined,
                                                                    borderBottom: isContinuedToNext ? '2px dashed rgba(0,0,0,0.1)' : undefined,
                                                                    zIndex: visualHeight > timeBasedHeight ? 10 : 1, // Ensure expanded cards float above others
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

                            {
                                visibleTasks.length === 0 && (
                                    <div className="absolute inset-0 col-span-full hidden md:flex flex-col items-center justify-center p-12 text-center animate-in fade-in zoom-in duration-500">
                                        <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mb-6 shadow-sm border border-slate-100/50">
                                            <ClipboardIcon size={48} className="text-slate-300" weight="bold" />
                                        </div>
                                        <h3 className="text-2xl font-black text-slate-800 mb-2 tracking-tight">אין עדיין משימות להצגה</h3>
                                        <p className="text-slate-500 max-w-sm mb-8 font-medium leading-relaxed">
                                            כדי להתחיל לשבץ, עליך להגדיר את משימות הפלוגה (שמירות, סיורים, תורנויות וכו').
                                        </p>
                                    </div>
                                )
                            }
                        </>
                    )}
                </div >
            </div >
            {selectedShift && (
                <AssignmentModal
                    selectedShift={selectedShift}
                    task={taskTemplates.find(t => t.id === selectedShift.taskId)!}
                    people={people}
                    roles={roles}
                    teams={teams}
                    shifts={effectiveShifts}
                    selectedDate={selectedDate}
                    teamRotations={teamRotations}
                    constraints={constraints}
                    interPersonConstraints={settings?.interPersonConstraints || []}
                    settings={settings}
                    absences={absences}
                    hourlyBlockages={hourlyBlockages}
                    taskTemplates={taskTemplates}
                    isViewer={isViewer}
                    onClose={() => setSelectedShiftId(null)}
                    onAssign={handleDraftAssign}
                    onUnassign={handleDraftUnassign}
                    onUpdateShift={handleDraftUpdateShift}
                    onToggleCancelShift={handleDraftToggleCancel}
                    onNavigate={onNavigate}
                    onViewHistory={handleViewHistory}
                />
            )}



            {showInsights && (
                <IdlePersonnelInsights
                    people={activePeople}
                    shifts={effectiveShifts}
                    teams={teams}
                    taskTemplates={taskTemplates}
                    selectedDate={selectedDate}
                    teamRotations={teamRotations}
                    absences={absences}
                    hourlyBlockages={hourlyBlockages}
                    settings={settings}
                    constraints={constraints}
                    onClose={() => setShowInsights(false)}
                    forceShowDemo={isTourActive}
                    onAssignClick={(p, shiftId) => {
                        if (shiftId) {
                            const shift = effectiveShifts.find(s => s.id === shiftId);
                            const taskName = shift ? taskTemplates.find(t => t.id === shift.taskId)?.name : undefined;
                            handleDraftAssign(shiftId, p.id, taskName);
                            showToast(`החייל שובץ בהצלחה`, 'success');
                        } else {
                            setFilterPersonIds([p.id]);
                        }
                        setShowInsights(false);
                    }}
                />
            )}

            {showCompliance && (
                <ComplianceInsights
                    people={activePeople}
                    shifts={effectiveShifts}
                    tasks={taskTemplates}
                    roles={roles}
                    absences={absences}
                    hourlyBlockages={hourlyBlockages}
                    selectedDate={selectedDate}
                    onClose={() => setShowCompliance(false)}
                    onPersonSelect={(personId) => {
                        setFilterPersonIds([personId]);
                        setShowCompliance(false);
                    }}
                />
            )}

            {!isViewer && (
                <FeatureTour
                    tourId="idle_personnel_insights_v2"
                    steps={[
                        {
                            targetId: window.innerWidth < 768 ? '#tour-mobile-menu' : '#tour-idle-toggle',
                            title: 'הכירו את תמונת מצב פנויים',
                            content: 'מערכת חדשה שמאפשרת לכם לראות מי מהלוחמים פנוי כרגע, נמצא בבסיס ומסיים את המנוחה שלו. המערכת תסרוק את כל המשימות החסרות ותציע לכם הצעות שיבוץ חכמות.',
                            position: 'bottom'
                        },
                        {
                            targetId: '#tour-idle-panel',
                            title: 'לוח הפנויים',
                            content: 'כאן מופיעים כל הלוחמים שאינם משובצים כרגע וביצעו את המנוחה הנדרשת שלהם.',
                            position: 'right'
                        },
                        {
                            targetId: '#tour-idle-time',
                            title: 'כמה זמן הוא ממתין?',
                            content: 'כאן תוכל לראות בדיוק כמה זמן עבר מאז שהחייל סיים את המנוחה שלו והפך להיות זמין לשיבוץ מחדש.',
                            position: 'bottom'
                        },
                        {
                            targetId: '#tour-idle-history',
                            title: 'היסטוריה ותכנון',
                            content: 'המערכת מציגה לך מה הייתה המשימה האחרונה ומתי המשימה הבאה שרשומה לו, כדי שתקבל החלטה מושכלת.',
                            position: 'bottom'
                        },
                        {
                            targetId: '#tour-idle-suggestions',
                            title: 'שיבוץ מהיר וחכם',
                            content: 'אלו ההצעות הכי טובות עבורו. לחיצה על ה-V תשבץ אותו מיידית למשימה בלוח.',
                            position: 'top'
                        }
                    ]}
                    onStepChange={(idx) => {
                        // Open insights panel when we reach step 1 (index starts at 0)
                        if (idx >= 1) {
                            setShowInsights(true);
                            setIsTourActive(true);
                        } else {
                            setShowInsights(false);
                        }
                    }}
                    onComplete={() => {
                        setIsTourActive(false);
                        setShowInsights(false);
                    }}
                />
            )}

            {/* Legend Popup - Moved outside for fixed positioning on large screens */}

            {showLegend && (
                <div className={`
                    absolute top-16 left-4 z-[100] w-64 
                    bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/50 ring-1 ring-slate-900/5
                    overflow-hidden animate-in fade-in zoom-in-95 duration-200
                    xl:fixed xl:left-8 xl:top-32 xl:block
                `}>
                    <div className="px-5 py-4 flex justify-between items-start">
                        <div>
                            <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                <Info size={16} className="text-indigo-500" weight="duotone" />
                                מקרא סימונים
                            </h4>
                            <p className="text-[10px] text-slate-400 mt-0.5">הסבר על הסטטוסים בלוח</p>
                        </div>
                        <button
                            onClick={() => setShowLegend(false)}
                            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1 rounded-full transition-colors -ml-1"
                        >
                            <X size={14} weight="bold" />
                        </button>
                    </div>

                    <div className="px-5 pb-5 space-y-5">
                        <div className="space-y-2.5">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                <User size={12} weight="bold" />
                                סטטוס איוש
                            </p>
                            <div className="space-y-2 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100/50">
                                <div className="flex items-center gap-2.5 text-xs">
                                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-200"></div>
                                    <span className="text-slate-700 font-medium">מאויש מלא (תקין)</span>
                                </div>
                                <div className="flex items-center gap-2.5 text-xs">
                                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-sm shadow-amber-200"></div>
                                    <span className="text-slate-700 font-medium">חסר איוש / תפקיד</span>
                                </div>
                                <div className="flex items-center gap-2.5 text-xs">
                                    <div className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-sm shadow-purple-200"></div>
                                    <span className="text-slate-700 font-medium">איוש יתר (חריגה)</span>
                                </div>
                                <div className="flex items-center gap-2.5 text-xs">
                                    <div className="w-2.5 h-2.5 rounded-full bg-slate-100 border border-slate-300"></div>
                                    <span className="text-slate-500">ריק (ללא שיבוץ)</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2.5">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                <AlertTriangle size={12} weight="bold" />
                                התראות ושגיאות
                            </p>
                            <div className="space-y-2 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100/50">
                                <div className="flex items-center gap-2.5 text-xs group">
                                    <div className="bg-rose-100 text-rose-600 p-1 rounded-md group-hover:bg-rose-200 transition-colors">
                                        <ClockCounterClockwise size={14} weight="bold" />
                                    </div>
                                    <span className="text-slate-700 font-medium">אי עמידה בזמן מנוחה</span>
                                </div>
                                <div className="flex items-center gap-2.5 text-xs group">
                                    <div className="bg-amber-100 text-amber-600 p-1 rounded-md group-hover:bg-amber-200 transition-colors">
                                        <AlertTriangle size={14} weight="bold" />
                                    </div>
                                    <span className="text-slate-700 font-medium">חסר כוח אדם / תפקיד</span>
                                </div>
                                <div className="flex items-center gap-2.5 text-xs group">
                                    <div className="bg-red-100 text-red-600 p-1 rounded-md group-hover:bg-red-200 transition-colors">
                                        <Ban size={14} weight="bold" />
                                    </div>
                                    <span className="text-slate-700 font-medium">חייל באילוץ / חופש</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {
                selectedReportShift && (() => {
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
                })()
            }

            {/* Activity Feed Overlay */}
            {showHistory && organization && (
                <ActivityFeed
                    onClose={handleHistoryClose}
                    organizationId={organization.id}
                    initialFilters={historyFilters}
                    people={activePeople}
                    tasks={taskTemplates}
                    teams={teams}
                    entityTypes={['shift']}
                    onLogClick={(log) => {
                        if (log.entity_type === 'shift' && log.entity_id) {
                            // Find shift locally first
                            const shift = shifts.find(s => s.id === log.entity_id);

                            // Determine date to jump to

                            let targetDate = shift ? new Date(shift.startTime) : null;
                            if (!targetDate && log.metadata?.startTime) {
                                targetDate = new Date(log.metadata.startTime);
                            } else if (!targetDate && log.metadata?.date) {
                                // Fallback for pure date strings
                                targetDate = new Date(log.metadata.date);
                            }


                            if (targetDate && !isNaN(targetDate.getTime())) {
                                onDateChange(targetDate);
                                handleHistoryClose();
                            } else {
                                console.error('❌ Calculated Invalid Date for navigation');
                                showToast('שגיאה: תאריך היעד אינו תקין', 'error');
                                return;
                            }
                            setSelectedShiftId(log.entity_id); // This should trigger any highlighting logic
                            setShowHistory(false);

                            const taskName = log.metadata?.taskName || (shift ? taskTemplates.find(t => t.id === shift.taskId)?.name : "משמרת");
                            showToast(`נווט למשמרת: ${taskName}`, 'info');
                        } else {
                            showToast('לא ניתן לאתר את תאריך המשמרת', 'error');
                        }
                    }}
                />
            )}

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

            {
                showRotaWizard && (
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
                )
            }

            <AutoScheduleModal
                isOpen={showScheduleModal}
                onClose={() => setShowScheduleModal(false)}
                onSchedule={handleInternalAutoSchedule}
                tasks={taskTemplates}
                initialDate={selectedDate}
                isScheduling={isScheduling}
            />

            <FloatingActionButton
                icon={Wand2}
                onClick={() => setShowScheduleModal(true)}
                ariaLabel="שיבוץ אוטומטי"
                show={!isViewer}
                variant="action"
            />
            <GenericModal
                isOpen={isFilterModalOpen}
                onClose={() => setIsFilterModalOpen(false)}
                title="סינון לוח שיבוצים"
                size="md"
            >
                <div className="space-y-6 py-4">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">סינון לפי משימות</label>
                        <MultiSelect
                            options={taskTemplates.map(t => ({ value: t.id, label: t.name }))}
                            value={filterTaskIds}
                            onChange={setFilterTaskIds}
                            placeholder="בחר משימות..."
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">סינון לפי חייל</label>
                        <MultiSelect
                            options={activePeople.map(p => ({ value: p.id, label: p.name }))}
                            value={filterPersonIds}
                            onChange={setFilterPersonIds}
                            placeholder="בחר חיילים..."
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">סינון לפי מחלקה/צוות</label>
                        <MultiSelect
                            options={teams.map(t => ({ value: t.id, label: t.name }))}
                            value={filterTeamIds}
                            onChange={setFilterTeamIds}
                            placeholder="בחר צוותים..."
                        />
                    </div>

                    <div className="flex justify-between pt-4 border-t border-slate-100">
                        <Button
                            variant="secondary"
                            onClick={() => {
                                setFilterTaskIds([]);
                                setFilterPersonIds([]);
                                setFilterTeamIds([]);
                            }}
                        >
                            איפוס מסננים
                        </Button>
                        <Button
                            variant="primary"
                            onClick={() => setIsFilterModalOpen(false)}
                        >
                            החל סינונים
                        </Button>
                    </div>
                </div>
            </GenericModal>
        </div>
    );
};
