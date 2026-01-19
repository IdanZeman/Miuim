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
import { CaretLeft as ChevronLeft, CaretRight as ChevronRight, Plus, X, Check, Warning as AlertTriangle, Clock, ClockCounterClockwise, User, MapPin, CalendarBlank as CalendarIcon, PencilSimple as Pencil, FloppyDisk as Save, Trash as Trash2, Copy, CheckCircle, Prohibit as Ban, ArrowUUpLeft as Undo2, CaretDown as ChevronDown, MagnifyingGlass as Search, DotsThreeVertical as MoreVertical, MagicWand as Wand2, ClipboardText as ClipboardIcon, Funnel, Info } from '@phosphor-icons/react';
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
    hasAbsenceConflict?: boolean;
    hasRestViolation?: boolean; // NEW
}> = ({ shift, taskTemplates, people, roles, teams, onSelect, onToggleCancel, onReportClick, isViewer, acknowledgedWarnings, missionReports, style, onAutoSchedule, isContinuedFromPrev, isContinuedToNext, isCompact, hasAbsenceConflict, hasRestViolation }) => {
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
            bgColor = 'bg-green-50';
            borderColor = 'border-green-200';
        } else if (isUnderStaffed || hasMissingRoles) {
            bgColor = 'bg-amber-50';
            borderColor = 'border-amber-200';
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
                </div>
            </div>

            {/* Middle Row - Names (Adaptive - Desktop Only) */}
            {
                (style?.height && parseInt(String(style.height)) >= 45 && assigned.length > 0) && (() => {
                    const cardHeight = parseInt(String(style.height));

                    // A full name chip + gap is roughly 28px. 
                    // Header/Footer take about 32px of space.
                    const maxVerticalNames = Math.max(1, Math.floor((cardHeight - 32) / 28));

                    // If we have fewer people than available vertical slots, we can show full names in a column
                    const isCrowded = assigned.length > maxVerticalNames;

                    return (
                        <div className={`hidden md:flex flex-1 ${isCrowded ? 'flex-row flex-wrap content-center justify-center' : 'flex-col justify-center items-center'} gap-1 overflow-hidden py-0.5 w-full px-1`}>
                            {assigned.map(p => {
                                // Only use initials if it's truly crowded (more people than vertical slots)
                                const useInitials = isCrowded;
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
                    <div className={`text-[10px] font-medium leading-none flex-shrink-0 ml-1 mb-0.5 ${hasMissingRoles || isUnderStaffed ? 'text-red-500 font-bold' : (isOverStaffed ? 'text-purple-600 font-bold' : 'text-slate-400')}`}>
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
    absences = [], hourlyBlockages = [], settings = null, onAutoSchedule
}) => {
    const activePeople = useMemo(() => people.filter(p => p.isActive !== false), [people]);
    const { profile } = useAuth();
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


    const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
    const [selectedReportShiftId, setSelectedReportShiftId] = useState<string | null>(null);
    const [filterTaskIds, setFilterTaskIds] = useState<string[]>([]);
    const [filterPersonIds, setFilterPersonIds] = useState<string[]>([]);
    const [filterTeamIds, setFilterTeamIds] = useState<string[]>([]);
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false); // NEW
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
    const acknowledgedWarnings = (propAcknowledgedWarnings instanceof Set) ? propAcknowledgedWarnings : localAcknowledgedWarnings;


    const setAcknowledgedWarnings = setLocalAcknowledgedWarnings;

    // Export Modal State
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // New state for mobile action menu
    const [showRotaWizard, setShowRotaWizard] = useState(false);
    const [isClearModalOpen, setIsClearModalOpen] = useState(false);
    const [showLegend, setShowLegend] = useState(false);

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

                        text += `• ${sStart} - ${sEnd}: ${personnelNames || 'לא שובץ'}\n`;
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
                const availability = person ? getEffectiveAvailability(person, selectedDate, teamRotations, absences, hourlyBlockages) : { isAvailable: true };

                // Determine conflict type
                let type: 'absence' | 'overlap' | 'rest_violation' = !availability.isAvailable ? 'absence' : 'overlap';

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
                    }
                }

                return {
                    shiftId: shift.id,
                    personId,
                    type
                };
            });
        });
    }, [shifts, activePeople, selectedDate, teamRotations, absences, hourlyBlockages]);

    const getShiftConflicts = (shiftId: string) => {
        const shift = shifts.find(s => s.id === shiftId);
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
            {isViewer && renderFeaturedCard()}



            {/* Time Grid Board Container - FLEX LOCK STRATEGY */}
            <div className={`bg-white rounded-[2rem] border border-slate-100 ${isCompact ? 'p-2 md:p-3' : 'p-4 md:p-6'} flex flex-col relative overflow-hidden h-[calc(100vh-190px)] md:h-[calc(100vh-140px)] shadow-sm`}>

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

                    {/* Right Side: Title, Info, Stats & Mobile Menu */}
                    <div className="flex items-center justify-between w-full md:w-auto gap-3">
                        {/* Title Group */}
                        <div className="flex items-center gap-3">
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

                            {/* Availability Badge */}
                            {!isViewer && (() => {
                                const dateKey = selectedDate.toLocaleDateString('en-CA');
                                const unavailableCount = activePeople.filter(p => {
                                    if (p.dailyAvailability?.[dateKey]?.isAvailable === false) return true;
                                    return false;
                                }).length;
                                const availableCount = activePeople.length - unavailableCount;

                                return (
                                    <div className="hidden xs:flex items-center gap-2 bg-gradient-to-r from-emerald-50 to-green-50 px-3 py-1.5 rounded-full border border-emerald-200">
                                        <User size={14} className="text-emerald-600" weight="bold" />
                                        <span className="text-xs font-bold text-emerald-700">
                                            זמינים: {availableCount}/{activePeople.length}
                                        </span>
                                    </div>
                                );
                            })()}
                        </div>

                    </div>

                    {/* Center: Date Navigation & Mobile Menu */}
                    <div className="flex flex-row items-center justify-center flex-1 z-50 gap-2">

                        <DateNavigator
                            date={selectedDate}
                            onDateChange={handleDateChange}
                            canGoPrev={canGoPrev}
                            canGoNext={canGoNext}
                            maxDate={isViewer ? maxViewerDate : undefined}
                            className="bg-white/50 backdrop-blur-sm shadow-sm rounded-2xl border border-slate-100 p-1"
                        />

                        {/* Mobile Menu Button - Moved to LEFT of Date (After in DOM for RTL? No, checking visual) */}
                        {/* User said "Left of the Date". In RTL, "Left" is the end. So let's place it AFTER. */}
                        <div className="md:hidden">
                            <button
                                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-700 active:bg-slate-50 transition-colors shadow-sm"
                                aria-label="More actions"
                            >
                                <MoreVertical size={20} weight="bold" />
                            </button>
                        </div>
                    </div>

                    {/* Left: Desktop Actions (Icon Only) */}
                    <div className="hidden md:flex items-center gap-1.5 bg-slate-50/50 p-1 rounded-2xl border border-slate-100">
                        <Tooltip content="מסננים">
                            <Button
                                variant={filterTaskIds.length > 0 || filterPersonIds.length > 0 || filterTeamIds.length > 0 ? 'primary' : 'secondary'}
                                size="sm"
                                onClick={() => setIsFilterModalOpen(true)}
                                className="w-9 h-9 rounded-xl p-0 flex items-center justify-center relative"
                            >
                                <Funnel size={18} weight={(filterTaskIds.length > 0 || filterPersonIds.length > 0 || filterTeamIds.length > 0) ? "fill" : "regular"} />
                                {(filterTaskIds.length > 0 || filterPersonIds.length > 0 || filterTeamIds.length > 0) && (
                                    <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold border-2 border-white">
                                        {(filterTaskIds.length > 0 ? 1 : 0) + (filterPersonIds.length > 0 ? 1 : 0) + (filterTeamIds.length > 0 ? 1 : 0)}
                                    </span>
                                )}
                            </Button>
                        </Tooltip>

                        <Tooltip content="ייצוא לאקסל">
                            <ExportButton
                                onExport={async () => { setIsExportModalOpen(true); }}
                                variant="secondary"
                                size="sm"
                                iconOnly
                                className="w-9 h-9 rounded-xl border-slate-200"
                            />
                        </Tooltip>

                        <Tooltip content="העתק ללוח">
                            <button
                                onClick={handleExportClick}
                                className="flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 transition-all shadow-sm"
                            >
                                <Copy size={18} weight="bold" />
                            </button>
                        </Tooltip>

                        {!isViewer && (
                            <Tooltip content="נקה הכל">
                                <button
                                    onClick={handleClearDayClick}
                                    className="flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-all shadow-sm"
                                >
                                    <Trash2 size={18} weight="bold" />
                                </button>
                            </Tooltip>
                        )}

                        <Tooltip content={showLegend ? "הסתר מקרא" : "הצג מקרא"}>
                            <button
                                onClick={() => setShowLegend(!showLegend)}
                                className={`flex items-center justify-center w-9 h-9 rounded-xl border transition-all shadow-sm ${showLegend
                                    ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-inner'
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200'
                                    }`}
                            >
                                <Info size={18} weight="bold" />
                            </button>
                        </Tooltip>

                        <Tooltip content={isCompact ? "תצוגה רגילה" : "תצוגה קומפקטית"}>
                            <button
                                onClick={() => setIsCompact(!isCompact)}
                                className={`flex items-center justify-center w-9 h-9 rounded-xl border transition-all shadow-sm ${isCompact
                                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-inner'
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200'
                                    }`}
                            >
                                {isCompact ? <ArrowsOutSimple size={18} weight="bold" /> : <ArrowsInSimple size={18} weight="bold" />}
                            </button>
                        </Tooltip>
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
                                    // Corrected shift overlap check for desktop grid
                                    const dayStart = new Date(selectedDate);
                                    dayStart.setHours(0, 0, 0, 0);
                                    const dayEnd = new Date(selectedDate);
                                    dayEnd.setHours(24, 0, 0, 0);

                                    const taskShifts = (shifts || []).filter(s => {
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
                                                        hasAbsenceConflict={isShiftConflictDueToAbsence(shift.id)}
                                                        hasRestViolation={conflicts.some(c => c.shiftId === shift.id && c.type === 'rest_violation')}
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

                    {
                        visibleTasks.length === 0 && (
                            <div className="absolute inset-0 col-span-full flex flex-col items-center justify-center p-12 text-center animate-in fade-in zoom-in duration-500">
                                <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mb-6 shadow-sm border border-slate-100/50">
                                    <ClipboardIcon size={48} className="text-slate-300" weight="bold" />
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
                        )
                    }
                </div >
            </div >
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
                    taskTemplates={taskTemplates}
                    isViewer={isViewer}
                    onClose={() => setSelectedShiftId(null)}
                    onAssign={onAssign}
                    onUnassign={onUnassign}
                    onUpdateShift={onUpdateShift}
                    onToggleCancelShift={onToggleCancelShift}
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

            <FloatingActionButton
                icon={Wand2}
                onClick={onAutoSchedule || (() => { })}
                ariaLabel="שיבוץ אוטומטי"
                show={!isViewer && !!onAutoSchedule}
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
