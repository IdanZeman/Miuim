import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { SystemMessage, Team, Role } from '../../types';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { CircleNotch as Loader2, Plus, Trash as Trash2, PencilSimple as Edit2, FloppyDisk as Save, Megaphone, CheckCircle, XCircle, Users, ArrowRight } from '@phosphor-icons/react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { useConfirmation } from '@/hooks/useConfirmation';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { DashboardSkeleton } from '@/components/ui/DashboardSkeleton';
import { FloatingActionButton } from '@/components/ui/FloatingActionButton';

interface Props {
    teams: Team[];
    roles?: Role[];
}

const isValidUUID = (id: string) => {
    const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return regex.test(id);
};

export const OrganizationMessagesManager: React.FC<Props> = ({ teams, roles = [] }) => {
    // Filter out teams with temporary/invalid IDs to prevent DB errors
    const validTeams = teams.filter(t => isValidUUID(t.id));
    const { organization } = useAuth();
    const { showToast } = useToast();
    const { confirm, modalProps } = useConfirmation();
    const [messages, setMessages] = useState<SystemMessage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form State
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [targetTeams, setTargetTeams] = useState<string[]>([]);
    const [targetRoles, setTargetRoles] = useState<string[]>([]);

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
                .eq('message_type', 'BULLETIN')
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
                message_type: 'BULLETIN'
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

    const handleDelete = async (id: string) => {
        confirm({
            title: 'מחיקת הודעה',
            message: 'האם אתה בטוח שברצונך למחוק הודעה זו?',
            confirmText: 'מחק',
            type: 'danger',
            onConfirm: async () => {
                try {
                    const { error } = await supabase
                        .from('system_messages')
                        .delete()
                        .eq('id', id);

                    if (error) throw error;
                    showToast('ההודעה נמחקה בהצלחה', 'success');
                    setMessages(prev => prev.filter(m => m.id !== id));
                } catch (error) {
                    console.error('Error deleting message:', error);
                    showToast('שגיאה במחיקת ההודעה', 'error');
                }
            }
        });
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
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Bulletin Board</p>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative flex flex-col">
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
                            className="bg-amber-400 text-slate-900 shadow-xl shadow-amber-400/20 hover:bg-amber-500 rounded-xl px-8 h-12 font-black"
                            icon={Plus}
                            iconWeight="bold"
                        >
                            צור הודעה חדשה
                        </Button>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/50">
                        {/* Mobile List View */}
                        <div className="md:hidden p-4 space-y-4">
                            {messages.map(msg => (
                                <div key={msg.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 relative group overflow-hidden">
                                    <div className={`absolute top-0 right-0 w-1.5 h-full ${msg.is_active ? 'bg-green-400' : 'bg-slate-200'}`} />

                                    <div className="flex justify-between items-start mb-3 pr-3">
                                        <div>
                                            {msg.title && <h3 className="font-black text-slate-800 text-lg mb-1">{msg.title}</h3>}
                                            <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-full border border-slate-100">
                                                {format(new Date(msg.created_at), 'dd/MM/yyyy')}
                                            </span>
                                        </div>
                                        <div className="flex gap-1">
                                            <button onClick={() => handleEdit(msg)} className="w-8 h-8 flex items-center justify-center bg-blue-50 text-blue-600 rounded-lg">
                                                <Edit2 size={16} weight="bold" />
                                            </button>
                                        </div>
                                    </div>

                                    <p className="text-slate-600 text-sm leading-relaxed mb-4 pr-3 whitespace-pre-wrap">
                                        {msg.message}
                                    </p>

                                    <div className="flex gap-2 pr-3 overflow-x-auto pb-1 hide-scrollbar">
                                        {(!msg.target_team_ids && !msg.target_role_ids) ? (
                                            <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">לכולם</span>
                                        ) : (
                                            <>
                                                {msg.target_team_ids?.length && (
                                                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100 whitespace-nowrap">
                                                        {msg.target_team_ids.length} צוותים
                                                    </span>
                                                )}
                                                {msg.target_role_ids?.length && (
                                                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100 whitespace-nowrap">
                                                        {msg.target_role_ids.length} תפקידים
                                                    </span>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                            <div className="h-24"></div> {/* Spacer for FAB */}
                        </div>

                        {/* Desktop Table View */}
                        <div className="hidden md:block">
                            <table className="w-full text-right border-separate border-spacing-0">
                                <thead className="bg-slate-50 sticky top-0 z-10 text-slate-500 text-xs font-bold uppercase tracking-wider backdrop-blur-md">
                                    <tr>
                                        <th className="px-8 py-4 border-b border-slate-200">סטטוס</th>
                                        <th className="px-8 py-4 border-b border-slate-200 w-1/3">הודעה</th>
                                        <th className="px-8 py-4 border-b border-slate-200">קהל יעד</th>
                                        <th className="px-8 py-4 border-b border-slate-200">נוצר בתאריך</th>
                                        <th className="px-8 py-4 border-b border-slate-200">פעולות</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {messages.map(msg => (
                                        <tr key={msg.id} className="hover:bg-slate-50 transition-colors group">
                                            <td className="px-8 py-4">
                                                {msg.is_active ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-green-50 text-green-600 border border-green-100">
                                                        <CheckCircle size={12} weight="fill" />
                                                        פעיל
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-slate-100 text-slate-500 border border-slate-200">
                                                        <XCircle size={12} weight="fill" />
                                                        לא פעיל
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-8 py-4">
                                                <div className="font-bold text-slate-800 mb-1">{msg.title || '(ללא כותרת)'}</div>
                                                <div className="text-xs text-slate-500 truncate max-w-[250px] font-normal leading-relaxed">{msg.message}</div>
                                            </td>
                                            <td className="px-8 py-4">
                                                {(!msg.target_team_ids && !msg.target_role_ids) ? (
                                                    <span className="text-xs font-bold text-slate-400">כולם</span>
                                                ) : (
                                                    <div className="flex gap-2 flex-wrap">
                                                        {msg.target_team_ids && msg.target_team_ids.length > 0 && (
                                                            <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-1 rounded border border-blue-100">
                                                                {msg.target_team_ids.length} צוותים
                                                            </span>
                                                        )}
                                                        {msg.target_role_ids && msg.target_role_ids.length > 0 && (
                                                            <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-1 rounded border border-indigo-100">
                                                                {msg.target_role_ids.length} תפקידים
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-8 py-4 text-slate-500 text-xs font-bold">
                                                {format(new Date(msg.created_at), 'dd/MM/yyyy')}
                                            </td>
                                            <td className="px-8 py-4">
                                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => handleEdit(msg)}
                                                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    >
                                                        <Edit2 size={18} weight="bold" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(msg.id)}
                                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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

            {/* FAB - Primary Action (Consistent on Desktop and Mobile) */}
            <FloatingActionButton
                icon={Plus}
                onClick={() => { resetForm(); setIsEditing(true); }}
                ariaLabel="צור הודעה חדשה"
            />

            {/* Edit/Create Modal (Using System Modal) */}
            <Modal
                isOpen={isEditing}
                onClose={resetForm}
                title={editingId ? 'עריכת הודעה' : 'הודעה חדשה'}
                size="lg"
                footer={
                    <div className="flex gap-3 w-full justify-between">
                        {editingId && (
                            <Button variant="ghost" className="text-red-500 hover:bg-red-50 hover:text-red-600 font-bold" onClick={() => { handleDelete(editingId); resetForm(); }}>
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
                    {/* Main Content */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">כותרת ההודעה</label>
                                <Input
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    placeholder="למשל: עדכון חשוב לגבי המשמרת"
                                    className="bg-slate-50 border-slate-200 h-12 text-base font-bold text-slate-800"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">תוכן ההודעה</label>
                                <textarea
                                    value={message}
                                    onChange={e => setMessage(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none min-h-[160px] text-base leading-relaxed resize-none font-medium text-slate-700"
                                    placeholder="כתוב כאן את תוכן ההודעה..."
                                />
                            </div>

                            <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100">
                                <div className={`w-10 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${isActive ? 'bg-green-500' : 'bg-slate-300'}`} onClick={() => setIsActive(!isActive)}>
                                    <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${isActive ? 'translate-x-[-16px]' : ''}`} />
                                </div>
                                <span className="text-sm font-bold text-slate-700 select-none cursor-pointer" onClick={() => setIsActive(!isActive)}>
                                    הודעה פעילה (מוצגת בלוח)
                                </span>
                            </div>
                        </div>

                        {/* Audience Selection */}
                        <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5 space-y-6">
                            <h3 className="font-black text-slate-800 text-sm flex items-center gap-2 uppercase tracking-wider">
                                <Users size={18} weight="bold" className="text-blue-500" />
                                קהל יעד
                            </h3>
                            <p className="text-xs text-slate-400 leading-relaxed -mt-4">
                                בחר מי יראה את ההודעה. השאר ריק כדי לשלוח לכולם.
                            </p>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-3">צוותים</label>
                                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto custom-scrollbar p-1">
                                    {validTeams.map(team => (
                                        <button
                                            key={team.id}
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

                            <div className="border-t border-slate-200 my-4" />

                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-3">תפקידים</label>
                                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto custom-scrollbar p-1">
                                    {roles.map(role => (
                                        <button
                                            key={role.id}
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
        </div>
    );
};
