import React, { useState, useEffect } from 'react';
import { useToast } from '../contexts/ToastContext';
import { SchedulingSegment, Role, FrequencyType } from '../types';
import { SheetModal } from './ui/SheetModal';
import { Input } from './ui/Input';
import { Button } from './ui/Button'; // Keeping Button if needed, or remove if unused in updated code
import { Plus, Minus, Clock, Users, Calendar, Sparkles, Shield } from 'lucide-react';
import { ROLE_ICONS } from '../constants';
import { Select } from './ui/Select';

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
        <SheetModal
            isOpen={isOpen}
            onClose={onClose}
            title={initialSegment ? 'עריכת מקטע משמרת' : 'הוספת מקטע משמרת'}
            onSave={handleSave}
            saveLabel={initialSegment ? 'עדכן מקטע' : 'הוסף מקטע'}
        >
            <div className="space-y-6">
                {/* 1. Basic Info */}
                <div className="space-y-2">
                    <h3 className="text-xs font-bold text-slate-500 px-2">כללי ותדירות</h3>
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
                        <div className="flex items-center px-4 py-3">
                            <div className="w-24 shrink-0 font-bold text-slate-700 text-sm">שם המקטע</div>
                            <input
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="לדוגמה: בוקר"
                                className="flex-1 bg-transparent border-none outline-none text-slate-900 text-right font-medium placeholder:text-slate-300 h-full w-full"
                            />
                        </div>

                        {/* Frequency Toggles */}
                        <div className="p-3 bg-slate-50">
                            <div className="flex bg-white rounded-lg p-1 border border-slate-200">
                                {(['daily', 'weekly', 'specific_date'] as FrequencyType[]).map(f => (
                                    <button
                                        key={f}
                                        onClick={() => setFrequency(f)}
                                        className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all ${frequency === f ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                                    >
                                        {f === 'daily' ? 'כל יום' : f === 'weekly' ? 'ימי השבוע' : 'תאריך ספציפי'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Date Logic */}
                        {frequency === 'weekly' && (
                            <div className="p-3 flex justify-center gap-2 flex-wrap">
                                {DAYS_HEBREW.map(d => (
                                    <button
                                        key={d.id}
                                        onClick={() => toggleDay(d.id)}
                                        className={`w-9 h-9 rounded-full text-sm font-bold transition-all ${daysOfWeek.includes(d.id) ? 'bg-blue-600 text-white shadow-md scale-105' : 'bg-white border border-slate-200 text-slate-400 hover:border-blue-300'}`}
                                    >
                                        {d.label}
                                    </button>
                                ))}
                            </div>
                        )}
                        {frequency === 'specific_date' && (
                            <div className="flex items-center px-4 py-3">
                                <div className="w-24 shrink-0 font-bold text-slate-700 text-sm">תאריך</div>
                                <input
                                    type="date"
                                    value={specificDate}
                                    onChange={e => setSpecificDate(e.target.value)}
                                    className="flex-1 bg-transparent border-none outline-none text-slate-900 text-right font-medium"
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. Timing Controls (Counters) */}
                <div className="space-y-2">
                    <h3 className="text-xs font-bold text-slate-500 px-2">זמנים</h3>
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 grid grid-cols-2 gap-4">
                        {/* Start Time */}
                        <div className="col-span-2 flex items-center justify-between border-b border-slate-100 pb-4 mb-2">
                            <div className="font-bold text-slate-700 text-sm">שעת התחלה</div>
                            <div className="relative">
                                <input
                                    type="time"
                                    value={startTime}
                                    onChange={e => setStartTime(e.target.value)}
                                    className="bg-slate-100 border-none rounded-lg px-3 py-1.5 text-lg font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>

                        {/* Duration Counter */}
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-xs font-bold text-slate-500">משך (שעות)</span>
                            <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-1">
                                <button
                                    onClick={() => setDuration(Math.max(1, duration - 1))}
                                    className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-slate-600 hover:text-blue-600 active:scale-95 transition-transform"
                                >
                                    <Minus size={16} />
                                </button>
                                <span className="w-6 text-center font-bold text-lg">{duration}</span>
                                <button
                                    onClick={() => setDuration(duration + 1)}
                                    className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-slate-600 hover:text-blue-600 active:scale-95 transition-transform"
                                >
                                    <Plus size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Rest Counter */}
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-xs font-bold text-slate-500">מנוחה נדרשת</span>
                            <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-1">
                                <button
                                    onClick={() => setMinRest(Math.max(0, minRest - 1))}
                                    className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-slate-600 hover:text-blue-600 active:scale-95 transition-transform"
                                >
                                    <Minus size={16} />
                                </button>
                                <span className="w-6 text-center font-bold text-lg">{minRest}</span>
                                <button
                                    onClick={() => setMinRest(minRest + 1)}
                                    className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-slate-600 hover:text-blue-600 active:scale-95 transition-transform"
                                >
                                    <Plus size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Workforce Requirements (Role Grid) */}
                <div className="space-y-2">
                    <div className="flex justify-between items-center px-2">
                        <h3 className="text-xs font-bold text-slate-500">דרישות תפקיד</h3>
                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                            סה"כ: {roleComposition.reduce((sum, rc) => sum + rc.count, 0)}
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        {roles.map(role => {
                            const count = getRoleCount(role.id);
                            const Icon = role.icon && ROLE_ICONS[role.icon] ? ROLE_ICONS[role.icon] : Shield;

                            return (
                                <div key={role.id} className={`bg-white border rounded-xl p-3 flex flex-col gap-2 transition-all ${count > 0 ? 'border-blue-300 shadow-sm' : 'border-slate-200'}`}>
                                    <div className="flex items-center gap-2">
                                        <div className={`p-1.5 rounded-lg ${role.color || 'bg-slate-100'}`}>
                                            <Icon size={14} className="text-slate-600" />
                                        </div>
                                        <span className="text-sm font-bold text-slate-800 truncate flex-1">{role.name}</span>
                                    </div>

                                    <div className="flex items-center justify-between bg-slate-50 rounded-lg p-1">
                                        <button
                                            onClick={() => updateRoleCount(role.id, -1)}
                                            className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${count > 0 ? 'bg-white shadow-sm text-slate-700 hover:text-red-500' : 'text-slate-300'}`}
                                            disabled={count === 0}
                                        >
                                            <Minus size={14} />
                                        </button>
                                        <span className={`font-bold ${count > 0 ? 'text-blue-600' : 'text-slate-300'}`}>{count}</span>
                                        <button
                                            onClick={() => updateRoleCount(role.id, 1)}
                                            className="w-7 h-7 flex items-center justify-center bg-white rounded-md shadow-sm text-slate-700 hover:text-green-600 transition-colors"
                                        >
                                            <Plus size={14} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}

                        {roles.length === 0 && (
                            <div className="col-span-2 text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-400 text-sm">
                                לא הוגדרו תפקידים במערכת
                            </div>
                        )}
                    </div>
                </div>
                <div className="h-4" />
            </div>
        </SheetModal>
    );
};
