import React, { useState } from 'react';
import { TaskTemplate, Role, SchedulingSegment, Team } from '../types';
import { CheckSquare, Plus, Pencil, Trash2, Copy, Layers, Clock, Users, Calendar, MoreVertical } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { SheetModal } from './ui/SheetModal';
import { Modal } from './ui/Modal';
import { useAuth } from '../contexts/AuthContext';
import { SegmentEditor } from './SegmentEditor';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Button } from './ui/Button';

interface TaskManagerProps {
    tasks: TaskTemplate[];
    roles: Role[];
    teams: Team[];
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
    teams,
    onAddTask,
    onUpdateTask,
    onDeleteTask
}) => {
    const { checkAccess } = useAuth();
    const canEdit = checkAccess('tasks', 'edit');

    const [isAdding, setIsAdding] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const { showToast } = useToast();

    // Form State
    const [name, setName] = useState('');
    const [difficulty, setDifficulty] = useState(3);
    const [selectedColor, setSelectedColor] = useState(COLORS[0]);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [assignedTeamId, setAssignedTeamId] = useState('');
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
        setAssignedTeamId('');
        setSegments([]);
    };

    const handleEditClick = (task: TaskTemplate) => {
        setEditId(task.id);
        setName(task.name);
        setDifficulty(task.difficulty);
        setSelectedColor(task.color);
        // Ensure date is YYYY-MM-DD for input[type="date"]
        setStartDate(task.startDate ? task.startDate.split('T')[0] : '');
        setEndDate(task.endDate ? task.endDate.split('T')[0] : '');
        setAssignedTeamId(task.assignedTeamId || '');
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
            assignedTeamId: assignedTeamId || undefined,
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

    const handleEditSegment = (index: number) => {
        setEditingSegment(segments[index]);
        setShowSegmentEditor(true);
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
        <div className="bg-white rounded-xl md:shadow-portal min-h-[600px] relative pb-20 md:pb-6">
            <div className="flex flex-col md:flex-row justify-between items-center p-4 md:p-6 border-b border-slate-100 gap-4 sticky top-0 bg-white z-10">
                <h2 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2 md:gap-3">
                    <span className="bg-blue-50 p-2 rounded-lg text-blue-600"><CheckSquare size={20} /></span>
                    ניהול משימות
                </h2>
                {canEdit && (
                    <Button
                        onClick={() => {
                            if (roles.length === 0) {
                                showToast('יש להגדיר תפקידים לפני יצירת משימות', 'error');
                                return;
                            }
                            resetForm();
                            setIsAdding(true);
                        }}
                        className="hidden md:flex" // Hide on mobile, use FAB
                        icon={Plus}
                        variant="primary"
                    >
                        הוסף משימה
                    </Button>
                )}
            </div>

            {/* Task List - Full Width */}
            <div className="divide-y divide-slate-100">
                {tasks.map(task => (
                    <div
                        key={task.id}
                        className="relative bg-white hover:bg-slate-50 transition-colors group select-none"
                        onClick={() => canEdit && handleEditClick(task)}
                    >
                        {/* Vertical Color Anchor (w-1 = 4px) */}
                        <div className={`absolute top-0 right-0 w-1 h-full ${task.color.replace('border-l-', 'bg-')}`}></div>

                        <div className="p-4 pr-5 flex justify-between items-center group/row">
                            <div className="min-w-0 flex-1 ml-2">
                                <h3 className="text-lg font-bold text-slate-900 truncate mb-1">{task.name}</h3>
                                <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                                    <span className="flex items-center gap-1">
                                        <Layers size={14} className="text-slate-400" />
                                        {task.segments?.length || 0} מקטעים
                                    </span>
                                    {task.assignedTeamId && (
                                        <span className="flex items-center gap-1 text-blue-600 bg-blue-50 px-2 rounded-full">
                                            צוות {teams.find(t => t.id === task.assignedTeamId)?.name}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                {/* Difficulty Badge */}
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${task.difficulty >= 4 ? 'bg-red-50 text-red-700' :
                                    task.difficulty >= 2 ? 'bg-orange-50 text-orange-700' :
                                        'bg-green-50 text-green-700'
                                    }`}>
                                    קושי {task.difficulty}
                                </span>

                                {/* Three Dots Menu */}
                                {canEdit && (
                                    <div className="relative">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setOpenMenuId(openMenuId === task.id ? null : task.id);
                                            }}
                                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                                        >
                                            <MoreVertical size={20} />
                                        </button>

                                        {openMenuId === task.id && (
                                            <div className="absolute left-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-slate-100 py-1 w-32 z-20 flex flex-col">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDuplicateTask(task); setOpenMenuId(null); }}
                                                    className="px-4 py-2 text-right text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                                >
                                                    <Copy size={14} /> שכפל
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onDeleteTask(task.id); setOpenMenuId(null); }}
                                                    className="px-4 py-2 text-right text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                                >
                                                    <Trash2 size={14} /> מחק
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* FAB - Mobile Only */}
            {canEdit && (
                <button
                    onClick={() => {
                        if (roles.length === 0) {
                            showToast('יש להגדיר תפקידים לפני יצירת משימות', 'error');
                            return;
                        }
                        resetForm();
                        setIsAdding(true);
                    }}
                    className="md:hidden fixed bottom-24 left-6 w-14 h-14 bg-idf-yellow text-slate-900 rounded-full shadow-lg hover:shadow-xl hover:bg-yellow-400 transition-all flex items-center justify-center z-30 active:scale-95"
                >
                    <Plus size={28} />
                </button>
            )}

            {/* Add/Edit Task Sheet */}
            <SheetModal
                isOpen={isModalOpen}
                onClose={resetForm}
                title={editId ? 'עריכת משימה' : 'הוספת משימה חדשה'}
                onSave={handleSubmit}
                saveLabel={editId ? 'עדכן משימה' : 'צור משימה'}
            >
                <div className="space-y-6">
                    {/* Group 1: Basic Info */}
                    <div className="space-y-2">
                        <h3 className="text-xs font-bold text-slate-500 px-2">פרטי המשימה</h3>
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
                            {/* Name Input */}
                            <div className="flex items-center px-4 py-3">
                                <div className="w-24 shrink-0 font-bold text-slate-700 text-sm">שם המשימה</div>
                                <input
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="לדוגמה: סיור בוקר"
                                    className="flex-1 bg-transparent border-none outline-none text-slate-900 text-right placeholder:text-slate-300 h-full w-full font-medium"
                                />
                            </div>

                            {/* Color Picker (Horizontal Scroll) */}
                            <div className="px-4 py-3">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="font-bold text-slate-700 text-sm">צבע תצוגה</div>
                                </div>
                                <div className="flex gap-3 overflow-x-auto no-scrollbar py-2 -mx-4 px-4 scroll-smooth">
                                    {COLORS.map(c => {
                                        const isSelected = selectedColor === c;
                                        const bgColor = c.replace('border-l-', 'bg-');
                                        return (
                                            <button
                                                key={c}
                                                onClick={() => setSelectedColor(c)}
                                                className={`w-8 h-8 rounded-full shrink-0 ${bgColor} flex items-center justify-center transition-transform ${isSelected ? 'scale-110 ring-2 ring-offset-2 ring-slate-900' : 'opacity-70 hover:opacity-100'}`}
                                            >
                                                {isSelected && <CheckSquare size={14} className="text-white bg-black/20 rounded" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Difficulty Slider */}
                            <div className="px-4 py-4">
                                <div className="flex justify-between mb-2">
                                    <span className="font-bold text-slate-700 text-sm">רמת קושי</span>
                                    <span className="font-bold text-slate-900 text-sm bg-slate-100 px-2 rounded">{difficulty}</span>
                                </div>
                                <input
                                    type="range"
                                    value={difficulty}
                                    onChange={e => setDifficulty(Number(e.target.value))}
                                    className="w-full h-2 bg-slate-100 rounded-lg accent-idf-yellow cursor-pointer"
                                    min="1"
                                    max="5"
                                />
                                <div className="flex justify-between mt-1 text-[10px] text-slate-400 font-medium">
                                    <span>קל</span>
                                    <span>בינוני</span>
                                    <span>קשה</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Group 2: Assignment & Dates */}
                    <div className="space-y-2">
                        <h3 className="text-xs font-bold text-slate-500 px-2">שיוך ותזמון</h3>
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
                            {/* Team Selector */}
                            <div className="flex items-center justify-between px-4 py-3 bg-white relative">
                                <div className="w-24 shrink-0 font-bold text-slate-700 text-sm">צוות אחראי</div>
                                <Select
                                    value={assignedTeamId}
                                    onChange={(val) => setAssignedTeamId(val)}
                                    options={[{ value: '', label: 'ללא שיוך (פתוח לכולם)' }, ...teams.map(t => ({ value: t.id, label: t.name }))]}
                                    placeholder="בחר צוות אחרי"
                                    className="bg-transparent border-none shadow-none hover:bg-slate-50 pr-0"
                                    containerClassName="flex-1"
                                    direction="top"
                                />
                            </div>

                            {/* Start Date */}
                            <div className="flex items-center px-4 py-3">
                                <div className="w-32 shrink-0 font-bold text-slate-700 text-sm">תאריך התחלה</div>
                                <input
                                    type="date"
                                    value={startDate.split('T')[0]}
                                    onChange={e => setStartDate(e.target.value)}
                                    className="flex-1 bg-transparent border-none outline-none text-slate-900 text-right font-medium"
                                />
                            </div>

                            {/* End Date */}
                            <div className="flex items-center px-4 py-3">
                                <div className="w-32 shrink-0 font-bold text-slate-700 text-sm">תאריך סיום</div>
                                <input
                                    type="date"
                                    value={endDate.split('T')[0]}
                                    onChange={e => setEndDate(e.target.value)}
                                    className="flex-1 bg-transparent border-none outline-none text-slate-900 text-right font-medium placeholder:text-slate-300"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Group 3: Segments */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-xs font-bold text-slate-500">תבניות שיבוץ (מקטעים)</h3>
                        </div>

                        {/* List of Segments */}
                        {segments.length > 0 && (
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
                                {segments.map((seg, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 active:bg-slate-50">
                                        <div className="flex-1 min-w-0" onClick={() => handleEditSegment(idx)}>
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="font-bold text-slate-800 text-sm">{seg.name}</span>
                                                <span className="text-[10px] bg-slate-100 px-1.5 rounded text-slate-500">{seg.frequency === 'daily' ? 'יומי' : seg.frequency === 'weekly' ? 'שבועי' : 'תאריך'}</span>
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-slate-500">
                                                <span>{seg.startTime}</span>
                                                <span>•</span>
                                                <span>{seg.durationHours} שעות</span>
                                                <span>•</span>
                                                <span>{seg.requiredPeople} חיילים</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const newSeg = { ...seg, id: crypto.randomUUID(), name: `${seg.name} (עותק)` };
                                                    setSegments(prev => [...prev, newSeg]);
                                                }}
                                                className="p-2 text-slate-400 hover:text-blue-500 rounded-full"
                                                title="שכפל מקטע"
                                            >
                                                <Copy size={16} />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    // Use seg.id if available, otherwise fallback might be tricky if we don't have IDs. 
                                                    // Assuming segments created have IDs.
                                                    if (seg.id) handleDeleteSegment(seg.id);
                                                }}
                                                className="p-2 text-slate-400 hover:text-red-500 rounded-full"
                                                title="מחק מקטע"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Add Segment Button - Clean separate block */}
                        <button
                            onClick={() => { setEditingSegment(undefined); setShowSegmentEditor(true); }}
                            className="w-full py-3 bg-white border border-slate-200 border-dashed rounded-xl text-blue-600 font-bold text-sm hover:bg-blue-50 hover:border-blue-300 transition-all flex items-center justify-center gap-2"
                        >
                            <Plus size={18} />
                            הוסף מקטע / משמרת
                        </button>

                    </div>
                </div>
            </SheetModal>

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
