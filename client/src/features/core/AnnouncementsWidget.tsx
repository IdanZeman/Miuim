import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../features/auth/AuthContext';
import { SystemMessage, Person } from '../../types';
import { Megaphone as MegaphoneIcon, CaretDown as ChevronDownIcon, CaretUp as ChevronUpIcon } from '@phosphor-icons/react';
import { format } from 'date-fns';

interface Props {
    myPerson?: Person;
}

export const AnnouncementsWidget: React.FC<Props> = ({ myPerson }) => {
    const { organization } = useAuth();
    const [messages, setMessages] = useState<SystemMessage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedIds, setExpandedIds] = useState<string[]>([]);

    useEffect(() => {
        if (organization && myPerson) {
            fetchMessages();
        }
    }, [organization, myPerson]);

    const fetchMessages = async () => {
        try {
            const { data, error } = await supabase
                .from('system_messages')
                .select('*')
                .eq('organization_id', organization?.id)
                .eq('is_active', true)
                .eq('message_type', 'BULLETIN')
                .order('created_at', { ascending: false });

            if (error) throw error;

            const relevantMessages = (data || []).filter(msg => {
                const hasTeamTarget = msg.target_team_ids && msg.target_team_ids.length > 0;
                const hasRoleTarget = msg.target_role_ids && msg.target_role_ids.length > 0;

                if (!hasTeamTarget && !hasRoleTarget) return true;

                const matchTeam = hasTeamTarget && myPerson?.teamId && msg.target_team_ids.includes(myPerson.teamId);
                const matchRole = hasRoleTarget && myPerson?.roleId && msg.target_role_ids.includes(myPerson.roleId);

                return matchTeam || matchRole;
            });

            setMessages(relevantMessages);
        } catch (error) {
            console.error('Error fetching announcements:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleExpand = (id: string) => {
        setExpandedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    if (isLoading) return null;
    if (messages.length === 0) return null;

    return (
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 mb-6 overflow-hidden flex flex-col max-h-[500px]">
            {/* Minimal Header */}
            <div className="bg-slate-50/50 px-4 md:px-5 py-2.5 md:py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <MegaphoneIcon size={16} className="text-indigo-600" weight="bold" />
                    <h2 className="text-sm md:text-base font-bold text-slate-800">עדכונים</h2>
                </div>
                <span className="text-[9px] md:text-[10px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded-full border border-slate-100">
                    {messages.length} חדשים
                </span>
            </div>

            {/* Compact List - Fixed Height with Scroll */}
            <div className="overflow-y-auto p-4 custom-scrollbar flex-1">
                <div className="space-y-0">
                    {messages.map((msg, index) => {
                        const isLast = index === messages.length - 1;
                        const isExpanded = expandedIds.includes(msg.id);
                        const isLong = msg.message.length > 80 || msg.message.includes('\n');

                        return (
                            <div key={msg.id} className="flex gap-3 relative">
                                {/* Timeline Line */}
                                <div className="flex flex-col items-center w-4 shrink-0">
                                    <div className="w-2 h-2 rounded-full bg-indigo-100 border border-indigo-300 mt-2 shrink-0 relative z-10"></div>
                                    {!isLast && <div className="w-px bg-slate-100 h-full absolute top-3 bottom-[-12px] right-[7px] -z-0"></div>}
                                </div>

                                {/* Content */}
                                <div className={`flex-1 min-w-0 pb-6 ${isLast ? '' : 'border-b-0 border-slate-50'}`}>
                                    <div className="flex items-baseline gap-2 mb-1 flex-wrap">
                                        <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-md whitespace-nowrap">
                                            {format(new Date(msg.created_at), 'dd/MM')}
                                        </span>
                                        {msg.title && (
                                            <h3 className="font-bold text-slate-800 text-sm leading-tight">
                                                {msg.title}
                                            </h3>
                                        )}
                                    </div>

                                    <div
                                        className={`text-slate-600 text-xs leading-relaxed whitespace-pre-wrap ${!isExpanded && isLong ? 'line-clamp-2' : ''
                                            }`}
                                    >
                                        {msg.message}
                                    </div>

                                    {isLong && (
                                        <button
                                            onClick={() => toggleExpand(msg.id)}
                                            className="text-[10px] font-bold text-slate-400 hover:text-indigo-600 mt-1 flex items-center gap-1 transition-colors"
                                        >
                                            {isExpanded ? (
                                                <>הצג פחות <ChevronUpIcon size={10} weight="bold" /></>
                                            ) : (
                                                <>קרא עוד <ChevronDownIcon size={10} weight="bold" /></>
                                            )}
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
