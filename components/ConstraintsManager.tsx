import React, { useState, useEffect } from 'react';
import { Person, TaskTemplate, SchedulingConstraint, ConstraintType, Team, Role } from '../types';
import { Trash2, Plus, Calendar, Clock, AlertTriangle, CheckCircle, Ban, User, Shield, ChevronDown, Pencil, X, Users, BadgeCheck } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Select } from './ui/Select';

interface ConstraintsManagerProps {
    people: Person[];
    tasks: TaskTemplate[];
    teams: Team[];
    roles: Role[];
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

export const ConstraintsManager: React.FC<ConstraintsManagerProps> = ({ people, tasks, teams, roles, constraints, onAddConstraint, onDeleteConstraint, onUpdateConstraint }) => {
    // Target Selection Type
    const [targetType, setTargetType] = useState<'person' | 'team' | 'role'>('person');
    const [selectedTargetId, setSelectedTargetId] = useState<string>('');

    const [selectedType, setSelectedType] = useState<ConstraintType>('never_assign');
    const [selectedTaskId, setSelectedTaskId] = useState<string>('');
    const [startDate, setStartDate] = useState<string>('');
    const [startTime, setStartTime] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [endTime, setEndTime] = useState<string>('');
    const [editingId, setEditingId] = useState<string | null>(null);

    const handleSave = () => {
        if (!selectedTargetId) return;

        const constraintData: SchedulingConstraint = {
            id: editingId || uuidv4(),
            type: selectedType,
            organization_id: '', // Will be set by parent or DB mapper
        };

        // Assign target based on type
        if (targetType === 'person') constraintData.personId = selectedTargetId;
        else if (targetType === 'team') constraintData.teamId = selectedTargetId;
        else if (targetType === 'role') constraintData.roleId = selectedTargetId;

        if (selectedType === 'time_block') {
            if (!startDate || !startTime || !endDate || !endTime) return;
            constraintData.startTime = new Date(`${startDate}T${startTime}`).toISOString();
            constraintData.endTime = new Date(`${endDate}T${endTime}`).toISOString();
        } else {
            if (!selectedTaskId) return;
            constraintData.taskId = selectedTaskId;
        }

        if (editingId) {
            onUpdateConstraint({ ...constraintData, id: editingId });
        } else {
            onAddConstraint(constraintData);
        }

        resetForm();
    };

    const resetForm = () => {
        setTargetType('person');
        setSelectedTargetId('');
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

        if (c.personId) { setTargetType('person'); setSelectedTargetId(c.personId); }
        else if (c.teamId) { setTargetType('team'); setSelectedTargetId(c.teamId); }
        else if (c.roleId) { setTargetType('role'); setSelectedTargetId(c.roleId); }

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

    // Helper to get target name for list display
    const getTargetDisplay = (c: SchedulingConstraint) => {
        if (c.personId) {
            const p = people.find(p => p.id === c.personId);
            return { name: p?.name || 'לא ידוע', icon: <User size={16} className="text-slate-400" />, type: 'חייל' };
        }
        if (c.teamId) {
            const t = teams.find(t => t.id === c.teamId);
            return { name: t?.name || 'צוות לא ידוע', icon: <Users size={16} className="text-blue-500" />, type: 'צוות' };
        }
        if (c.roleId) {
            const r = roles.find(r => r.id === c.roleId);
            return { name: r?.name || 'תפקיד לא ידוע', icon: <BadgeCheck size={16} className="text-purple-500" />, type: 'תפקיד' };
        }
        return { name: 'לא ידוע', icon: <User size={16} />, type: 'אלמוני' };
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
                    {/* Target Selector Group */}
                    <div className="md:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Target Type Selector */}
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">על מי חל האילוץ?</label>
                            <div className="flex bg-slate-50 p-1 rounded-xl">
                                <button onClick={() => { setTargetType('person'); setSelectedTargetId(''); }} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${targetType === 'person' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>חייל ספציפי</button>
                                <button onClick={() => { setTargetType('team'); setSelectedTargetId(''); }} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${targetType === 'team' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>צוות שלם</button>
                                <button onClick={() => { setTargetType('role'); setSelectedTargetId(''); }} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${targetType === 'role' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>תפקיד</button>
                            </div>
                        </div>

                        {/* Specific Target Select */}
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">בחר {targetType === 'person' ? 'חייל' : targetType === 'team' ? 'צוות' : 'תפקיד'}</label>
                            {targetType === 'person' && (
                                <Select
                                    value={selectedTargetId}
                                    onChange={setSelectedTargetId}
                                    options={people.map(p => ({ value: p.id, label: p.name }))}
                                    placeholder="בחר חייל..."
                                    icon={<User size={18} />}
                                    searchable={true}
                                />
                            )}
                            {targetType === 'team' && (
                                <Select
                                    value={selectedTargetId}
                                    onChange={setSelectedTargetId}
                                    options={teams.map(t => ({ value: t.id, label: t.name }))}
                                    placeholder="בחר צוות..."
                                    icon={<Users size={18} />}
                                />
                            )}
                            {targetType === 'role' && (
                                <Select
                                    value={selectedTargetId}
                                    onChange={setSelectedTargetId}
                                    options={roles.map(r => ({ value: r.id, label: r.name }))}
                                    placeholder="בחר תפקיד..."
                                    icon={<BadgeCheck size={18} />}
                                />
                            )}
                        </div>
                    </div>

                    {/* Constraint Type Select */}
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

                    {/* Dynamic Constraint Details */}
                    <div className="md:col-span-12 border-t border-slate-50 pt-4 mt-2">
                        {selectedType === 'time_block' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                                            className="w-32 p-2.5 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm shadow-sm text-right ltr-input"
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
                                            className="w-32 p-2.5 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm shadow-sm text-right ltr-input"
                                            lang="he"
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">לאיזו משימה?</label>
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
                            disabled={!selectedTargetId || (selectedType === 'time_block' ? (!startDate || !startTime) : !selectedTaskId)}
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
                    const target = getTargetDisplay(c);
                    const task = tasks.find(t => t.id === c.taskId);
                    const isEditing = editingId === c.id;

                    const formatDate = (dateStr: string) => {
                        return new Date(dateStr).toLocaleString('he-IL', {
                            day: '2-digit', month: '2-digit', year: '2-digit',
                            hour: '2-digit', minute: '2-digit'
                        });
                    };

                    return (
                        <div key={c.id} className={`bg-white rounded-2xl shadow-sm border transaction-all duration-200 group relative overflow-hidden ${isEditing ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-100 hover:shadow-md hover:-translate-y-0.5'}`}>
                            {/* Accent Bar */}
                            <div className={`absolute top-0 right-0 left-0 h-1 ${c.type === 'never_assign' ? 'bg-red-500' : c.type === 'always_assign' ? 'bg-green-500' : 'bg-orange-500'}`}></div>

                            <div className="p-5">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg shrink-0 ${c.type === 'never_assign' ? 'bg-red-50 text-red-600' :
                                            c.type === 'always_assign' ? 'bg-green-50 text-green-600' :
                                                'bg-orange-50 text-orange-600'
                                            }`}>
                                            {getConstraintIcon(c.type)}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-bold text-slate-800 text-lg leading-tight">{target.name}</h3>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${target.type === 'חייל' ? 'bg-slate-50 text-slate-500 border-slate-200' :
                                                    target.type === 'צוות' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                        'bg-purple-50 text-purple-600 border-purple-100'
                                                    }`}>
                                                    {target.type}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-500 font-medium mt-0.5">{getConstraintLabel(c.type)}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                    {c.type === 'time_block' ? (
                                        <div className="flex items-center justify-between text-sm">
                                            <div className="text-right">
                                                <div className="text-xs text-slate-400 font-bold mb-1">התחלה</div>
                                                <div className="font-mono font-bold text-slate-700 dir-ltr text-right">{formatDate(c.startTime!)}</div>
                                            </div>
                                            <div className="text-slate-300 px-2">
                                                <ChevronDown size={16} className="rotate-90" />
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xs text-slate-400 font-bold mb-1">סיום</div>
                                                <div className="font-mono font-bold text-slate-700 dir-ltr text-right">{formatDate(c.endTime!)}</div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                            <span className="font-bold text-slate-700 text-sm">
                                                {task?.name || 'משימה לא ידועה'}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Actions Overlay */}
                            <div className="absolute top-3 left-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0">
                                <button
                                    onClick={() => handleEdit(c)}
                                    className="p-2 bg-white text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full shadow-sm border border-slate-100 transition-all"
                                    title="ערוך"
                                >
                                    <Pencil size={14} />
                                </button>
                                <button
                                    onClick={() => onDeleteConstraint(c.id)}
                                    className="p-2 bg-white text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full shadow-sm border border-slate-100 transition-all"
                                    title="מחק"
                                >
                                    <Trash2 size={14} />
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
