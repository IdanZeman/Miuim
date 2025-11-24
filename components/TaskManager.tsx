import React, { useState } from 'react';
import { TaskTemplate, Role, SchedulingType } from '../types';
import { Clock, Users, AlertCircle, CheckSquare, Plus, Pencil, Trash2, X, Check, Repeat, Calendar } from 'lucide-react';

interface TaskManagerProps {
    tasks: TaskTemplate[];
    roles: Role[];
    onAddTask: (t: TaskTemplate) => void;
    onUpdateTask: (t: TaskTemplate) => void;
    onDeleteTask: (id: string) => void;
}

const COLORS = [
    'border-l-blue-500', 'border-l-red-500', 'border-l-green-500',
    'border-l-yellow-500', 'border-l-purple-500', 'border-l-pink-500',
    'border-l-indigo-500', 'border-l-teal-500', 'border-l-orange-500'
];

export const TaskManager: React.FC<TaskManagerProps> = ({
    tasks,
    roles,
    onAddTask,
    onUpdateTask,
    onDeleteTask
}) => {
    const [isAdding, setIsAdding] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);

    // Form State
    const [name, setName] = useState('');
    const [duration, setDuration] = useState(4);
    const [minRest, setMinRest] = useState(8);
    const [difficulty, setDifficulty] = useState(3);
    const [roleComposition, setRoleComposition] = useState<{ roleId: string; count: number }[]>([]);
    const [selectedColor, setSelectedColor] = useState(COLORS[0]);
    const [schedulingType, setSchedulingType] = useState<SchedulingType>('continuous');
    const [startTime, setStartTime] = useState('08:00');
    const [specificDate, setSpecificDate] = useState('');

    const resetForm = () => {
        setName('');
        setDuration(4);
        setMinRest(8);
        setDifficulty(3);
        setRoleComposition([]);
        setSelectedColor(COLORS[0]);
        setSchedulingType('continuous');
        setStartTime('08:00');
        setSpecificDate('');
        setIsAdding(false);
        setEditId(null);
    };

    const handleEditClick = (task: TaskTemplate) => {
        setName(task.name);
        setDuration(task.durationHours);
        setMinRest(task.minRestHoursBefore);
        setDifficulty(task.difficulty);
        setRoleComposition(task.roleComposition || []);
        setSelectedColor(task.color);
        setSchedulingType(task.schedulingType);
        setStartTime(task.defaultStartTime || '08:00');
        setSpecificDate(task.specificDate || '');
        setEditId(task.id);
        setIsAdding(false); // Don't show top form
    };

    const handleSubmit = () => {
        if (!name) return;

        const totalPeople = roleComposition.reduce((sum, rc) => sum + rc.count, 0);

        const taskData: TaskTemplate = {
            id: editId || `task-${Date.now()}`,
            name,
            durationHours: Number(duration),
            requiredPeople: totalPeople > 0 ? totalPeople : 1,
            minRestHoursBefore: Number(minRest),
            difficulty: Number(difficulty),
            roleComposition,
            color: selectedColor,
            schedulingType,
            is247: schedulingType === 'continuous',
            defaultStartTime: startTime,
            specificDate: (schedulingType === 'one-time' && specificDate) ? specificDate : undefined
        };

        if (editId) {
            onUpdateTask(taskData);
        } else {
            onAddTask(taskData);
        }
        resetForm();
    };

    const addRoleRow = () => {
        if (roles.length === 0) return;
        setRoleComposition([...roleComposition, { roleId: roles[0].id, count: 1 }]);
    };

    const updateRoleRow = (index: number, field: 'roleId' | 'count', value: string | number) => {
        const newComp = [...roleComposition];
        if (field === 'roleId') newComp[index].roleId = value as string;
        if (field === 'count') newComp[index].count = Number(value);
        setRoleComposition(newComp);
    };

    const removeRoleRow = (index: number) => {
        setRoleComposition(roleComposition.filter((_, i) => i !== index));
    };

    const totalPeople = roleComposition.reduce((sum, rc) => sum + rc.count, 0);

    // Render inline edit form
    const renderEditForm = (taskId: string) => {
        if (editId !== taskId) return null;

        return (
            <div className="col-span-full mb-6 bg-slate-50 p-4 md:p-6 rounded-xl border-2 border-idf-yellow animate-fadeIn">
                <h3 className="font-bold text-slate-800 mb-4 text-base md:text-lg border-b border-slate-200 pb-2">
                    עריכת משימה
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">שם המשימה</label>
                        <input value={name} onChange={e => setName(e.target.value)} className="w-full p-2 md:p-2.5 rounded-lg border border-slate-300 text-sm md:text-base" placeholder="לדוגמה: סיור בוקר" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">משך (שעות)</label>
                            <input type="number" value={duration} onChange={e => setDuration(Number(e.target.value))} className="w-full p-2 md:p-2.5 rounded-lg border border-slate-300 text-sm md:text-base" min="1" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">סה"כ לוחמים</label>
                            <div className="w-full p-2 md:p-2.5 rounded-lg border border-slate-200 bg-slate-100 text-slate-600 font-bold text-sm md:text-base">
                                {totalPeople > 0 ? totalPeople : 1}
                            </div>
                        </div>
                    </div>

                    <div className="col-span-1 md:col-span-2">
                        <label className="block text-xs font-bold text-slate-500 mb-2">סוג תזמון</label>
                        <div className="flex flex-col gap-3">
                            <div className="flex gap-2">
                                <button onClick={() => setSchedulingType('continuous')} className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg border text-xs md:text-sm ${schedulingType === 'continuous' ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'bg-white border-slate-300'}`}>
                                    <Repeat size={14} /> רציף
                                </button>
                                <button onClick={() => setSchedulingType('one-time')} className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg border text-xs md:text-sm ${schedulingType === 'one-time' ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'bg-white border-slate-300'}`}>
                                    <Calendar size={14} /> בודדת
                                </button>
                            </div>

                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-slate-500 mb-1">
                                        {schedulingType === 'continuous' ? 'שעת התחלה' : 'שעת משימה'}
                                    </label>
                                    <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="p-2 rounded-lg border border-slate-300 w-full text-sm" />
                                </div>
                                {schedulingType === 'one-time' && (
                                    <div className="flex-1">
                                        <label className="block text-xs font-bold text-slate-500 mb-1">תאריך</label>
                                        <input type="date" value={specificDate} onChange={e => setSpecificDate(e.target.value)} className="p-2 rounded-lg border border-slate-300 w-full text-sm" />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">מנוחה (שעות)</label>
                            <input type="number" value={minRest} onChange={e => setMinRest(Number(e.target.value))} className="w-full p-2 rounded-lg border border-slate-300 text-sm" min="0" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">רמת קושי</label>
                            <input type="range" value={difficulty} onChange={e => setDifficulty(Number(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg mt-2 accent-idf-yellow" min="1" max="5" />
                            <div className="text-xs text-center text-slate-500">{difficulty}</div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2">צבע</label>
                        <div className="flex gap-2">
                            {COLORS.map(c => (
                                <button key={c} onClick={() => setSelectedColor(c)} className={`w-5 h-5 md:w-6 md:h-6 rounded-full ${c.replace('border-l-', 'bg-')} ${selectedColor === c ? 'ring-2 ring-offset-2 ring-slate-400' : ''}`} />
                            ))}
                        </div>
                    </div>
                </div>

                <div className="mb-4">
                    <label className="block text-xs font-bold text-slate-500 mb-2">הרכב תפקידים</label>
                    <div className="space-y-2">
                        {roleComposition.map((rc, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                                <select value={rc.roleId} onChange={e => updateRoleRow(idx, 'roleId', e.target.value)} className="p-2 rounded-lg border border-slate-300 flex-1 text-sm">
                                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </select>
                                <input type="number" min="1" value={rc.count} onChange={e => updateRoleRow(idx, 'count', e.target.value)} className="w-16 md:w-20 p-2 rounded-lg border border-slate-300 text-sm" />
                                <button onClick={() => removeRoleRow(idx)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-full">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                        <button onClick={addRoleRow} className="text-blue-600 text-xs font-bold hover:underline flex items-center gap-1">
                            <Plus size={12} /> הוסף תפקיד
                        </button>
                    </div>
                </div>

                <div className="flex justify-end gap-2">
                    <button onClick={handleSubmit} className="px-4 md:px-6 py-1.5 md:py-2 bg-idf-yellow text-slate-900 rounded-full font-bold text-sm md:text-base">עדכן</button>
                    <button onClick={resetForm} className="px-3 md:px-5 py-1.5 md:py-2 text-slate-500 hover:bg-slate-200 rounded-full text-sm">ביטול</button>
                </div>
            </div>
        );
    };

    return (
        <div className="bg-white rounded-xl shadow-portal p-4 md:p-6 min-h-[600px]">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 md:mb-8 pb-4 border-b border-slate-100 gap-4">
                <h2 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2 md:gap-3">
                    <span className="bg-blue-50 p-2 rounded-lg text-blue-600"><CheckSquare size={20} /></span>
                    בנק משימות
                </h2>
                {!isAdding && !editId && (
                    <button onClick={() => setIsAdding(true)} className="w-full md:w-auto bg-idf-yellow text-slate-900 hover:bg-idf-yellow-hover px-4 md:px-5 py-2 md:py-2.5 rounded-full font-bold shadow-sm text-sm flex items-center justify-center gap-2">
                        <Plus size={16} /> הוסף משימה
                    </button>
                )}
            </div>

            {/* Top Form - Only for "Add New" */}
            {isAdding && !editId && (
                <div className="mb-6 md:mb-8 bg-slate-50 p-4 md:p-6 rounded-xl border border-slate-200 animate-fadeIn">
                    <h3 className="font-bold text-slate-800 mb-4 text-base md:text-lg border-b border-slate-200 pb-2">
                        הוספת משימה חדשה
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">שם המשימה</label>
                            <input value={name} onChange={e => setName(e.target.value)} className="w-full p-2 md:p-2.5 rounded-lg border border-slate-300 text-sm md:text-base" placeholder="לדוגמה: סיור בוקר" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">משך (שעות)</label>
                                <input type="number" value={duration} onChange={e => setDuration(Number(e.target.value))} className="w-full p-2 md:p-2.5 rounded-lg border border-slate-300 text-sm md:text-base" min="1" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">סה"כ לוחמים</label>
                                <div className="w-full p-2 md:p-2.5 rounded-lg border border-slate-200 bg-slate-100 text-slate-600 font-bold text-sm md:text-base">
                                    {totalPeople > 0 ? totalPeople : 1}
                                </div>
                            </div>
                        </div>

                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-xs font-bold text-slate-500 mb-2">סוג תזמון</label>
                            <div className="flex flex-col gap-3">
                                <div className="flex gap-2">
                                    <button onClick={() => setSchedulingType('continuous')} className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg border text-xs md:text-sm ${schedulingType === 'continuous' ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'bg-white border-slate-300'}`}>
                                        <Repeat size={14} /> רציף
                                    </button>
                                    <button onClick={() => setSchedulingType('one-time')} className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg border text-xs md:text-sm ${schedulingType === 'one-time' ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'bg-white border-slate-300'}`}>
                                        <Calendar size={14} /> בודדת
                                    </button>
                                </div>

                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <label className="block text-xs font-bold text-slate-500 mb-1">
                                            {schedulingType === 'continuous' ? 'שעת התחלה' : 'שעת משימה'}
                                        </label>
                                        <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="p-2 rounded-lg border border-slate-300 w-full text-sm" />
                                    </div>
                                    {schedulingType === 'one-time' && (
                                        <div className="flex-1">
                                            <label className="block text-xs font-bold text-slate-500 mb-1">תאריך</label>
                                            <input type="date" value={specificDate} onChange={e => setSpecificDate(e.target.value)} className="p-2 rounded-lg border border-slate-300 w-full text-sm" />
                                        </div>
                                    )}
                                </div>
                                <p className="text-xs text-slate-400">
                                    {schedulingType === 'continuous'
                                        ? `משמרות ${duration} שעות ברצף החל מ-${startTime}.`
                                        : 'משימה בשעה ותאריך שנבחרו.'}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">מנוחה (שעות)</label>
                                <input type="number" value={minRest} onChange={e => setMinRest(Number(e.target.value))} className="w-full p-2 rounded-lg border border-slate-300 text-sm" min="0" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">רמת קושי</label>
                                <input type="range" value={difficulty} onChange={e => setDifficulty(Number(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg mt-2 accent-idf-yellow" min="1" max="5" />
                                <div className="text-xs text-center text-slate-500">{difficulty}</div>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-2">צבע</label>
                            <div className="flex gap-2">
                                {COLORS.map(c => (
                                    <button key={c} onClick={() => setSelectedColor(c)} className={`w-5 h-5 md:w-6 md:h-6 rounded-full ${c.replace('border-l-', 'bg-')} ${selectedColor === c ? 'ring-2 ring-offset-2 ring-slate-400' : ''}`} />
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="block text-xs font-bold text-slate-500 mb-2">הרכב תפקידים</label>
                        <div className="space-y-2">
                            {roleComposition.map((rc, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                    <select value={rc.roleId} onChange={e => updateRoleRow(idx, 'roleId', e.target.value)} className="p-2 rounded-lg border border-slate-300 flex-1 text-sm">
                                        {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                    </select>
                                    <input type="number" min="1" value={rc.count} onChange={e => updateRoleRow(idx, 'count', e.target.value)} className="w-16 md:w-20 p-2 rounded-lg border border-slate-300 text-sm" />
                                    <button onClick={() => removeRoleRow(idx)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-full">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                            <button onClick={addRoleRow} className="text-blue-600 text-xs font-bold hover:underline flex items-center gap-1">
                                <Plus size={12} /> הוסף תפקיד
                            </button>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2">
                        <button onClick={handleSubmit} className="px-4 md:px-6 py-1.5 md:py-2 bg-idf-yellow text-slate-900 rounded-full font-bold text-sm md:text-base">שמור</button>
                        <button onClick={resetForm} className="px-3 md:px-5 py-1.5 md:py-2 text-slate-500 hover:bg-slate-200 rounded-full text-sm">ביטול</button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                {tasks.map(task => (
                    <React.Fragment key={task.id}>
                        <div className="bg-white rounded-xl p-4 md:p-6 border border-idf-card-border hover:shadow-md transition-all group relative overflow-hidden">
                            <div className={`absolute top-0 right-0 w-1 md:w-1.5 h-full ${task.color.replace('border-l-', 'bg-')}`}></div>

                            <div className="absolute top-3 md:top-4 left-3 md:left-4 flex gap-1 md:gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleEditClick(task)} className="p-1.5 md:p-2 bg-slate-100 hover:bg-blue-100 text-slate-500 hover:text-blue-600 rounded-full">
                                    <Pencil size={14} />
                                </button>
                                <button onClick={() => onDeleteTask(task.id)} className="p-1.5 md:p-2 bg-slate-100 hover:bg-red-100 text-slate-500 hover:text-red-600 rounded-full">
                                    <Trash2 size={14} />
                                </button>
                            </div>

                            <div className="flex justify-between items-start mb-3 md:mb-4 pr-3 md:pr-4">
                                <div className="min-w-0 flex-1">
                                    <h3 className="text-base md:text-xl font-bold text-slate-900 truncate">{task.name}</h3>
                                    <div className="flex flex-col gap-1 mt-1">
                                        {task.schedulingType === 'continuous' ?
                                            <span className="bg-blue-100 text-blue-700 text-[9px] md:text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 w-fit">
                                                <Repeat size={10} /> רציף ({task.defaultStartTime})
                                            </span>
                                            :
                                            <span className="bg-slate-100 text-slate-700 text-[9px] md:text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 w-fit"><Calendar size={10} /> {task.defaultStartTime || 'בודדת'}</span>
                                        }
                                        {task.specificDate && (
                                            <span className="bg-purple-100 text-purple-700 text-[9px] md:text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 w-fit"><Calendar size={10} /> {new Date(task.specificDate).toLocaleDateString('he-IL')}</span>
                                        )}
                                    </div>
                                </div>
                                <span className={`px-2 md:px-3 py-1 rounded-full text-[10px] md:text-xs font-bold flex-shrink-0 ${task.difficulty >= 4 ? 'bg-red-50 text-red-700' : task.difficulty >= 2 ? 'bg-orange-50 text-orange-700' : 'bg-green-50 text-green-700'}`}>
                                    קושי {task.difficulty}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-3 md:gap-4 text-xs md:text-sm text-slate-600 mb-4 md:mb-6 pr-3 md:pr-4">
                                <div className="flex items-center gap-1.5 md:gap-2">
                                    <Clock size={14} className="text-slate-400 flex-shrink-0" />
                                    <span className="font-medium">{task.durationHours} שעות</span>
                                </div>
                                <div className="flex items-center gap-1.5 md:gap-2">
                                    <Users size={14} className="text-slate-400 flex-shrink-0" />
                                    <span className="font-medium">{task.requiredPeople} לוחמים</span>
                                </div>
                                <div className="flex items-center gap-1.5 md:gap-2 col-span-2 text-slate-500">
                                    <AlertCircle size={14} className="flex-shrink-0" />
                                    <span className="text-xs">מנוחה: {task.minRestHoursBefore} שעות</span>
                                </div>
                            </div>

                            <div className="pt-3 md:pt-4 border-t border-slate-100 pr-3 md:pr-4">
                                <p className="text-xs font-bold text-slate-500 mb-2 md:mb-3">הרכב:</p>
                                <div className="flex flex-wrap gap-1.5 md:gap-2">
                                    {task.roleComposition && task.roleComposition.length > 0 ? task.roleComposition.map((rc, idx) => {
                                        const r = roles.find(role => role.id === rc.roleId);
                                        return r ? (
                                            <span key={`${rc.roleId}-${idx}`} className="text-[10px] md:text-xs px-2 md:px-3 py-0.5 md:py-1 rounded-full border border-slate-200 font-medium text-slate-600 bg-slate-50">
                                                {rc.count}x {r.name}
                                            </span>
                                        ) : null;
                                    }) : <span className="text-xs text-slate-400 italic">ללא דרישות</span>}
                                </div>
                            </div>
                        </div>
                        {renderEditForm(task.id)}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
};
