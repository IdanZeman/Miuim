import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../features/auth/AuthContext';
import { SystemMessage } from '../../types';
import { X, Bell } from '@phosphor-icons/react';

export const SystemMessagePopup: React.FC = () => {
    const { organization, user } = useAuth();
    const [messages, setMessages] = useState<SystemMessage[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (organization && user) {
            checkMessages();
        }
    }, [organization, user]);

    const checkMessages = async () => {
        try {
            // Check for seen messages in local storage to avoid showing same message repeatedly in same session/day
            // Ideally we track 'read' status in DB, but for simple popup we can use localStorage with ID

            const seenMessages = JSON.parse(localStorage.getItem('miuim_seen_messages') || '[]');

            const { data, error } = await supabase
                .from('system_messages')
                .select('*')
                .eq('organization_id', organization?.id)
                .eq('is_active', true)
                .eq('message_type', 'POPUP')
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Filter out messages user has already "acknowledged" or closed recently?
            // User requirement: "display... when session starts"
            // Let's show all active messages that haven't been dismissed *forever* or maybe just show them once per session.
            // For now, let's filter against a local storage "dismissed_ids" list.

            const relevantMessages = (data || []).filter(msg => !seenMessages.includes(msg.id));

            if (relevantMessages.length > 0) {
                setMessages(relevantMessages);
                setIsOpen(true);
            }
        } catch (error) {
            console.error('Error fetching system messages:', error);
        }
    };

    const handleDismiss = () => {
        const currentMsg = messages[currentIndex];
        if (currentMsg) {
            const seenMessages = JSON.parse(localStorage.getItem('miuim_seen_messages') || '[]');
            if (!seenMessages.includes(currentMsg.id)) {
                seenMessages.push(currentMsg.id);
                localStorage.setItem('miuim_seen_messages', JSON.stringify(seenMessages));
            }
        }

        if (currentIndex < messages.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            setIsOpen(false);
        }
    };

    const handleDismissAll = () => {
        const seenMessages = JSON.parse(localStorage.getItem('miuim_seen_messages') || '[]');
        messages.forEach(msg => {
            if (!seenMessages.includes(msg.id)) {
                seenMessages.push(msg.id);
            }
        });
        localStorage.setItem('miuim_seen_messages', JSON.stringify(seenMessages));
        setIsOpen(false);
    };

    if (!isOpen || messages.length === 0) return null;

    const currentMsg = messages[currentIndex];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="bg-blue-600 p-6 text-white relative overflow-hidden">
                    <div className="relative z-10 flex items-start gap-4">
                        <div className="p-3 bg-white/20 rounded-xl backdrop-blur-md">
                            <Bell size={32} className="text-white" weight="duotone" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-2 p-1.5 bg-blue-50 rounded-lg self-end">
                                <span className="text-[10px] font-black text-blue-600 uppercase tracking-wider">צוות מערכת לניהול פלוגה</span>
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                            </div>
                            <h3 className="text-xl font-bold">הודעת מערכת</h3>
                            {messages.length > 1 && (
                                <p className="text-blue-100 text-sm mt-1">
                                    הודעה {currentIndex + 1} מתוך {messages.length}
                                </p>
                            )}
                        </div>
                    </div>
                    {/* Background decoration */}
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                    <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-blue-500/50 rounded-full blur-2xl"></div>
                </div>

                <div className="p-6">
                    {currentMsg.title && (
                        <h4 className="text-lg font-bold text-slate-800 mb-2">{currentMsg.title}</h4>
                    )}
                    <div className="prose prose-slate max-w-none text-slate-600 whitespace-pre-wrap leading-relaxed">
                        {currentMsg.message}
                    </div>

                    <div className="mt-8 flex flex-col gap-3">
                        <button
                            onClick={handleDismiss}
                            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors shadow-lg shadow-blue-200"
                        >
                            {currentIndex < messages.length - 1 ? 'הבא' : 'הבנתי, סגור'}
                        </button>
                        {messages.length > 1 && (
                            <button
                                onClick={handleDismissAll}
                                className="w-full py-2 px-4 text-slate-500 hover:text-slate-700 text-sm font-medium transition-colors"
                            >
                                סמן הכל כנקרא וסגור
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
