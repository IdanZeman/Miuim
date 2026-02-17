import React, { useState, useEffect } from 'react';
import { Poll, PollQuestion, PollQuestionType } from '../../types';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
    Plus, Trash, PencilSimple as Edit2,
    ChartBar, ListBullets, Star, TextAlignLeft,
    CheckCircle, XCircle
} from '@phosphor-icons/react';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { fetchPolls, addPoll, updatePoll } from '../../services/pollService';
import { DashboardSkeleton } from '../../components/ui/DashboardSkeleton';
import { FloatingActionButton } from '../../components/ui/FloatingActionButton';
import { PollResultsModal } from './PollResultsModal';

export const PollsManager: React.FC = () => {
    const { organization, user } = useAuth();
    const { showToast } = useToast();
    const [polls, setPolls] = useState<Poll[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [viewingResultsPoll, setViewingResultsPoll] = useState<Poll | null>(null);

    // Form State
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [questions, setQuestions] = useState<PollQuestion[]>([]);

    useEffect(() => {
        if (organization) {
            loadPolls();
        }
    }, [organization]);

    const loadPolls = async () => {
        setIsLoading(true);
        try {
            const data = await fetchPolls(organization!.id);
            setPolls(data);
        } catch (error) {
            console.error('Error fetching polls:', error);
            showToast('שגיאה בטעינת סקרים', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!title.trim() || questions.length === 0) {
            showToast('חובה להזין כותרת ולפחות שאלה אחת', 'error');
            return;
        }

        try {
            const payload = {
                organization_id: organization!.id,
                title,
                description,
                is_active: isActive,
                config: questions,
                created_by: user?.id
            };

            if (editingId) {
                await updatePoll(editingId, payload);
                showToast('הסקר עודכן בהצלחה', 'success');
            } else {
                await addPoll(payload);
                showToast('הסקר נוצר בהצלחה', 'success');
            }

            resetForm();
            loadPolls();
        } catch (error) {
            console.error('Error saving poll:', error);
            showToast('שגיאה בשמירת הסקר', 'error');
        }
    };

    const handleEdit = (poll: Poll) => {
        setEditingId(poll.id);
        setTitle(poll.title);
        setDescription(poll.description || '');
        setIsActive(poll.is_active);
        setQuestions(poll.config || []);
        setIsEditing(true);
    };

    const resetForm = () => {
        setEditingId(null);
        setTitle('');
        setDescription('');
        setIsActive(true);
        setQuestions([]);
        setIsEditing(false);
    };

    const addQuestion = (type: PollQuestionType) => {
        const newQuestion: PollQuestion = {
            id: Math.random().toString(36).substr(2, 9),
            type,
            question: '',
            required: true,
            options: type === 'choice' ? ['אפשרות 1', 'אפשרות 2'] : undefined
        };
        setQuestions([...questions, newQuestion]);
    };

    const removeQuestion = (id: string) => {
        setQuestions(questions.filter(q => q.id !== id));
    };

    const updateQuestionText = (id: string, text: string) => {
        setQuestions(questions.map(q => q.id === id ? { ...q, question: text } : q));
    };

    const toggleRequired = (id: string) => {
        setQuestions(questions.map(q => q.id === id ? { ...q, required: !q.required } : q));
    };

    const updateOption = (qId: string, optIndex: number, val: string) => {
        setQuestions(questions.map(q => {
            if (q.id === qId && q.options) {
                const newOpts = [...q.options];
                newOpts[optIndex] = val;
                return { ...q, options: newOpts };
            }
            return q;
        }));
    };

    const addOption = (qId: string) => {
        setQuestions(questions.map(q => {
            if (q.id === qId && q.options) {
                return { ...q, options: [...q.options, `אפשרות ${q.options.length + 1}`] };
            }
            return q;
        }));
    };

    return (
        <div className="bg-white rounded-[2rem] border border-slate-200/60 shadow-sm overflow-hidden flex flex-col h-full">
            <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-sm">
                        <ChartBar size={24} weight="bold" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">ניהול סקרים</h2>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Polls Management</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/50 p-6">
                {isLoading ? (
                    <DashboardSkeleton />
                ) : polls.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-20 h-20 bg-slate-100 text-slate-300 rounded-3xl flex items-center justify-center mb-4">
                            <ChartBar size={40} weight="bold" />
                        </div>
                        <h3 className="text-lg font-black text-slate-800">אין סקרים פעילים</h3>
                        <p className="text-slate-500 mb-8 max-w-xs">צור סקר כדי לקבל משוב מהמשתמשים</p>
                        <Button onClick={() => setIsEditing(true)} className="bg-amber-400 text-slate-900 font-black shadow-xl shadow-amber-400/20" icon={Plus}>צור סקר חדש</Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {polls.map(poll => (
                            <div key={poll.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden">
                                <div className={`absolute top-0 right-0 w-1.5 h-full ${poll.is_active ? 'bg-green-400' : 'bg-slate-200'}`} />
                                <div className="flex justify-between items-start mb-4 pr-3">
                                    <div>
                                        <h4 className="font-black text-slate-800 text-lg">{poll.title}</h4>
                                        <span className="text-[10px] text-slate-400 font-bold uppercase">{poll.config.length} שאלות</span>
                                    </div>
                                    <button onClick={() => handleEdit(poll)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors">
                                        <Edit2 size={20} weight="bold" />
                                    </button>
                                </div>
                                <p className="text-slate-500 text-sm line-clamp-2 mb-6 pr-3">{poll.description || 'אין תיאור'}</p>
                                <div className="flex items-center gap-2 pr-3 mt-auto">
                                    {poll.is_active ? (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-green-50 text-green-600 border border-green-100 uppercase">
                                            <CheckCircle size={12} weight="fill" /> פעיל
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-slate-100 text-slate-500 border border-slate-200 uppercase">
                                            <XCircle size={12} weight="fill" /> לא פעיל
                                        </span>
                                    )}

                                    <button
                                        onClick={() => setViewingResultsPoll(poll)}
                                        className="ml-auto p-2 flex items-center gap-2 text-[10px] font-black text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all uppercase"
                                    >
                                        <ChartBar size={16} weight="bold" />
                                        צפה בתוצאות
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <PollResultsModal
                poll={viewingResultsPoll}
                isOpen={!!viewingResultsPoll}
                onClose={() => setViewingResultsPoll(null)}
            />

            <FloatingActionButton icon={Plus} onClick={() => { resetForm(); setIsEditing(true); }} ariaLabel="צור סקר חדש" />

            <Modal
                isOpen={isEditing}
                onClose={resetForm}
                title={editingId ? 'עריכת סקר' : 'סקר חדש'}
                size="xl"
                footer={
                    <div className="flex gap-3 justify-end w-full">
                        <Button variant="ghost" onClick={resetForm} className="font-black">ביטול</Button>
                        <Button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-8 shadow-lg shadow-indigo-200">
                            {editingId ? 'שמור שינויים' : 'צור סקר'}
                        </Button>
                    </div>
                }
            >
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1 space-y-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">כותרת הסקר</label>
                            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="למשל: סקר חווית שימוש" className="bg-slate-50 font-bold" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">תיאור (אופציונלי)</label>
                            <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl h-32 text-sm" placeholder="ספר למשתמשים על מה הסקר..." />
                        </div>
                        <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                            <div className={`w-10 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${isActive ? 'bg-green-500' : 'bg-slate-300'}`} onClick={() => setIsActive(!isActive)}>
                                <div className={`bg-white w-4 h-4 rounded-full transform transition-transform ${isActive ? 'translate-x-[-16px]' : ''}`} />
                            </div>
                            <span className="text-sm font-bold text-slate-700">סקר פעיל</span>
                        </div>

                        <div className="pt-6 border-t border-slate-100">
                            <h4 className="text-xs font-bold text-slate-500 uppercase mb-4">הוספות שאלה</h4>
                            <div className="grid grid-cols-2 gap-2">
                                <Button onClick={() => addQuestion('rating')} variant="outline" className="text-xs font-bold" icon={Star}>דירוג</Button>
                                <Button onClick={() => addQuestion('choice')} variant="outline" className="text-xs font-bold" icon={ListBullets}>בחירה</Button>
                                <Button onClick={() => addQuestion('text')} variant="outline" className="text-xs font-bold" icon={TextAlignLeft}>טקסט חופשי</Button>
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-2 bg-slate-50 rounded-[2rem] p-6 min-h-[400px]">
                        <h3 className="font-black text-slate-800 mb-6 flex items-center gap-2">
                            <ListBullets size={20} weight="bold" />
                            שאלות הסקר
                        </h3>

                        {questions.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-12 text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl">
                                <p className="font-bold">טרם נוספו שאלות</p>
                                <p className="text-xs mt-1">השתמש בכפתורים מימין כדי להוסיף</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {questions.map((q, idx) => (
                                    <div key={q.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 animate-in slide-in-from-top-2">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-2">
                                                <span className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-[10px] font-black text-slate-500">
                                                    {idx + 1}
                                                </span>
                                                <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full uppercase">
                                                    {q.type === 'rating' ? 'דירוג' : q.type === 'choice' ? 'בחירה' : 'טקסט'}
                                                </span>
                                                <div
                                                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase cursor-pointer transition-all ${q.required ? 'bg-red-50 text-red-500 border border-red-100' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}
                                                    onClick={() => toggleRequired(q.id)}
                                                >
                                                    {q.required ? 'חובה' : 'רשות'}
                                                </div>
                                            </div>
                                            <button onClick={() => removeQuestion(q.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                                                <Trash size={18} weight="bold" />
                                            </button>
                                        </div>
                                        <Input
                                            value={q.question}
                                            onChange={e => updateQuestionText(q.id, e.target.value)}
                                            placeholder="הקלד את השאלה כאן..."
                                            className="bg-slate-50 border-none font-bold text-slate-800 mb-4"
                                        />

                                        {q.type === 'choice' && (
                                            <div className="space-y-2 mt-4">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase">אפשרויות בחירה</label>
                                                {q.options?.map((opt, oIdx) => (
                                                    <div key={oIdx} className="flex gap-2">
                                                        <input
                                                            value={opt}
                                                            onChange={e => updateOption(q.id, oIdx, e.target.value)}
                                                            className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs font-medium"
                                                        />
                                                    </div>
                                                ))}
                                                <button onClick={() => addOption(q.id)} className="text-[10px] font-black text-indigo-600 flex items-center gap-1 hover:underline">
                                                    <Plus size={10} weight="bold" /> הוסף אפשרות
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </Modal>
        </div>
    );
};
