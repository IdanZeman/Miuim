import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { SystemMessage, Team, Role, Poll } from '../../types';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { CircleNotch as Loader2, Plus, Trash as Trash2, PencilSimple as Edit2, FloppyDisk as Save, Megaphone, CheckCircle, XCircle, Users, ArrowRight, ChartBar } from '@phosphor-icons/react';
import { format } from 'date-fns';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { useConfirmation } from '../../hooks/useConfirmation';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';
import { DashboardSkeleton } from '../../components/ui/DashboardSkeleton';
import { FloatingActionButton } from '../../components/ui/FloatingActionButton';
import { useTacticalDelete } from '../../hooks/useTacticalDelete';
import { TacticalDeleteStyles } from '../../components/ui/TacticalDeleteWrapper';
// PollsManager import removed - now a top-level tab in OrganizationSettings
// import { PollsManager } from './PollsManager';
// Assuming Tabs are available based on other similar managers, if not we will use a simple state
// import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';

interface Props {
    teams: Team[];
    roles?: Role[];
}

export const OrganizationMessagesManager: React.FC<Props> = ({ teams, roles = [] }) => {
    // Use all teams - technical IDs might be strings or UUIDs
    const validTeams = teams;
    const { organization } = useAuth();
    const { showToast } = useToast();
    const { confirm, modalProps } = useConfirmation();
    const [messages, setMessages] = useState<SystemMessage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Tactical Delete Hook
    const { handleTacticalDelete, isAnimating } = useTacticalDelete<string>(
        async (id: string) => {
            const { error } = await supabase
                .from('system_messages')
                .delete()
                .eq('id', id);

            if (error) throw error;
            showToast('ההודעה נמחקה בהצלחה', 'success');
            setMessages(prev => prev.filter(m => m.id !== id));
        },
        1300
    );

    // Form State
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [targetTeams, setTargetTeams] = useState<string[]>([]);
    const [targetRoles, setTargetRoles] = useState<string[]>([]);
    // messageType removed - always BULLETIN for org messages

    useEffect(() => {
        if (organization) {
            fetchMessages();
        }
    }, [organization]);

    const fetchMessages = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('system_messages')
                .select('*')
                .eq('organization_id', organization?.id)
                .eq('message_type', 'BULLETIN') // Only bulletins for org messages
                .order('created_at', { ascending: false });

            if (error) throw error;
            setMessages(data || []);
        } catch (error) {
            console.error('Error fetching messages:', error);
            showToast('שגיאה בטעינת הודעות', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!message.trim()) {
            showToast('חובה להזין תוכן להודעה', 'error');
            return;
        }

        try {
            const payload = {
                organization_id: organization?.id,
                title,
                message,
                is_active: isActive,
                target_team_ids: targetTeams.length > 0 ? targetTeams : null,
                target_role_ids: targetRoles.length > 0 ? targetRoles : null,
                message_type: 'BULLETIN' // Force BULLETIN for org messages
            };

            if (editingId) {
                const { error } = await supabase
                    .from('system_messages')
                    .update(payload)
                    .eq('id', editingId);
                if (error) throw error;
                showToast('ההודעה עודכנה בהצלחה', 'success');
            } else {
                const { error } = await supabase
                    .from('system_messages')
                    .insert(payload);
                if (error) throw error;
                showToast('ההודעה נוצרה בהצלחה', 'success');
            }

            resetForm();
            fetchMessages();
        } catch (error) {
            console.error('Error saving message:', error);
            showToast('שגיאה בשמירת ההודעה', 'error');
        }
    };

    const handleEdit = (msg: SystemMessage) => {
        setEditingId(msg.id);
        setTitle(msg.title || '');
        setMessage(msg.message);
        setIsActive(msg.is_active);
        setTargetTeams(msg.target_team_ids || []);
        setTargetRoles(msg.target_role_ids || []);
        setIsEditing(true);
    };

    const resetForm = () => {
        setEditingId(null);
        setTitle('');
        setMessage('');
        setIsActive(true);
        setTargetTeams([]);
        setTargetRoles([]);
        setIsEditing(false);
    };

    const toggleTeam = (teamId: string) => {
        setTargetTeams(prev => prev.includes(teamId) ? prev.filter(id => id !== teamId) : [...prev, teamId]);
    };

    const toggleRole = (roleId: string) => {
        setTargetRoles(prev => prev.includes(roleId) ? prev.filter(id => id !== roleId) : [...prev, roleId]);
    };

    const handleToggleActive = async (id: string, currentStatus: boolean) => {
        try {
            const { error } = await supabase
                .from('system_messages')
                .update({ is_active: !currentStatus })
                .eq('id', id);

            if (error) throw error;
            showToast(`ההודעה ${!currentStatus ? 'הופעלה' : 'כובתה'} בהצלחה`, 'success');
            setMessages(prev => prev.map(m => m.id === id ? { ...m, is_active: !currentStatus } : m));
        } catch (error) {
            console.error('Error toggling message status:', error);
            showToast('שגיאה בשינוי סטטוס ההודעה', 'error');
        }
    };

    return (
        <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] border border-slate-200/60 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-6rem)] md:h-[calc(100vh-8rem)] relative z-20">
            {/* Premium Header */}
            <div className="flex flex-col md:flex-row items-center justify-between px-6 py-6 md:px-8 md:h-24 bg-white border-b border-slate-100 shrink-0 gap-4">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-sm shadow-blue-100">
                        <Megaphone size={24} weight="bold" />
                    </div>
                    <div>
                        <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-none">הודעות ועדכונים</h2>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 flex flex-col overflow-hidden m-0 p-0">
                    {isLoading ? (
                        <DashboardSkeleton />
                    ) : messages.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                            <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-3xl flex items-center justify-center mb-4">
                                <Megaphone size={40} weight="bold" />
                            </div>
                            <h3 className="text-lg font-black text-slate-800 mb-2">אין הודעות פעילות</h3>
                            <p className="text-slate-500 max-w-xs mb-8">
                                עדיין לא נוצרו הודעות במערכת. צור את ההודעה הראשונה כדי לעדכן את כולם.
                            </p>
                            <Button
                                onClick={() => setIsEditing(true)}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-black px-8 py-4 rounded-2xl shadow-lg shadow-blue-200 h-auto"
                            >
                                <Plus size={20} weight="bold" className="ml-2" />
                                צור הודעה חדשה
                            </Button>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-hidden">
                            <div className="overflow-x-auto h-full shadow-inner bg-slate-50/30">
                                <table className="w-full text-right border-collapse min-w-[800px]">
                                    <thead className="sticky top-0 z-10 bg-white/80 backdrop-blur-md shadow-sm">
                                        <tr className="border-b border-slate-100">
                                            <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">סטטוס</th>
                                            <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">כותרת ותוכן</th>
                                            <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">סוג</th>
                                            <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">יעד</th>
                                            <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">נצפה על ידי</th>
                                            <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">פעולות</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100/50">
                                        {messages.map((msg) => (
                                            <tr key={msg.id} className="group hover:bg-white transition-all bg-transparent">
                                                <td className="px-6 py-6" data-label="סטטוס">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-2 h-2 rounded-full ${msg.is_active ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-slate-300'}`} />
                                                        <span className={`text-xs font-bold ${msg.is_active ? 'text-green-600' : 'text-slate-400'}`}>
                                                            {msg.is_active ? 'פעיל' : 'כבוי'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-6" data-label="כותרת ותוכן">
                                                    <div className="max-w-md">
                                                        <h4 className="font-bold text-slate-800 text-sm mb-1 group-hover:text-blue-600 transition-colors">{msg.title || 'ללא כותרת'}</h4>
                                                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{msg.message}</p>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-6" data-label="סוג">
                                                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${msg.message_type === 'POPUP' ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
                                                        {msg.message_type === 'POPUP' ? 'פופאפ' : 'לוח מודעות'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-6" data-label="יעד">
                                                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                                                        {!msg.target_team_ids?.length && !msg.target_role_ids?.length && (
                                                            <span className="text-[10px] font-bold text-slate-400">כולם</span>
                                                        )}
                                                        {msg.target_team_ids?.map(tid => {
                                                            const team = teams.find(t => t.id === tid);
                                                            return team ? (
                                                                <span key={tid} className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md flex items-center gap-1">
                                                                    <Users size={10} /> {team.name}
                                                                </span>
                                                            ) : null;
                                                        })}
                                                        {msg.target_role_ids?.map(rid => {
                                                            const role = roles.find(r => r.id === rid);
                                                            return role ? (
                                                                <span key={rid} className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md">
                                                                    {role.name}
                                                                </span>
                                                            ) : null;
                                                        })}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-6" data-label="צפיות">
                                                    <div className="flex items-center gap-1.5 text-slate-500 font-bold">
                                                        <div className="text-slate-800">0</div>
                                                        <div className="text-[10px] text-slate-400 uppercase tracking-tighter">צפיות</div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-6 text-left">
                                                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => handleEdit(msg)}
                                                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                                                            title="ערוך"
                                                        >
                                                            <Edit2 size={18} weight="bold" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleToggleActive(msg.id, msg.is_active)}
                                                            className={`p-2 rounded-xl transition-all ${msg.is_active ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50' : 'text-slate-400 hover:text-green-600 hover:bg-green-50'}`}
                                                            title={msg.is_active ? 'כבה' : 'הפעל'}
                                                        >
                                                            {msg.is_active ? <XCircle size={18} weight="bold" /> : <CheckCircle size={18} weight="bold" />}
                                                        </button>
                                                        <button
                                                            onClick={() => handleTacticalDelete(msg.id)}
                                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                                            title="מחק"
                                                        >
                                                            <Trash2 size={18} weight="bold" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <FloatingActionButton
                icon={Plus}
                onClick={() => { resetForm(); setIsEditing(true); }}
                ariaLabel="פעולה חדשה"
            />

            <Modal
                isOpen={isEditing}
                onClose={resetForm}
                title={editingId ? 'עריכת הודעה' : 'הודעה חדשה'}
                size="lg"
                footer={
                    <div className="flex gap-3 w-full justify-between">
                        {editingId && (
                            <Button variant="ghost" className="text-red-500 hover:bg-red-50 hover:text-red-600 font-bold" onClick={() => { handleTacticalDelete(editingId); resetForm(); }}>
                                <Trash2 size={18} weight="bold" className="mr-2" /> מחק
                            </Button>
                        )}
                        <div className="flex gap-3 mr-auto">
                            <Button variant="ghost" onClick={resetForm} className="font-bold text-slate-500">ביטול</Button>
                            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white font-black px-8 shadow-lg shadow-blue-200">
                                {editingId ? 'שמור שינויים' : 'צור הודעה'}
                            </Button>
                        </div>
                    </div>
                }
            >
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Input
                            label="כותרת ההודעה"
                            value={title}
                            onChange={(val) => setTitle(typeof val === 'string' ? val : val.target.value)}
                            placeholder="למשל: עדכון לו''ז שבועי"
                            required
                        />
                        {/* Message type removed - always BULLETIN for organization messages */}
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest block pr-1">תוכן ההודעה</label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="הקלד כאן את תוכן ההודעה..."
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm min-h-[120px] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-slate-300"
                            required
                        />
                    </div>


                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
                                <Users size={18} weight="bold" className="text-blue-500" />
                                מי קהל היעד?
                            </h4>
                            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full uppercase">הגדרת הרשאות</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pr-1">לפי צוותים</label>
                                <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                    {teams.map(team => (
                                        <button
                                            key={team.id}
                                            type="button"
                                            onClick={() => toggleTeam(team.id)}
                                            className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all active:scale-95 ${targetTeams.includes(team.id)
                                                ? 'bg-blue-500 border-blue-600 text-white shadow-md shadow-blue-500/20'
                                                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                                }`}
                                        >
                                            {team.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pr-1">לפי תפקידים</label>
                                <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                    {roles.map(role => (
                                        <button
                                            key={role.id}
                                            type="button"
                                            onClick={() => toggleRole(role.id)}
                                            className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all active:scale-95 ${targetRoles.includes(role.id)
                                                ? 'bg-indigo-500 border-indigo-600 text-white shadow-md shadow-indigo-500/20'
                                                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                                }`}
                                        >
                                            {role.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </Modal>

            <ConfirmationModal {...modalProps} />
            <TacticalDeleteStyles />
        </div>
    );
};
