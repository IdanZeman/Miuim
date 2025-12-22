
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
    const [isOpen, setIsOpen] = useState(true);
    const [filters, setFilters] = useState<{
        mode: 'all' | 'custom';
        general: boolean;
        teams: string[];
        roles: string[];
    }>({ mode: 'all', general: false, teams: [], roles: [] });
    const [showFilters, setShowFilters] = useState(false);
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

    const clusters = (() => {
        if (filteredItems.length === 0) return [];
        const sorted = [...filteredItems].sort((a, b) => a.startTime.localeCompare(b.startTime));

        const result: { start: number, end: number, items: ScheduleItem[] }[] = [];
        let currentCluster: ScheduleItem[] = [];
        let clusterEnd = -1;
        let clusterStart = -1;

        sorted.forEach(item => {
            const start = minutesFromMidnight(item.startTime);
            const end = minutesFromMidnight(item.endTime);

            if (currentCluster.length === 0) {
                currentCluster.push(item);
                clusterStart = start;
                clusterEnd = end;
            } else {
                if (start < clusterEnd) {
                    // Overlap
                    currentCluster.push(item);
                    clusterEnd = Math.max(clusterEnd, end);
                } else {
                    // New Cluster
                    result.push({ start: clusterStart, end: clusterEnd, items: currentCluster });
                    currentCluster = [item];
                    clusterStart = start;
                    clusterEnd = end;
                }
            }
        });
        if (currentCluster.length > 0) result.push({ start: clusterStart, end: clusterEnd, items: currentCluster });
        return result;
    })();

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

    // Helper for duration visualization
    const getDurationMin = (start: string, end: string) => {
        const [h1, m1] = start.split(':').map(Number);
        const [h2, m2] = end.split(':').map(Number);
        return (h2 * 60 + m2) - (h1 * 60 + m1);
    };

    return (
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm relative overflow-hidden transition-all duration-300">
            <div className="flex items-center justify-between mb-6">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-3 group text-left"
                >
                    <div className={`p-2 rounded-xl transition-colors ${isOpen ? 'bg-red-50 text-red-500' : 'bg-slate-50 text-slate-400 group-hover:text-red-500'}`}>
                        <Clock size={24} />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            שעון לחימה / סדר יום
                        </h3>
                        {!isOpen && items.length > 0 && (
                            <p className="text-xs text-slate-400 font-medium">
                                {items.length} אירועים מתוכננים
                            </p>
                        )}
                    </div>
                    <div className="mr-2 text-slate-300 group-hover:text-slate-500 transition-colors">
                        {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                </button>

                <div className="flex items-center gap-2">
                    {isOpen && (
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`p-2 rounded-full transition-colors relative ${showFilters || filters.mode !== 'all' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-400 hover:text-indigo-600'}`}
                            title="סינון"
                        >
                            <Filter size={20} />
                            {filters.mode !== 'all' && <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-indigo-500 rounded-full border-2 border-white"></span>}
                        </button>
                    )}

                    {canEdit && isOpen && (
                        <button
                            onClick={() => {
                                setEditItem({ targetType: 'all', startTime: '08:00', endTime: '09:00' });
                                setIsEditing(true);
                            }}
                            className="p-2 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition-colors"
                            title="הוסף אירוע"
                        >
                            <Plus size={20} />
                        </button>
                    )}
                </div>
            </div>

            {isOpen && (
                <div className="animate-in slide-in-from-top-2 duration-300">

                    {showFilters && (
                        <div className="mb-6 p-4 bg-slate-50 rounded-xl animate-in slide-in-from-top-1 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-bold text-slate-500 ml-2">הצג:</span>

                                {/* All Button */}
                                <button
                                    onClick={() => setFilters({ mode: 'all', general: false, teams: [], roles: [] })}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filters.mode === 'all' ? 'bg-white shadow-sm text-slate-900 ring-1 ring-slate-200' : 'text-slate-500 hover:bg-white/50'}`}
                                >
                                    הכל
                                </button>

                                {/* General Button */}
                                <button
                                    onClick={() => setFilters(prev => ({ ...prev, mode: 'custom', general: !prev.general }))}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${filters.mode === 'custom' && filters.general ? 'bg-white shadow-sm text-indigo-700 ring-1 ring-indigo-200' : 'text-slate-500 hover:bg-white/50'}`}
                                >
                                    <Globe size={14} /> כללי
                                </button>

                                <div className="w-px h-4 bg-slate-300 mx-1"></div>

                                {/* Team Select/Toggle */}
                                {canEdit ? (
                                    <div className="relative">
                                        <select
                                            value=""
                                            onChange={(e) => {
                                                const id = e.target.value;
                                                if (id && !filters.teams.includes(id)) {
                                                    setFilters(prev => ({ ...prev, mode: 'custom', teams: [...prev.teams, id] }));
                                                }
                                            }}
                                            className="px-3 py-1.5 pr-8 rounded-lg text-sm font-medium appearance-none outline-none focus:ring-2 focus:ring-blue-500 transition-shadow bg-transparent text-slate-500 hover:bg-white/50 cursor-pointer"
                                        >
                                            <option value="" disabled>+ הוסף צוות</option>
                                            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                        </select>
                                        <Users size={14} className="absolute top-1/2 -translate-y-1/2 right-2.5 pointer-events-none opacity-50" />
                                    </div>
                                ) : (
                                    myPerson?.teamId && (
                                        <button
                                            onClick={() => setFilters(prev => {
                                                const id = myPerson.teamId!;
                                                const isActive = prev.teams.includes(id);
                                                return {
                                                    ...prev,
                                                    mode: 'custom',
                                                    teams: isActive ? prev.teams.filter(t => t !== id) : [...prev.teams, id]
                                                };
                                            })}
                                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${filters.teams.includes(myPerson.teamId) ? 'bg-white shadow-sm text-blue-700 ring-1 ring-slate-200' : 'text-slate-500 hover:bg-white/50'}`}
                                        >
                                            <Users size={14} /> הצוות שלי
                                        </button>
                                    )
                                )}

                                {/* Role Select/Toggle */}
                                {canEdit ? (
                                    <div className="relative">
                                        <select
                                            value=""
                                            onChange={(e) => {
                                                const id = e.target.value;
                                                if (id && !filters.roles.includes(id)) {
                                                    setFilters(prev => ({ ...prev, mode: 'custom', roles: [...prev.roles, id] }));
                                                }
                                            }}
                                            className="px-3 py-1.5 pr-8 rounded-lg text-sm font-medium appearance-none outline-none focus:ring-2 focus:ring-purple-500 transition-shadow bg-transparent text-slate-500 hover:bg-white/50 cursor-pointer"
                                        >
                                            <option value="" disabled>+ הוסף תפקיד</option>
                                            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                        </select>
                                        <Shield size={14} className="absolute top-1/2 -translate-y-1/2 right-2.5 pointer-events-none opacity-50" />
                                    </div>
                                ) : (
                                    myPerson?.roleId && (
                                        <button
                                            onClick={() => setFilters(prev => {
                                                const id = myPerson.roleId!;
                                                const isActive = prev.roles.includes(id);
                                                return {
                                                    ...prev,
                                                    mode: 'custom',
                                                    roles: isActive ? prev.roles.filter(r => r !== id) : [...prev.roles, id]
                                                };
                                            })}
                                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${filters.roles.includes(myPerson.roleId) ? 'bg-white shadow-sm text-purple-700 ring-1 ring-slate-200' : 'text-slate-500 hover:bg-white/50'}`}
                                        >
                                            <Shield size={14} /> התפקיד שלי
                                        </button>
                                    )
                                )}
                            </div>

                            {/* Active Chips */}
                            {(filters.teams.length > 0 || filters.roles.length > 0) && (
                                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/50">
                                    {filters.teams.map(tid => {
                                        const team = teams.find(t => t.id === tid);
                                        return (
                                            <span key={tid} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100">
                                                {team?.name || 'Unknown Team'}
                                                <button onClick={() => setFilters(prev => ({ ...prev, teams: prev.teams.filter(t => t !== tid) }))} className="hover:text-blue-900"><X size={12} /></button>
                                            </span>
                                        );
                                    })}
                                    {filters.roles.map(rid => {
                                        const role = roles.find(r => r.id === rid);
                                        return (
                                            <span key={rid} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-purple-50 text-purple-700 text-xs font-medium border border-purple-100">
                                                {role?.name || 'Unknown Role'}
                                                <button onClick={() => setFilters(prev => ({ ...prev, roles: prev.roles.filter(r => r !== rid) }))} className="hover:text-purple-900"><X size={12} /></button>
                                            </span>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {items.length === 0 && !isEditing ? (
                        <div className="text-center py-8 text-slate-400">
                            <p>לא הוגדר סדר יום להיום</p>
                        </div>
                    ) : (
                        <div className="space-y-8 relative pr-4 md:pr-0">
                            <div className="absolute top-4 bottom-4 right-[7.5rem] w-0.5 bg-slate-100 hidden md:block"></div>

                            {baseItems.length === 0 && items.length > 0 && !canEdit && (
                                <div className="text-center py-8 text-slate-400">
                                    <p>אין אירועים רלוונטיים עבורך היום</p>
                                </div>
                            )}

                            {filteredItems.length === 0 && baseItems.length > 0 && (
                                <div className="text-center py-8 text-slate-400">
                                    <p>לא נמצאו אירועים התואמים לסינון</p>
                                </div>
                            )}

                            {clusters.map((cluster, cIdx) => {
                                const height = (cluster.end - cluster.start) * 2; // Pixel per minute

                                // Calculate Columns greedy
                                const columns: ScheduleItem[][] = [];
                                cluster.items.forEach(item => {
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

                                return (
                                    <div key={cIdx} className="relative mb-8" style={{ height: `${Math.max(height, 80)}px` }}>
                                        {/* Time Label */}
                                        <div className="hidden md:flex flex-col items-end w-20 flex-shrink-0 absolute right-0 -top-3 text-right">
                                            <span className="font-mono font-bold text-lg text-slate-600">
                                                {cluster.items[0].startTime}
                                            </span>
                                        </div>

                                        {/* Items Grid */}
                                        <div className="mr-24 relative h-full">
                                            {columns.map((col, colIdx) => (
                                                col.map(item => {
                                                    const itemStart = minutesFromMidnight(item.startTime);
                                                    const itemEnd = minutesFromMidnight(item.endTime);

                                                    const top = (itemStart - cluster.start) * 2;
                                                    const h = (itemEnd - itemStart) * 2;
                                                    const gap = columns.length > 1 ? 2 : 0; // 2% gap if multiple columns
                                                    const width = (100 - (columns.length - 1) * gap) / columns.length;
                                                    const right = colIdx * (width + gap);

                                                    const now = new Date();
                                                    const currentHmm = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
                                                    const isActive = currentHmm >= item.startTime && currentHmm <= item.endTime;
                                                    const itemColor = getItemColor(item);

                                                    // Helper to apply transparency to hex colors
                                                    const hexToRgba = (hex: string, alpha: number) => {
                                                        if (!hex || !hex.startsWith('#')) return hex;
                                                        const r = parseInt(hex.slice(1, 3), 16);
                                                        const g = parseInt(hex.slice(3, 5), 16);
                                                        const b = parseInt(hex.slice(5, 7), 16);
                                                        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
                                                    };

                                                    const cardBg = hexToRgba(itemColor, isActive ? 0.15 : 0.05);
                                                    const cardBorder = itemColor;
                                                    const textDark = hexToRgba(itemColor, 1);

                                                    return (
                                                        <div
                                                            key={item.id}
                                                            style={{
                                                                position: 'absolute',
                                                                top: `${top}px`,
                                                                height: `${Math.max(h, 60)}px`,
                                                                width: `${width}%`,
                                                                right: `${right}%`,
                                                                zIndex: isActive ? 20 : 10,
                                                                backgroundColor: cardBg,
                                                                border: `${isActive ? '3px' : '2px'} solid ${cardBorder}`,
                                                                boxShadow: isActive ? `0 10px 25px ${hexToRgba(itemColor, 0.3)}` : 'none',
                                                            }}
                                                            className={`group flex flex-col p-3 pr-7 rounded-2xl transition-all overflow-hidden ${isActive ? 'scale-[1.03]' : 'hover:scale-[1.01]'}`}
                                                        >
                                                            {/* Color Strip Indicator */}
                                                            <div
                                                                className="absolute top-0 right-0 bottom-0 w-3 shadow-inner z-10"
                                                                style={{ backgroundColor: itemColor }}
                                                            />

                                                            <div className="flex justify-between items-start gap-1 relative z-20">
                                                                <p
                                                                    className="font-bold text-sm leading-tight truncate"
                                                                    style={{ color: isActive ? '#000' : '#1e293b' }}
                                                                >
                                                                    {item.description}
                                                                </p>

                                                                <span className="text-[10px] font-mono opacity-70 shrink-0" style={{ color: textDark }}>
                                                                    {item.startTime}-{item.endTime}
                                                                </span>
                                                            </div>

                                                            <div className="mt-1 flex items-center gap-1.5 text-[10px] font-bold relative z-20" style={{ color: textDark }}>
                                                                {getTargetIcon(item.targetType, item.targetId)}
                                                                <span className="truncate">{getTargetLabel(item)}</span>
                                                            </div>

                                                            {canEdit && (
                                                                <div className="absolute bottom-1 left-1 flex gap-1 bg-white/90 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-30">
                                                                    <button onClick={(e) => { e.stopPropagation(); handleDuplicate(item); }} className="p-1 hover:bg-slate-100 rounded text-slate-500"><Copy size={12} /></button>
                                                                    <button onClick={(e) => { e.stopPropagation(); setEditItem(item); setIsEditing(true); }} className="p-1 hover:bg-slate-100 rounded text-slate-500"><Edit2 size={12} /></button>
                                                                    <button onClick={(e) => { e.stopPropagation(); setItemToDeleteId(item.id); }} className="p-1 hover:bg-red-50 rounded text-red-500"><Trash2 size={12} /></button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Edit Modal / Inline Form */}
            {isEditing && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-lg">{editItem.id ? 'עריכת אירוע' : 'אירוע חדש'}</h3>
                            <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500">התחלה</label>
                                    <input type="time" value={editItem.startTime || ''} onChange={e => setEditItem({ ...editItem, startTime: e.target.value })} className="w-full p-2 border rounded-lg" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500">סיום</label>
                                    <input type="time" value={editItem.endTime || ''} onChange={e => setEditItem({ ...editItem, endTime: e.target.value })} className="w-full p-2 border rounded-lg" />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500">תיאור האירוע</label>
                                <input type="text" value={editItem.description || ''} onChange={e => setEditItem({ ...editItem, description: e.target.value })} className="w-full p-2 border rounded-lg" placeholder="לדוגמה: מסדר בוקר" />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500">מי רואה?</label>
                                <div className="grid grid-cols-3 gap-2 mb-2">
                                    <button
                                        onClick={() => setEditItem({ ...editItem, targetType: 'all', targetId: null })}
                                        className={`p-2 rounded-lg border text-sm font-medium transition-all ${editItem.targetType === 'all' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-slate-200 hover:bg-slate-50'}`}
                                    >
                                        כולם
                                    </button>
                                    <button
                                        onClick={() => setEditItem({ ...editItem, targetType: 'team', targetId: teams[0]?.id || null })}
                                        className={`p-2 rounded-lg border text-sm font-medium transition-all ${editItem.targetType === 'team' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-slate-200 hover:bg-slate-50'}`}
                                    >
                                        צוות
                                    </button>
                                    <button
                                        onClick={() => setEditItem({ ...editItem, targetType: 'role', targetId: roles[0]?.id || null })}
                                        className={`p-2 rounded-lg border text-sm font-medium transition-all ${editItem.targetType === 'role' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-slate-200 hover:bg-slate-50'}`}
                                    >
                                        תפקיד
                                    </button>
                                </div>

                                {editItem.targetType === 'team' && (
                                    <select
                                        value={editItem.targetId || ''}
                                        onChange={e => setEditItem({ ...editItem, targetId: e.target.value })}
                                        className="w-full p-2 border rounded-lg text-sm"
                                    >
                                        {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                )}
                                {editItem.targetType === 'role' && (
                                    <select
                                        value={editItem.targetId || ''}
                                        onChange={e => setEditItem({ ...editItem, targetId: e.target.value })}
                                        className="w-full p-2 border rounded-lg text-sm"
                                    >
                                        {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                    </select>
                                )}
                            </div>
                        </div>
                        <div className="p-4 border-t bg-slate-50 flex gap-2">
                            <button onClick={() => setIsEditing(false)} className="flex-1 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-lg transition-colors">ביטול</button>
                            <button onClick={handleSaveItem} className="flex-1 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200">שמור אירוע</button>
                        </div>
                    </div>
                </div>
            )}
            {/* Delete Confirmation Modal */}
            {itemToDeleteId && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-8 text-center">
                            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <AlertTriangle size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">מחיקת אירוע</h3>
                            <p className="text-slate-500">האם אתה בטוח שברצונך למחוק את האירוע הזה? פעולה זו אינה ניתנת לביטול.</p>
                        </div>
                        <div className="p-4 bg-slate-50 flex gap-3">
                            <button
                                onClick={() => setItemToDeleteId(null)}
                                className="flex-1 py-3 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition-colors"
                            >
                                ביטול
                            </button>
                            <button
                                onClick={() => {
                                    handleDelete(itemToDeleteId);
                                    setItemToDeleteId(null);
                                }}
                                className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors shadow-lg shadow-red-200"
                            >
                                כן, מחק
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
