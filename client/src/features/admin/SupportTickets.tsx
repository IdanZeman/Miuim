import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../features/auth/AuthContext';
import {
    Chat as MessageSquare, MagnifyingGlass as Search, Funnel as Filter, Paperclip,
    PaperPlaneRight as Send, CheckCircle, Clock, WarningCircle as AlertCircle,
    DotsThree as MoreHorizontal, X
} from '@phosphor-icons/react';

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
        <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] border border-slate-200/60 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-6rem)] md:h-[calc(100vh-8rem)] relative z-20">
            {/* Premium Header */}
            <div className="flex items-center justify-between px-6 py-6 md:px-8 md:h-24 bg-white border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center shadow-sm shadow-rose-100">
                        <MessageSquare size={24} weight="bold" />
                    </div>
                    <div>
                        <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-none">מרכז תמיכה</h2>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Support Center</p>
                    </div>
                </div>
            </div>

            {/* Master-Detail Layout */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">

                {/* === Left Panel: Ticket List (Master) === */}
                <div className={`col-span-1 lg:col-span-4 border-l border-slate-200 flex flex-col h-full bg-white ${selectedTicketId ? 'hidden lg:flex' : 'flex'}`}>
                    {/* Search & Filter Header (Inner) */}
                    <div className="p-4 border-b border-slate-100 bg-white">
                        <div className="relative mb-3">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} weight="bold" />
                            <input
                                type="text"
                                placeholder="חיפוש פניות..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all placeholder:font-normal"
                            />
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
                            {(['all', 'new', 'in_progress', 'closed'] as const).map(status => (
                                <button
                                    key={status}
                                    onClick={() => setFilterStatus(status)}
                                    className={`whitespace-nowrap px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${filterStatus === status
                                        ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-200 shadow-sm'
                                        : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                                        }`}
                                >
                                    {status === 'all' ? 'הכל' : status === 'new' ? 'חדש' : status === 'in_progress' ? 'בטיפול' : 'סגור'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* List Content */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {filteredTickets.map(ticket => (
                            <div
                                key={ticket.id}
                                onClick={() => setSelectedTicketId(ticket.id)}
                                className={`relative p-5 cursor-pointer transition-all border-b border-slate-50 group hover:bg-slate-50/80 ${selectedTicketId === ticket.id ? 'bg-rose-50/50 border-r-4 border-rose-500' : 'border-r-4 border-transparent'
                                    }`}
                            >
                                {/* Priority Dot */}
                                <div className={`absolute top-5 right-5 w-2 h-2 rounded-full ring-2 ring-white ${ticket.priority === 'high' ? 'bg-red-500' : ticket.priority === 'medium' ? 'bg-amber-400' : 'bg-emerald-400'
                                    }`} />

                                <div className="mr-4">
                                    <div className="flex justify-between items-start mb-1.5">
                                        <h4 className={`text-sm truncate max-w-[180px] ${selectedTicketId === ticket.id ? 'font-black text-slate-800' : 'font-bold text-slate-700'}`}>
                                            {ticket.name}
                                        </h4>
                                        <span className="text-[10px] text-slate-400 font-mono shrink-0 bg-slate-50 px-1.5 py-0.5 rounded">
                                            {new Date(ticket.created_at).toLocaleDateString('he-IL')}
                                        </span>
                                    </div>
                                    <p className={`text-xs line-clamp-2 mb-3 leading-relaxed ${selectedTicketId === ticket.id ? 'text-slate-600 font-medium' : 'text-slate-500'}`}>
                                        {ticket.message}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${ticket.status === 'new' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                                            ticket.status === 'in_progress' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                                                'bg-slate-100 text-slate-500 border border-slate-200'
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
                <div className={`col-span-1 lg:col-span-8 flex flex-col h-full bg-slate-50/50 ${selectedTicketId ? 'flex' : 'hidden lg:flex'}`}>
                    {selectedTicket ? (
                        <>
                            {/* Detail Header */}
                            <div className="p-6 md:h-24 border-b border-slate-200 bg-white/80 backdrop-blur-sm flex justify-between items-start shadow-sm z-10 sticky top-0">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <h2 className="text-xl font-black text-slate-800 tracking-tight">פנייה בנושא: כללי</h2>
                                        <div className={`px-2 py-0.5 rounded-lg text-xs font-bold flex items-center gap-1.5 ${selectedTicket.status === 'new' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                                            selectedTicket.status === 'in_progress' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                                                'bg-slate-100 text-slate-500 border border-slate-200'
                                            }`}>
                                            <div className={`w-1.5 h-1.5 rounded-full ${selectedTicket.status === 'new' ? 'bg-blue-500' :
                                                selectedTicket.status === 'in_progress' ? 'bg-amber-500' :
                                                    'bg-slate-500'
                                                }`} />
                                            {selectedTicket.status === 'new' ? 'חדש' : selectedTicket.status === 'in_progress' ? 'בטיפול' : 'סגור'}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-slate-500">
                                        <div className="flex items-center gap-2 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                                            <div className="w-5 h-5 rounded-md bg-slate-200 flex items-center justify-center text-[10px] font-black text-slate-600">
                                                {selectedTicket.name.charAt(0)}
                                            </div>
                                            <span className="font-bold text-slate-700 text-xs">{selectedTicket.name}</span>
                                        </div>
                                        <span className="text-slate-300">|</span>
                                        <span className="text-xs font-mono">{selectedTicket.email}</span>
                                        {selectedTicket.phone && (
                                            <>
                                                <span className="text-slate-300">|</span>
                                                <span className="text-xs font-mono" dir="ltr">{selectedTicket.phone}</span>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2">
                                    <button className="md:hidden p-2 text-slate-400 hover:text-slate-600" onClick={() => setSelectedTicketId(null)}>
                                        <X size={20} weight="bold" />
                                    </button>
                                    <div className="hidden md:flex bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
                                        <button
                                            onClick={() => handleUpdateStatus(selectedTicket.id, 'closed')}
                                            className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                            title="סגור טיפול"
                                        >
                                            <CheckCircle size={20} weight="bold" />
                                        </button>
                                        <div className="w-px h-6 bg-slate-100 my-auto mx-1" />
                                        <button className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all" title="שעון">
                                            <Clock size={20} weight="bold" />
                                        </button>
                                        <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all" title="עוד">
                                            <MoreHorizontal size={20} weight="bold" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Detail Body */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                                {/* Original Message */}
                                <div className="bg-white p-8 rounded-[1.5rem] shadow-sm border border-slate-200/60 relative">
                                    <div className="absolute top-0 right-8 -mt-3 bg-white px-3 py-1 text-[10px] font-bold text-slate-400 border border-slate-200 rounded-full uppercase tracking-wider">
                                        Original Message
                                    </div>
                                    <p className="text-slate-800 whitespace-pre-wrap leading-loose text-sm font-medium">
                                        {selectedTicket.message}
                                    </p>
                                    {selectedTicket.image_url && (
                                        <div className="mt-6 pt-6 border-t border-dashed border-slate-100">
                                            <a href={selectedTicket.image_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-white hover:border-slate-300 hover:shadow-sm transition-all group">
                                                <div className="p-1.5 bg-slate-200 rounded-md group-hover:bg-slate-300 transition-colors">
                                                    <Paperclip size={14} weight="bold" />
                                                </div>
                                                צפה בקובץ מצורף
                                            </a>
                                        </div>
                                    )}
                                </div>

                                {/* Internal Notes */}
                                {(selectedTicket.internal_notes || showNoteInput) && (
                                    <div className="bg-amber-50/50 p-6 rounded-[1.5rem] border border-amber-100/60">
                                        <h4 className="text-xs font-black text-amber-800/70 mb-4 flex items-center gap-2 uppercase tracking-wide">
                                            <AlertCircle size={14} weight="bold" /> הערות פנימיות
                                        </h4>
                                        {showNoteInput ? (
                                            <div className="flex gap-2">
                                                <input
                                                    value={internalNote}
                                                    onChange={e => setInternalNote(e.target.value)}
                                                    className="flex-1 bg-white border border-amber-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-200"
                                                    placeholder="כתוב הערה..."
                                                    autoFocus
                                                />
                                                <button onClick={() => handleUpdateNote(selectedTicket.id)} className="text-xs bg-amber-200 hover:bg-amber-300 text-amber-900 px-4 rounded-xl font-bold transition-colors">שמור</button>
                                            </div>
                                        ) : (
                                            <p className="text-sm text-amber-900 bg-white/80 p-4 rounded-xl border border-amber-100 shadow-sm leading-relaxed">
                                                {selectedTicket.internal_notes}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Detail Footer (Reply) */}
                            <div className="p-4 bg-white border-t border-slate-200 sticky bottom-0 z-10">
                                <div className="flex flex-col gap-3 max-w-4xl mx-auto">
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setShowNoteInput(!showNoteInput)}
                                            className="text-[10px] font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg transition-all flex items-center gap-1"
                                        >
                                            <MoreHorizontal size={12} weight="bold" />
                                            {showNoteInput ? 'סגור הערה' : 'הוסף הערה פנימית'}
                                        </button>
                                    </div>
                                    <div className="relative group">
                                        <textarea
                                            value={replyText}
                                            onChange={(e) => setReplyText(e.target.value)}
                                            placeholder="כתוב תשובה ללקוח..."
                                            className="w-full min-h-[120px] p-4 pb-12 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 resize-none transition-all placeholder:text-slate-400 font-medium text-sm focus:bg-white"
                                        />
                                        <div className="absolute bottom-3 left-3 flex items-center gap-2">
                                            <button className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">
                                                <Paperclip size={18} weight="bold" />
                                            </button>
                                            <button className="flex items-center gap-2 px-6 py-2 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-all shadow-sm shadow-rose-200 font-bold text-sm group-focus-within:shadow-md group-focus-within:shadow-rose-200 transform active:scale-95">
                                                <span>שלח תגובה</span>
                                                <Send size={14} weight="bold" className="rotate-180" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-300 bg-slate-50/50">
                            <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mb-6 shadow-inset border border-slate-200">
                                <MessageSquare size={40} weight="bold" className="opacity-40" />
                            </div>
                            <p className="text-lg font-black text-slate-400">בחר פנייה לצפייה בפרטים</p>
                            <p className="text-xs font-bold text-slate-400/60 mt-2 uppercase tracking-widest">Select a ticket to view details</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
