import React, { useState, useEffect } from 'react';
import { SchedulingSegment, Role, FrequencyType } from '../types';
import { Modal } from './ui/Modal';
import { Select } from './ui/Select';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Plus, Trash2, Clock, Users, Calendar, Sparkles } from 'lucide-react';

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
        if (!name) return; // TODO: Validation

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

    const addRoleRow = () => setRoleComposition([...roleComposition, { roleId: '', count: 1 }]);
    const removeRoleRow = (idx: number) => setRoleComposition(roleComposition.filter((_, i) => i !== idx));
    const updateRoleRow = (idx: number, field: 'roleId' | 'count', value: any) => {
        const newRows = [...roleComposition];
        if (field === 'count') newRows[idx].count = Number(value);
        else newRows[idx].roleId = value;
        setRoleComposition(newRows);
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

    // ...

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={initialSegment ? 'עריכת מקטע שיבוץ' : 'הוספת מקטע שיבוץ חדש'}
            size="lg"
            footer={(
                <div className="flex justify-end gap-2 w-full">
                    <Button variant="ghost" onClick={onClose}>ביטול</Button>
                    <Button variant="primary" onClick={handleSave}>
                        {initialSegment ? 'עדכן מקטע' : 'שמור והוסף'}
                    </Button>
                </div>
            )}
        >
            <div className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                        label="שם המקטע"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="לדוגמה: משמרת בוקר"
                    />
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">תדירות</label>
                        <div className="flex gap-2">
                            {(['daily', 'weekly', 'specific_date'] as FrequencyType[]).map(f => (
                                <button
                                    key={f}
                                    onClick={() => setFrequency(f)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${frequency === f ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-slate-200 text-slate-600'}`}
                                >
                                    {f === 'daily' ? 'יומי' : f === 'weekly' ? 'שבועי' : 'תאריך'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Timing Logic */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-4">
                    {frequency === 'weekly' && (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-2">ימי פעילות</label>
                            <div className="flex gap-2">
                                {DAYS_HEBREW.map(d => (
                                    <button
                                        key={d.id}
                                        onClick={() => toggleDay(d.id)}
                                        className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${daysOfWeek.includes(d.id) ? 'bg-blue-600 text-white shadow-md scale-105' : 'bg-white border border-slate-200 text-slate-400 hover:border-blue-300'}`}
                                    >
                                        {d.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {frequency === 'specific_date' && (
                        <Input
                            type="date"
                            label="תאריך"
                            value={specificDate}
                            onChange={e => setSpecificDate(e.target.value)}
                        />
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Input
                            type="time"
                            label="שעת התחלה"
                            value={startTime}
                            onChange={e => setStartTime(e.target.value)}
                            className="text-center"
                        />
                        <Input
                            type="number"
                            label="משך (שעות)"
                            value={duration}
                            onChange={e => setDuration(Number(e.target.value))}
                            className="text-center"
                            min={1}
                        />
                        <div className="flex items-center">
                            <label className="flex items-center gap-2 cursor-pointer mt-0 sm:mt-6 p-2 sm:p-0 bg-white sm:bg-transparent rounded-lg border sm:border-none border-slate-200 w-full sm:w-auto">
                                <input type="checkbox" checked={isRepeat} onChange={e => setIsRepeat(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
                                <span className="text-xs font-bold text-slate-600">מחזור רציף (24ש)</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Resources */}
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-bold text-slate-500">דרישות כוח אדם</label>
                        <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-500">
                            סה"כ: {roleComposition.reduce((sum, rc) => sum + rc.count, 0)} חיילים
                        </span>
                    </div>

                    <div className="space-y-2 mb-3">
                        {roleComposition.map((rc, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                                <Select
                                    value={rc.roleId}
                                    onChange={(val) => updateRoleRow(idx, 'roleId', val)}
                                    options={roles.map(r => ({ value: r.id, label: r.name }))}
                                    placeholder="בחר תפקיד"
                                    className="flex-1"
                                />
                                <div className="w-24">
                                    <Input
                                        type="number"
                                        min={1}
                                        value={rc.count}
                                        onChange={e => updateRoleRow(idx, 'count', e.target.value)}
                                    />
                                </div>
                                <button onClick={() => removeRoleRow(idx)} className="text-red-500 hover:bg-red-50 p-2 rounded-full"><Trash2 size={16} /></button>
                            </div>
                        ))}
                    </div>

                    <button onClick={addRoleRow} className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg border border-dashed border-blue-200 flex items-center gap-1">
                        <Plus size={14} /> הוסף תפקיד
                    </button>
                </div>

                <div>
                    <Input
                        type="number"
                        label="מנוחה נדרשת אחרי (שעות)"
                        value={minRest}
                        onChange={e => setMinRest(Number(e.target.value))}
                        containerClassName="w-24"
                        className="text-center"
                        min={0}
                    />
                </div>

                {/* Footer moved to prop */}
            </div>
        </Modal>
    );
};
