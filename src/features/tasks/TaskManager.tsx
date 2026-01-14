import React, { useState } from 'react';
import { TaskTemplate, Role, SchedulingSegment, Team } from '@/types';
import { CheckSquare, Plus, PencilSimple as Pencil, Trash, Copy, Stack as Layers, Clock, Users, CalendarBlank as Calendar, DotsThreeVertical as MoreVertical, Globe, ArrowsClockwise, Info } from '@phosphor-icons/react';
import { useToast } from '@/contexts/ToastContext';
import { GenericModal } from '@/components/ui/GenericModal';
import { PageInfo } from '@/components/ui/PageInfo';
import { useAuth } from '@/features/auth/AuthContext';
import { SegmentEditor } from './SegmentEditor';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { FloatingActionButton } from '@/components/ui/FloatingActionButton';
import { DatePicker } from '@/components/ui/DatePicker';
import { logger } from '@/services/loggingService';
import { cn } from '@/lib/utils';

interface TaskManagerProps {
    tasks: TaskTemplate[];
    roles: Role[];
    teams: Team[];
    onAddTask: (task: TaskTemplate) => void;
    onUpdateTask: (task: TaskTemplate) => void;
    onDeleteTask: (id: string) => void;
    isViewer?: boolean;
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
    onDeleteTask,
    isViewer = false
}) => {
    const { checkAccess } = useAuth();
    const canEdit = !isViewer && checkAccess('tasks', 'edit');

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
    const [is247, setIs247] = useState(false);

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
        setIs247(false);
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
        setIs247(task.is247 || false);
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
        logger.log({
            action: 'CREATE',
            entityType: 'task',
            entityId: newTask.id,
            entityName: newTask.name,
            newData: newTask,
            actionDescription: `Duplicated task ${task.name} to ${newTask.name}`,
            category: 'data'
        });
        showToast('המשמרת שוכפלה בהצלחה', 'success');
    };

    const handleSubmit = () => {
        if (!name) {
            showToast('נא להזין שם משימה', 'error');
            return;
        }

        if (is247 && segments.length > 1) {
            showToast('משימה במצב 24/7 יכולה להכיל מקטע אחד בלבד', 'error');
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
            is247: is247
        };

        if (editId) {
            const oldTask = tasks.find(t => t.id === editId);
            onUpdateTask(taskData);
            logger.logUpdate('task', taskId, name, oldTask, taskData);
            showToast('המשימה עודכנה בהצלחה', 'success');
        } else {
            onAddTask(taskData);
            logger.logCreate('task', taskId, name, taskData);
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
        <div className="bg-white rounded-[2rem] shadow-xl md:shadow-portal border border-slate-100 min-h-[600px] relative pb-20 md:pb-6 overflow-hidden">
            <div className="flex flex-col md:flex-row justify-between items-center p-4 md:p-6 border-b border-slate-100 gap-4 sticky top-0 bg-white z-10 transition-shadow">
                <h2 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2 md:gap-3">
                    <span className="bg-blue-50 p-2 rounded-lg text-blue-600"><CheckSquare size={20} weight="duotone" /></span>
                    ניהול משימות
                    <PageInfo
                        title="ניהול משימות ומשמרות"
                        description={
                            <>
                                <p className="mb-2">כאן מגדירים את סוגי המשמרות והמשימות בפלוגה.</p>
                                <p className="text-sm font-bold mb-1">עבור כל משימה ניתן לקבוע:</p>
                                <ul className="list-disc list-inside space-y-1 mb-2 text-right text-sm">
                                    <li>שעות התחלה וסיום.</li>
                                    <li>כמות אנשים נדרשת.</li>
                                    <li>תפקידים נדרשים.</li>
                                    <li>רמת קושי וצבע תצוגה.</li>
                                </ul>
                                <p className="text-sm bg-slate-50 p-2 rounded border border-slate-100">
                                    ניתן ליצור משימות מורכבות עם מספר מקטעים (למשל: סיור בוקר, צהריים ולילה) תחת אותה הגדרה.
                                </p>
                            </>
                        }
                    />
                </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 p-4 md:p-6">
                {[...tasks].sort((a, b) => a.name.localeCompare(b.name, 'he')).map(task => (
                    <div
                        key={task.id}
                        className="group relative bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-slate-300 transition-all cursor-pointer overflow-hidden flex flex-col h-full"
                        onClick={() => canEdit && handleEditClick(task)}
                    >
                        {/* Top Color Strip */}
                        <div className={`h-2 w-full ${task.color.replace('border-l-', 'bg-')} opacity-80`}></div>

                        <div className="p-5 flex flex-col flex-1 gap-4">

                            {/* Header: Title & Actions */}
                            <div className="flex justify-between items-start gap-4">
                                <h3 className="text-xl font-black text-slate-900 leading-tight line-clamp-2 flex-1">{task.name}</h3>

                                <div className="flex items-center gap-1 -mt-1 -ml-2">
                                    {canEdit && (
                                        <div className="relative">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setOpenMenuId(openMenuId === task.id ? null : task.id);
                                                }}
                                                className={`p-2 rounded-full transition-all ${openMenuId === task.id ? 'bg-slate-100 text-slate-800' : 'text-slate-300 hover:text-slate-600 hover:bg-slate-50'}`}
                                                aria-label={`אפשרויות עבור ${task.name}`}
                                            >
                                                <MoreVertical size={20} weight="bold" />
                                            </button>

                                            {openMenuId === task.id && (
                                                <div className="absolute left-0 top-full mt-1 bg-white rounded-2xl shadow-xl border border-slate-100 py-1.5 w-40 z-20 flex flex-col animate-in zoom-in-95 origin-top-left">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDuplicateTask(task); setOpenMenuId(null); }}
                                                        className="px-4 py-2.5 text-right text-sm font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                                                    >
                                                        <Copy size={16} weight="bold" className="text-slate-400" /> שכפל
                                                    </button>
                                                    <div className="h-px bg-slate-100 my-1 mx-2" />
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onDeleteTask(task.id);
                                                            logger.logDelete('task', task.id, task.name, task);
                                                            setOpenMenuId(null);
                                                        }}
                                                        className="px-4 py-2.5 text-right text-sm font-bold text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors"
                                                    >
                                                        <Trash size={16} weight="bold" className="text-red-500" /> מחק
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Details Grid */}
                            <div className="grid grid-cols-2 gap-3 mt-auto">
                                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100/50 flex flex-col justify-center">
                                    <span className="text-[10px] uppercase font-bold text-slate-400 mb-1 tracking-wider">מקטעים</span>
                                    <div className="flex items-center gap-2 text-slate-700 font-bold">
                                        <Layers size={16} weight="duotone" className="text-blue-500" />
                                        <span className="text-sm">{task.segments?.length || 0}</span>
                                    </div>
                                </div>
                                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100/50 flex flex-col justify-center">
                                    <span className="text-[10px] uppercase font-bold text-slate-400 mb-1 tracking-wider">רמת קושי</span>
                                    <div className={`flex items-center gap-2 font-bold text-sm ${task.difficulty >= 4 ? 'text-red-600' :
                                        task.difficulty >= 2 ? 'text-orange-500' : 'text-green-600'
                                        }`}>
                                        <div className={`w-2 h-2 rounded-full shadow-sm ${task.difficulty >= 4 ? 'bg-red-500' :
                                            task.difficulty >= 2 ? 'bg-orange-500' : 'bg-green-500'
                                            }`} />
                                        {task.difficulty}
                                    </div>
                                </div>
                            </div>

                            {/* Optional: Team Badge / Info */}
                            {task.assignedTeamId ? (
                                <div className="pt-3 border-t border-slate-100 flex items-center gap-2 text-xs font-bold text-slate-600">
                                    <Users size={14} weight="duotone" className="text-slate-400 text-blue-500" />
                                    <span>צוות {teams.find(t => t.id === task.assignedTeamId)?.name}</span>
                                </div>
                            ) : (
                                <div className="pt-3 border-t border-slate-100 flex items-center gap-2 text-xs font-bold text-slate-400">
                                    <Globe size={14} weight="duotone" />
                                    <span>פתוח לכולם</span>
                                </div>
                            )}

                        </div>
                    </div>
                ))}
            </div>

            {/* FAB - Universal Add Button */}
            <FloatingActionButton
                icon={Plus}
                onClick={() => {
                    if (roles.length === 0) {
                        showToast('יש להגדיר תפקידים לפני יצירת משימות', 'error');
                        return;
                    }
                    resetForm();
                    setIsAdding(true);
                }}
                ariaLabel="הוסף משימה חדשה"
                show={canEdit}
            />

            {/* Add/Edit Task GenericModal */}
            <GenericModal
                isOpen={isModalOpen}
                onClose={resetForm}
                title={editId ? 'עריכת משימה' : 'הוספת משימה חדשה'}
                size="lg"
                footer={
                    <div className="flex gap-3 w-full">
                        {editId && (
                            <Button
                                variant="secondary"
                                onClick={() => {
                                    const taskToDup = tasks.find(t => t.id === editId);
                                    if (taskToDup) {
                                        handleDuplicateTask(taskToDup);
                                        resetForm();
                                    }
                                }}
                                className="flex-1 border-slate-200 hover:bg-slate-50 text-slate-600"
                            >
                                <Copy size={18} weight="bold" className="ml-2" />
                                שכפל
                            </Button>
                        )}
                        <Button
                            onClick={handleSubmit}
                            className={`${editId ? 'flex-[2]' : 'w-full'} bg-idf-yellow text-slate-900 hover:bg-yellow-400 font-bold shadow-md`}
                        >
                            {editId ? 'עדכן משימה' : 'צור משימה'}
                        </Button>
                    </div>
                }
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
                                                aria-label={`בחר צבע ${bgColor.replace('bg-', '')}`}
                                                aria-pressed={isSelected}
                                            >
                                                {isSelected && <CheckSquare size={14} weight="duotone" className="text-white bg-black/20 rounded" aria-hidden="true" />}
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
                                    aria-label="רמת קושי המשימה"
                                    aria-valuemin={1}
                                    aria-valuemax={5}
                                    aria-valuenow={difficulty}
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
                            <div className="px-4 py-2">
                                <DatePicker
                                    label="תאריך התחלה"
                                    value={startDate.split('T')[0]}
                                    onChange={setStartDate}
                                />
                            </div>

                            {/* End Date */}
                            <div className="px-4 py-2 border-t border-slate-100">
                                <DatePicker
                                    label="תאריך סיום"
                                    value={endDate.split('T')[0]}
                                    onChange={setEndDate}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Group 2.5: 24/7 Toggle */}
                    <div className="space-y-3">
                        <div className={cn(
                            "bg-white rounded-3xl border transition-all px-5 py-4 flex items-center justify-between cursor-pointer",
                            is247 ? "border-amber-200 shadow-md shadow-amber-50" : "border-slate-200/60 shadow-sm"
                        )}
                            onClick={() => {
                                if (!is247 && segments.length > 1) {
                                    showToast('לא ניתן להפעיל מצב 24/7 למשימה עם יותר ממקטע אחד. נא למחוק מקטעים מיותרים קודם.', 'warning');
                                    return;
                                }
                                const newval = !is247;
                                setIs247(newval);
                                // Sync existing segment isRepeat if it exists
                                if (segments.length === 1) {
                                    setSegments(prev => [{ ...prev[0], isRepeat: newval }]);
                                }
                            }}>
                            <div>
                                <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                    <ArrowsClockwise size={18} className={is247 ? "text-amber-500" : "text-slate-400"} weight="bold" />
                                    מחזור רציף (סבב 24/7)
                                </div>
                                <p className="text-[11px] font-bold text-slate-400 mt-1">יצירת רצף משמרות אוטומטי לכל אורך היממה (למשל: ש"ג)</p>
                            </div>
                            <div className={cn("w-12 h-7 rounded-full transition-all relative", is247 ? "bg-amber-500" : "bg-slate-200")}>
                                <div className={cn("absolute top-1 w-5 h-5 bg-white rounded-full transition-all shadow-sm", is247 ? "left-1" : "left-6")} />
                            </div>
                        </div>

                        {is247 && (
                            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-3 animate-in fade-in slide-in-from-top-2">
                                <Info size={20} className="text-amber-600 shrink-0" weight="bold" />
                                <div className="text-xs text-amber-800 leading-relaxed font-medium">
                                    <p className="font-bold mb-1">שים לב:</p>
                                    במצב 24/7 המערכת מייצרת רצף משמרות אוטומטי. לכן, ניתן להגדיר <strong>מקטע אחד בלבד</strong> (למשל: משמרת של 4 שעות שרצה בלופ). המערכת תדאג למלא את כל שעות היממה בהתאם למשך שהגדרת.
                                </div>
                            </div>
                        )}
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
                                                <Copy size={16} weight="bold" />
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
                                                <Trash size={16} weight="bold" />
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
                            <Plus size={18} weight="bold" />
                            הוסף מקטע / משמרת
                        </button>

                    </div>
                </div>
            </GenericModal>

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
