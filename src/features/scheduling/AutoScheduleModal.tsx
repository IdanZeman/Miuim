import React, { useState, useEffect } from 'react';
import { TaskTemplate } from '../../types';
import { X, CalendarBlank as Calendar, CheckSquare, MagicWand as Wand2, Sparkle as Sparkles, Users } from '@phosphor-icons/react';
import { GenericModal } from '@/components/ui/GenericModal';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';

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
    const [localIsSubmitting, setLocalIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const date = initialDate || new Date(); // Fallback
            const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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

    const handleSubmit = async () => {
        if (!startDate) return;

        setLocalIsSubmitting(true);

        // Allow UI to render the spinner before starting the heavy calculation
        await new Promise(resolve => setTimeout(resolve, 100));

        const [sY, sM, sD] = startDate.split('-').map(Number);
        const start = new Date(sY, sM - 1, sD);

        const [eY, eM, eD] = (mode === 'range' ? endDate : startDate).split('-').map(Number);
        const end = new Date(eY, eM - 1, eD);

        // Set end of day for the end date
        end.setHours(23, 59, 59, 999);

        try {
            await onSchedule({
                startDate: start,
                endDate: end,
                selectedTaskIds: Array.from(selectedTaskIds),
                prioritizeTeamOrganic
            });
        } finally {
            setLocalIsSubmitting(false);
        }
    };

    // Close on backdrop click
    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    if (!isOpen) return null;

    const modalTitle = (
        <div className="flex flex-col gap-0.5">
            <h2 className="text-xl md:text-2xl font-black text-slate-800 leading-tight flex items-center gap-2">
                <Sparkles className="text-blue-500" size={20} weight="duotone" />
                <span>שיבוץ אוטומטי</span>
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-500 font-bold uppercase tracking-wider">
                <Wand2 size={12} className="text-blue-500" weight="duotone" />
                <span>אלגוריתם חלוקת משימות חכמה</span>
            </div>
        </div>
    );

    const modalFooter = (
        <div className="flex gap-3 w-full">
            <Button
                variant="ghost"
                onClick={onClose}
                className="flex-1 h-12 md:h-10 text-base md:text-sm font-bold"
                disabled={isScheduling || localIsSubmitting}
            >
                ביטול
            </Button>
            <Button
                onClick={handleSubmit}
                disabled={isScheduling || localIsSubmitting || !startDate || (mode === 'range' && !endDate) || selectedTaskIds.size === 0}
                className="flex-1 h-12 md:h-10 text-base md:text-sm font-black bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200"
                isLoading={isScheduling || localIsSubmitting}
            >
                <div className="flex items-center justify-center gap-2">
                    <Wand2 size={18} weight="duotone" />
                    <span>התחל שיבוץ</span>
                </div>
            </Button>
        </div>
    );

    return (
        <GenericModal
            isOpen={isOpen}
            onClose={onClose}
            title={modalTitle}
            size="md"
            footer={modalFooter}
        >
            <div className="flex flex-col gap-1 w-full">
                {/* Mode Selection - Segmented Control */}
                <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
                    <button
                        onClick={() => setMode('single')}
                        className={`flex-1 py-2 px-4 rounded-lg text-xs font-black transition-all ${mode === 'single'
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-slate-400 hover:text-slate-600'
                            }`}
                    >
                        <Calendar size={14} className={`inline-block ml-2 ${mode === 'single' ? 'text-blue-500' : ''}`} weight="duotone" />
                        יום בודד
                    </button>
                    <button
                        onClick={() => setMode('range')}
                        className={`flex-1 py-2 px-4 rounded-lg text-xs font-black transition-all ${mode === 'range'
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-slate-400 hover:text-slate-600'
                            }`}
                    >
                        <Calendar size={14} className={`inline-block ml-2 ${mode === 'range' ? 'text-blue-500' : ''}`} weight="duotone" />
                        טווח תאריכים
                    </button>
                </div>

                {/* Date Inputs */}
                <div className="grid grid-cols-2 gap-4 mb-2">
                    <DatePicker
                        label={mode === 'single' ? 'תאריך לשיבוץ' : 'תאריך התחלה'}
                        value={startDate}
                        onChange={setStartDate}
                    />
                    {mode === 'range' && (
                        <div className="animate-in fade-in slide-in-from-left-2 duration-300">
                            <DatePicker
                                label="תאריך סיום"
                                value={endDate}
                                onChange={setEndDate}
                            />
                        </div>
                    )}
                </div>

                {/* Team Organic Toggle */}
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 my-4">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${prioritizeTeamOrganic ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500'}`}>
                            <Users size={20} weight="duotone" />
                        </div>
                        <div>
                            <h4 className="text-sm font-black text-slate-800 leading-tight">שמור על אורגניות צוותים</h4>
                            <p className="text-[10px] text-slate-500 font-bold">העדפת לוחמים מאותו צוות לאותה משימה</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setPrioritizeTeamOrganic(!prioritizeTeamOrganic)}
                        className={`w-12 h-6 rounded-full transition-all relative ${prioritizeTeamOrganic ? 'bg-blue-600' : 'bg-slate-300'}`}
                    >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${prioritizeTeamOrganic ? 'left-1' : 'left-7'}`}></div>
                    </button>
                </div>

                {/* Tasks Selection List */}
                <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center px-1 mb-1">
                        <span className="text-xs font-black text-slate-500 uppercase tracking-wider">בחירת משימות ({selectedTaskIds.size})</span>
                        <button
                            onClick={handleSelectAllTasks}
                            className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline"
                        >
                            {selectedTaskIds.size === tasks.length ? 'נקה הכל' : 'בחר הכל'}
                        </button>
                    </div>

                    {tasks.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-sm font-bold border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/50">
                            לא נמצאו משימות להגדרה
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                            {tasks.slice().sort((a, b) => a.name.localeCompare(b.name, 'he')).map(task => (
                                <label
                                    key={task.id}
                                    className={`relative flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer group hover:shadow-md ${selectedTaskIds.has(task.id) ? 'bg-white border-blue-200 ring-1 ring-blue-50' : 'bg-white border-slate-100 grayscale-[0.5] opacity-80 hover:grayscale-0 hover:opacity-100'}`}
                                >
                                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all shrink-0 ${selectedTaskIds.has(task.id)
                                        ? 'bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-200'
                                        : 'border-slate-200 bg-white'
                                        }`}>
                                        {selectedTaskIds.has(task.id) && <CheckSquare size={16} weight="bold" />}
                                    </div>
                                    <input
                                        type="checkbox"
                                        className="hidden"
                                        checked={selectedTaskIds.has(task.id)}
                                        onChange={() => handleToggleTask(task.id)}
                                    />

                                    <div className="flex-1 min-w-0">
                                        <div className="font-black text-slate-800 text-base leading-tight mb-0.5">{task.name}</div>
                                        <div className="text-[10px] text-slate-500 flex items-center gap-2 font-bold uppercase tracking-wide">
                                            <span>{task.segments?.length || 0} מקטעים</span>
                                            <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                                            <span className={task.difficulty >= 4 ? 'text-orange-600' : ''}>{task.difficulty >= 4 ? 'מורכב' : (task.difficulty === 3 ? 'בינוני' : 'קל')}</span>
                                        </div>
                                    </div>

                                    {/* Color Strip (Left) */}
                                    <div className={`absolute left-0 top-3 bottom-3 w-1.5 rounded-r-lg ${task.color.replace('border-l-', 'bg-') || 'bg-slate-200'}`}></div>
                                </label>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </GenericModal>
    );
};
