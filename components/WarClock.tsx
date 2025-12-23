
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Clock, Plus, Trash2, Edit2, Copy, Save, X, Eye, Users, Shield, Globe, ChevronUp, ChevronDown, Filter, AlertTriangle } from 'lucide-react';
import * as AllIcons from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Person, Team, Role } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '../contexts/ToastContext';

interface ScheduleItem {
    id: string;
    startTime: string; // "HH:MM"
    endTime: string;   // "HH:MM"
    description: string;
    targetType: 'all' | 'team' | 'role';
    targetId: string | null; // teamId or roleId
}

interface WarClockProps {
    myPerson: Person | undefined;
    teams: Team[];
    roles: Role[];
}

export const WarClock: React.FC<WarClockProps> = ({ myPerson, teams, roles }) => {
    const { profile, organization } = useAuth();
    const { showToast } = useToast();
    const canEdit = profile?.role === 'admin' || profile?.role === 'editor' || profile?.permissions?.canManageSettings;

    const [items, setItems] = useState<ScheduleItem[]>([]);
    const [isEditing, setIsEditing] = useState(false);
    const [editItem, setEditItem] = useState<Partial<ScheduleItem>>({});

    const [filters, setFilters] = useState<{
        mode: 'all' | 'custom';
        general: boolean;
        teams: string[];
        roles: string[];
    }>({ mode: 'all', general: false, teams: [], roles: [] });

    const [showFilters, setShowFilters] = useState(false);
    const [isOpen, setIsOpen] = useState(true);
    const scrollContainerRef = React.useRef<HTMLDivElement>(null);
    const [itemToDeleteId, setItemToDeleteId] = useState<string | null>(null);

    const fetchItems = async () => {
        let loadedFromDb = false;

        if (organization) {
            try {
                const { data, error } = await supabase
                    .from('war_clock_items')
                    .select('*')
                    .eq('organization_id', organization.id);

                if (error) throw error;

                if (data) {
                    const mappedItems: ScheduleItem[] = data.map(d => ({
                        id: d.id,
                        startTime: d.start_time,
                        endTime: d.end_time,
                        description: d.description,
                        targetType: d.target_type,
                        targetId: d.target_id
                    }));
                    mappedItems.sort((a, b) => a.startTime.localeCompare(b.startTime));
                    setItems(mappedItems);
                    loadedFromDb = true;
                }
            } catch (err) {
                console.error('Error fetching from DB, falling back to local:', err);
            }
        }

        if (!loadedFromDb) {
            const saved = localStorage.getItem('miuim_war_clock');
            if (saved) setItems(JSON.parse(saved));
        }
    };

    useEffect(() => {
        fetchItems();

        if (organization) {
            const channel = supabase
                .channel('war_clock_updates')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'war_clock_items', filter: `organization_id=eq.${organization.id}` }, () => {
                    fetchItems();
                })
                .subscribe();
            return () => { supabase.removeChannel(channel); };
        }
    }, [organization]);

    const handleSaveItem = async () => {
        if (!editItem.startTime || !editItem.endTime || !editItem.description) {
            showToast('נא למלא את כל השדות', 'error');
            return;
        }

        if (editItem.startTime > editItem.endTime) {
            showToast('שעת סיום חייבת להיות אחרי שעת התחלה', 'error');
            return;
        }

        const cleanTargetId = editItem.targetId && editItem.targetId.trim() !== '' ? editItem.targetId : null;

        // Try DB Save if Organization exists
        if (organization) {
            const payload = {
                organization_id: organization.id,
                start_time: editItem.startTime,
                end_time: editItem.endTime,
                description: editItem.description,
                target_type: editItem.targetType || 'all',
                target_id: cleanTargetId
            };

            try {
                // If editItem.id exists and is not a local-only ID, it's an update.
                // Otherwise, it's an insert (either new or promoting a local item).
                if (editItem.id && !editItem.id.startsWith('local-')) {
                    const { error } = await supabase.from('war_clock_items').update(payload).eq('id', editItem.id);
                    if (error) throw error;
                } else {
                    const { error } = await supabase.from('war_clock_items').insert(payload);
                    if (error) throw error;
                }

                showToast('האירוע נשמר בהצלחה', 'success');
                setIsEditing(false);
                setEditItem({});
                fetchItems();
                return;
            } catch (error) {
                console.error('DB Save failed:', error);
                showToast('שגיאה בשמירה לענן, שומר מקומית...', 'warning');
                // Fallthrough to local save
            }
        }

        // Local Save (Fallback or No Org)
        const newItem: ScheduleItem = {
            id: editItem.id || `local-${uuidv4()}`, // Ensure local items have a distinct ID
            startTime: editItem.startTime,
            endTime: editItem.endTime,
            description: editItem.description,
            targetType: editItem.targetType || 'all',
            targetId: cleanTargetId
        };

        const newItems = editItem.id
            ? items.map(i => i.id === newItem.id ? newItem : i)
            : [...items, newItem];

        newItems.sort((a, b) => a.startTime.localeCompare(b.startTime));

        localStorage.setItem('miuim_war_clock', JSON.stringify(newItems));
        setItems(newItems);
        setIsEditing(false);
        setEditItem({});
        if (!organization) showToast('נשמר מקומית (לא מחובר לארגון)', 'success');
    };

    const handleDelete = async (id: string) => {
        if (organization) {
            try {
                const { error } = await supabase.from('war_clock_items').delete().eq('id', id);
                if (error) throw error;
                showToast('האירוע נמחק', 'success');
                fetchItems();
                return;
            } catch (error) {
                console.error('DB Delete failed:', error);
                showToast('שגיאה במחיקה מהענן, מוחק מקומית...', 'warning');
            }
        }

        // Local Delete (Fallback or No Org)
        const newItems = items.filter(i => i.id !== id);
        localStorage.setItem('miuim_war_clock', JSON.stringify(newItems));
        setItems(newItems);
        showToast('האירוע נמחק מקומית', 'success');
        setItemToDeleteId(null);
    };

    const handleDuplicate = (item: ScheduleItem) => {
        setEditItem({
            ...item,
            id: undefined,
            description: `${item.description} (עותק)`
        });
        setIsEditing(true);
    };

    // Filter relevant items for display IF not editing (or show all if admin?)
    // Actually, usually admin wants to see what they are editing.
    // But specific soldier wants to see only relevant.
    // 1. Permission Based Filtering (Base)
    const baseItems = items.filter(item => {
        if (canEdit) return true; // Admin/Editor sees all available
        if (!myPerson) return item.targetType === 'all';
        if (item.targetType === 'all') return true;
        if (item.targetType === 'team' && myPerson.teamId === item.targetId) return true;
        if (item.targetType === 'role' && (myPerson.roleId === item.targetId || myPerson.roleIds?.includes(item.targetId || ''))) return true;
        return false;
    });

    // 2. View Filtering (User Selection)
    // 2. View Filtering (User Selection - Union Logic)
    const filteredItems = baseItems.filter(item => {
        if (filters.mode === 'all') return true;

        let match = false;
        if (filters.general && item.targetType === 'all') match = true;
        if (item.targetType === 'team' && filters.teams.includes(item.targetId || '')) match = true;
        if (item.targetType === 'role' && filters.roles.includes(item.targetId || '')) match = true;

        return match;
    });

    const minutesFromMidnight = (time: string) => {
        const [h, m] = time.split(':').map(Number);
        return h * 60 + m;
    };

    // Timeline Configuration
    const START_HOUR = 3; // 03:00
    const END_HOUR = 24;  // 24:00 / 00:00
    const PX_PER_MIN = 2; // Increased from 2 for visibility

    const timelineData = React.useMemo(() => {
        if (filteredItems.length === 0) return { items: [], height: 0 };

        const sorted = [...filteredItems].sort((a, b) => a.startTime.localeCompare(b.startTime));

        // 1. Group into Overlap Clusters for Width Calculation
        const clusters: ScheduleItem[][] = [];
        let currentCluster: ScheduleItem[] = [];
        let clusterEnd = -1;

        sorted.forEach(item => {
            const start = minutesFromMidnight(item.startTime);
            const end = minutesFromMidnight(item.endTime);

            if (currentCluster.length === 0) {
                currentCluster.push(item);
                clusterEnd = end;
            } else {
                if (start < clusterEnd) {
                    currentCluster.push(item);
                    clusterEnd = Math.max(clusterEnd, end);
                } else {
                    clusters.push(currentCluster);
                    currentCluster = [item];
                    clusterEnd = end;
                }
            }
        });
        if (currentCluster.length > 0) clusters.push(currentCluster);

        // 2. Calculate Layout Props
        const layoutItems: any[] = [];

        clusters.forEach(cluster => {
            // Apply Greedy Column Layout to Cluster
            const columns: ScheduleItem[][] = [];
            cluster.forEach(item => {
                const start = minutesFromMidnight(item.startTime);
                let placed = false;
                for (let col of columns) {
                    const lastInCol = col[col.length - 1];
                    if (minutesFromMidnight(lastInCol.endTime) <= start) {
                        col.push(item);
                        placed = true;
                        break;
                    }
                }
                if (!placed) columns.push([item]);
            });

            // Map to Absolute Position
            columns.forEach((col, colIdx) => {
                col.forEach(item => {
                    const startMin = minutesFromMidnight(item.startTime);
                    const endMin = minutesFromMidnight(item.endTime);
                    const startOffset = startMin - (START_HOUR * 60); // Offset from 06:00

                    const top = startOffset * PX_PER_MIN;
                    const height = (endMin - startMin) * PX_PER_MIN;
                    const widthPct = 100 / columns.length;
                    const leftPct = colIdx * widthPct;

                    layoutItems.push({
                        ...item,
                        layout: { top, height, leftPct, widthPct }
                    });
                });
            });
        });

        const totalMinutes = (END_HOUR - START_HOUR) * 60;
        return { items: layoutItems, height: totalMinutes * PX_PER_MIN };
    }, [filteredItems]);

    // Auto-scroll to current time on mount/open
    useEffect(() => {
        if (isOpen && scrollContainerRef.current) {
            const now = new Date();
            const currentHour = now.getHours();
            // Scroll to 1 hour before current time (for context)
            const scrollPx = Math.max(0, (currentHour - 1 - START_HOUR) * 60 * PX_PER_MIN);
            scrollContainerRef.current.scrollTop = scrollPx;
        }
    }, [isOpen, timelineData.height]);

    const getItemColor = (item: ScheduleItem) => {
        let rawColor = '';
        if (item.targetType === 'team') {
            rawColor = teams.find(t => t.id === item.targetId)?.color || '#3b82f6';
        } else if (item.targetType === 'role') {
            rawColor = roles.find(r => r.id === item.targetId)?.color || '#a855f7';
        } else {
            return '#94a3b8'; // Default Slate (All)
        }

        // Convert Tailwind classes to Hex by stripping prefixes
        const colorKey = rawColor.replace(/^(border-|bg-|text-)/, '');

        const mapping: Record<string, string> = {
            'red-500': '#ef4444',
            'orange-500': '#f97316',
            'yellow-500': '#eab308',
            'green-500': '#22c55e',
            'teal-500': '#14b8a6',
            'blue-500': '#3b82f6',
            'indigo-500': '#6366f1',
            'purple-500': '#a855f7',
            'pink-500': '#ec4899',
            'slate-500': '#64748b',
            'slate-400': '#94a3b8',
            'slate-300': '#cbd5e1',
            'slate-200': '#e2e8f0',
        };

        return mapping[colorKey] || (rawColor.startsWith('#') ? rawColor : '#94a3b8');
    };

    const getTargetLabel = (item: ScheduleItem) => {
        if (item.targetType === 'all') return 'כולם';
        if (item.targetType === 'team') return teams.find(t => t.id === item.targetId)?.name || 'צוות לא ידוע';
        if (item.targetType === 'role') return roles.find(r => r.id === item.targetId)?.name || 'תפקיד לא ידוע';
        return '';
    };

    const getTargetIcon = (type: string, targetId?: string | null) => {
        if (type === 'all') return <Globe size={14} />;
        if (type === 'team') return <Users size={14} />;
        if (type === 'role' && targetId) {
            const role = roles.find(r => r.id === targetId);
            // @ts-ignore
            if (role?.icon && AllIcons[role.icon]) {
                // @ts-ignore
                const IconComp = AllIcons[role.icon];
                return <IconComp size={14} />;
            }
        }
        return <Shield size={14} />;
    };



    return (
        <div className="w-full relative animate-in fade-in flex flex-col gap-4 transition-all">
            {/* Minimal Header */}
            <div
                className="flex items-center justify-between px-2 cursor-pointer hover:bg-slate-50/50 p-2 rounded-xl transition-colors select-none"
                onClick={() => setIsOpen(!isOpen)}
            >
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg transition-colors ${isOpen ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                        <Clock size={20} />
                    </div>
                    סדר יום
                    {!isOpen && <span className="text-xs font-normal text-slate-400 px-2 py-0.5 bg-slate-100 rounded-full">{timelineData.items.length} אירועים</span>}
                </h3>
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    {isOpen && (
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`p-2 rounded-full transition-colors ${showFilters || filters.mode !== 'all' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-400 hover:bg-slate-100'}`}
                        >
                            <Filter size={18} />
                        </button>
                    )}
                    {canEdit && isOpen && (
                        <button
                            onClick={() => { setEditItem({ targetType: 'all', startTime: '08:00', endTime: '09:00' }); setIsEditing(true); }}
                            className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 shadow-md shadow-blue-200"
                        >
                            <Plus size={18} />
                        </button>
                    )}
                    <button onClick={() => setIsOpen(!isOpen)} className="p-2 text-slate-400 hover:text-slate-600">
                        {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                </div>
            </div>

            {/* Collapsible Content */}
            {isOpen && (
                <div className="animate-in slide-in-from-top-4 duration-300 ease-out">

                    {/* Filters Banner */}
                    {showFilters && (
                        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm mb-4 z-20">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-bold text-slate-500 ml-2">הצג:</span>
                                <button onClick={() => setFilters({ mode: 'all', general: false, teams: [], roles: [] })} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filters.mode === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>הכל</button>

                                <div className="w-px h-4 bg-slate-300 mx-1"></div>

                                {canEdit ? (
                                    <>
                                        {/* Team Selector */}
                                        <div className="relative group">
                                            <select
                                                onChange={(e) => {
                                                    const id = e.target.value;
                                                    if (id && !filters.teams.includes(id)) setFilters(p => ({ ...p, mode: 'custom', teams: [...p.teams, id] }));
                                                }}
                                                value=""
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                            >
                                                <option value="" disabled>צוות +</option>
                                                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                            </select>
                                            <div className="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-50 text-slate-600 border border-slate-200 flex items-center gap-2 group-hover:bg-slate-100 group-hover:border-slate-300 transition-all">
                                                <span>צוות</span>
                                                <Plus size={14} className="text-slate-400" />
                                            </div>
                                        </div>

                                        {/* Role Selector */}
                                        <div className="relative group">
                                            <select
                                                onChange={(e) => {
                                                    const id = e.target.value;
                                                    if (id && !filters.roles.includes(id)) setFilters(p => ({ ...p, mode: 'custom', roles: [...p.roles, id] }));
                                                }}
                                                value=""
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                            >
                                                <option value="" disabled>תפקיד +</option>
                                                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                            </select>
                                            <div className="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-50 text-slate-600 border border-slate-200 flex items-center gap-2 group-hover:bg-slate-100 group-hover:border-slate-300 transition-all">
                                                <span>תפקיד</span>
                                                <Plus size={14} className="text-slate-400" />
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {myPerson?.teamId && (
                                            <button onClick={() => setFilters(p => ({ ...p, mode: 'custom', teams: p.teams.includes(myPerson.teamId!) ? p.teams.filter(t => t !== myPerson.teamId) : [...p.teams, myPerson.teamId!] }))} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filters.teams.includes(myPerson.teamId) ? 'bg-blue-100 text-blue-700' : 'bg-slate-50 text-slate-600'}`}>הצוות שלי</button>
                                        )}
                                        {myPerson?.roleId && (
                                            <button onClick={() => setFilters(p => ({ ...p, mode: 'custom', roles: p.roles.includes(myPerson.roleId!) ? p.roles.filter(r => r !== myPerson.roleId) : [...p.roles, myPerson.roleId!] }))} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filters.roles.includes(myPerson.roleId) ? 'bg-purple-100 text-purple-700' : 'bg-slate-50 text-slate-600'}`}>התפקיד שלי</button>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Active Chips */}
                            {(filters.teams.length > 0 || filters.roles.length > 0) && (
                                <div className="flex flex-wrap items-center gap-2 pt-3 mt-2 border-t border-slate-100">
                                    {filters.teams.map(tid => {
                                        const team = teams.find(t => t.id === tid);
                                        return (
                                            <span key={tid} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100 animate-in zoom-in-50">
                                                {team?.name}
                                                <button onClick={() => setFilters(prev => ({ ...prev, teams: prev.teams.filter(t => t !== tid) }))} className="hover:bg-blue-200 rounded p-0.5 transition-colors"><X size={12} /></button>
                                            </span>
                                        );
                                    })}
                                    {filters.roles.map(rid => {
                                        const role = roles.find(r => r.id === rid);
                                        return (
                                            <span key={rid} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-purple-50 text-purple-700 text-xs font-medium border border-purple-100 animate-in zoom-in-50">
                                                {role?.name}
                                                <button onClick={() => setFilters(prev => ({ ...prev, roles: prev.roles.filter(r => r !== rid) }))} className="hover:bg-purple-200 rounded p-0.5 transition-colors"><X size={12} /></button>
                                            </span>
                                        );
                                    })}
                                    <button onClick={() => setFilters({ mode: 'all', general: false, teams: [], roles: [] })} className="text-xs text-slate-400 hover:text-slate-600 underline px-2">נקה הכל</button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Timeline View - SCROLLABLE & LIMITED HEIGHT */}
                    <div
                        ref={scrollContainerRef}
                        className="relative w-full rounded-2xl bg-white shadow-sm border border-slate-100 overflow-y-auto scroll-smooth"
                        style={{ height: '400px', maxHeight: '60vh' }}
                    >
                        <div className="relative w-full" style={{ height: `${Math.max(timelineData.height, 400)}px` }}>
                            {/* Hour Grid */}
                            {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i).map(h => (
                                <div key={h} className="absolute w-full border-t border-slate-100" style={{ top: `${(h - START_HOUR) * 60 * PX_PER_MIN}px` }}>
                                    <span className="absolute -top-3 right-3 text-xs font-mono font-bold text-slate-300 bg-white px-1 z-10">
                                        {h.toString().padStart(2, '0')}:00
                                    </span>
                                </div>
                            ))}

                            {/* Current Time Indicator Line */}
                            {(() => {
                                const now = new Date();
                                const currentMin = now.getHours() * 60 + now.getMinutes();
                                const startMin = START_HOUR * 60;
                                if (currentMin >= startMin && currentMin <= END_HOUR * 60) {
                                    const top = (currentMin - startMin) * PX_PER_MIN;
                                    return (
                                        <div className="absolute w-full border-t-2 border-red-400 z-30 pointer-events-none flex items-center" style={{ top: `${top}px` }}>
                                            <div className="absolute right-0 -translate-y-1/2 w-2 h-2 rounded-full bg-red-500"></div>
                                        </div>
                                    );
                                }
                                return null;
                            })()}

                            {/* Empty State */}
                            {timelineData.items.length === 0 && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 pointer-events-none">
                                    <Clock size={48} className="opacity-20 mb-2" />
                                    <p className="text-sm font-medium">אין אירועים בטווח הזמן הזה</p>
                                </div>
                            )}

                            {/* Items */}
                            {timelineData.items.map(item => {
                                const { top, height, leftPct, widthPct } = item.layout;
                                const itemColor = getItemColor(item);
                                const isShort = height < 50;

                                return (
                                    <div
                                        key={item.id}
                                        className="absolute rounded-lg border-l-[3px] shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden group hover:z-50"
                                        style={{
                                            top: `${top}px`,
                                            height: `${height}px`,
                                            right: `${leftPct}%`,
                                            width: `${widthPct}%`,
                                            backgroundColor: itemColor + '15', // 10% opacity
                                            borderColor: itemColor
                                        }}
                                        onClick={() => { if (canEdit) { setEditItem(item); setIsEditing(true); } }}
                                    >
                                        <div className={`h-full w-full p-1.5 flex ${isShort ? 'flex-row items-center gap-2' : 'flex-col justify-start'}`}>
                                            <div className={`flex items-center gap-1 shrink-0 ${isShort ? '' : 'mb-0.5'}`}>
                                                <div style={{ color: itemColor }}>
                                                    {getTargetIcon(item.targetType, item.targetId)}
                                                </div>
                                                {!isShort && (
                                                    <span className="text-[10px] font-mono font-bold text-slate-400 leading-none">
                                                        {item.startTime}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <h4 className={`font-bold leading-none text-slate-900 ${isShort ? 'text-xs truncate' : 'text-sm md:text-base line-clamp-3'}`}>
                                                    {item.description}
                                                </h4>
                                                {isShort && (
                                                    <span className="text-[10px] text-slate-400 font-mono ml-1">{item.startTime}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Modals */}
            {isEditing && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-lg text-slate-800">{editItem.id ? 'עריכת אירוע' : 'אירוע חדש'}</h3>
                            <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500">התחלה</label>
                                    <input type="time" value={editItem.startTime || ''} onChange={e => setEditItem({ ...editItem, startTime: e.target.value })} className="w-full p-2 border rounded-lg bg-slate-50 focus:bg-white transition-colors" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500">סיום</label>
                                    <input type="time" value={editItem.endTime || ''} onChange={e => setEditItem({ ...editItem, endTime: e.target.value })} className="w-full p-2 border rounded-lg bg-slate-50 focus:bg-white transition-colors" />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500">תיאור</label>
                                <input type="text" value={editItem.description || ''} onChange={e => setEditItem({ ...editItem, description: e.target.value })} className="w-full p-2 border rounded-lg" placeholder="זמן מנוחה / שמירה..." />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500">שיוך</label>
                                <div className="grid grid-cols-3 gap-2 mb-2">
                                    <button onClick={() => setEditItem({ ...editItem, targetType: 'all', targetId: null })} className={`p-2 rounded-lg text-xs font-bold border ${editItem.targetType === 'all' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-slate-200 hover:bg-slate-50'}`}>כולם</button>
                                    <button onClick={() => setEditItem({ ...editItem, targetType: 'team', targetId: teams[0]?.id || null })} className={`p-2 rounded-lg text-xs font-bold border ${editItem.targetType === 'team' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-slate-200 hover:bg-slate-50'}`}>צוות</button>
                                    <button onClick={() => setEditItem({ ...editItem, targetType: 'role', targetId: roles[0]?.id || null })} className={`p-2 rounded-lg text-xs font-bold border ${editItem.targetType === 'role' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-slate-200 hover:bg-slate-50'}`}>תפקיד</button>
                                </div>
                                {editItem.targetType !== 'all' && (
                                    <select
                                        value={editItem.targetId || ''}
                                        onChange={e => setEditItem({ ...editItem, targetId: e.target.value })}
                                        className="w-full p-2 border rounded-lg text-sm bg-slate-50"
                                    >
                                        {(editItem.targetType === 'team' ? teams : roles).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                )}
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                            {editItem.id && (
                                <button onClick={() => { setItemToDeleteId(editItem.id!); setIsEditing(false); }} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={20} /></button>
                            )}
                            <div className="flex-1"></div>
                            <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-200 rounded-lg font-bold text-sm">ביטול</button>
                            <button onClick={handleSaveItem} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm shadow-lg shadow-blue-200 hover:bg-blue-700">שמור</button>
                        </div>
                    </div>
                </div>
            )}

            {itemToDeleteId && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95">
                        <h3 className="font-bold text-lg text-slate-800 mb-2">מחיקת אירוע?</h3>
                        <p className="text-slate-500 mb-6">פעולה זו לא ניתנת לביטול.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setItemToDeleteId(null)} className="flex-1 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200">ביטול</button>
                            <button onClick={() => { handleDelete(itemToDeleteId); setItemToDeleteId(null); }} className="flex-1 py-2 bg-red-500 text-white font-bold rounded-xl shadow-lg shadow-red-200 hover:bg-red-600">מחק</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
