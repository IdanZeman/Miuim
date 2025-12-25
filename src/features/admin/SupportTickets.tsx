import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../features/auth/AuthContext';
import {
    MessageSquare, Search, Filter, Paperclip,
    Send, CheckCircle, Clock, AlertCircle,
    MoreHorizontal, Reply, X
} from 'lucide-react';

interface ContactMessage {
    id: string;
    created_at: string;
    name: string;
    email: string | null;
    phone: string | null;
    message: string;
    image_url: string | null;
    user_id: string | null;
    status: 'new' | 'in_progress' | 'closed';
    priority: 'low' | 'medium' | 'high';
    internal_notes?: string;
}

export const SupportTickets: React.FC = () => {
    const { profile } = useAuth();
    const [tickets, setTickets] = useState<ContactMessage[]>([]);
    const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<'all' | 'new' | 'in_progress' | 'closed'>('all');
    const [searchTerm, setSearchTerm] = useState('');

    // Reply State
    const [replyText, setReplyText] = useState('');
    const [internalNote, setInternalNote] = useState('');
    const [showNoteInput, setShowNoteInput] = useState(false);

    useEffect(() => {
        if (profile?.is_super_admin) {
            fetchTickets();
        }
    }, [profile]);

    const fetchTickets = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('contact_messages')
            .select('*')
            .order('created_at', { ascending: false });

        if (!error && data) {
            // Mock priority/status if missing from DB schema, normally should be there
            const enhancedData = data.map(t => ({
                ...t,
                status: t.status || 'new',
                priority: t.priority || 'medium'
            }));
            setTickets(enhancedData);
            if (enhancedData.length > 0 && !selectedTicketId) {
                setSelectedTicketId(enhancedData[0].id);
            }
        }
        setLoading(false);
    };

    const handleUpdateStatus = async (id: string, newStatus: string) => {
        const { error } = await supabase
            .from('contact_messages')
            .update({ status: newStatus })
            .eq('id', id);

        if (!error) {
            setTickets(prev => prev.map(t => t.id === id ? { ...t, status: newStatus as any } : t));
        }
    };

    const handleUpdateNote = async (id: string) => {
        // Implement note update in DB
        // For now just update local state mock
        setTickets(prev => prev.map(t => t.id === id ? { ...t, internal_notes: internalNote } : t));
        setShowNoteInput(false);
    }

    const filteredTickets = tickets.filter(t => {
        const matchesStatus = filterStatus === 'all' || t.status === filterStatus;
        const matchesSearch = t.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.message?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.email?.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesStatus && matchesSearch;
    });

    const selectedTicket = tickets.find(t => t.id === selectedTicketId);

    if (!profile?.is_super_admin) return <div>Access Denied</div>;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 h-[calc(100vh-200px)] bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* === Left Panel: Ticket List (Master) === */}
            <div className={`col-span-1 lg:col-span-4 border-l border-slate-200 flex flex-col h-full bg-white ${selectedTicketId ? 'hidden lg:flex' : 'flex'}`}>
                {/* Search & Filter Header */}
                <div className="p-4 border-b border-slate-100 bg-slate-50">
                    <div className="relative mb-3">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="חיפוש פניות..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pr-10 pl-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
                        {(['all', 'new', 'in_progress', 'closed'] as const).map(status => (
                            <button
                                key={status}
                                onClick={() => setFilterStatus(status)}
                                className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-bold transition-colors ${filterStatus === status
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                            >
                                {status === 'all' ? 'הכל' : status === 'new' ? 'חדש' : status === 'in_progress' ? 'בטיפול' : 'סגור'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* List Content */}
                <div className="flex-1 overflow-y-auto">
                    {filteredTickets.map(ticket => (
                        <div
                            key={ticket.id}
                            onClick={() => setSelectedTicketId(ticket.id)}
                            className={`relative p-4 cursor-pointer transition-all border-b border-slate-50 group hover:bg-slate-50 ${selectedTicketId === ticket.id ? 'bg-blue-50 border-r-4 border-blue-500' : ''
                                }`}
                        >
                            {/* Priority Dot */}
                            <div className={`absolute top-4 right-4 w-2 h-2 rounded-full ${ticket.priority === 'high' ? 'bg-red-500' : ticket.priority === 'medium' ? 'bg-amber-400' : 'bg-emerald-400'
                                }`} />

                            <div className="mr-6">
                                <div className="flex justify-between items-start mb-1">
                                    <h4 className={`text-sm trunkate max-w-[180px] ${selectedTicketId === ticket.id ? 'font-black text-slate-900' : 'font-bold text-slate-700'}`}>
                                        {ticket.name}
                                    </h4>
                                    <span className="text-[10px] text-slate-400 font-mono shrink-0">
                                        {new Date(ticket.created_at).toLocaleDateString('he-IL')}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 line-clamp-2 mb-2 font-medium leading-relaxed">
                                    {ticket.message}
                                </p>
                                <div className="flex items-center gap-2">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${ticket.status === 'new' ? 'bg-blue-100 text-blue-700' :
                                        ticket.status === 'in_progress' ? 'bg-amber-100 text-amber-700' :
                                            'bg-slate-100 text-slate-500'
                                        }`}>
                                        {ticket.status === 'new' ? 'חדש' : ticket.status === 'in_progress' ? 'בטיפול' : 'סגור'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* === Right Panel: Detail View (Detail) === */}
            <div className={`col-span-1 lg:col-span-8 flex flex-col h-full bg-slate-50/30 ${selectedTicketId ? 'flex' : 'hidden lg:flex'}`}>
                {selectedTicket ? (
                    <>
                        {/* Detail Header */}
                        <div className="p-6 border-b border-slate-200 bg-white flex justify-between items-start shadow-sm z-10">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <h2 className="text-xl font-black text-slate-800">פנייה בנושא: כללי</h2>
                                    <div className={`px-2 py-0.5 rounded text-xs font-bold flex items-center gap-1 ${selectedTicket.status === 'new' ? 'bg-blue-100 text-blue-700' :
                                        selectedTicket.status === 'in_progress' ? 'bg-amber-100 text-amber-700' :
                                            'bg-slate-100 text-slate-500'
                                        }`}>
                                        <div className={`w-1.5 h-1.5 rounded-full ${selectedTicket.status === 'new' ? 'bg-blue-500' :
                                            selectedTicket.status === 'in_progress' ? 'bg-amber-500' :
                                                'bg-slate-500'
                                            }`} />
                                        {selectedTicket.status === 'new' ? 'חדש' : selectedTicket.status === 'in_progress' ? 'בטיפול' : 'סגור'}
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 text-sm text-slate-500">
                                    <div className="flex items-center gap-1">
                                        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                                            {selectedTicket.name.charAt(0)}
                                        </div>
                                        <span className="font-bold text-slate-700">{selectedTicket.name}</span>
                                    </div>
                                    <span>&bull;</span>
                                    <span>{selectedTicket.email}</span>
                                    {selectedTicket.phone && (
                                        <>
                                            <span>&bull;</span>
                                            <span>{selectedTicket.phone}</span>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2">
                                <button className="md:hidden p-2 text-slate-400 hover:text-slate-600" onClick={() => setSelectedTicketId(null)}>
                                    <X size={20} />
                                </button>
                                <div className="hidden md:flex bg-slate-100 rounded-lg p-1">
                                    <button
                                        onClick={() => handleUpdateStatus(selectedTicket.id, 'closed')}
                                        className="p-2 text-slate-500 hover:text-slate-700 hover:bg-white rounded-md transition-all"
                                        title="סגור טיפול"
                                    >
                                        <CheckCircle size={18} />
                                    </button>
                                    <button className="p-2 text-slate-500 hover:text-slate-700 hover:bg-white rounded-md transition-all" title="שעון">
                                        <Clock size={18} />
                                    </button>
                                    <button className="p-2 text-slate-500 hover:text-slate-700 hover:bg-white rounded-md transition-all" title="עוד">
                                        <MoreHorizontal size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Detail Body */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Original Message */}
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                <p className="text-slate-800 whitespace-pre-wrap leading-relaxed">
                                    {selectedTicket.message}
                                </p>
                                {selectedTicket.image_url && (
                                    <div className="mt-4">
                                        <a href={selectedTicket.image_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-100">
                                            <Paperclip size={14} />
                                            צפה בקובץ מצורף
                                        </a>
                                    </div>
                                )}
                            </div>

                            {/* Internal Notes */}
                            {(selectedTicket.internal_notes || showNoteInput) && (
                                <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                                    <h4 className="text-xs font-bold text-amber-800 mb-2 flex items-center gap-1">
                                        <AlertCircle size={12} /> הערות פנימיות (מנהלים בלבד)
                                    </h4>
                                    {showNoteInput ? (
                                        <div className="flex gap-2">
                                            <input
                                                value={internalNote}
                                                onChange={e => setInternalNote(e.target.value)}
                                                className="flex-1 bg-white border border-amber-200 rounded px-2 py-1 text-sm outline-none"
                                                placeholder="כתוב הערה..."
                                            />
                                            <button onClick={() => handleUpdateNote(selectedTicket.id)} className="text-xs bg-amber-200 text-amber-800 px-3 rounded font-bold">שמור</button>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-amber-900 bg-white/50 p-2 rounded">
                                            {selectedTicket.internal_notes}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Detail Footer (Reply) */}
                        <div className="p-4 bg-white border-t border-slate-200">
                            <div className="flex flex-col gap-3">
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setShowNoteInput(!showNoteInput)}
                                        className="text-xs font-bold text-slate-500 hover:text-slate-700 px-3 py-1 bg-slate-100 rounded-full"
                                    >
                                        + הערה פנימית
                                    </button>
                                </div>
                                <div className="relative">
                                    <textarea
                                        value={replyText}
                                        onChange={(e) => setReplyText(e.target.value)}
                                        placeholder="כתוב תשובה..."
                                        className="w-full min-h-[100px] p-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                                    />
                                    <div className="absolute bottom-3 left-3 flex items-center gap-2">
                                        <button className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition-colors">
                                            <Paperclip size={18} />
                                        </button>
                                        <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-sm font-bold text-sm">
                                            <span>שלח תגובה</span>
                                            <Send size={14} className="rotate-180" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                            <MessageSquare size={32} className="opacity-20" />
                        </div>
                        <p className="text-lg font-bold">בחר פנייה לצפייה</p>
                    </div>
                )}
            </div>
        </div>
    );
};
