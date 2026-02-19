import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../features/auth/AuthContext';
import { SystemMessage } from '../../types';
import { X, Bell, ChartBar, Megaphone, CaretRight } from '@phosphor-icons/react';
import { PollRenderer } from '../PollRenderer';
import { motion, AnimatePresence } from 'framer-motion';
import { Poll } from '../../types';
import { fetchPolls, checkUserPollResponse } from '../../services/pollService';

export const SystemMessagePopup: React.FC = () => {
    const { organization, user } = useAuth();
    const [messages, setMessages] = useState<SystemMessage[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [activePoll, setActivePoll] = useState<Poll | null>(null);
    const [isLoadingPoll, setIsLoadingPoll] = useState(false);

    useEffect(() => {
        if (organization && user) {
            checkMessages();
        }
    }, [organization, user]);

    useEffect(() => {
        const msg = messages[currentIndex];
        if (msg?.poll_id) {
            loadPoll(msg.poll_id);
        } else {
            setActivePoll(null);
        }
    }, [currentIndex, messages]);

    const loadPoll = async (pollId: string) => {
        setIsLoadingPoll(true);
        try {
            // Ideally we get single poll by ID, but fetchPolls gives all for organization.
            // We can filter or add single fetch. Since fetchPolls exists:
            const polls = await fetchPolls(organization!.id);
            const poll = polls.find(p => p.id === pollId);
            if (poll) {
                setActivePoll(poll);
            }
        } catch (error) {
            console.error('Error loading poll for popup:', error);
        } finally {
            setIsLoadingPoll(false);
        }
    };

    const checkMessages = async () => {
        try {
            if (!organization || !user) return;

            // 1. Fetch current user's person record to get team/role
            const { data: personData, error: personError } = await supabase
                .from('people')
                .select('id, team_id, role_ids')
                .eq('user_id', user.id)
                .eq('organization_id', organization.id)
                .maybeSingle();

            if (personError) console.error('Error fetching person record:', personError);

            const userTeamId = personData?.team_id;
            const userRoleIds = personData?.role_ids;

            // Check if user is super admin from profiles table
            const { data: profileData } = await supabase
                .from('profiles')
                .select('is_super_admin')
                .eq('id', user.id)
                .single();

            const isSuperAdmin = profileData?.is_super_admin || false;

            // 2. Fetch active popup messages
            // Super admins see ALL messages, regular users see only their org's messages
            const { data, error } = await supabase
                .from('system_messages')
                .select('*')
                .eq('is_active', true)
                .eq('message_type', 'POPUP')
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Filter by organization for non-super admins
            const orgFilteredData = isSuperAdmin
                ? data
                : data?.filter(msg => !msg.organization_id || msg.organization_id === organization.id);

            const seenMessages = JSON.parse(localStorage.getItem('miuim_seen_messages') || '[]');

            // 3. Filter relevant messages based on targeting and persistence
            const relevantMessages = [];

            for (const msg of (orgFilteredData || [])) {
                // A. Targeting Filter (skip for super admins)
                let isTargetedToMe = isSuperAdmin; // Super admins see everything

                if (!isSuperAdmin) {
                    const isPersonTargeted = msg.target_person_ids?.includes(personData?.id);
                    const isOrgTargeted = !msg.target_org_ids?.length || msg.target_org_ids.includes(organization.id);
                    const isTeamOrRoleTargeted =
                        (!msg.target_team_ids?.length && !msg.target_role_ids?.length) || // Everyone in Org
                        (userTeamId && msg.target_team_ids?.includes(userTeamId)) || // My team
                        (userRoleIds?.length && msg.target_role_ids?.some(roleId => userRoleIds.includes(roleId))); // My role

                    isTargetedToMe = isPersonTargeted || (isOrgTargeted && isTeamOrRoleTargeted);
                }

                if (!isTargetedToMe) continue;

                // B. Persistence Filter
                // Super admins: respect dismissed messages (localStorage) but ignore poll responses
                if (isSuperAdmin) {
                    // Check if message was manually dismissed
                    if (seenMessages.includes(msg.id)) {
                        continue; // Skip dismissed messages
                    }
                    // Show message regardless of poll response status
                    relevantMessages.push(msg);
                    continue;
                }

                // Regular users: check both localStorage and poll responses
                if (msg.poll_id) {
                    // If message has a poll, check database for response
                    try {
                        const hasResponded = await checkUserPollResponse(msg.poll_id, user.id);
                        if (!hasResponded) {
                            relevantMessages.push(msg);
                        }
                    } catch (err) {
                        console.error('Error checking poll response:', err);
                        // Fallback to local storage if DB check fails
                        if (!seenMessages.includes(msg.id)) relevantMessages.push(msg);
                    }
                } else {
                    // Regular message - check local storage
                    if (!seenMessages.includes(msg.id)) {
                        relevantMessages.push(msg);
                    }
                }
            }

            if (relevantMessages.length > 0) {
                setMessages(relevantMessages);
                setIsOpen(true);
            }
        } catch (error) {
            console.error('Error in checkMessages:', error);
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

    const currentMsg = messages[currentIndex];

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 overflow-y-auto">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
                        onClick={handleDismiss}
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200/50"
                    >
                        {/* Premium Header Decoration */}
                        <div className={`h-2 w-full ${activePoll ? 'bg-gradient-to-l from-indigo-500 to-blue-600' : 'bg-gradient-to-l from-blue-500 to-indigo-600'}`} />

                        <div className="p-6 md:p-10 relative">
                            {/* Dismiss Button for regular messages */}
                            {!activePoll && (
                                <button
                                    onClick={handleDismiss}
                                    className="absolute top-6 left-6 w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:bg-slate-100 transition-all z-10"
                                >
                                    <X size={20} weight="bold" />
                                </button>
                            )}

                            {activePoll ? (
                                <PollRenderer
                                    poll={activePoll}
                                    onComplete={handleDismiss}
                                    onExit={() => setIsOpen(false)}
                                />
                            ) : (
                                <div className="space-y-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-sm shadow-blue-100 shrink-0">
                                            <Megaphone size={28} weight="bold" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-widest">הודעה חדשה</span>
                                                {messages.length > 1 && (
                                                    <span className="text-[10px] font-black text-slate-400">({currentIndex + 1}/{messages.length})</span>
                                                )}
                                            </div>
                                            <h3 className="text-xl md:text-2xl font-black text-slate-900 leading-tight">{currentMsg.title || 'עדכון חשוב'}</h3>
                                        </div>
                                    </div>

                                    <div className="bg-slate-50/50 rounded-3xl p-6 md:p-8 border border-slate-100 min-h-[150px]">
                                        <div className="prose prose-slate max-w-none text-slate-700 whitespace-pre-wrap leading-relaxed font-medium md:text-lg">
                                            {currentMsg.message}
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-3 py-2">
                                        <button
                                            onClick={handleDismiss}
                                            className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl transition-all shadow-xl shadow-blue-200 flex items-center justify-center gap-2 text-lg active:scale-[0.98]"
                                        >
                                            {currentIndex < messages.length - 1 ? (
                                                <>
                                                    המשך להודעה הבאה
                                                    <CaretRight size={20} weight="bold" />
                                                </>
                                            ) : 'נשמע טוב, המשך'}
                                        </button>

                                        {messages.length > 1 && (
                                            <button
                                                onClick={handleDismissAll}
                                                className="w-full py-3 text-slate-400 hover:text-slate-600 text-xs font-black uppercase tracking-widest transition-all"
                                            >
                                                דלג על כל ההודעות
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Visual background elements */}
                        <div className="fixed -bottom-24 -right-24 w-64 h-64 bg-blue-50 rounded-full blur-3xl opacity-50 -z-10" />
                        <div className="fixed -top-24 -left-24 w-64 h-64 bg-indigo-50 rounded-full blur-3xl opacity-50 -z-10" />
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
