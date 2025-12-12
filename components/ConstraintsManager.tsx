import React, { useState, useEffect } from 'react';
import { Person, TaskTemplate, SchedulingConstraint, ConstraintType } from '../types';
import { Trash2, Plus, Calendar, Clock, AlertTriangle, CheckCircle, Ban, User, Shield, ChevronDown, Pencil, X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Select } from './ui/Select';

interface ConstraintsManagerProps {
    people: Person[];
    tasks: TaskTemplate[];
    constraints: SchedulingConstraint[];
    onAddConstraint: (c: SchedulingConstraint) => void;
    onDeleteConstraint: (id: string) => void;
    onUpdateConstraint: (c: SchedulingConstraint) => void;
}

// Custom Date Input to enforce DD/MM/YYYY format while allowing picker
const IsraeliDateInput: React.FC<{ value: string, onChange: (val: string) => void }> = ({ value, onChange }) => {
    const [text, setText] = useState('');

    useEffect(() => {
        if (value) {
            const [y, m, d] = value.split('-');
            setText(`${d}/${m}/${y}`);
        } else {
            setText('');
        }
    }, [value]);

    const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setText(val);

        // Try to parse DD/MM/YYYY
        const parts = val.split('/');
        if (parts.length === 3) {
            const [d, m, y] = parts;
            if (d && m && y && y.length === 4 && !isNaN(Number(d)) && !isNaN(Number(m)) && !isNaN(Number(y))) {
                onChange(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
            }
        } else if (val === '') {
            onChange('');
        }
    };

    const handleDatePick = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value);
    };

    return (
        <div className="relative w-full">
            <input
                type="text"
                value={text}
                onChange={handleTextChange}
                placeholder="dd/mm/yyyy"
                className="w-full p-2.5 pl-10 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono dir-ltr"
                style={{ direction: 'ltr' }}
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 overflow-hidden">
                <Calendar size={20} className="text-slate-400 pointer-events-none absolute inset-0" />
                <input
                    type="date"
                    value={value}
                    onChange={handleDatePick}
                    className="opacity-0 cursor-pointer absolute inset-0 w-full h-full scale-150"
                    lang="he"
                />
            </div>
        </div>
    );
};

