import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { TaskTemplate } from '../types';
import { X, Calendar, CheckSquare, Wand2, Loader2, Sparkles } from 'lucide-react';

interface AutoScheduleModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSchedule: (params: { startDate: Date; endDate: Date; selectedTaskIds: string[]; prioritizeTeamOrganic: boolean }) => Promise<void>;
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
    const [prioritizeTeamOrganic, setPrioritizeTeamOrganic] = useState(false);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const date = initialDate || new Date(); // Fallback
            const dateStr = date.toISOString().split('T')[0];
            setStartDate(dateStr);
            setEndDate(dateStr);
            // Select all tasks by default
            setSelectedTaskIds(new Set(tasks.map(t => t.id)));

            // Trigger animation frame
            requestAnimationFrame(() => {
                setIsVisible(true);
            });
        } else {
            setIsVisible(false);
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
            selectedTaskIds: Array.from(selectedTaskIds),
            prioritizeTeamOrganic
        });
    };

    // Close on backdrop click
    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div
            className={`fixed inset-0 z-[9999] flex flex-col justify-end md:justify-center md:items-center transition-colors duration-300 ${isVisible ? 'bg-slate-900/60 backdrop-blur-sm' : 'bg-transparent'}`}
            onClick={handleBackdropClick}
        >
            <div
                className={`bg-white w-full md:w-full md:max-w-lg rounded-t-3xl md:rounded-2xl shadow-2xl flex flex-col max-h-[85vh] md:max-h-[90vh] transform transition-transform duration-300 ease-out ${isVisible ? 'translate-y-0' : 'translate-y-full md:translate-y-0 md:scale-100 md:opacity-100'} ${!isVisible && 'md:scale-95 md:opacity-0'}`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 pb-4 md:py-6 shrink-0 flex items-center justify-between md:border-b md:border-slate-100 md:bg-slate-50 md:rounded-t-2xl">
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <Sparkles className="text-idf-yellow" size={20} />
                        שיבוץ אוטומטי
                    </h2>
                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto flex-1 bg-white">
                    <div className="px-6 md:p-6">
                        {/* Mode Selection - Segmented Control */}
                        <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
                            <button
                                onClick={() => setMode('single')}
                                className={`flex-1 py-1.5 px-4 rounded-lg text-sm font-bold transition-all ${mode === 'single'
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                <Calendar size={16} className={`inline-block ml-2 ${mode === 'single' ? 'text-idf-yellow' : ''}`} />
                                יום בודד
                            </button>
                            <button
                                onClick={() => setMode('range')}
                                className={`flex-1 py-1.5 px-4 rounded-lg text-sm font-bold transition-all ${mode === 'range'
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                <Calendar size={16} className={`inline-block ml-2 ${mode === 'range' ? 'text-idf-yellow' : ''}`} />
                                טווח תאריכים
                            </button>
                        </div>

                        {/* Date Inputs */}
                        <div className="grid grid-cols-2 gap-4 mb-2">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">
                                    {mode === 'single' ? 'תאריך לשיבוץ' : 'תאריך התחלה'}
                                </label>
                                <div className="relative flex items-center bg-slate-50 rounded-xl border border-slate-200 px-3 py-2 w-full group hover:bg-white hover:border-idf-yellow transition-colors">
                                    <span className={`text-sm font-bold flex-1 text-right pointer-events-none ${startDate ? 'text-slate-900' : 'text-slate-400'}`}>
                                        {startDate ? new Date(startDate).toLocaleDateString('he-IL') : 'בחר תאריך'}
                                    </span>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                                    />
                                    <Calendar size={18} className="text-slate-400 ml-2 pointer-events-none" />
                                </div>
                            </div>
                            {mode === 'range' && (
                                <div className="animate-fadeIn">
                                    <label className="block text-xs font-bold text-slate-500 mb-1">תאריך סיום</label>
                                    <div className="relative flex items-center bg-slate-50 rounded-xl border border-slate-200 px-3 py-2 w-full group hover:bg-white hover:border-idf-yellow transition-colors">
                                        <span className={`text-sm font-bold flex-1 text-right pointer-events-none ${endDate ? 'text-slate-900' : 'text-slate-400'}`}>
                                            {endDate ? new Date(endDate).toLocaleDateString('he-IL') : 'בחר תאריך'}
                                        </span>
                                        <input
                                            type="date"
                                            value={endDate}
                                            min={startDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                                        />
                                        <Calendar size={18} className="text-slate-400 ml-2 pointer-events-none" />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Team Organic Toggle - Full width row */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 md:bg-slate-50 md:mx-6 md:rounded-xl md:mb-4 md:border-none">
                        <div>
                            <h4 className="text-sm font-bold text-slate-800">שמור על אורגניות מתחם</h4>
                            <p className="text-xs text-slate-500">שיבוץ לפי צוותים</p>
                        </div>
                        <button
                            onClick={() => setPrioritizeTeamOrganic(!prioritizeTeamOrganic)}
                            className={`w-12 h-7 rounded-full transition-colors relative ${prioritizeTeamOrganic ? 'bg-idf-yellow' : 'bg-slate-300'}`}
                        >
                            <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all shadow-sm ${prioritizeTeamOrganic ? 'left-1' : 'left-6'}`}></div>
                        </button>
                    </div>

                    {/* Tasks Selection List */}
                    <div className="divide-y divide-slate-100 md:px-6">
                        {/* Header for list */}
                        <div className="px-6 md:px-0 py-3 bg-slate-50 md:bg-white text-xs font-bold text-slate-500 flex justify-between items-center sticky top-0 z-10">
                            <span>בחירת משימות</span>
                            <button
                                onClick={handleSelectAllTasks}
                                className="text-idf-yellow hover:underline"
                            >
                                {selectedTaskIds.size === tasks.length ? 'נקה הכל' : 'בחר הכל'}
                            </button>
                        </div>

                        {tasks.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 text-sm">
                                לא נמצאו משימות
                            </div>
                        ) : (
                            <div className="md:border md:border-slate-200 md:rounded-xl md:overflow-hidden">
                                {tasks.map(task => (
                                    <label
                                        key={task.id}
                                        className="flex items-center gap-4 px-6 py-4 bg-white hover:bg-slate-50 cursor-pointer transition-colors relative overflow-hidden md:border-b md:last:border-0 border-b border-slate-100 last:border-0"
                                    >
                                        {/* Checkbox (Right) */}
                                        <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${selectedTaskIds.has(task.id)
                                            ? 'bg-idf-yellow border-idf-yellow text-slate-900'
                                            : 'border-slate-300 bg-white'
                                            }`}>
                                            {selectedTaskIds.has(task.id) && <CheckSquare size={16} strokeWidth={3} />}
                                        </div>
                                        <input
                                            type="checkbox"
                                            className="hidden"
                                            checked={selectedTaskIds.has(task.id)}
                                            onChange={() => handleToggleTask(task.id)}
                                        />

                                        {/* Info (Center) */}
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-slate-900 text-base mb-0.5">{task.name}</div>
                                            <div className="text-xs text-slate-500 flex items-center gap-1.5">
                                                <span>{task.segments?.length || 0} מקטעים</span>
                                                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                <span>{task.difficulty === 3 || task.difficulty === 'hard' ? 'מורכב' : (task.difficulty === 2 || task.difficulty === 'medium' ? 'בינוני' : 'קל')}</span>
                                            </div>
                                        </div>

                                        {/* Color Strip (Left) */}
                                        <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${task.color.replace('border-l-', 'bg-')}`}></div>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 md:p-6 border-t border-slate-100 bg-white shrink-0 pb-6 md:pb-6 flex gap-3 md:rounded-b-2xl">
                    {/* "Start" Button - High priority */}
                    <button
                        onClick={handleSubmit}
                        disabled={isScheduling || !startDate || (mode === 'range' && !endDate) || selectedTaskIds.size === 0}
                        className="flex-1 h-14 md:h-12 rounded-xl font-bold text-slate-900 bg-idf-yellow hover:bg-idf-yellow-hover disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed shadow-md transition-all flex items-center justify-center gap-2 text-lg md:text-base relative overflow-hidden"
                    >
                        {isScheduling ? (
                            <>
                                <Loader2 className="animate-spin" size={20} />
                                <span>משבץ...</span>
                            </>
                        ) : (
                            <>
                                <Wand2 size={20} />
                                <span>התחל שיבוץ</span>
                            </>
                        )}
                    </button>

                    {/* "Cancel" Button - Desktop Only */}
                    <button
                        onClick={onClose}
                        className="hidden md:block w-32 h-12 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-all border border-slate-200 hover:border-slate-300"
                    >
                        ביטול
                    </button>
                </div>
            </div>
        </div >,
        document.body
    );
};
