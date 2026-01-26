import React, { useState, useMemo } from 'react';
import { Shift, TaskTemplate } from '@/types';
import { ClipboardText, Clock, UserPlus, Info, Calendar, CaretDown, CaretRight } from '@phosphor-icons/react';
import { hexToRgba } from './ScheduleBoard';

interface UnassignedTaskBankProps {
    shifts: Shift[];
    taskTemplates: TaskTemplate[];
    selectedDate: Date;
    isViewer?: boolean;
}

export const UnassignedTaskBank: React.FC<UnassignedTaskBankProps> = ({
    shifts,
    taskTemplates,
    selectedDate,
    isViewer = false,
}) => {
    const [collapsedTasks, setCollapsedTasks] = useState<Set<string>>(new Set());

    const toggleTaskType = (taskId: string) => {
        const next = new Set(collapsedTasks);
        if (next.has(taskId)) next.delete(taskId);
        else next.add(taskId);
        setCollapsedTasks(next);
    };

    // Filter shifts for the selected week that are unassigned
    const unassignedShifts = useMemo(() => {
        const weekStart = new Date(selectedDate);
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(selectedDate);
        weekEnd.setDate(weekEnd.getDate() + 7);
        weekEnd.setHours(23, 59, 59, 999);

        return shifts.filter(s => {
            const required = s.requirements?.requiredPeople || 1;
            const isUnassigned = s.assignedPersonIds.length < required;
            if (!isUnassigned || s.isCancelled) return false;

            const sStart = new Date(s.startTime);
            return sStart >= weekStart && sStart <= weekEnd;
        });
    }, [shifts, selectedDate]);

    // Group and sort shifts
    const groupedShifts = useMemo(() => {
        const groups: Record<string, Shift[]> = {};

        unassignedShifts.forEach(shift => {
            if (!groups[shift.taskId]) groups[shift.taskId] = [];
            groups[shift.taskId].push(shift);
        });

        // Sort shifts within each group by startTime
        Object.keys(groups).forEach(taskId => {
            groups[taskId].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
        });

        // Sort groups by task name
        return Object.entries(groups).sort(([idA], [idB]) => {
            const nameA = taskTemplates.find(t => t.id === idA)?.name || '';
            const nameB = taskTemplates.find(t => t.id === idB)?.name || '';
            return nameA.localeCompare(nameB, 'he');
        });
    }, [unassignedShifts, taskTemplates]);

    const formatTime = (timeStr: string) => {
        if (!timeStr) return '--:--';
        if (timeStr.includes('T')) {
            const date = new Date(timeStr);
            return date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
        }
        return timeStr.substring(0, 5);
    };

    const handleDragStart = (e: React.DragEvent, shiftId: string) => {
        if (isViewer) {
            e.preventDefault();
            return;
        }
        e.dataTransfer.setData('application/json', JSON.stringify({ shiftId }));
        e.dataTransfer.effectAllowed = 'copy';
    };

    return (
        <div className="w-full lg:w-[240px] flex flex-col bg-slate-50 border-b lg:border-b-0 lg:border-r border-slate-200 h-[250px] lg:h-full overflow-hidden shrink-0 transition-all">
            <div className="p-2.5 md:p-3 border-b border-slate-200 bg-white shadow-sm z-[2]">
                <div className="flex items-center gap-2 mb-0.5">
                    <div className="p-1 bg-amber-100 text-amber-700 rounded-md">
                        <ClipboardText size={16} weight="bold" />
                    </div>
                    <h3 className="font-black text-slate-800 tracking-tight text-xs md:text-sm">בנק משימות</h3>
                </div>
                <p className="text-[9px] md:text-[10px] text-slate-500 font-medium leading-tight">
                    גרור לחייל בלוח לשיבוץ.
                </p>
            </div>

            <div className="flex-1 overflow-y-auto p-1.5 flex flex-col gap-1 custom-scrollbar">
                {unassignedShifts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 lg:py-12 px-6 text-center">
                        <div className="w-12 h-12 lg:w-16 lg:h-16 bg-white rounded-2xl flex items-center justify-center mb-4 border border-slate-100 shadow-sm">
                            <Info size={28} className="text-slate-200" weight="bold" />
                        </div>
                        <p className="text-xs lg:text-sm font-bold text-slate-400">אין משימות לא מאוישות</p>
                        <p className="text-[10px] lg:text-[11px] text-slate-400/80 mt-1">הכל משובץ פיקס!</p>
                    </div>
                ) : (
                    groupedShifts.map(([taskId, taskShifts]) => {
                        const task = taskTemplates.find(t => t.id === taskId);
                        const isCollapsed = collapsedTasks.has(taskId);

                        return (
                            <div key={taskId} className="flex flex-col">
                                {/* Group Header */}
                                <button
                                    onClick={() => toggleTaskType(taskId)}
                                    className="flex items-center gap-2 p-2 hover:bg-slate-100 rounded-lg transition-colors w-full text-right group"
                                >
                                    <div className="flex items-center justify-center w-5 h-5 rounded bg-white shadow-sm border border-slate-200 text-slate-400">
                                        {isCollapsed ? <CaretRight size={12} weight="bold" /> : <CaretDown size={12} weight="bold" />}
                                    </div>
                                    <span className="font-black text-slate-700 text-[11px] md:text-xs truncate flex-1">
                                        {task?.name || 'משימה'}
                                        <span className="mr-2 px-1.5 py-0.5 bg-slate-200 text-slate-500 rounded-full text-[9px] font-black">
                                            {taskShifts.length}
                                        </span>
                                    </span>
                                </button>

                                {/* Group Items */}
                                {!isCollapsed && (
                                    <div className="flex flex-col gap-2 p-1">
                                        {taskShifts.map(shift => {
                                            const shiftDate = new Date(shift.startTime);
                                            return (
                                                <div
                                                    key={shift.id}
                                                    draggable={!isViewer}
                                                    onDragStart={(e) => handleDragStart(e, shift.id)}
                                                    className={`group bg-white px-2 py-2 rounded-lg border border-slate-200 shadow-sm transition-all relative overflow-hidden min-h-[50px] flex flex-col justify-center ${isViewer ? 'cursor-default' : 'hover:border-blue-300 cursor-grab active:cursor-grabbing'}`}
                                                >
                                                    {/* Accent line */}
                                                    <div
                                                        className="absolute right-0 top-0 bottom-0 w-1"
                                                        style={{ backgroundColor: task?.color || '#cbd5e1' }}
                                                    />

                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center justify-between gap-1 text-[9px] font-black text-slate-500">
                                                            <div className="flex items-center gap-1">
                                                                <Calendar size={10} weight="bold" className="text-slate-400" />
                                                                <span>{shiftDate.toLocaleDateString('he-IL', { weekday: 'short', day: '2-digit', month: '2-digit' })}</span>
                                                            </div>
                                                            <div className="p-1 bg-blue-50 text-blue-600 rounded opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                                                <UserPlus size={10} weight="bold" />
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-1.5 text-[10px] text-slate-700 font-bold bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 w-fit" dir="ltr">
                                                            <Clock size={11} className="text-slate-400" />
                                                            <span>{formatTime(shift.startTime)} - {formatTime(shift.endTime)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            <div className="p-2 bg-white border-t border-slate-200">
                <div className="text-[9px] text-slate-400 font-bold flex items-center justify-between">
                    <span>סה״כ חסרים:</span>
                    <span className="text-amber-600 font-black">{unassignedShifts.length}</span>
                </div>
            </div>
        </div>
    );
};