export const ConstraintsManager: React.FC<ConstraintsManagerProps> = ({ people, tasks, constraints, onAddConstraint, onDeleteConstraint, onUpdateConstraint }) => {
    const [selectedPersonId, setSelectedPersonId] = useState<string>('');
    const [selectedType, setSelectedType] = useState<ConstraintType>('never_assign');
    const [selectedTaskId, setSelectedTaskId] = useState<string>('');
    const [startDate, setStartDate] = useState<string>('');
    const [startTime, setStartTime] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [endTime, setEndTime] = useState<string>('');
    const [editingId, setEditingId] = useState<string | null>(null);

    const handleSave = () => {
        if (!selectedPersonId) return;

        const constraintData: SchedulingConstraint = {
            id: editingId || uuidv4(),
            personId: selectedPersonId,
            type: selectedType,
            organization_id: '', // Will be set by parent or DB mapper
        };

        if (selectedType === 'time_block') {
            if (!startDate || !startTime || !endDate || !endTime) return;
            constraintData.startTime = new Date(`${startDate}T${startTime}`).toISOString();
            constraintData.endTime = new Date(`${endDate}T${endTime}`).toISOString();
        } else {
            if (!selectedTaskId) return;
            constraintData.taskId = selectedTaskId;
        }

        if (editingId) {
            onUpdateConstraint(constraintData);
        } else {
            onAddConstraint(constraintData);
        }

        resetForm();
    };

    const resetForm = () => {
        setSelectedPersonId('');
        setSelectedType('never_assign');
        setSelectedTaskId('');
        setStartDate('');
        setStartTime('');
        setEndDate('');
        setEndTime('');
        setEditingId(null);
    };

    const handleEdit = (c: SchedulingConstraint) => {
        setEditingId(c.id);
        setSelectedPersonId(c.personId);
        setSelectedType(c.type);

        if (c.type === 'time_block' && c.startTime && c.endTime) {
            const start = new Date(c.startTime);
            const end = new Date(c.endTime);
            setStartDate(start.toISOString().split('T')[0]);
            setStartTime(start.toTimeString().slice(0, 5));
            setEndDate(end.toISOString().split('T')[0]);
            setEndTime(end.toTimeString().slice(0, 5));
        } else if (c.taskId) {
            setSelectedTaskId(c.taskId);
        }

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const getConstraintLabel = (type: ConstraintType) => {
        switch (type) {
            case 'always_assign': return 'תמיד לשבץ ל...';
            case 'never_assign': return 'לעולם לא לשבץ ל...';
            case 'time_block': return 'חסימת שעות';
        }
    };

    const getConstraintIcon = (type: ConstraintType) => {
        switch (type) {
            case 'always_assign': return <CheckCircle className="text-green-500" />;
            case 'never_assign': return <Ban className="text-red-500" />;
            case 'time_block': return <Clock className="text-orange-500" />;
        }
    };

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
            {/* Add/Edit Constraint Form */}
            <div className={`bg-white p-6 md:p-8 rounded-3xl shadow-lg border ${editingId ? 'border-blue-200 ring-2 ring-blue-100' : 'border-slate-100'}`}>
                <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${editingId ? 'bg-blue-100' : 'bg-blue-50'}`}>
                            {editingId ? <Pencil size={24} className="text-blue-700" /> : <Plus size={24} className="text-blue-600" />}
                        </div>
                        <h2 className="text-xl font-bold text-slate-800">
                            {editingId ? 'עריכת אילוץ' : 'הוסף אילוץ חדש'}
                        </h2>
                    </div>
                    {editingId && (
                        <button
                            onClick={resetForm}
                            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors"
                        >
                            <X size={20} />
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                    {/* Person Select */}
                    <div className="md:col-span-4">
                        <label className="block text-sm font-bold text-slate-700 mb-2">מי?</label>
                        <Select
                            value={selectedPersonId}
                            onChange={setSelectedPersonId}
                            options={people.map(p => ({ value: p.id, label: p.name }))}
                            placeholder="בחר אדם..."
                            icon={<User size={18} />}
                        />
                    </div>

                    {/* Type Select */}
                    <div className="md:col-span-4">
                        <label className="block text-sm font-bold text-slate-700 mb-2">סוג אילוץ</label>
                        <Select
                            value={selectedType}
                            onChange={(val) => setSelectedType(val as ConstraintType)}
                            options={[
                                { value: 'never_assign', label: '⛔ לעולם לא לשבץ ל...' },
                                { value: 'always_assign', label: '✅ תמיד לשבץ ל... (בלעדיות)' },
                                { value: 'time_block', label: '⏳ חסימת שעות ספציפית' }
                            ]}
                            placeholder="בחר סוג..."
                            icon={<Shield size={18} />}
                        />
                    </div>

                    {/* Dynamic Fields */}
                    <div className="md:col-span-4">
                        {selectedType === 'time_block' ? (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">התחלה</label>
                                    <div className="flex gap-2 items-center">
                                        <div className="flex-1">
                                            <IsraeliDateInput value={startDate} onChange={setStartDate} />
                                        </div>
                                        <input
                                            type="time"
                                            value={startTime}
                                            onChange={e => setStartTime(e.target.value)}
                                            className="w-32 p-2.5 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm shadow-sm text-right"
                                            lang="he"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">סיום</label>
                                    <div className="flex gap-2 items-center">
                                        <div className="flex-1">
                                            <IsraeliDateInput value={endDate} onChange={setEndDate} />
                                        </div>
                                        <input
                                            type="time"
                                            value={endTime}
                                            onChange={e => setEndTime(e.target.value)}
                                            className="w-32 p-2.5 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm shadow-sm text-right"
                                            lang="he"
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">משימה</label>
                                <Select
                                    value={selectedTaskId}
                                    onChange={setSelectedTaskId}
                                    options={tasks.map(t => ({ value: t.id, label: t.name }))}
                                    placeholder="בחר משימה..."
                                    icon={<CheckCircle size={18} />}
                                />
                            </div>
                        )}
                    </div>

                    {/* Add/Update Button */}
                    <div className="md:col-span-12 flex justify-end mt-4 gap-3">
                        {editingId && (
                            <button
                                onClick={resetForm}
                                className="px-6 py-3 text-slate-500 hover:bg-slate-100 rounded-xl font-bold transition-colors"
                            >
                                ביטול
                            </button>
                        )}
                        <button
                            onClick={handleSave}
                            disabled={!selectedPersonId || (selectedType === 'time_block' ? (!startDate || !startTime) : !selectedTaskId)}
                            className={`w-full md:w-auto px-8 py-3 text-white rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2
                                ${editingId
                                    ? 'bg-blue-700 shadow-blue-200 hover:bg-blue-800'
                                    : 'bg-blue-600 shadow-blue-200 hover:bg-blue-700 hover:-translate-y-0.5'
                                }
                                disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0
                            `}
                        >
                            {editingId ? <Pencil size={20} /> : <Plus size={20} />}
                            {editingId ? 'עדכן אילוץ' : 'הוסף אילוץ'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Constraints List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {constraints.map(c => {
                    const person = people.find(p => p.id === c.personId);
                    const task = tasks.find(t => t.id === c.taskId);
                    const isEditing = editingId === c.id;

                    return (
                        <div key={c.id} className={`bg-white p-4 rounded-xl shadow-sm border flex items-start justify-between group hover:shadow-md transition-all ${isEditing ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50' : 'border-slate-100'}`}>
                            <div className="flex items-start gap-3">
                                <div className="mt-1">{getConstraintIcon(c.type)}</div>
                                <div>
                                    <div className="font-bold text-slate-800">{person?.name || 'לא ידוע'}</div>
                                    <div className="text-sm font-medium text-slate-600 mb-1">{getConstraintLabel(c.type)}</div>

                                    {c.type === 'time_block' ? (
                                        <div className="text-xs text-slate-500 bg-slate-50 p-1.5 rounded border border-slate-100">
                                            <div>{new Date(c.startTime!).toLocaleString('he-IL')}</div>
                                            <div className="text-center">⬇️</div>
                                            <div>{new Date(c.endTime!).toLocaleString('he-IL')}</div>
                                        </div>
                                    ) : (
                                        <div className="text-sm text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded inline-block">
                                            {task?.name || 'משימה לא ידועה'}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => handleEdit(c)}
                                    className="text-slate-400 hover:text-blue-500 p-2 rounded-full hover:bg-blue-50 transition-colors"
                                    title="ערוך"
                                >
                                    <Pencil size={18} />
                                </button>
                                <button
                                    onClick={() => onDeleteConstraint(c.id)}
                                    className="text-slate-400 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition-colors"
                                    title="מחק"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    );
                })}

                {constraints.length === 0 && (
                    <div className="col-span-full text-center py-12 text-slate-400">
                        <Shield size={48} className="mx-auto mb-4 opacity-20" />
                        <p>אין אילוצים מוגדרים</p>
                    </div>
                )}
            </div>
        </div>
    );
};
