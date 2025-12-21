import React, { useState } from 'react';
import { Shift, Person, TaskTemplate, Role, Team, TeamRotation } from '../types';
import { Clock, MapPin, User, ChevronDown, CheckCircle, AlertTriangle, ChevronRight, Hash, Ban, Undo2 } from 'lucide-react';
import { getPersonInitials } from '../utils/nameUtils';

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

    // 3. Render
    return (
        <div className="flex flex-col gap-4 pb-20">
            {sortedTasks.map(task => {
                const taskShifts = activeShifts.filter(s => s.taskId === task.id)
                    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

                if (taskShifts.length === 0) return null;

                const bgStyle = { backgroundColor: hexToRgba(task.color, 0.05), borderColor: task.color };
                const headerStyle = { backgroundColor: hexToRgba(task.color, 0.15), color: task.color }; // Darker text? no, use specific color logic or class

                return (
                    <div key={task.id} className="rounded-xl overflow-hidden border border-slate-200 shadow-sm" style={{ borderColor: hexToRgba(task.color, 0.3) }}>
                        {/* Task Header */}
                        <div className="p-3 flex items-center justify-between border-b border-slate-100" style={headerStyle}>
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-white/50 rounded-lg">
                                    <Hash size={14} style={{ color: task.color }} />
                                </div>
                                <h3 className="font-bold text-slate-900">{task.name}</h3>
                            </div>
                            <span className="text-xs font-bold px-2 py-0.5 bg-white/50 rounded-full text-slate-700">
                                {taskShifts.length} משמרות
                            </span>
                        </div>

                        {/* Shifts List */}
                        <div className="bg-white">
                            {taskShifts.map(shift => {
                                const assigned = shift.assignedPersonIds
                                    .map(id => people.find(p => p.id === id))
                                    .filter(Boolean) as Person[];

                                const start = new Date(shift.startTime);
                                const end = new Date(shift.endTime);
                                const isCancelled = shift.isCancelled;

                                return (
                                    <div
                                        key={shift.id}
                                        onClick={() => onSelectShift(shift)}
                                        className={`p-3 border-b border-slate-50 last:border-0 relative transition-all active:scale-[0.99] ${isCancelled ? 'bg-slate-50 opacity-70 grayscale' : 'hover:bg-slate-50'}`}
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            {/* Time & Status */}
                                            <div className="flex items-center gap-2">
                                                <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded-md text-slate-700 font-mono text-xs font-bold">
                                                    <Clock size={12} />
                                                    {start.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                                    -
                                                    {end.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                                {isCancelled && <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">מבוטל</span>}
                                            </div>

                                            {/* Action / Chevron */}
                                            <ChevronRight size={16} className="text-slate-300" />
                                        </div>

                                        {/* Assigned People */}
                                        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                                            {assigned.length > 0 ? (
                                                assigned.map(person => (
                                                    <div key={person.id} className="flex items-center gap-1.5 bg-blue-50/50 pl-2 pr-1 py-0.5 rounded-full border border-blue-100 shrink-0">
                                                        <div className="w-5 h-5 rounded-full bg-blue-200 flex items-center justify-center text-[9px] font-bold text-blue-700">
                                                            {getPersonInitials(person.name)}
                                                        </div>
                                                        <span className="text-xs font-medium text-slate-700 max-w-[80px] truncate">{person.name}</span>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="flex items-center gap-1 text-slate-400 text-xs italic">
                                                    <AlertTriangle size={12} />
                                                    <span>לא משובץ</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}

            {activeShifts.length === 0 && (
                <div className="text-center py-10 text-slate-400">
                    <p>אין משמרות להצגה בתאריך זה</p>
                </div>
            )}
        </div>
    );
};
