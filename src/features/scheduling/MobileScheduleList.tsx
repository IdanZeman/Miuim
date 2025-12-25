import React, { useState } from 'react';
import { Shift, Person, TaskTemplate, Role, Team, TeamRotation } from '../../types';
import { Clock, MapPin, User, ChevronDown, CheckCircle, AlertTriangle, ChevronRight, Hash, Ban, Undo2, Plus } from 'lucide-react';
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
    onSelectShift, onToggleCancelShift, onAddShift
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
    const sortedTasks = [...taskTemplates].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

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
        <div className="flex flex-col pb-20 -mx-4">
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
                                    size={20}
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

                                    // Status Color (Strip)
                                    const statusColor = isCancelled ? '#94a3b8' : (isEmpty ? '#f97316' : '#22c55e');

                                    return (
                                        <div
                                            key={shift.id}
                                            onClick={() => onSelectShift(shift)}
                                            className="relative flex items-center min-h-[64px] bg-white active:bg-slate-50 transition-colors cursor-pointer"
                                        >
                                            {/* Status Strip */}
                                            <div
                                                className="absolute right-0 top-0 bottom-0 w-1.5"
                                                style={{ backgroundColor: statusColor }}
                                            ></div>

                                            <div className="flex-1 flex items-center justify-between pr-4 pl-4 py-3">

                                                {/* Left: Time & Info */}
                                                <div className="flex flex-col gap-0.5">
                                                    <div className={`text-base font-semibold font-mono tracking-tight ${isCancelled ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                                                        {start.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                                        <span className="mx-1 text-slate-300">-</span>
                                                        {end.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                    {isCancelled && <span className="text-xs text-red-500 font-bold">מבוטל</span>}
                                                </div>

                                                {/* Center/Right: People or CTA */}
                                                <div className="flex items-center justify-end gap-2 flex-1 pl-2">
                                                    {isEmpty ? (
                                                        <div className="flex items-center gap-2 text-orange-500 bg-orange-50 px-3 py-1.5 rounded-full border border-orange-100/50">
                                                            <span className="text-sm font-bold">שבץ אותי</span>
                                                            <div className="w-6 h-6 rounded-full border-2 border-orange-300 border-dashed flex items-center justify-center">
                                                                <Plus size={14} strokeWidth={3} />
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex -space-x-2 space-x-reverse overflow-hidden py-1">
                                                            {assigned.map(person => (
                                                                <div key={person.id} className="relative group">
                                                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs text-white font-bold ring-2 ring-white ${person.color} shadow-sm`}>
                                                                        {getPersonInitials(person.name)}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {!isEmpty && <ChevronRight size={18} className="text-slate-300 mr-1" />}
                                                </div>
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
                        <CheckCircle size={32} />
                    </div>
                    <p className="text-lg font-medium text-slate-500">הכל פנוי!</p>
                    <p className="text-sm">אין משמרות להיום</p>
                </div>
            )}
        </div>
    );
};
