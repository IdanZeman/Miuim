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
    onSelectShift, onToggleCancelShift, onAddShift, missionReports, onReportClick
}) => {
    // 1. Filter shifts for the selected date
    const dayStart = new Date(selectedDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(selectedDate);
    dayEnd.setHours(24, 0, 0, 0);

    const activeShifts = shifts.filter(s => {
        const start = new Date(s.startTime);
        const end = new Date(s.endTime);
        return start < dayEnd && end > dayStart;
    });

    // 2. Sort tasks by logic (e.g. orderIndex later, or just name for now) - assuming templates have order
    const sortedTasks = [...taskTemplates].sort((a, b) => a.name.localeCompare(b.name));

    // State for collapsed tasks (default empty = all expanded)
    const [collapsedTasks, setCollapsedTasks] = useState<Set<string>>(new Set());

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
                                <h3 className="font-bold text-slate-800 text-lg sticky left-0">
                                    # {task.name}
                                </h3>
                                <span className="text-xs font-medium text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                                    {taskShifts.length}
                                </span>
                            </div>
                            <button className="text-slate-400">
                                <ChevronDown
                                    className={`transition-transform duration-200 ${isCollapsed ? '-rotate-90 rtl:rotate-90' : ''}`}
                                    weight="duotone"
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
                                            className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 mb-3 mx-4 active:scale-[0.98] transition-all cursor-pointer"
                                        >
                                            {/* Header: Time & Status */}
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <div className={`text-lg font-bold font-mono tracking-tight ${isCancelled ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                                                        <span dir="ltr">
                                                            {start.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                                            <span className="mx-1 text-slate-300">-</span>
                                                            {end.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Status Badge */}
                                                {isCancelled ? (
                                                    <span className="px-2 py-1.5 rounded-md bg-slate-100 text-slate-500 text-sm font-bold flex items-center gap-1"> {/* Rule 2: min 14px text */}
                                                        <Ban size={14} weight="duotone" /> מבוטל
                                                    </span>
                                                ) : isEmpty ? (
                                                    <span className="px-2 py-1.5 rounded-md bg-orange-50 text-orange-600 text-sm font-bold border border-orange-100">
                                                        לא מאויש
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-1.5 rounded-md bg-green-50 text-green-600 text-sm font-bold border border-green-100 flex items-center gap-1">
                                                        <CheckCircle size={14} weight="duotone" /> מאויש
                                                    </span>
                                                )}
                                            </div>

                                            {/* Body: Person Info */}
                                            <div className="mb-4">
                                                {assigned.length > 0 ? (
                                                    assigned.length > 2 ? (
                                                        <div className="flex -space-x-3 space-x-reverse overflow-hidden py-1 px-1">
                                                            {assigned.map(person => (
                                                                <div key={person.id} className="relative group">
                                                                    <div
                                                                        className={`w-10 h-10 rounded-full flex items-center justify-center text-sm text-white font-bold ring-2 ring-white ${person.color} shadow-sm transition-transform hover:scale-110 hover:z-10`}
                                                                        title={`${person.name}`}
                                                                    >
                                                                        {getPersonInitials(person.name)}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        /* Detailed View: Avatar + Name */
                                                        <div className="flex items-center gap-3 overflow-x-auto pb-1 no-scrollbar">
                                                            {assigned.map(person => (
                                                                <div key={person.id} className="flex items-center gap-3 min-w-fit bg-slate-50 pr-3 pl-1 py-1 rounded-full border border-slate-100 shrink-0 flex-row-reverse">
                                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm text-white font-bold ring-2 ring-white ${person.color} shadow-sm shrink-0`}>
                                                                        {getPersonInitials(person.name)}
                                                                    </div>
                                                                    <div className="flex flex-col text-right">
                                                                        <span className="text-base font-bold text-slate-800 whitespace-nowrap">{person.name}</span> {/* Rule 2: 16px body font */}
                                                                        <span className="text-sm text-slate-500">לוחם</span> {/* Rule 2: 14px metadata */}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )
                                                ) : (
                                                    <div className="flex items-center gap-3 text-slate-400 w-full">
                                                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 border-dashed">
                                                            <User size={20} className="opacity-50" weight="duotone" />
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

                                            <div className="pt-3 border-t border-slate-50">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onReportClick(shift);
                                                    }}
                                                    className={`w-full h-12 rounded-xl flex items-center justify-center gap-2 font-bold text-base transition-colors ${hasReport // Rule 1: 48px height, Rule 2: 16px text
                                                        ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                                                        }`}
                                                >
                                                    <FileText size={20} className={hasReport ? "fill-blue-700" : ""} weight="duotone" />
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
                        <CheckCircle size={32} weight="duotone" />
                    </div>
                    <p className="text-lg font-medium text-slate-500">הכל פנוי!</p>
                    <p className="text-sm">אין משמרות להיום</p>
                </div>
            )}
        </div>
    );
};
