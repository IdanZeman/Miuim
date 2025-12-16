import React, { useState } from 'react';
import { Person, TaskTemplate, SchedulingConstraint, ConstraintType, Team, Role } from '../types';
import { Trash2, Plus, Clock, CheckCircle, Ban, User, Shield, ChevronDown, Pencil, Users, BadgeCheck, Calendar, Search } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Select } from './ui/Select';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';

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

export const ConstraintsManager: React.FC<ConstraintsManagerProps> = ({ people, tasks, teams, roles, constraints, onAddConstraint, onDeleteConstraint, onUpdateConstraint }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingConstraint, setEditingConstraint] = useState<SchedulingConstraint | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Form State
    const [targetType, setTargetType] = useState<'person' | 'team' | 'role'>('person');
    const [selectedTargetId, setSelectedTargetId] = useState<string>('');
    const [selectedType, setSelectedType] = useState<ConstraintType>('never_assign');
    const [selectedTaskId, setSelectedTaskId] = useState<string>('');
    const [startDate, setStartDate] = useState<string>('');
    const [startTime, setStartTime] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [endTime, setEndTime] = useState<string>('');

    const resetForm = () => {
        setTargetType('person');
        setSelectedTargetId('');
        setSelectedType('never_assign');
        setSelectedTaskId('');
        setStartDate('');
        setStartTime('');
        setEndDate('');
        setEndTime('');
        setEditingConstraint(null);
    };

    const handleOpenModal = (constraint?: SchedulingConstraint) => {
        if (constraint) {
            setEditingConstraint(constraint);
            if (constraint.personId) { setTargetType('person'); setSelectedTargetId(constraint.personId); }
            else if (constraint.teamId) { setTargetType('team'); setSelectedTargetId(constraint.teamId); }
            else if (constraint.roleId) { setTargetType('role'); setSelectedTargetId(constraint.roleId); }

            setSelectedType(constraint.type);

            if (constraint.type === 'time_block' && constraint.startTime && constraint.endTime) {
                const start = new Date(constraint.startTime);
                const end = new Date(constraint.endTime);
                setStartDate(start.toISOString().split('T')[0]);
                setStartTime(start.toTimeString().slice(0, 5));
                setEndDate(end.toISOString().split('T')[0]);
                setEndTime(end.toTimeString().slice(0, 5));
            } else if (constraint.taskId) {
                setSelectedTaskId(constraint.taskId);
            }
        } else {
            resetForm();
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        resetForm();
    };

    const handleSave = () => {
        if (!selectedTargetId) return;

        const constraintData: SchedulingConstraint = {
            id: editingConstraint?.id || uuidv4(),
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
            if (!selectedTaskId && selectedType !== 'time_block') return; // Task needed unless time_block
            if (selectedTaskId) constraintData.taskId = selectedTaskId;
        }

        if (editingConstraint) {
            onUpdateConstraint(constraintData);
        } else {
            onAddConstraint(constraintData);
        }

        handleCloseModal();
    };

    // Helper functions for display
    const getConstraintLabel = (type: ConstraintType) => {
        switch (type) {
            case 'always_assign': return 'תמיד לשבץ ל...';
            case 'never_assign': return 'לעולם לא לשבץ ל...';
            case 'time_block': return 'חסימת שעות';
        }
    };

    const getConstraintIcon = (type: ConstraintType) => {
        switch (type) {
            case 'always_assign': return <CheckCircle size={20} className="text-green-500" />;
            case 'never_assign': return <Ban size={20} className="text-red-500" />;
            case 'time_block': return <Clock size={20} className="text-orange-500" />;
        }
    };

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

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('he-IL', {
            day: '2-digit', month: '2-digit', year: '2-digit',
            hour: '2-digit', minute: '2-digit'
        });
    };

    // Filter constraints
    const filteredConstraints = constraints.filter(c => {
        const target = getTargetDisplay(c);
        return target.name.toLowerCase().includes(searchTerm.toLowerCase());
    });

    const footerContent = (
        <div className="flex gap-3 w-full">
            <Button
                variant="ghost"
                onClick={handleCloseModal}
                fullWidth
            >
                ביטול
            </Button>
            <Button
                variant="primary"
                onClick={handleSave}
                disabled={!selectedTargetId || (selectedType === 'time_block' ? (!startDate || !startTime) : !selectedTaskId)}
                fullWidth
            >
                {editingConstraint ? 'שמור שינויים' : 'צור אילוץ'}
            </Button>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* ... (Header and List remain unchanged) ... */}

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-100">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Shield className="text-blue-600" />
                        ניהול אילוצים
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">הגדרת חוקים לשיבוץ (חסימות, העדפות, וכדומה)</p>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                    <Button
                        onClick={() => handleOpenModal()}
                        icon={Plus}
                        variant="primary"
                        className="w-full md:w-auto"
                    >
                        הוסף אילוץ
                    </Button>
                </div>
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <Input
                    placeholder="חפש אילוץ לפי שם..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    icon={Search}
                    className="w-full"
                />
            </div>

            {/* List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredConstraints.map(c => {
                    const target = getTargetDisplay(c);
                    const task = tasks.find(t => t.id === c.taskId);

                    return (
                        <div key={c.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all group overflow-hidden relative">
                            {/* Color Bar */}
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

                            <div className="flex items-center justify-end gap-2 p-3 bg-slate-50 border-t border-slate-100">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleOpenModal(c)}
                                    className="text-slate-500 hover:text-blue-600"
                                >
                                    <Pencil size={16} />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onDeleteConstraint(c.id)}
                                    className="text-slate-500 hover:text-red-600"
                                >
                                    <Trash2 size={16} />
                                </Button>
                            </div>
                        </div>
                    );
                })}

                {filteredConstraints.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center py-12 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <Shield size={48} className="mb-4 opacity-20" />
                        <p className="text-lg font-medium">לא נמצאו אילוצים</p>
                        {searchTerm && <p className="text-sm">נסה לחפש ביטוי אחר</p>}
                        <Button variant="ghost" className="mt-4" onClick={() => handleOpenModal()}>
                            צור אילוץ חדש
                        </Button>
                    </div>
                )}
            </div>

            {/* Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                title={editingConstraint ? 'עריכת אילוץ' : 'הוסף אילוץ חדש'}
                footer={footerContent}
            >
                <div className="space-y-6">
                    {/* Target Selector */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">על מי חל האילוץ?</label>
                        <div className="flex bg-slate-100 p-1 rounded-xl mb-3">
                            <button onClick={() => { setTargetType('person'); setSelectedTargetId(''); }} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${targetType === 'person' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>חייל ספציפי</button>
                            <button onClick={() => { setTargetType('team'); setSelectedTargetId(''); }} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${targetType === 'team' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>צוות שלם</button>
                            <button onClick={() => { setTargetType('role'); setSelectedTargetId(''); }} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${targetType === 'role' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>תפקיד</button>
                        </div>

                        {targetType === 'person' && (
                            <Select
                                label="בחר חייל"
                                value={selectedTargetId}
                                onChange={setSelectedTargetId}
                                options={people.map(p => ({ value: p.id, label: p.name }))}
                                placeholder="בחר חייל..."
                                icon={User}
                                searchable
                            />
                        )}
                        {targetType === 'team' && (
                            <Select
                                label="בחר צוות"
                                value={selectedTargetId}
                                onChange={setSelectedTargetId}
                                options={teams.map(t => ({ value: t.id, label: t.name }))}
                                placeholder="בחר צוות..."
                                icon={Users}
                            />
                        )}
                        {targetType === 'role' && (
                            <Select
                                label="בחר תפקיד"
                                value={selectedTargetId}
                                onChange={setSelectedTargetId}
                                options={roles.map(r => ({ value: r.id, label: r.name }))}
                                placeholder="בחר תפקיד..."
                                icon={BadgeCheck}
                            />
                        )}
                    </div>

                    {/* Type Selector */}
                    <div>
                        <Select
                            label="סוג אילוץ"
                            value={selectedType}
                            onChange={(val) => setSelectedType(val as ConstraintType)}
                            options={[
                                { value: 'never_assign', label: '⛔ לעולם לא לשבץ ל...' },
                                { value: 'always_assign', label: '✅ תמיד לשבץ ל... (בלעדיות)' },
                                { value: 'time_block', label: '⏳ חסימת שעות ספציפית' }
                            ]}
                            placeholder="בחר סוג..."
                            icon={Shield}
                        />
                    </div>

                    {/* Conditional Fields */}
                    {selectedType === 'time_block' ? (
                        <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">התחלה</label>
                                <div className="relative flex items-center bg-white rounded-lg border border-slate-200 px-2 py-1.5 w-full mb-2">
                                    <span className={`text-xs font-bold flex-1 text-right pointer-events-none ${startDate ? 'text-slate-700' : 'text-slate-400'}`}>
                                        {startDate ? new Date(startDate).toLocaleDateString('he-IL') : 'תאריך'}
                                    </span>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                                    />
                                    <Calendar size={14} className="text-slate-400 ml-1 pointer-events-none" />
                                </div>
                                <div className="relative flex items-center bg-white rounded-lg border border-slate-200 px-2 py-1.5 w-full">
                                    <span className={`text-xs font-bold flex-1 text-right pointer-events-none ${startTime ? 'text-slate-700' : 'text-slate-400'}`}>
                                        {startTime || 'שעה'}
                                    </span>
                                    <input
                                        type="time"
                                        value={startTime}
                                        onChange={(e) => setStartTime(e.target.value)}
                                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                                    />
                                    <Clock size={14} className="text-slate-400 ml-1 pointer-events-none" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">סיום</label>
                                <div className="relative flex items-center bg-white rounded-lg border border-slate-200 px-2 py-1.5 w-full mb-2">
                                    <span className={`text-xs font-bold flex-1 text-right pointer-events-none ${endDate ? 'text-slate-700' : 'text-slate-400'}`}>
                                        {endDate ? new Date(endDate).toLocaleDateString('he-IL') : 'תאריך'}
                                    </span>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                                    />
                                    <Calendar size={14} className="text-slate-400 ml-1 pointer-events-none" />
                                </div>
                                <div className="relative flex items-center bg-white rounded-lg border border-slate-200 px-2 py-1.5 w-full">
                                    <span className={`text-xs font-bold flex-1 text-right pointer-events-none ${endTime ? 'text-slate-700' : 'text-slate-400'}`}>
                                        {endTime || 'שעה'}
                                    </span>
                                    <input
                                        type="time"
                                        value={endTime}
                                        onChange={(e) => setEndTime(e.target.value)}
                                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                                    />
                                    <Clock size={14} className="text-slate-400 ml-1 pointer-events-none" />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <Select
                                label="לאיזו משימה?"
                                value={selectedTaskId}
                                onChange={setSelectedTaskId}
                                options={tasks.map(t => ({ value: t.id, label: t.name }))}
                                placeholder="בחר משימה..."
                                icon={CheckCircle}
                            />
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
};


