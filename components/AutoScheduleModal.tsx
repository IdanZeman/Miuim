import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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

    return createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 md:p-6 animate-fadeIn pt-16 md:pt-24">
            <div className="bg-white rounded-xl md:rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[calc(100vh-10rem)] md:max-h-[90vh] mb-16 md:mb-0">
                {/* Header */}
                <div className="p-3 md:p-6 border-b border-slate-100 bg-slate-50 shrink-0">
                    <div className="flex justify-between items-start gap-2">
                        <div>
                            <h2 className="text-base md:text-xl font-bold text-slate-900 flex items-center gap-2">
                                <Sparkles className="text-idf-yellow" size={20} />
                                שיבוץ אוטומטי
                            </h2>
                            <p className="text-slate-500 text-xs md:text-sm mt-1">הפעלת האלגוריתם החכם לשיבוץ משמרות</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1.5 md:p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-4 md:p-6 overflow-y-auto flex-1">
                    {/* Mode Selection */}
                    <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
                        <button
                            onClick={() => setMode('single')}
                            className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${mode === 'single'
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            <Calendar size={16} className={mode === 'single' ? 'text-idf-yellow' : ''} />
                            יום בודד
                        </button>
                        <button
                            onClick={() => setMode('range')}
                            className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${mode === 'range'
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            <Calendar size={16} className={mode === 'range' ? 'text-idf-yellow' : ''} />
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
                                className="w-full p-2 md:p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-idf-yellow focus:ring-2 focus:ring-yellow-100 outline-none transition-all font-medium text-sm text-right"
                                lang="he"
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
                                    className="w-full p-2 md:p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-idf-yellow focus:ring-2 focus:ring-yellow-100 outline-none transition-all font-medium text-sm text-right"
                                    lang="he"
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
                                className="text-xs text-slate-600 font-medium hover:text-idf-yellow hover:underline transition-colors"
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
                                                ? 'bg-idf-yellow border-idf-yellow text-slate-900'
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
                                                <div className="font-medium text-slate-700 truncate text-sm">{task.name}</div>
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
                <div className="p-4 md:p-6 border-t border-slate-100 bg-slate-50 shrink-0 flex gap-3">
                    <button
                        onClick={handleSubmit}
                        disabled={isScheduling || !startDate || (mode === 'range' && !endDate) || selectedTaskIds.size === 0}
                        className="flex-[2] py-2.5 md:py-3 px-4 rounded-xl font-bold text-slate-900 bg-idf-yellow hover:bg-idf-yellow-hover disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 text-sm md:text-base"
                    >
                        {isScheduling ? (
                            <>
                                <Loader2 className="animate-spin" size={18} />
                                <span>משבץ...</span>
                            </>
                        ) : (
                            <>
                                <Wand2 size={18} />
                                <span>התחל שיבוץ</span>
                            </>
                        )}
                    </button>
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 md:py-3 px-4 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors text-sm md:text-base"
                    >
                        ביטול
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
