import React, { useState, useEffect } from 'react';
import { TaskTemplate } from '../types';
import { X, Calendar, CheckSquare, Wand2, Loader2, Sparkles } from 'lucide-react';

interface AutoScheduleModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSchedule: (params: { startDate: Date; endDate: Date; selectedTaskIds: string[] }) => Promise<void>;
    tasks: TaskTemplate[];
    initialDate: Date;
    isScheduling: boolean;
}

export const AutoScheduleModal: React.FC<AutoScheduleModalProps> = ({
    isOpen,
    onClose,
    onSchedule,
    tasks,
    initialDate,
    isScheduling
}) => {
    const [mode, setMode] = useState<'single' | 'range'>('single');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (isOpen) {
            const dateStr = initialDate.toISOString().split('T')[0];
            setStartDate(dateStr);
            setEndDate(dateStr);
            // Select all tasks by default
            setSelectedTaskIds(new Set(tasks.map(t => t.id)));
        }
    }, [isOpen, initialDate, tasks]);

    const handleToggleTask = (taskId: string) => {
        const newSelected = new Set(selectedTaskIds);
        if (newSelected.has(taskId)) {
            newSelected.delete(taskId);
        } else {
            newSelected.add(taskId);
        }
        setSelectedTaskIds(newSelected);
    };

    const handleSelectAllTasks = () => {
        if (selectedTaskIds.size === tasks.length) {
            setSelectedTaskIds(new Set());
        } else {
            setSelectedTaskIds(new Set(tasks.map(t => t.id)));
        }
    };

    const handleSubmit = () => {
        if (!startDate) return;

        const start = new Date(startDate);
        const end = mode === 'single' ? new Date(startDate) : new Date(endDate);

        // Set end of day for the end date
        end.setHours(23, 59, 59, 999);

        onSchedule({
            startDate: start,
            endDate: end,
            selectedTaskIds: Array.from(selectedTaskIds)
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="bg-gradient-to-r from-green-600 to-teal-600 p-6 text-white relative overflow-hidden shrink-0">
                    <div className="absolute top-0 left-0 w-full h-full bg-white/10 backdrop-blur-[1px]"></div>
                    <div className="relative z-10 flex justify-between items-start">
                        <div>
                            <h2 className="text-2xl font-bold flex items-center gap-2">
                                <Sparkles className="text-yellow-300" />
                                שיבוץ אוטומטי
                            </h2>
                            <p className="text-green-50 mt-1">הפעלת האלגוריתם החכם לשיבוץ משמרות</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-white/80 hover:text-white hover:bg-white/20 p-1 rounded-full transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">
                    {/* Mode Selection */}
                    <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
                        <button
                            onClick={() => setMode('single')}
                            className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${mode === 'single'
                                ? 'bg-white text-green-600 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            <Calendar size={16} />
                            יום בודד
                        </button>
                        <button
                            onClick={() => setMode('range')}
                            className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${mode === 'range'
                                ? 'bg-white text-green-600 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            <Calendar size={16} />
                            טווח תאריכים
                        </button>
                    </div>

                    {/* Date Inputs */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">
                                {mode === 'single' ? 'תאריך לשיבוץ' : 'תאריך התחלה'}
                            </label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none transition-all font-medium"
                            />
                        </div>
                        {mode === 'range' && (
                            <div className="animate-fadeIn">
                                <label className="block text-xs font-bold text-slate-500 mb-1">תאריך סיום</label>
                                <input
                                    type="date"
                                    value={endDate}
                                    min={startDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none transition-all font-medium"
                                />
                            </div>
                        )}
                    </div>

                    {/* Tasks Selection */}
                    <div className="mb-6">
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-sm font-bold text-slate-700">בחר משימות לשיבוץ</label>
                            <button
                                onClick={handleSelectAllTasks}
                                className="text-xs text-green-600 font-medium hover:underline"
                            >
                                {selectedTaskIds.size === tasks.length ? 'בטל בחירה' : 'בחר הכל'}
                            </button>
                        </div>
                        <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto custom-scrollbar">
                            {tasks.length === 0 ? (
                                <div className="p-4 text-center text-slate-400 text-sm">
                                    לא נמצאו משימות
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {tasks.map(task => (
                                        <label
                                            key={task.id}
                                            className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer transition-colors"
                                        >
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedTaskIds.has(task.id)
                                                ? 'bg-green-600 border-green-600 text-white'
                                                : 'border-slate-300 bg-white'
                                                }`}>
                                                {selectedTaskIds.has(task.id) && <CheckSquare size={14} />}
                                            </div>
                                            <input
                                                type="checkbox"
                                                className="hidden"
                                                checked={selectedTaskIds.has(task.id)}
                                                onChange={() => handleToggleTask(task.id)}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium text-slate-700 truncate">{task.name}</div>
                                                <div className="text-xs text-slate-400 flex gap-2">
                                                    <span>{task.requiredPeople} לוחמים</span>
                                                    <span>•</span>
                                                    <span>{task.durationHours} שעות</span>
                                                </div>
                                            </div>
                                            <div className={`w-1.5 h-8 rounded-full ${task.color.replace('border-l-', 'bg-')}`}></div>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 bg-slate-50 shrink-0 flex gap-3">
                    <button
                        onClick={handleSubmit}
                        disabled={isScheduling || !startDate || (mode === 'range' && !endDate) || selectedTaskIds.size === 0}
                        className="flex-[2] py-3 px-4 rounded-xl font-bold text-white bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                    >
                        {isScheduling ? (
                            <>
                                <Loader2 className="animate-spin" />
                                <span>משבץ...</span>
                            </>
                        ) : (
                            <>
                                <Wand2 size={20} />
                                <span>התחל שיבוץ אוטומטי</span>
                            </>
                        )}
                    </button>
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 px-4 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors"
                    >
                        ביטול
                    </button>
                </div>
            </div>
        </div>
    );
};
