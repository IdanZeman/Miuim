import React, { useState } from 'react';
import { TaskTemplate, Role, SchedulingSegment } from '../types';
import { CheckSquare, Plus, Pencil, Trash2, Copy, Layers, Clock, Users } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { Modal } from './ui/Modal';
import { useAuth } from '../contexts/AuthContext';
import { SegmentEditor } from './SegmentEditor';

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
    const { checkAccess } = useAuth();
    const canEdit = checkAccess('tasks', 'edit');

    const [isAdding, setIsAdding] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const { showToast } = useToast();

    // Form State
    const [name, setName] = useState('');
    const [difficulty, setDifficulty] = useState(3);
    const [selectedColor, setSelectedColor] = useState(COLORS[0]);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [segments, setSegments] = useState<SchedulingSegment[]>([]);

    // Segment Editor State
    const [showSegmentEditor, setShowSegmentEditor] = useState(false);
    const [editingSegment, setEditingSegment] = useState<SchedulingSegment | undefined>(undefined);

    const isModalOpen = isAdding || !!editId;

    const resetForm = () => {
        setIsAdding(false);
        setEditId(null);
        setName('');
        setDifficulty(3);
        setSelectedColor(COLORS[0]);
        setStartDate('');
        setEndDate('');
        setSegments([]);
    };

    const handleEditClick = (task: TaskTemplate) => {
        setEditId(task.id);
        setName(task.name);
        setDifficulty(task.difficulty);
        setSelectedColor(task.color);
        setStartDate(task.startDate || '');
        setEndDate(task.endDate || '');
        setSegments(task.segments || []);
        setIsAdding(false);
    };

    const handleDuplicateTask = (task: TaskTemplate) => {
        const newTask: TaskTemplate = {
            ...task,
            id: crypto.randomUUID(),
            name: `${task.name} (עותק)`,
            segments: task.segments.map(s => ({ ...s, id: crypto.randomUUID(), taskId: '' })) // Reset IDs
        };
        // Fix taskId for duplicated segments after creation (or just leave empty, they get assigned on save?? No, simpler to assign new ID)
        newTask.segments.forEach(s => s.taskId = newTask.id);

        onAddTask(newTask);
        showToast('המשמרת שוכפלה בהצלחה', 'success');
    };

    const handleSubmit = () => {
        if (!name) {
            showToast('נא להזין שם משימה', 'error');
            return;
        }

        const taskId = editId || crypto.randomUUID();

        // Ensure all segments have the correct taskId
        const processedSegments = segments.map(s => ({ ...s, taskId }));

        const taskData: TaskTemplate = {
            id: taskId,
            name,
            difficulty,
            color: selectedColor,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            segments: processedSegments,
            is247: false
        };

        if (editId) {
            onUpdateTask(taskData);
            showToast('המשימה עודכנה בהצלחה', 'success');
        } else {
            onAddTask(taskData);
            showToast('המשימה נוצרה בהצלחה', 'success');
        }
        resetForm();
    };

    const handleSaveSegment = (segment: SchedulingSegment) => {
        if (editingSegment) {
            setSegments(prev => prev.map(s => s.id === segment.id ? segment : s));
        } else {
            setSegments(prev => [...prev, segment]);
        }
    };

    const handleDeleteSegment = (segmentId: string) => {
        setSegments(prev => prev.filter(s => s.id !== segmentId));
    };

    const handleDuplicateSegment = (segment: SchedulingSegment) => {
        const newSegment = {
            ...segment,
            id: crypto.randomUUID(),
            name: `${segment.name} (עותק)`
        };
        setSegments(prev => [...prev, newSegment]);
    };

    return (
        <div className="bg-white rounded-xl shadow-portal p-4 md:p-6 min-h-[600px]">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 md:mb-8 pb-4 border-b border-slate-100 gap-4">
                <h2 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2 md:gap-3">
                    <span className="bg-blue-50 p-2 rounded-lg text-blue-600"><CheckSquare size={20} /></span>
                    ניהול משימות
                </h2>
                {canEdit && (
                    <button
                        onClick={() => {
                            if (roles.length === 0) {
                                showToast('יש להגדיר תפקידים לפני יצירת משימות', 'error');
                                return;
                            }
                            setIsAdding(true);
                        }}
                        className="w-full md:w-auto bg-idf-yellow text-slate-900 hover:bg-idf-yellow-hover px-4 md:px-5 py-2 md:py-2.5 rounded-full font-bold shadow-sm text-sm flex items-center justify-center gap-2"
                    >
                        הוסף משימה<Plus size={16} />
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                {tasks.map(task => (
                    <div key={task.id} className="bg-white rounded-xl p-4 md:p-6 border border-idf-card-border hover:shadow-md transition-all group relative overflow-hidden">
                        <div className={`absolute top-0 right-0 w-1 md:w-1.5 h-full ${task.color.replace('border-l-', 'bg-')}`}></div>

                        {canEdit && (
                            <div className="absolute top-3 md:top-4 left-3 md:left-4 flex gap-1 md:gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleDuplicateTask(task)} className="p-1.5 md:p-2 bg-slate-100 hover:bg-green-100 text-slate-500 hover:text-green-600 rounded-full" title="שכפל משימה">
                                    <Copy size={14} />
                                </button>
                                <button onClick={() => handleEditClick(task)} className="p-1.5 md:p-2 bg-slate-100 hover:bg-blue-100 text-slate-500 hover:text-blue-600 rounded-full">
                                    <Pencil size={14} />
                                </button>
                                <button onClick={() => onDeleteTask(task.id)} className="p-1.5 md:p-2 bg-slate-100 hover:bg-red-100 text-slate-500 hover:text-red-600 rounded-full">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        )}

                        <div className="flex justify-between items-start mb-3 md:mb-4 pr-3 md:pr-4">
                            <div className="min-w-0 flex-1">
                                <h3 className="text-base md:text-xl font-bold text-slate-900 truncate">{task.name}</h3>
                                <div className="flex gap-2 text-xs text-slate-500 mt-1">
                                    <span className="flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-full">
                                        <Layers size={12} /> {task.segments?.length || 0} מקטעים
                                    </span>
                                </div>
                            </div>
                            <span className={`px-2 md:px-3 py-1 rounded-full text-[10px] md:text-xs font-bold flex-shrink-0 ${task.difficulty >= 4 ? 'bg-red-50 text-red-700' : task.difficulty >= 2 ? 'bg-orange-50 text-orange-700' : 'bg-green-50 text-green-700'}`}>
                                קושי {task.difficulty}
                            </span>
                        </div>

                        {/* Segment Summary Preview */}
                        <div className="space-y-2 mt-4">
                            {task.segments?.slice(0, 3).map((seg, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-slate-50 p-2 rounded-lg text-xs">
                                    <span className="font-bold text-slate-700">{seg.name}</span>
                                    <div className="flex gap-3 text-slate-500">
                                        <span className="flex items-center gap-1"><Clock size={12} /> {seg.startTime} ({seg.durationHours}h)</span>
                                        <span className="flex items-center gap-1"><Users size={12} /> {seg.requiredPeople}</span>
                                    </div>
                                </div>
                            ))}
                            {(task.segments?.length || 0) > 3 && (
                                <p className="text-xs text-center text-slate-400">+{task.segments.length - 3} נוספים</p>
                            )}
                        </div>

                    </div>
                ))}
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={resetForm}
                title={editId ? 'עריכת משימה' : 'הוספת משימה חדשה'}
                size="lg"
            >
                <div className="space-y-6">
                    {/* Task General Settings */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">שם המשימה</label>
                            <input value={name} onChange={e => setName(e.target.value)} className="w-full p-2 rounded-lg border border-slate-300" placeholder="לדוגמה: סיור בוקר" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-2">צבע</label>
                            <div className="flex gap-2">
                                {COLORS.map(c => (
                                    <button key={c} onClick={() => setSelectedColor(c)} className={`w-6 h-6 rounded-full ${c.replace('border-l-', 'bg-')} ${selectedColor === c ? 'ring-2 ring-offset-2 ring-slate-400' : ''}`} />
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">רמת קושי ({difficulty})</label>
                            <input type="range" value={difficulty} onChange={e => setDifficulty(Number(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg mt-2 accent-idf-yellow" min="1" max="5" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">תאריך התחלה</label>
                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-2 rounded-lg border border-slate-300 text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">תאריך סיום</label>
                                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-2 rounded-lg border border-slate-300 text-sm" />
                            </div>
                        </div>
                    </div>

                    {/* Segments Management */}
                    <div className="border-t border-slate-100 pt-4">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                <Layers size={16} /> תבניות שיבוץ (Segments)
                            </h3>
                            <button
                                onClick={() => { setEditingSegment(undefined); setShowSegmentEditor(true); }}
                                className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg border border-dashed border-blue-200 flex items-center gap-1"
                            >
                                <Plus size={14} /> הוסף מקטע
                            </button>
                        </div>

                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                            {segments.length === 0 ? (
                                <p className="text-center text-xs text-slate-400 py-4 italic bg-slate-50 rounded-lg">לא הוגדרו מקטעים. לחץ על "הוסף מקטע" כדי להתחיל.</p>
                            ) : (
                                segments.map((seg, idx) => (
                                    <div key={seg.id || idx} className="flex justify-between items-center bg-white border border-slate-200 p-3 rounded-lg hover:border-blue-300 transition-colors group">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-sm text-slate-800">{seg.name}</span>
                                                <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500">
                                                    {seg.frequency === 'daily' ? 'יומי' : seg.frequency === 'weekly' ? 'שבועי' : 'תאריך'}
                                                </span>
                                            </div>
                                            <div className="text-xs text-slate-500 mt-1 flex gap-3">
                                                <span className="flex items-center gap-1"><Clock size={12} /> {seg.startTime} ({seg.durationHours}h)</span>
                                                <span className="flex items-center gap-1"><Users size={12} /> {seg.requiredPeople} חיילים</span>
                                            </div>
                                        </div>

                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleDuplicateSegment(seg)} className="p-1.5 hover:bg-green-50 text-green-600 rounded" title="שכפל מקטע"><Copy size={14} /></button>
                                            <button onClick={() => { setEditingSegment(seg); setShowSegmentEditor(true); }} className="p-1.5 hover:bg-blue-50 text-blue-600 rounded"><Pencil size={14} /></button>
                                            <button onClick={() => handleDeleteSegment(seg.id)} className="p-1.5 hover:bg-red-50 text-red-600 rounded"><Trash2 size={14} /></button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                        <button onClick={resetForm} className="px-3 md:px-5 py-1.5 md:py-2 text-slate-500 hover:bg-slate-100 rounded-full text-sm font-medium">ביטול</button>
                        <button onClick={handleSubmit} className="px-4 md:px-6 py-1.5 md:py-2 bg-idf-yellow text-slate-900 rounded-full font-bold text-sm md:text-base">
                            {editId ? 'עדכן משימה' : 'שמור משימה'}
                        </button>
                    </div>
                </div>
            </Modal>

            <SegmentEditor
                isOpen={showSegmentEditor}
                onClose={() => setShowSegmentEditor(false)}
                onSave={handleSaveSegment}
                initialSegment={editingSegment}
                roles={roles}
                taskId={editId || 'temp'}
            />
        </div>
    );
};
