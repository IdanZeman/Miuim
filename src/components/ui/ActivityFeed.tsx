import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, ClockCounterClockwise, Calendar, Funnel, CaretDown, Check, MagnifyingGlass as SearchIcon } from '@phosphor-icons/react';
import { AuditLog } from '@/services/auditService';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { Person, TaskTemplate, Team } from '@/types';
import { useActivityLogs } from '@/hooks/useActivityLogs';
import { DatePicker } from './DatePicker';

interface ActivityFeedProps {
    onClose: () => void;
    organizationId: string;
    onLogClick?: (log: AuditLog) => void;
    people: Person[];
    tasks?: TaskTemplate[];
    teams?: Team[];
    entityTypes?: string[];
    initialFilters?: import('@/services/auditService').LogFilters;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = React.memo(({ onClose, organizationId, onLogClick, people = [], tasks = [], teams = [], entityTypes, initialFilters }) => {
    const { logs, isLoading, isLoadingMore, hasMore, filters, updateFilters, loadMore } = useActivityLogs({ organizationId, entityTypes, initialFilters });
    const observerTarget = useRef<HTMLDivElement>(null);
    const personSelectRef = useRef<HTMLDivElement>(null);

    const [showFilters, setShowFilters] = useState(false);
    const [personSelectorOpen, setPersonSelectorOpen] = useState(false);
    const [personSearchTerm, setPersonSearchTerm] = useState('');
    const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(new Set());

    // Close person selector on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (personSelectRef.current && !personSelectRef.current.contains(event.target as Node)) {
                setPersonSelectorOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Infinite scroll observer
    useEffect(() => {
        const target = observerTarget.current;
        if (!target || !hasMore || isLoadingMore || isLoading) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    loadMore();
                }
            },
            { threshold: 0.1, rootMargin: '100px' }
        );

        observer.observe(target);
        return () => observer.disconnect();
    }, [hasMore, isLoadingMore, isLoading, loadMore]);

    const formatLogMessage = (log: AuditLog) => {
        const userName = log.user_name || 'מערכת';

        if (log.entity_type === 'shift') {
            const personName = log.metadata?.personName || 'חייל';
            const action = log.event_type;

            if (action === 'ASSIGN') {
                return (
                    <div className="flex flex-col gap-1 w-full">
                        <div className="text-right text-xs leading-relaxed text-slate-600">
                            <span className="font-black text-slate-900">{userName}</span>
                            <span> שיבץ את </span>
                            <span className="font-black text-slate-900">{personName}</span>
                            <span> למשמרת</span>
                        </div>
                        {log.metadata?.taskName && (
                            <div className="flex items-center gap-2 mt-1 bg-slate-50 p-1.5 rounded-lg border border-slate-100/50">
                                <div className="w-1 h-3 rounded-full bg-blue-500"></div>
                                <span className="text-[10px] font-bold text-slate-700">{log.metadata.taskName}</span>
                                {(log.metadata.startTime && log.metadata.endTime) && (
                                    <span className="text-[9px] text-black font-black font-mono border-r border-slate-200 pr-2 mr-auto" dir="ltr">
                                        {format(new Date(log.metadata.startTime), 'dd/MM')} | {format(new Date(log.metadata.startTime), 'HH:mm')} - {format(new Date(log.metadata.endTime), 'HH:mm')}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                );
            } else if (action === 'UNASSIGN') {
                return (
                    <div className="flex flex-col gap-1 w-full">
                        <div className="text-right text-xs leading-relaxed text-slate-600">
                            <span className="font-black text-slate-900">{userName}</span>
                            <span> הסיר את </span>
                            <span className="font-black text-slate-900">{personName}</span>
                            <span> מהמשמרת</span>
                        </div>
                        {log.metadata?.taskName && (
                            <div className="flex items-center gap-2 mt-1 bg-red-50 p-1.5 rounded-lg border border-red-100/50">
                                <div className="w-1 h-3 rounded-full bg-red-500"></div>
                                <span className="text-[10px] font-bold text-slate-700 line-through decoration-red-500/50">{log.metadata.taskName}</span>
                                {(log.metadata.startTime && log.metadata.endTime) && (
                                    <span className="text-[9px] text-black font-black font-mono border-r border-red-200 pr-2 mr-auto" dir="ltr">
                                        {format(new Date(log.metadata.startTime), 'dd/MM')} | {format(new Date(log.metadata.startTime), 'HH:mm')} - {format(new Date(log.metadata.endTime), 'HH:mm')}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                );
            } else {
                return (
                    <div className="text-right text-xs leading-relaxed text-slate-600">
                        <span className="font-black text-slate-900">{userName}</span>
                        <span> {log.action_description}</span>
                    </div>
                );
            }
        }

        const soldierName = log.entity_name || log.metadata?.entity_name || 'חייל';
        const oldVal = log.before_data || 'לא ידוע';
        const newVal = log.after_data || 'לא ידוע';

        const translateStatus = (status: any, currentLog: AuditLog) => {
            if (typeof status !== 'string') return JSON.stringify(status);
            const map: Record<string, string> = {
                'base': 'בסיס', 'home': 'בית', 'full': 'בסיס (יום שלם)', 'arrival': 'הגעה', 'departure': 'יציאה',
                'unavailable': 'אילוץ', 'leave_shamp': 'חופשה בשמפ', 'gimel': "ג'", 'absent': 'נפקד',
                'organization_days': 'ימי התארגנות', 'not_in_shamp': 'לא בשמ"פ'
            };
            if (map[status]) return map[status];
            let translated = status;
            const hType = currentLog.metadata?.homeStatusType;
            if (hType && (status === 'home' || status === 'בית')) return `בית (${map[hType] || hType})`;
            translated = translated.replace(/\(([^)]+)\)/g, (match: string, p1: string) => {
                const key = p1.trim();
                return `(${map[key] || key})`;
            });
            Object.entries(map).forEach(([key, val]) => {
                if (translated === key) translated = val;
            });
            return translated;
        };

        return (
            <div className="text-right text-xs leading-relaxed text-slate-600">
                <span className="font-black text-slate-900">{userName}</span>
                <span> שינה את הערך מ-</span>
                <span className="font-bold text-blue-600/80">{translateStatus(oldVal, log)}</span>
                <span> ל-</span>
                <span className="font-bold text-emerald-600/80">{translateStatus(newVal, log)}</span>
                <span> עבור החייל </span>
                <span className="font-black text-slate-900">{soldierName}</span>
            </div>
        );
    };

    const [draftFilters, setDraftFilters] = useState(filters);
    useEffect(() => { setDraftFilters(filters); }, [filters]);

    const handleApplyFilters = () => {
        updateFilters(draftFilters);
        setShowFilters(false);
    };

    const handleClearFilters = () => {
        const cleared = { personId: undefined, taskId: undefined, date: undefined, createdDate: undefined, entityId: undefined, startTime: undefined };
        setDraftFilters(cleared);
        updateFilters(cleared);
    };

    const hasActiveFilters = !!(filters.personId || filters.date || filters.createdDate || filters.taskId || filters.entityId || filters.startTime);

    const peopleByTeam = React.useMemo(() => {
        const grouped: Record<string, Person[]> = {};
        const noTeam: Person[] = [];
        people.forEach(p => {
            if (p.isActive === false) return; // Filter out inactive
            if (p.teamId) {
                if (!grouped[p.teamId]) grouped[p.teamId] = [];
                grouped[p.teamId].push(p);
            } else {
                noTeam.push(p);
            }
        });
        return { grouped, noTeam };
    }, [people]);

    const getTeamName = (teamId: string) => {
        const team = teams.find(t => t.id === teamId);
        return team ? team.name : 'צוות ' + teamId;
    };

    const filteredPeopleByTeam = React.useMemo(() => {
        const lowerSearch = personSearchTerm.toLowerCase().trim();
        const grouped: Record<string, Person[]> = {};
        const noTeam: Person[] = [];

        people.forEach(p => {
            if (p.isActive === false) return;
            if (lowerSearch && !p.name.toLowerCase().includes(lowerSearch)) return;

            if (p.teamId) {
                if (!grouped[p.teamId]) grouped[p.teamId] = [];
                grouped[p.teamId].push(p);
            } else {
                noTeam.push(p);
            }
        });
        return { grouped, noTeam };
    }, [people, personSearchTerm]);

    const totalFilteredCount = useMemo(() => {
        return filteredPeopleByTeam.noTeam.length + Object.values(filteredPeopleByTeam.grouped).reduce((acc, current) => acc + current.length, 0);
    }, [filteredPeopleByTeam]);

    const toggleTeamCollapse = (teamId: string) => {
        const next = new Set(collapsedTeams);
        if (next.has(teamId)) next.delete(teamId);
        else next.add(teamId);
        setCollapsedTeams(next);
    };

    return createPortal(
        <div className="fixed top-[8.5rem] md:top-16 bottom-0 right-0 w-full md:w-96 bg-white/80 backdrop-blur-2xl border-l border-slate-200 flex flex-col h-[calc(100%-8.5rem)] md:h-[calc(100%-64px)] shadow-[0_0_50px_-12px_rgba(0,0,0,0.25)] z-[10001] animate-in slide-in-from-right duration-500 overflow-hidden" dir="rtl">
            <div className="p-3 md:p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
                        <ClockCounterClockwise size={18} weight="bold" />
                    </div>
                    <div>
                        <h3 className="font-black text-slate-800 tracking-tight text-sm md:text-base leading-none">היסטוריית שינויים</h3>
                        <span className="text-[10px] text-slate-400 font-bold">{hasActiveFilters ? 'פעיל סינון' : 'מציג הכל'}</span>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={() => setShowFilters(!showFilters)} className={`p-1.5 rounded-lg transition-colors ${showFilters || hasActiveFilters ? 'bg-blue-100 text-blue-600' : 'hover:bg-slate-200 text-slate-400'}`} title="סינון">
                        <Funnel size={20} weight={hasActiveFilters ? "fill" : "bold"} />
                    </button>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 transition-colors">
                        <X size={20} weight="bold" />
                    </button>
                </div>
            </div>

            {showFilters && (
                <div className="p-3 bg-white border-b border-slate-100 gap-3 flex flex-col shadow-sm animate-in slide-in-from-top-2 duration-200">
                    <div className={`grid ${filters.entityTypes?.includes('shift') ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
                        <div className="relative" ref={personSelectRef}>
                            <label className="text-[10px] font-bold text-slate-500 mb-1 block">לוחם</label>
                            <button
                                onClick={() => setPersonSelectorOpen(!personSelectorOpen)}
                                className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs font-bold text-slate-700 hover:bg-white hover:border-blue-400 transition-all outline-none"
                            >
                                <span className="truncate">
                                    {draftFilters.personId ? (people.find(p => p.id === draftFilters.personId)?.name || 'חייל לא נמצא') : 'הכל'}
                                </span>
                                <CaretDown size={14} className={`text-slate-400 transition-transform ${personSelectorOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {personSelectorOpen && (
                                <div className="absolute top-full mt-2 left-0 right-0 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[10001] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 origin-top">
                                    <div className="p-2 border-b border-slate-100 bg-slate-50/50">
                                        <div className="relative">
                                            <SearchIcon size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="text"
                                                placeholder="חיפוש חייל..."
                                                value={personSearchTerm}
                                                onChange={(e) => setPersonSearchTerm(e.target.value)}
                                                className="w-full h-8 pr-9 pl-3 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all font-bold"
                                                autoFocus
                                            />
                                        </div>
                                    </div>

                                    <div className="max-h-64 overflow-y-auto custom-scrollbar p-1">
                                        <button
                                            onClick={() => {
                                                setDraftFilters(prev => ({ ...prev, personId: undefined }));
                                                setPersonSelectorOpen(false);
                                                setPersonSearchTerm('');
                                            }
                                            }
                                            className={`w-full text-right px-3 py-2 rounded-lg text-xs font-bold transition-colors mb-0.5 ${!draftFilters.personId ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-50 text-slate-600'}`}
                                        >
                                            הכל
                                        </button>

                                        {/* No Team */}
                                        {filteredPeopleByTeam.noTeam.length > 0 && (
                                            <div className="mb-1">
                                                <div className="px-3 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">ללא צוות</div>
                                                {filteredPeopleByTeam.noTeam.map(p => (
                                                    <button
                                                        key={p.id}
                                                        onClick={() => {
                                                            setDraftFilters(prev => ({ ...prev, personId: p.id }));
                                                            setPersonSelectorOpen(false);
                                                            setPersonSearchTerm('');
                                                        }}
                                                        className={`w-full text-right px-4 py-2 rounded-lg text-xs font-bold transition-colors mb-0.5 ${draftFilters.personId === p.id ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-50 text-slate-600'}`}
                                                    >
                                                        {p.name}
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {/* Grouped by Team */}
                                        {Object.entries(filteredPeopleByTeam.grouped).map(([teamId, members]) => {
                                            const isCollapsed = collapsedTeams.has(teamId);
                                            const teamName = getTeamName(teamId);

                                            return (
                                                <div key={teamId} className="mb-0.5">
                                                    <button
                                                        onClick={() => toggleTeamCollapse(teamId)}
                                                        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-slate-50 rounded-lg transition-colors group"
                                                    >
                                                        <span className="text-[10px] font-black text-slate-400 group-hover:text-slate-600 uppercase tracking-widest">{teamName}</span>
                                                        <CaretDown size={10} className={`text-slate-300 group-hover:text-slate-500 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                                                    </button>
                                                    {!isCollapsed && members.map(p => (
                                                        <button
                                                            key={p.id}
                                                            onClick={() => {
                                                                setDraftFilters(prev => ({ ...prev, personId: p.id }));
                                                                setPersonSelectorOpen(false);
                                                                setPersonSearchTerm('');
                                                            }}
                                                            className={`w-full text-right px-4 py-2 rounded-lg text-xs font-bold transition-colors mb-0.5 ${draftFilters.personId === p.id ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-50 text-slate-600'}`}
                                                        >
                                                            {p.name}
                                                        </button>
                                                    ))}
                                                </div>
                                            );
                                        })}

                                        {totalFilteredCount === 0 && (
                                            <div className="p-4 text-center text-[10px] font-bold text-slate-400">לא נמצאו תוצאות</div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        {filters.entityTypes?.includes('shift') && (
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 mb-1 block">משימה</label>
                                <div className="relative">
                                    <select value={draftFilters.taskId || ''} onChange={(e) => setDraftFilters(prev => ({ ...prev, taskId: e.target.value || undefined }))} className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl h-9 px-2 outline-none focus:border-blue-500 appearance-none">
                                        <option value="">הכל</option>
                                        {tasks.sort((a, b) => a.name.localeCompare(b.name)).map(t => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                    <CaretDown size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="grid grid-cols-1">
                        <DatePicker
                            value={draftFilters.createdDate || ''}
                            onChange={(val) => setDraftFilters(prev => ({ ...prev, createdDate: val || undefined }))}
                            variant="compact"
                            label="תאריך עריכה"
                            className="w-full"
                        />
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                        <button onClick={handleApplyFilters} className="flex-1 h-9 bg-blue-600 text-white rounded-xl text-xs font-black hover:bg-blue-700 transition-colors shadow-sm flex items-center justify-center gap-2">
                            <Check size={14} weight="bold" />
                            <span>החל סינון</span>
                        </button>
                        {(draftFilters.personId || draftFilters.date || draftFilters.taskId) && (
                            <button onClick={handleClearFilters} className="px-3 h-9 bg-slate-100 text-slate-500 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors">נקה</button>
                        )}
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 md:p-3 space-y-3">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
                        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-bold">טוען פעולות...</span>
                    </div>
                ) : logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400 opacity-60 p-4">
                        <ClockCounterClockwise size={48} weight="thin" className="animate-pulse" />
                        <div className="text-center">
                            <span className="text-sm font-bold block mb-1">אין היסטוריה זמינה</span>
                            {hasActiveFilters ? (
                                <p className="text-[10px] leading-relaxed">
                                    לא נמצאו רשומות התואמות את הסינון הנבחר.
                                    {filters.date && <span className="block mt-1">תאריך: {filters.date}</span>}
                                    {filters.personId && <span className="block italic">עבור חייל ספציפי</span>}
                                </p>
                            ) : (
                                <p className="text-[10px]">טרם בוצעו שינויים שניתן להציג.</p>
                            )}
                        </div>
                        {hasActiveFilters && (
                            <button
                                onClick={handleClearFilters}
                                className="text-[11px] text-blue-600 font-black hover:underline mt-2"
                            >
                                נקה את כל המסננים
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        {logs.map((log) => (
                            <div key={log.id} onClick={() => onLogClick?.(log)} className={`p-3 bg-white/40 rounded-2xl border border-slate-100 hover:border-blue-200 hover:bg-white hover:shadow-sm transition-all group ${onLogClick ? 'cursor-pointer active:scale-[0.98]' : ''}`}>
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-black text-slate-400 tracking-widest uppercase mb-0.5">זמן עריכה</span>
                                        <span className="text-[10px] font-bold text-slate-600">{format(new Date(log.created_at), 'HH:mm • dd/MM/yy', { locale: he })}</span>
                                    </div>
                                    <div className="w-2 h-2 rounded-full bg-blue-100 group-hover:bg-blue-400 transition-colors" />
                                </div>
                                {formatLogMessage(log)}
                                {(() => {
                                    const targetDate = log.metadata?.date || (log.metadata?.startTime ? format(new Date(log.metadata.startTime), 'yyyy-MM-dd') : null);
                                    if (!targetDate) return null;
                                    return (
                                        <div className="mt-2 flex items-center gap-1.5 text-[9px] text-blue-600 font-bold bg-blue-50/50 px-2 py-1 rounded-lg w-fit border border-blue-100/50">
                                            <Calendar size={12} weight="bold" />
                                            <span>עבור יום: {targetDate}</span>
                                        </div>
                                    );
                                })()}
                            </div>
                        ))}
                        <div ref={observerTarget} className="h-4 w-full flex items-center justify-center">
                            {hasMore && (
                                <div className="p-2">
                                    {isLoadingMore ? (
                                        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <span className="text-[10px] font-bold text-slate-300 italic">טוען עוד...</span>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>,
        document.body
    );
});
