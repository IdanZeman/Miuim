import React, { useState } from 'react';
import { Shift, Person, TaskTemplate, Role, Team, TeamRotation, MissionReport } from '../../types';
import { Clock, MapPin, User, CaretDown as ChevronDown, CheckCircle, Warning as AlertTriangle, CaretRight as ChevronRight, Hash, Prohibit as Ban, ArrowUUpLeft as Undo2, Plus, FileText } from '@phosphor-icons/react';
import { getPersonInitials } from '../../utils/nameUtils';

interface MobileScheduleListProps {
    shifts: Shift[];
    people: Person[];
    taskTemplates: TaskTemplate[];
    roles: Role[];
    teams: Team[];
    selectedDate: Date;
    isViewer: boolean;
    onSelectShift: (shift: Shift) => void;
    onToggleCancelShift: (shiftId: string) => void;
    onAddShift?: (task: TaskTemplate) => void;
    missionReports: MissionReport[];
    onReportClick: (shift: Shift) => void;
    conflicts?: { shiftId: string, personId: string, type: string }[];
    filterPersonIds?: string[]; // NEW
    filterTeamIds?: string[]; // NEW
}

const hexToRgba = (hex: string, alpha: number) => {
    if (!hex) return `rgba(226, 232, 240, ${alpha})`;
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const MobileScheduleList: React.FC<MobileScheduleListProps> = ({
    shifts, people, taskTemplates, roles, teams, selectedDate, isViewer,
    onSelectShift, onToggleCancelShift, onAddShift, missionReports, onReportClick,
    conflicts = [], filterPersonIds = [], filterTeamIds = []
}) => {
    // 1. Filter shifts for the selected date
    const dayStart = new Date(selectedDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(selectedDate);
    dayEnd.setHours(24, 0, 0, 0);

    const activeShifts = (shifts || []).filter(s => {
        const start = new Date(s.startTime);
        const end = new Date(s.endTime);
        // For mobile list view, only show shifts that START on this day
        // This prevents overnight shifts from appearing on both days
        const isDayShift = start >= dayStart && start < dayEnd;
        if (!isDayShift) return false;

        // Apply refined filtering logic
        if (filterPersonIds.length === 0 && filterTeamIds.length === 0) return true;

        if (filterPersonIds.length > 0) {
            if (s.assignedPersonIds.some(pid => filterPersonIds.includes(pid))) return true;
        }

        if (filterTeamIds.length > 0) {
            const hasTeamMatch = s.assignedPersonIds.some(pid => {
                const person = people.find(p => p.id === pid);
                return person?.teamId && filterTeamIds.includes(person.teamId);
            });
            if (hasTeamMatch) return true;
        }

        return false;
    });

    // 2. Sort tasks by logic (e.g. orderIndex later, or just name for now) - assuming templates have order
    const sortedTasks = [...taskTemplates].sort((a, b) => a.name.localeCompare(b.name));

    // Local state for collapsed sections (grouped by task)
    // Default to ALL collapsed
    const [collapsedTasks, setCollapsedTasks] = useState<Set<string>>(() => {
        return new Set(taskTemplates.map(t => t.id));
    });

    const toggleCollapse = (taskId: string) => {
        setCollapsedTasks(prev => {
            const next = new Set(prev);
            if (next.has(taskId)) {
                next.delete(taskId);
            } else {
                next.add(taskId);
            }
            return next;
        });
    };

    // 3. Render
    return (
        <div className="flex flex-col pb-24 -mx-4"> {/* Rule 5: Bottom safe area padding */}
            {/* Negative margin to bleed to edges if parent has padding, or just ensure parent has no padding for this view */}

            {sortedTasks.map(task => {
                const taskShifts = activeShifts.filter(s => s.taskId === task.id)
                    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

                if (taskShifts.length === 0) return null;

                const isCollapsed = collapsedTasks.has(task.id);

                return (
                    <div key={task.id} className="mb-2">
                        {/* Sticky Section Header */}
                        <div
                            onClick={() => toggleCollapse(task.id)}
                            className="sticky top-0 z-10 flex items-center justify-between px-4 py-2 bg-slate-50/95 backdrop-blur-sm border-b border-t border-slate-200 cursor-pointer active:bg-slate-100 transition-colors"
                            style={{ borderLeftColor: task.color, borderLeftWidth: 4 }}
                        >
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-slate-800 text-sm sticky left-0">
                                    # {task.name}
                                </h3>
                                <span className="text-xs font-medium text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                                    {taskShifts.length}
                                </span>
                            </div>
                            <button className="text-slate-400">
                                <ChevronDown
                                    className={`transition-transform duration-200 ${isCollapsed ? '-rotate-90 rtl:rotate-90' : ''}`}
                                    weight="bold"
                                />
                            </button>
                        </div>

                        {/* Full Width List */}
                        {!isCollapsed && (
                            <div className="bg-white divide-y divide-slate-100 animate-in slide-in-from-top-2 duration-200">
                                {taskShifts.map(shift => {
                                    const assigned = shift.assignedPersonIds
                                        .map(id => people.find(p => p.id === id))
                                        .filter(Boolean) as Person[];

                                    const start = new Date(shift.startTime);
                                    const end = new Date(shift.endTime);
                                    const isCancelled = shift.isCancelled;
                                    const isEmpty = assigned.length === 0;
                                    const hasReport = missionReports.some(r => r.shift_id === shift.id);

                                    return (
                                        <div
                                            key={shift.id}
                                            onClick={() => onSelectShift(shift)}
                                            className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 mb-2 mx-4 active:scale-[0.98] transition-all cursor-pointer"
                                        >
                                            {/* Header: Time & Status */}
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <div className={`text-base font-bold font-mono tracking-tight ${isCancelled ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                                                        <span dir="ltr">
                                                            {start.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                                            <span className="mx-1 text-slate-300">-</span>
                                                            {end.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap items-center justify-end gap-1.5 min-w-0">
                                                    {/* Status Badge */}
                                                    {(() => {
                                                        const requiredPeople = shift.requirements?.requiredPeople ||
                                                            task.segments?.find(s => s.id === shift.segmentId)?.requiredPeople || 1;
                                                        const count = assigned.length;

                                                        if (isCancelled) {
                                                            return (
                                                                <span className="px-2 py-1.5 rounded-md bg-slate-100 text-slate-500 text-[10px] md:text-sm font-bold flex items-center gap-1 shrink-0">
                                                                    <Ban size={14} weight="bold" /> מבוטל
                                                                </span>
                                                            );
                                                        }
                                                        if (count === 0) {
                                                            return (
                                                                <span className="px-2 py-1.5 rounded-md bg-slate-50 text-slate-500 text-[10px] md:text-sm font-bold border border-slate-100 shrink-0">
                                                                    לא מאויש
                                                                </span>
                                                            );
                                                        }
                                                        if (count < requiredPeople) {
                                                            return (
                                                                <span className="px-2 py-1.5 rounded-md bg-amber-50 text-amber-600 text-[10px] md:text-sm font-bold border border-amber-100 flex items-center gap-1 shrink-0">
                                                                    <AlertTriangle size={14} weight="bold" />
                                                                    חסר ({count}/{requiredPeople})
                                                                </span>
                                                            );
                                                        }
                                                        if (count > requiredPeople) {
                                                            return (
                                                                <span className="px-2 py-1.5 rounded-md bg-purple-50 text-purple-600 text-[10px] md:text-sm font-bold border border-purple-100 flex items-center gap-1 shrink-0">
                                                                    <Plus size={14} weight="bold" />
                                                                    חריגה ({count}/{requiredPeople})
                                                                </span>
                                                            );
                                                        }
                                                        return (
                                                            <span className="px-2 py-1.5 rounded-md bg-green-50 text-green-600 text-[10px] md:text-sm font-bold border border-green-100 flex items-center gap-1 shrink-0">
                                                                <CheckCircle size={14} weight="bold" /> מאויש ({count}/{requiredPeople})
                                                            </span>
                                                        );
                                                    })()}

                                                    {/* Conflict Warning */}
                                                    {!isCancelled && conflicts.some(c => c.shiftId === shift.id && c.type === 'absence') && (
                                                        <span className="px-2 py-1.5 rounded-md bg-red-50 text-red-600 text-[10px] md:text-sm font-black border border-red-100 flex items-center gap-1 animate-pulse shrink-0" title="חייל בבית / לא זמין">
                                                            <Ban size={14} weight="bold" /> התראת נוכחות
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Body: Person Info */}
                                            <div className="mb-4">
                                                {assigned.length > 0 ? (
                                                    assigned.length > 2 ? (
                                                        <div className="flex -space-x-3 space-x-reverse overflow-hidden py-1 px-1">
                                                            {assigned.map(person => {
                                                                const isProblematic = conflicts.some(c => c.shiftId === shift.id && c.personId === person.id && c.type === 'absence');
                                                                return (
                                                                    <div key={person.id} className="relative group">
                                                                        <div
                                                                            className={`w-10 h-10 rounded-full flex items-center justify-center text-sm text-white font-bold ring-2 ${isProblematic ? 'ring-red-500 animate-pulse' : 'ring-white'} ${person.color} shadow-sm transition-transform hover:scale-110 hover:z-10 relative`}
                                                                            title={`${person.name}${isProblematic ? ' (לא זמין)' : ''}`}
                                                                        >
                                                                            {getPersonInitials(person.name)}
                                                                            {isProblematic && (
                                                                                <div className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 border border-white">
                                                                                    <Ban size={10} weight="bold" />
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        /* Detailed View: Avatar + Name */
                                                        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                                                            {assigned.map(person => {
                                                                const isProblematic = conflicts.some(c => c.shiftId === shift.id && c.personId === person.id && c.type === 'absence');
                                                                return (
                                                                    <div key={person.id} className={`flex items-center gap-2 min-w-fit pr-2 pl-1 py-1 rounded-full border shrink-0 flex-row-reverse ${isProblematic ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-100'}`}>
                                                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] text-white font-bold ring-2 ${isProblematic ? 'ring-red-500 animate-pulse' : 'ring-white'} ${person.color} shadow-sm shrink-0 relative`}>
                                                                            {getPersonInitials(person.name)}
                                                                            {isProblematic && (
                                                                                <div className="absolute -top-0.5 -right-0.5 bg-red-500 text-white rounded-full p-0.5 border border-white">
                                                                                    <Ban size={6} weight="bold" />
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex flex-col text-right">
                                                                            <span className={`text-xs font-bold whitespace-nowrap ${isProblematic ? 'text-red-700' : 'text-slate-800'}`}>{person.name}</span>
                                                                            <span className={`text-[9px] leading-none ${isProblematic ? 'text-red-400' : 'text-slate-500'}`}>{isProblematic ? 'בחופשה / לא זמין' : 'לוחם'}</span>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )
                                                ) : (
                                                    <div className="flex items-center gap-3 text-slate-400 w-full">
                                                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 border-dashed">
                                                            <User size={20} className="opacity-50" weight="bold" />
                                                        </div>
                                                        <span className="text-sm font-medium">טרם שובץ לוחם</span>

                                                        {/* Quick Assign CTA */}
                                                        <div className="mr-auto">
                                                            <div className="w-8 h-8 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center">
                                                                <Plus size={18} weight="bold" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="pt-2 border-t border-slate-50">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onReportClick(shift);
                                                    }}
                                                    className={`w-full h-10 rounded-xl flex items-center justify-center gap-2 font-bold text-sm transition-colors ${hasReport
                                                        ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                                                        }`}
                                                >
                                                    <FileText size={18} className={hasReport ? "fill-blue-700" : ""} weight="bold" />
                                                    {hasReport ? "צפה בדוח משימה" : "מלא דוח משימה"}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}

            {activeShifts.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                        <CheckCircle size={32} weight="bold" />
                    </div>
                    <p className="text-lg font-medium text-slate-500">הכל פנוי!</p>
                    <p className="text-sm">אין משמרות להיום</p>
                </div>
            )}
        </div>
    );
};
