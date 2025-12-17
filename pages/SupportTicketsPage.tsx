import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';
import { useToast } from '../contexts/ToastContext';
import { MessageSquare, Calendar, Phone, User, CheckCircle, Clock, AlertCircle, Search, Filter, ExternalLink, Image as ImageIcon, Save, X, Mail } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ContactMessage, TicketStatus } from '../types';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { useConfirmation } from '../hooks/useConfirmation';

const STATUS_LABELS: Record<TicketStatus, string> = {
    new: 'חדש',
    in_progress: 'בטיפול',
    resolved: 'טופל'
};

const STATUS_COLORS: Record<TicketStatus, string> = {
    new: 'bg-red-100 text-red-700 border-red-200',
    in_progress: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    resolved: 'bg-green-100 text-green-700 border-green-200'
};

export const SupportTicketsPage: React.FC = () => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const { confirm, modalProps } = useConfirmation();

    // Auth check - hardcoded for 'idanzeman' as requested or admins generally if preferred
    // Using a more generic "isSystemAdmin" check or email check
    const isAuthorized = user?.email?.includes('idanzeman') || user?.email === 'idanzman@gmail.com'; // Adjust based on exact email or add more

    const [tickets, setTickets] = useState<ContactMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<TicketStatus | 'all'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
    const [noteContent, setNoteContent] = useState('');

    useEffect(() => {
        if (isAuthorized) {
            fetchTickets();
        }
    }, [isAuthorized]);

    const fetchTickets = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('contact_messages')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching tickets:', error);
            showToast('שגיאה בטעינת הפניות', 'error');
        } else {
            setTickets(data || []);
        }
        setLoading(false);
    };

    const handleStatusChange = async (ticketId: string, newStatus: TicketStatus) => {
        const { error } = await supabase
            .from('contact_messages')
            .update({
                status: newStatus,
                updated_at: new Date().toISOString()
            })
            .eq('id', ticketId);

        if (error) {
            console.error('Error updating status:', error);
            showToast('שגיאה בעדכון הסטטוס', 'error');
        } else {
            setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: newStatus } : t));
            showToast('הסטטוס עודכן בהצלחה', 'success');
        }
    };

    const handleSaveNote = async (ticketId: string) => {
        const { error } = await supabase
            .from('contact_messages')
            .update({
                admin_notes: noteContent,
                updated_at: new Date().toISOString()
            })
            .eq('id', ticketId);

        if (error) {
            console.error('Error saving note:', error);
            showToast('שגיאה בשמירת הערה', 'error');
        } else {
            setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, admin_notes: noteContent } : t));
            showToast('הערה נשמרה', 'success');
            setEditingNoteId(null);
        }
    };

    const handleDelete = async (ticketId: string) => {
        confirm({
            title: 'מחיקת פנייה',
            message: 'האם אתה בטוח שברצונך למחוק פנייה זו? הפעולה אינה הפיכה.',
            confirmText: 'מחק',
            type: 'danger',
            onConfirm: async () => {
                const { error } = await supabase
                    .from('contact_messages')
                    .delete()
                    .eq('id', ticketId);

                if (error) {
                    showToast('שגיאה במחיקה', 'error');
                } else {
                    setTickets(prev => prev.filter(t => t.id !== ticketId));
                    showToast('הפנייה נמחקה', 'success');
                }
            }
        });
    };

    if (!isAuthorized) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-500">
                <AlertCircle size={48} className="mb-4 text-red-400" />
                <h2 className="text-2xl font-bold text-slate-800">אין גישה</h2>
                <p>עמוד זה מיועד למנהלי מערכת בלבד.</p>
            </div>
        );
    }

    const filteredTickets = tickets.filter(t => {
        const matchesStatus = filterStatus === 'all' || t.status === filterStatus || (!t.status && filterStatus === 'new'); // Treat null status as new
        const matchesSearch =
            t.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.message?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.phone?.includes(searchTerm);
        return matchesStatus && matchesSearch;
    });

    const getStatusIcon = (status: TicketStatus) => {
        switch (status) {
            case 'resolved': return <CheckCircle size={16} />;
            case 'in_progress': return <Clock size={16} />;
            default: return <AlertCircle size={16} />;
        }
    };

    return (
        <div className="max-w-6xl mx-auto p-4 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <MessageSquare className="text-blue-600" />
                        ניהול פניות ותמיכה
                    </h1>
                    <p className="text-slate-500 mt-1">מעקב וטיפול בפניות משתמשים (Contact Tickets)</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="bg-slate-100 px-4 py-2 rounded-xl flex items-center gap-2">
                        <span className="text-slate-500 text-sm font-bold">סה"כ פניות:</span>
                        <span className="text-blue-600 font-bold text-lg">{tickets.length}</span>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between sticky top-0 z-10 bg-slate-50/80 backdrop-blur-md py-4">
                <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-sm w-full md:w-auto overflow-x-auto">
                    {(['all', 'new', 'in_progress', 'resolved'] as const).map((status) => (
                        <button
                            key={status}
                            onClick={() => setFilterStatus(status)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${filterStatus === status
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'text-slate-600 hover:bg-slate-50'
                                }`}
                        >
                            {status === 'all' ? 'כל הפניות' : STATUS_LABELS[status]}
                        </button>
                    ))}
                </div>

                <div className="w-full md:w-64">
                    <Input
                        placeholder="חיפוש לפי שם, טלפון..."
                        icon={Search}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-white"
                    />
                </div>
            </div>

            {/* Tickets List */}
            {loading ? (
                <div className="text-center py-12">
                    <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-slate-500">טוען פניות...</p>
                </div>
            ) : filteredTickets.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300">
                    <MessageSquare size={48} className="mx-auto text-slate-300 mb-4" />
                    <h3 className="text-lg font-bold text-slate-600">אין פניות להצגה</h3>
                    <p className="text-slate-400">לא נמצאו פניות התואמות את הסינון הנוכחי</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {filteredTickets.map((ticket) => (
                        <div key={ticket.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 transition-all hover:shadow-md">
                            <div className="flex flex-col md:flex-row gap-4">
                                {/* Status & Date */}
                                <div className="flex md:flex-col items-center md:items-start justify-between gap-2 min-w-[120px]">
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${STATUS_COLORS[ticket.status || 'new']}`}>
                                        {getStatusIcon(ticket.status || 'new')}
                                        {STATUS_LABELS[ticket.status || 'new']}
                                    </span>
                                    <div className="flex items-center gap-1 text-slate-400 text-xs">
                                        <Calendar size={12} />
                                        {new Date(ticket.created_at).toLocaleDateString('he-IL')}
                                    </div>
                                    <div className="text-xs text-slate-400">
                                        {new Date(ticket.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>

                                {/* Main Content */}
                                <div className="flex-1 space-y-3">
                                    <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                                        <div>
                                            <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                                                {ticket.name}
                                                {ticket.user_id && <span className="text-xs font-normal bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md">רשום</span>}
                                            </h3>
                                            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 mt-1">
                                                {ticket.phone && (
                                                    <a href={`tel:${ticket.phone}`} className="flex items-center gap-1 hover:text-blue-600 border border-slate-200 px-2 py-1 rounded-md bg-white">
                                                        <Phone size={14} />
                                                        {ticket.phone}
                                                    </a>
                                                )}

                                                {ticket.email && (
                                                    <a href={`mailto:${ticket.email}`} className="flex items-center gap-1 hover:text-blue-600 border border-slate-200 px-2 py-1 rounded-md bg-white">
                                                        <Mail size={14} />
                                                        {ticket.email}
                                                    </a>
                                                )}

                                                <button
                                                    onClick={() => {
                                                        const subject = encodeURIComponent(`תגובה לפנייה: ${ticket.name} - Miuim Support`);
                                                        const body = encodeURIComponent(`שלום ${ticket.name},\n\nבהמשך לפנייתך בנושא:\n"${ticket.message || ''}"\n\n[כתוב כאן את תשובתך]\n\nבברכה,\nצוות התמיכה`);
                                                        const recipient = ticket.email || '';

                                                        // User explicitly requested Gmail web interface to avoid Outlook default
                                                        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${recipient}&su=${subject}&body=${body}`;
                                                        window.open(gmailUrl, '_blank');
                                                    }}
                                                    className="flex items-center gap-1 hover:text-red-600 border border-red-100 text-red-600 px-2 py-1 rounded-md bg-red-50 font-medium transition-colors"
                                                    title={ticket.email ? `השב ל-${ticket.email}` : "פתח ב-Gmail"}
                                                >
                                                    <Mail size={14} />
                                                    השב ב-Gmail
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-slate-700 whitespace-pre-wrap">
                                        {ticket.message}
                                    </div>

                                    {ticket.image_url && (
                                        <div className="mt-2">
                                            <a href={ticket.image_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-blue-600 hover:underline text-sm font-medium">
                                                <ImageIcon size={16} />
                                                צפה בקובץ המצורף
                                                <ExternalLink size={12} />
                                            </a>
                                        </div>
                                    )}
                                </div>

                                {/* Admin Actions */}
                                <div className="w-full md:w-72 border-t md:border-t-0 md:border-r border-slate-100 pt-4 md:pt-0 md:pr-4 flex flex-col gap-3">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 mb-1 block">טיפול בסטטוס</label>
                                        <div className="flex bg-slate-100 p-1 rounded-lg">
                                            {(['new', 'in_progress', 'resolved'] as const).map(s => (
                                                <button
                                                    key={s}
                                                    onClick={() => handleStatusChange(ticket.id, s)}
                                                    className={`flex-1 py-1 px-2 rounded-md text-xs font-medium transition-colors ${(ticket.status || 'new') === s
                                                        ? 'bg-white text-slate-800 shadow-sm font-bold'
                                                        : 'text-slate-500 hover:text-slate-700'
                                                        }`}
                                                    title={STATUS_LABELS[s]}
                                                >
                                                    {STATUS_LABELS[s]}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="text-xs font-bold text-slate-500">הערות טיפול</label>
                                            {editingNoteId !== ticket.id && (
                                                <button
                                                    onClick={() => {
                                                        setEditingNoteId(ticket.id);
                                                        setNoteContent(ticket.admin_notes || '');
                                                    }}
                                                    className="text-blue-600 text-xs hover:underline"
                                                >
                                                    ערוך
                                                </button>
                                            )}
                                        </div>

                                        {editingNoteId === ticket.id ? (
                                            <div className="space-y-2">
                                                <textarea
                                                    value={noteContent}
                                                    onChange={(e) => setNoteContent(e.target.value)}
                                                    className="w-full text-sm p-2 border rounded-md focus:ring-2 focus:ring-blue-100 outline-none"
                                                    rows={3}
                                                    placeholder="הוסף הערה פנימית..."
                                                    autoFocus
                                                />
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => setEditingNoteId(null)}
                                                        className="p-1 text-slate-500 hover:bg-slate-100 rounded"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleSaveNote(ticket.id)}
                                                        className="p-1 text-green-600 hover:bg-green-50 rounded"
                                                    >
                                                        <Save size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="bg-yellow-50 p-2 rounded-md border border-yellow-100 min-h-[60px] text-xs text-slate-700">
                                                {ticket.admin_notes ? ticket.admin_notes : <span className="text-slate-400 italic">אין הערות</span>}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <ConfirmationModal {...modalProps} />
        </div>
    );
};
