import React, { useState, useEffect } from 'react';
import { useToast } from '@/contexts/ToastContext';
import { SchedulingSegment, Role, FrequencyType } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { DatePicker, TimePicker } from '@/components/ui/DatePicker';
import { Plus, Minus, Users, ArrowCounterClockwise as RotateCcw, Layout as LayoutTemplate, Clock, CalendarBlank as CalendarDays } from '@phosphor-icons/react';
import { ROLE_ICONS } from '@/constants';
import { cn } from '@/lib/utils';

interface SegmentEditorProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (segment: SchedulingSegment) => void;
    initialSegment?: SchedulingSegment;
    roles: Role[];
    taskId: string;
}

export const SegmentEditor: React.FC<SegmentEditorProps> = ({
    isOpen,
    onClose,
    onSave,
    initialSegment,
    roles,
    taskId
}) => {
    // Form State
    const [name, setName] = useState('');
    const [startTime, setStartTime] = useState('08:00');
    const [duration, setDuration] = useState(4);
    const [frequency, setFrequency] = useState<FrequencyType>('daily');
    const [daysOfWeek, setDaysOfWeek] = useState<string[]>([]);
    const [specificDate, setSpecificDate] = useState('');
    const [roleComposition, setRoleComposition] = useState<{ roleId: string; count: number }[]>([]);
    const [minRest, setMinRest] = useState(8);
    const [isRepeat, setIsRepeat] = useState(false);

    // Toast Hook
    const { showToast } = useToast();

    useEffect(() => {
        if (isOpen) {
            if (initialSegment) {
                setName(initialSegment.name);
                setStartTime(initialSegment.startTime);
                setDuration(initialSegment.durationHours);
                setFrequency(initialSegment.frequency);
                setDaysOfWeek(initialSegment.daysOfWeek || []);
                setSpecificDate(initialSegment.specificDate || '');
                setRoleComposition(initialSegment.roleComposition);
                setMinRest(initialSegment.minRestHoursAfter);
                setIsRepeat(initialSegment.isRepeat);
            } else {
                // Reset for new
                setName('');
                setStartTime('08:00');
                setDuration(4);
                setFrequency('daily');
                setDaysOfWeek(['sunday', 'monday', 'tuesday', 'wednesday', 'thursday']);
                setSpecificDate('');
                setRoleComposition([]);
                setMinRest(8);
                setIsRepeat(false);
            }
        }
    }, [isOpen, initialSegment]);

    const handleSave = () => {
        // Validation Logic
        if (!name) {
            showToast('נא להזין שם למקטע', 'error');
            return;
        }

        if (isRepeat && duration >= 24) {
            showToast('לא ניתן להגדיר מחזור רציף עם משמרת של 24 שעות ומעלה. השתמש בתדירות יומית במקום.', 'error');
            return;
        }

        const segment: SchedulingSegment = {
            id: initialSegment?.id || crypto.randomUUID(),
            taskId,
            name,
            startTime,
            durationHours: duration,
            frequency,
            daysOfWeek: frequency === 'weekly' ? daysOfWeek : undefined,
            specificDate: frequency === 'specific_date' ? specificDate : undefined,
            requiredPeople: roleComposition.reduce((sum, rc) => sum + rc.count, 0),
            roleComposition,
            minRestHoursAfter: minRest,
            isRepeat
        };
        onSave(segment);
        onClose();
    };

    const toggleDay = (day: string) => {
        setDaysOfWeek(prev =>
            prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
        );
    };

    const updateRoleCount = (roleId: string, delta: number) => {
        setRoleComposition(prev => {
            const existingIndex = prev.findIndex(rc => rc.roleId === roleId);
            if (existingIndex >= 0) {
                const newCount = Math.max(0, prev[existingIndex].count + delta);
                if (newCount === 0) {
                    return prev.filter(rc => rc.roleId !== roleId);
                }
                const newArr = [...prev];
                newArr[existingIndex] = { ...newArr[existingIndex], count: newCount };
                return newArr;
            } else if (delta > 0) {
                return [...prev, { roleId, count: delta }];
            }
            return prev;
        });
    };

    const getRoleCount = (roleId: string) => {
        return roleComposition.find(rc => rc.roleId === roleId)?.count || 0;
    };

    const DAYS_HEBREW = [
        { id: 'sunday', label: 'א' },
        { id: 'monday', label: 'ב' },
        { id: 'tuesday', label: 'ג' },
        { id: 'wednesday', label: 'ד' },
        { id: 'thursday', label: 'ה' },
        { id: 'friday', label: 'ו' },
        { id: 'saturday', label: 'ש' }
    ];

    if (!isOpen) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <LayoutTemplate size={24} weight="bold" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-800">{initialSegment ? 'עריכת מקטע משמרת' : 'הוספת מקטע משמרת'}</h2>
                        <p className="text-sm font-bold text-slate-400">{initialSegment ? 'עדכון פרטי המקטע' : 'הגדרת זמנים ודרישות'}</p>
                    </div>
                </div>
            }
            footer={
                <Button onClick={handleSave} className="w-full bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20">
                    {initialSegment ? 'עדכן מקטע' : 'צור מקטע חדש'}
                </Button>
            }
        >
            <div className="space-y-6">
                {/* 1. Basic Info */}
                <div className="space-y-3">
                    <h3 className="text-[10px] font-black text-slate-400 px-4 uppercase tracking-widest">כללי ותדירות</h3>
                    <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden divide-y divide-slate-100">
                        <div className="flex items-center px-5 py-4 group">
                            <div className="w-20 shrink-0 font-black text-slate-500 text-sm">שם המקטע</div>
                            <input
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="לדוגמה: בוקר, סיור ערב..."
                                className="flex-1 bg-transparent border-none outline-none text-slate-900 font-bold text-base placeholder:text-slate-300 w-full"
                            />
                        </div>

                        {/* Frequency Toggles */}
                        <div className="p-4 bg-slate-50/50">
                            <div className="flex bg-slate-200/50 rounded-xl p-1.5 gap-1">
                                {(['daily', 'weekly', 'specific_date'] as FrequencyType[]).map(f => (
                                    <button
                                        key={f}
                                        onClick={() => setFrequency(f)}
                                        className={cn(
                                            "flex-1 py-2.5 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-2",
                                            frequency === f
                                                ? "bg-white text-blue-600 shadow-sm ring-1 ring-black/5"
                                                : "text-slate-500 hover:bg-white/50 hover:text-slate-700"
                                        )}
                                    >
                                        {f === 'daily' && <Clock size={14} weight="bold" />}
                                        {f === 'weekly' && <CalendarDays size={14} weight="bold" />}
                                        {f === 'specific_date' && <LayoutTemplate size={14} weight="bold" />}
                                        <span>{f === 'daily' ? 'כל יום' : f === 'weekly' ? 'ימי השבוע' : 'תאריך'}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Date Logic */}
                        {frequency === 'weekly' && (
                            <div className="p-5 flex justify-center gap-3 flex-wrap bg-white">
                                {DAYS_HEBREW.map(d => (
                                    <button
                                        key={d.id}
                                        onClick={() => toggleDay(d.id)}
                                        className={cn(
                                            "w-10 h-10 rounded-xl text-sm font-black transition-all flex items-center justify-center",
                                            daysOfWeek.includes(d.id)
                                                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20 scale-105"
                                                : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                                        )}
                                    >
                                        {d.label}
                                    </button>
                                ))}
                            </div>
                        )}
                        {frequency === 'specific_date' && (
                            <div className="px-5 py-4 bg-white">
                                <DatePicker
                                    label="תאריך"
                                    value={specificDate}
                                    onChange={setSpecificDate}
                                />
                            </div>
                        )}
                    </div>

                    {/* Continuous Cycle Toggle */}
                    <div className="space-y-3">
                        <div className={cn(
                            "bg-white rounded-3xl border transition-all px-5 py-4 flex items-center justify-between cursor-pointer",
                            isRepeat ? "border-amber-200 shadow-md shadow-amber-50" : "border-slate-200/60 shadow-sm"
                        )}
                            onClick={() => setIsRepeat(!isRepeat)}>
                            <div>
                                <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                    <RotateCcw size={18} className={isRepeat ? "text-amber-500" : "text-slate-400"} weight="bold" />
                                    מחזור רציף (סבב 24/7)
                                </div>
                                <p className="text-[11px] font-bold text-slate-400 mt-1">יצירת רצף משמרות אוטומטי לכל אורך היממה</p>
                            </div>
                            <div className={cn("w-12 h-7 rounded-full transition-all relative", isRepeat ? "bg-amber-500" : "bg-slate-200")}>
                                <div className={cn("absolute top-1 w-5 h-5 bg-white rounded-full transition-all shadow-sm", isRepeat ? "left-1" : "left-6")} />
                            </div>
                        </div>

                    </div>
                </div>

                {/* 2. Timing Controls (Counters) */}
                <div className="space-y-3">
                    <h3 className="text-[10px] font-black text-slate-400 px-4 uppercase tracking-widest">זמנים והגבלות</h3>
                    <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm p-5 grid grid-cols-2 gap-4">
                        {/* Start Time */}
                        <div className="col-span-2 py-2">
                            <TimePicker
                                label="שעת התחלה"
                                value={startTime}
                                onChange={setStartTime}
                            />
                        </div>

                        {/* Duration Counter */}
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-xs font-bold text-slate-500">משך (שעות)</span>
                            <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-1.5">
                                <button
                                    onClick={() => setDuration(Math.max(1, duration - 1))}
                                    className="w-9 h-9 flex items-center justify-center bg-white rounded-lg shadow-sm text-slate-600 hover:text-blue-600 active:scale-95 transition-all"
                                >
                                    <Minus size={18} weight="bold" />
                                </button>
                                <span className="w-8 text-center font-black text-xl text-slate-800">{duration}</span>
                                <button
                                    onClick={() => setDuration(duration + 1)}
                                    className="w-9 h-9 flex items-center justify-center bg-white rounded-lg shadow-sm text-slate-600 hover:text-blue-600 active:scale-95 transition-all"
                                >
                                    <Plus size={18} weight="bold" />
                                </button>
                            </div>
                        </div>

                        {/* Rest Counter */}
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-xs font-bold text-slate-500">מנוחה נדרשת</span>
                            <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-1.5">
                                <button
                                    onClick={() => setMinRest(Math.max(0, minRest - 1))}
                                    className="w-9 h-9 flex items-center justify-center bg-white rounded-lg shadow-sm text-slate-600 hover:text-blue-600 active:scale-95 transition-all"
                                >
                                    <Minus size={18} weight="bold" />
                                </button>
                                <span className="w-8 text-center font-black text-xl text-slate-800">{minRest}</span>
                                <button
                                    onClick={() => setMinRest(minRest + 1)}
                                    className="w-9 h-9 flex items-center justify-center bg-white rounded-lg shadow-sm text-slate-600 hover:text-blue-600 active:scale-95 transition-all"
                                >
                                    <Plus size={18} weight="bold" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Workforce Requirements (Role Grid) */}
                <div className="space-y-3">
                    <div className="flex justify-between items-center px-4">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">דרישות תפקיד</h3>
                        <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg font-black tracking-tight">
                            סה"כ: {roleComposition.reduce((sum, rc) => sum + rc.count, 0)}
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        {roles.map(role => {
                            const count = getRoleCount(role.id);
                            // @ts-ignore
                            const Icon = role.icon && ROLE_ICONS[role.icon] ? ROLE_ICONS[role.icon] : Users;

                            return (
                                <div key={role.id} className={cn(
                                    "bg-white border rounded-2xl p-3 flex flex-col gap-3 transition-all",
                                    count > 0 ? "border-indigo-200 shadow-md shadow-indigo-100/50" : "border-slate-200/60 shadow-sm"
                                )}>
                                    <div className="flex items-center gap-2.5">
                                        <div className={cn("p-2 rounded-xl", role.color || 'bg-slate-100')}>
                                            <Icon size={16} className="text-slate-600" weight="bold" />
                                        </div>
                                        <span className="text-sm font-black text-slate-800 truncate flex-1 leading-tight">{role.name}</span>
                                    </div>

                                    <div className="flex items-center justify-between bg-slate-50/80 rounded-xl p-1">
                                        <button
                                            onClick={() => updateRoleCount(role.id, -1)}
                                            className={cn(
                                                "w-8 h-8 flex items-center justify-center rounded-lg transition-all active:scale-90",
                                                count > 0 ? "bg-white shadow-sm text-slate-700 hover:text-red-500" : "text-slate-300 cursor-not-allowed"
                                            )}
                                            disabled={count === 0}
                                        >
                                            <Minus size={16} weight="bold" />
                                        </button>
                                        <span className={cn("font-black text-lg", count > 0 ? "text-indigo-600" : "text-slate-300")}>{count}</span>
                                        <button
                                            onClick={() => updateRoleCount(role.id, 1)}
                                            className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-slate-700 hover:text-green-600 active:scale-90 transition-all"
                                        >
                                            <Plus size={16} weight="bold" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Phantom/Deleted Roles */}
                        {roleComposition
                            .filter(rc => !roles.find(r => r.id === rc.roleId))
                            .map(rc => (
                                <div key={rc.roleId} className="bg-red-50/30 border border-red-200 rounded-2xl p-3 flex flex-col gap-3 transition-all shadow-sm">
                                    <div className="flex items-center gap-2.5">
                                        <div className="p-2 rounded-xl bg-red-100">
                                            <Users size={16} className="text-red-600" weight="bold" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <span className="text-sm font-black text-red-800 truncate block leading-tight">תפקיד שנמחק</span>
                                            <span className="text-[9px] font-bold text-red-400 block truncate tracking-tight">{rc.roleId.slice(0, 8)}...</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between bg-red-50 rounded-xl p-1">
                                        <button
                                            onClick={() => updateRoleCount(rc.roleId, -1)}
                                            className="w-8 h-8 flex items-center justify-center bg-white shadow-sm rounded-lg transition-all active:scale-90 text-red-600 hover:text-red-700"
                                        >
                                            <Minus size={16} weight="bold" />
                                        </button>
                                        <span className="font-black text-lg text-red-700">{rc.count}</span>
                                        <button
                                            onClick={() => updateRoleCount(rc.roleId, 1)}
                                            className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-red-500 active:scale-90 transition-all"
                                        >
                                            <Plus size={16} weight="bold" />
                                        </button>
                                    </div>
                                </div>
                            ))}

                        {roles.length === 0 && roleComposition.length === 0 && (
                            <div className="col-span-2 text-center py-6 bg-slate-50 rounded-3xl border border-dashed border-slate-200 text-slate-400">
                                <Users size={32} className="mx-auto mb-2 opacity-20" weight="bold" />
                                <span className="text-sm font-bold">לא הוגדרו תפקידים במערכת</span>
                            </div>
                        )}
                    </div>
                </div>
                <div className="h-4" />
            </div>
        </Modal>
    );
};
