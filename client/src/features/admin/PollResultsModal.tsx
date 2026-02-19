import React, { useEffect, useState } from 'react';
import { Poll, PollResponse } from '../../types';
import { fetchPollResults } from '../../services/pollService';
import { Modal } from '../../components/ui/Modal';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { Star, ListBullets, TextAlignLeft, Users, Export, ChartBar, User } from '@phosphor-icons/react';
import { Button } from '../../components/ui/Button';
import { format } from 'date-fns';

interface PollResultsModalProps {
    poll: Poll | null;
    isOpen: boolean;
    onClose: () => void;
}

export const PollResultsModal: React.FC<PollResultsModalProps> = ({ poll, isOpen, onClose }) => {
    const [responses, setResponses] = useState<PollResponse[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'summary' | 'individual'>('summary');

    useEffect(() => {
        if (isOpen && poll) {
            loadResults();
        }
    }, [isOpen, poll]);

    const loadResults = async () => {
        if (!poll) return;
        setIsLoading(true);
        try {
            const data = await fetchPollResults(poll.id);
            setResponses(data);
        } catch (error) {
            console.error('Error fetching poll results:', error);
        } finally {
            setIsLoading(false);
        }
    };

    if (!poll) return null;

    const renderQuestionResults = (question: any) => {
        const questionResponses = responses.map(r => r.responses[question.id]).filter(v => v !== undefined && v !== null);

        if (question.type === 'rating') {
            const sum = questionResponses.reduce((acc: number, val: any) => acc + (Number(val) || 0), 0);
            const avg = questionResponses.length > 0 ? (sum / questionResponses.length).toFixed(1) : 0;

            // Distribution
            const distribution = [1, 2, 3, 4, 5].map(star => ({
                name: `${star} כוכבים`,
                count: questionResponses.filter(v => Number(v) === star).length
            }));

            return (
                <div className="space-y-4">
                    <div className="flex items-center gap-4">
                        <div className="text-4xl font-black text-indigo-600">{avg}</div>
                        <div>
                            <div className="flex text-amber-400">
                                {[1, 2, 3, 4, 5].map(s => (
                                    <Star key={s} size={20} weight={s <= Math.round(Number(avg)) ? 'fill' : 'bold'} />
                                ))}
                            </div>
                            <div className="text-xs text-slate-400 font-bold uppercase mt-1">ממוצע דירוג ({questionResponses.length} תגובות)</div>
                        </div>
                    </div>
                    <div className="h-48 w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={distribution} layout="vertical" margin={{ left: 20 }}>
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={80} style={{ fontSize: '10px', fontWeight: 'bold' }} />
                                <Tooltip cursor={{ fill: 'transparent' }} />
                                <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            );
        }

        if (question.type === 'choice') {
            const data = (question.options || []).map((opt: string) => ({
                name: opt,
                value: questionResponses.filter(v => v === opt).length
            }));

            return (
                <div className="space-y-4">
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="name"
                                    angle={-45}
                                    textAnchor="end"
                                    interval={0}
                                    height={60}
                                    style={{ fontSize: '10px', fontWeight: 'bold' }}
                                />
                                <YAxis allowDecimals={false} style={{ fontSize: '10px' }} />
                                <Tooltip />
                                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                    {data.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316'][index % 5]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {data.map((d, i) => (
                            <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <span className="text-xs font-bold text-slate-700 truncate mr-2">{d.name}</span>
                                <span className="text-xs font-black text-indigo-600 shrink-0">{d.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        if (question.type === 'text') {
            return (
                <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar pr-2">
                    {questionResponses.length === 0 ? (
                        <p className="text-sm text-slate-400 italic py-4">אין תגובות עדיין</p>
                    ) : (
                        questionResponses.map((val: any, i) => (
                            <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-sm text-slate-700 leading-relaxed shadow-sm">
                                {val}
                            </div>
                        ))
                    )}
                </div>
            );
        }

        return null;
    };

    const renderIndividualResponses = () => {
        return (
            <div className="space-y-4">
                {responses.map((response, idx) => (
                    <div key={response.id} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-100">
                            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-blue-600 text-white rounded-xl flex items-center justify-center font-black shrink-0">
                                {idx + 1}
                            </div>
                            <div className="flex-1">
                                <div className="font-black text-slate-800">{response.user_name || 'משתמש אנונימי'}</div>
                                {response.user_email && (
                                    <div className="text-xs text-indigo-600 font-bold">{response.user_email}</div>
                                )}
                                <div className="text-xs text-slate-400 font-bold">
                                    {format(new Date(response.created_at), 'dd/MM/yyyy HH:mm')}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {poll.config.map((question, qIdx) => {
                                const answer = response.responses[question.id];
                                if (answer === undefined || answer === null) return null;

                                return (
                                    <div key={question.id} className="p-3 bg-slate-50 rounded-xl">
                                        <div className="text-xs font-black text-slate-500 uppercase tracking-wider mb-1">
                                            שאלה {qIdx + 1}: {question.question}
                                        </div>
                                        <div className="text-sm font-bold text-slate-800">
                                            {question.type === 'rating' ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="flex text-amber-400">
                                                        {[1, 2, 3, 4, 5].map(s => (
                                                            <Star key={s} size={16} weight={s <= Number(answer) ? 'fill' : 'bold'} />
                                                        ))}
                                                    </div>
                                                    <span className="text-indigo-600">({answer}/5)</span>
                                                </div>
                                            ) : (
                                                <span>{answer}</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
                {responses.length === 0 && (
                    <div className="text-center py-12 text-slate-400">
                        <Users size={48} className="mx-auto mb-3 opacity-20" />
                        <p className="font-bold">אין תגובות עדיין</p>
                    </div>
                )}
            </div>
        );
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={poll.title}
            size="xl"
            footer={
                <div className="flex justify-between w-full items-center">
                    <div className="flex items-center gap-2 text-slate-400">
                        <Users size={20} />
                        <span className="text-xs font-bold uppercase tracking-widest">{responses.length} משתתפים סה"כ</span>
                    </div>
                    <Button variant="primary" onClick={onClose} className="font-black">סגור</Button>
                </div>
            }
        >

            <div className="flex gap-2 mb-6 p-1 bg-slate-100 rounded-xl">
                <button
                    onClick={() => setActiveTab('summary')}
                    className={`flex-1 py-3 px-4 rounded-lg font-black text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'summary'
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    <ChartBar size={18} weight="bold" />
                    סיכום ותוצאות
                </button>
                <button
                    onClick={() => setActiveTab('individual')}
                    className={`flex-1 py-3 px-4 rounded-lg font-black text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'individual'
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    <User size={18} weight="bold" />
                    תגובות בודדות
                </button>
            </div>


            {activeTab === 'summary' ? (
                <div className="space-y-12 py-4">
                    {poll.config.map((q, idx) => (
                        <div key={q.id} className="animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
                            <div className="flex items-start gap-4 mb-6">
                                <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black shrink-0">
                                    {idx + 1}
                                </div>
                                <div>
                                    <h4 className="text-lg font-black text-slate-800 leading-tight mb-1">{q.question}</h4>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            {q.type === 'rating' ? 'דירוג' : q.type === 'choice' ? 'בחירה' : 'טקסט חופשי'}
                                        </span>
                                        {q.required && (
                                            <span className="text-[10px] font-black text-red-400 uppercase tracking-widest bg-red-50 px-2 py-0.5 rounded-full border border-red-100">חובה</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
                                {renderQuestionResults(q)}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="py-4">
                    {renderIndividualResponses()}
                </div>
            )}
        </Modal>
    );
};
