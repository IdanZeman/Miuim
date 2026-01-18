import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { SystemMessage } from '../../types';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { CircleNotch as Loader2, Plus, Trash as Trash2, PencilSimple as Edit2, FloppyDisk as Save, X, Megaphone, CheckCircle, XCircle } from '@phosphor-icons/react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { Button } from '@/components/ui/Button';
import { useConfirmation } from '@/hooks/useConfirmation';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { DashboardSkeleton } from '@/components/ui/DashboardSkeleton';

export const SystemMessagesManager: React.FC = () => {
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
                .eq('message_type', 'POPUP')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setMessages(data || []);
        } catch (error) {
            console.error('Error fetching messages:', error);
            showToast('שגיאה בטעינת הודעות מערכת', 'error');
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
                message_type: 'POPUP'
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
        setIsEditing(true);
    };

    const resetForm = () => {
        setEditingId(null);
        setTitle('');
        setMessage('');
        setIsActive(true);
        setIsEditing(false);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
                    <Megaphone size={20} weight="bold" className="text-blue-600" />
                    הודעות מערכת (פופאפים)
                </h2>
                {!isEditing && (
                    <Button
                        onClick={() => setIsEditing(true)}
                        variant="primary"
                        icon={Plus}
                        iconWeight="bold"
                    >
                        הודעה חדשה
                    </Button>
                )}
            </div>

            {isEditing && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 animate-in fade-in slide-in-from-top-2">
                    <div className="grid gap-4 max-w-2xl">
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
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none min-h-[100px]"
                                placeholder="הזן את תוכן ההודעה שתוצג למשתמשים..."
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
                                הודעה פעילה (תוצג למשתמשים)
                            </label>
                        </div>
                        <div className="flex gap-3 mt-2">
                            <Button
                                onClick={handleSave}
                                variant="primary"
                                icon={Save}
                            >
                                {editingId ? 'עדכן' : 'שמור'}
                            </Button>
                            <Button
                                onClick={resetForm}
                                variant="secondary"
                                icon={X}
                            >
                                ביטול
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {isLoading ? (
                    <DashboardSkeleton />
                ) : messages.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">
                        <Megaphone size={48} weight="bold" className="mx-auto mb-3 opacity-20" />
                        <p>לא נמצאו הודעות מערכת.</p>
                    </div>
                ) : (
                    <>
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-right">
                                <thead className="bg-slate-50 text-slate-500 text-sm">
                                    <tr>
                                        <th className="px-6 py-3 font-medium">סטטוס</th>
                                        <th className="px-6 py-3 font-medium">כותרת</th>
                                        <th className="px-6 py-3 font-medium">תוכן</th>
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
                                                        <CheckCircle size={12} weight="bold" />
                                                        פעיל
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                                                        <XCircle size={12} weight="bold" />
                                                        לא פעיל
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 font-medium text-slate-800">
                                                {msg.title || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 max-w-md truncate">
                                                {msg.message}
                                            </td>
                                            <td className="px-6 py-4 text-slate-500 text-sm">
                                                {format(new Date(msg.created_at), 'dd/MM/yyyy HH:mm')}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        onClick={() => handleEdit(msg)}
                                                        variant="ghost"
                                                        size="icon"
                                                        icon={Edit2}
                                                        className="text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                                                    />
                                                    <Button
                                                        onClick={() => handleDelete(msg.id)}
                                                        variant="ghost"
                                                        size="icon"
                                                        icon={Trash2}
                                                        className="text-slate-500 hover:text-red-500 hover:bg-red-50"
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile List View */}
                        <div className="md:hidden divide-y divide-slate-100">
                            {messages.map(msg => (
                                <div key={msg.id} className="p-4 bg-white active:bg-slate-50">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            {msg.is_active ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                                    <CheckCircle size={12} weight="bold" />
                                                    פעיל
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                                                    <XCircle size={12} weight="bold" />
                                                    לא פעיל
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-xs text-slate-400">
                                            {format(new Date(msg.created_at), 'dd/MM/yyyy')}
                                        </span>
                                    </div>

                                    <div className="mb-3 space-y-1">
                                        {msg.title && <div className="font-bold text-slate-800">{msg.title}</div>}
                                        <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{msg.message}</div>
                                    </div>

                                    <div className="flex justify-end gap-3 pt-2 border-t border-slate-50">
                                        <Button
                                            onClick={() => handleEdit(msg)}
                                            variant="secondary"
                                            size="sm"
                                            icon={Edit2}
                                            className="text-blue-600 bg-blue-50 border-blue-100"
                                        >
                                            ערוך
                                        </Button>
                                        <Button
                                            onClick={() => handleDelete(msg.id)}
                                            variant="secondary"
                                            size="sm"
                                            icon={Trash2}
                                            className="text-red-600 bg-red-50 border-red-100"
                                        >
                                            מחק
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
            <ConfirmationModal {...modalProps} />
        </div>
    );
};
