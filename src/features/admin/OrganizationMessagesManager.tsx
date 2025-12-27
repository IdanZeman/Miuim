import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { SystemMessage, Team, Role } from '../../types';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Loader2, Plus, Trash2, Edit2, Save, X, Megaphone, CheckCircle, XCircle, Users, Shield } from 'lucide-react';
import { format } from 'date-fns';

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
        if (!window.confirm('האם אתה בטוח שברצונך למחוק הודעה זו?')) return;

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
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
                    <Megaphone size={20} className="text-blue-600" />
                    הודעות ועדכונים (לוח מודעות)
                </h2>
                {!isEditing && (
                    <button
                        onClick={() => setIsEditing(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                        <Plus size={18} />
                        הודעה חדשה
                    </button>
                )}
            </div>

            {isEditing && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 animate-in fade-in slide-in-from-top-2">
                    <div className="grid gap-6 max-w-4xl">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">כותרת (אופציונלי)</label>
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={e => setTitle(e.target.value)}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="למשל: עדכון חשוב"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">תוכן ההודעה</label>
                                    <textarea
                                        value={message}
                                        onChange={e => setMessage(e.target.value)}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none min-h-[120px]"
                                        placeholder="הזן את תוכן ההודעה..."
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="isActive"
                                        checked={isActive}
                                        onChange={e => setIsActive(e.target.checked)}
                                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                    />
                                    <label htmlFor="isActive" className="text-sm font-medium text-slate-700 select-none cursor-pointer">
                                        הודעה פעילה (תוצג בלוח)
                                    </label>
                                </div>
                            </div>

                            <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-4">
                                <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                                    <Users size={16} />
                                    קהל יעד (השאר ריק לכולם)
                                </h3>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-2">צוותים</label>
                                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1">
                                        {validTeams.map(team => (
                                            <button
                                                key={team.id}
                                                onClick={() => toggleTeam(team.id)}
                                                className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${targetTeams.includes(team.id)
                                                    ? 'bg-blue-100 border-blue-200 text-blue-700'
                                                    : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100'
                                                    }`}
                                            >
                                                {team.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-2">תפקידים</label>
                                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1">
                                        {roles.map(role => (
                                            <button
                                                key={role.id}
                                                onClick={() => toggleRole(role.id)}
                                                className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${targetRoles.includes(role.id)
                                                    ? 'bg-indigo-100 border-indigo-200 text-indigo-700'
                                                    : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100'
                                                    }`}
                                            >
                                                {role.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2 border-t border-slate-100">
                            <button
                                onClick={handleSave}
                                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                            >
                                <Save size={18} />
                                {editingId ? 'עדכן' : 'שמור'}
                            </button>
                            <button
                                onClick={resetForm}
                                className="flex items-center gap-2 px-6 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition"
                            >
                                <X size={18} />
                                ביטול
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {isLoading ? (
                    <div className="p-12 flex justify-center text-slate-400">
                        <Loader2 className="animate-spin" size={32} />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">
                        <Megaphone size={48} className="mx-auto mb-3 opacity-20" />
                        <p>לא נמצאו הודעות מערכת.</p>
                    </div>
                ) : (
                    <table className="w-full text-right">
                        <thead className="bg-slate-50 text-slate-500 text-sm">
                            <tr>
                                <th className="px-6 py-3 font-medium">סטטוס</th>
                                <th className="px-6 py-3 font-medium">כותרת</th>
                                <th className="px-6 py-3 font-medium">קהל יעד</th>
                                <th className="px-6 py-3 font-medium">נוצר בתאריך</th>
                                <th className="px-6 py-3 font-medium">פעולות</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {messages.map(msg => (
                                <tr key={msg.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4">
                                        {msg.is_active ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                                <CheckCircle size={12} />
                                                פעיל
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                                                <XCircle size={12} />
                                                לא פעיל
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 font-medium text-slate-800">
                                        {msg.title || '(ללא כותרת)'}
                                        <div className="text-xs text-slate-500 truncate max-w-[200px] font-normal mt-0.5">{msg.message}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {(!msg.target_team_ids && !msg.target_role_ids) ? (
                                            <span className="text-xs text-slate-500">כולם</span>
                                        ) : (
                                            <div className="flex flex-col gap-1">
                                                {msg.target_team_ids && msg.target_team_ids.length > 0 && (
                                                    <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded w-fit">
                                                        {msg.target_team_ids.length} צוותים
                                                    </span>
                                                )}
                                                {msg.target_role_ids && msg.target_role_ids.length > 0 && (
                                                    <span className="text-xs bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded w-fit">
                                                        {msg.target_role_ids.length} תפקידים
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-slate-500 text-sm">
                                        {format(new Date(msg.created_at), 'dd/MM/yyyy')}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleEdit(msg)}
                                                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                                title="ערוך"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(msg.id)}
                                                className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                                title="מחק"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};
