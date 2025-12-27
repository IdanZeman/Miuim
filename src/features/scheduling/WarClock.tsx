
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../services/supabaseClient';
import { Clock, Plus, Trash2, Edit2, Copy, Save, X, Eye, Users, Shield, Globe, ChevronUp, ChevronDown, Filter, AlertTriangle, Check } from 'lucide-react';
import * as AllIcons from 'lucide-react';
import { useAuth } from '../../features/auth/AuthContext';
import { Person, Team, Role } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '../../contexts/ToastContext';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { SheetModal } from '../../components/ui/SheetModal';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';

interface ScheduleItem {
    id: string;
    startTime: string; // "HH:MM"
    endTime: string;   // "HH:MM"
    description: string;
    targetType: 'all' | 'team' | 'role';
    targetId: string | null; // teamId or roleId
    daysOfWeek?: number[]; // 0=Sunday, 6=Saturday
}

const DAYS = [
    { id: 0, label: 'א', full: 'ראשון' },
    { id: 1, label: 'ב', full: 'שני' },
    { id: 2, label: 'ג', full: 'שלישי' },
    { id: 3, label: 'ד', full: 'רביעי' },
    { id: 4, label: 'ה', full: 'חמישי' },
    { id: 5, label: 'ו', full: 'שישי' },
    { id: 6, label: 'ש', full: 'שבת' },
];

interface WarClockProps {
    myPerson: Person | undefined;
    teams: Team[];
    roles: Role[];
}

const CustomTimePicker = ({ label, value, onChange }: { label: string, value: string, onChange: (val: string) => void }) => {
    const inputRef = React.useRef<HTMLInputElement>(null);

    return (
        <div className="flex flex-col gap-1.5 w-full">
            <span className="text-xs font-bold text-slate-500 mr-1">{label}</span>
            <div
                className="relative flex items-center gap-3 bg-white hover:bg-slate-50 border border-slate-200 hover:border-blue-400 rounded-xl p-3 cursor-pointer transition-all duration-200 shadow-sm hover:shadow group w-full"
                onClick={() => {
                    if (inputRef.current) {
                        try {
                            if ('showPicker' in inputRef.current) {
                                (inputRef.current as any).showPicker();
                            } else {
                                (inputRef.current as HTMLInputElement).focus();
                                (inputRef.current as HTMLInputElement).click();
                            }
                        } catch (e) {
                            inputRef.current.click();
                        }
                    }
                }}
            >
                <div className="bg-blue-50 text-blue-600 p-2 rounded-lg group-hover:bg-blue-100 transition-colors">
                    <Clock size={18} />
                </div>
                <div className="flex flex-col">
                    <span className="text-sm font-black text-slate-700 group-hover:text-blue-700 transition-colors">
                        {value}
                    </span>
                    <span className="text-[10px] font-medium text-slate-400">
                        שעה
                    </span>
                </div>
                <input
                    ref={inputRef}
                    type="time"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                    aria-label={`בחר שעה עבור ${label}`}
                />
            </div>
        </div>
    );
};

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

    const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay());

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
                        targetId: d.target_id,
                        daysOfWeek: d.days_of_week || [0, 1, 2, 3, 4, 5, 6]
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
                target_id: cleanTargetId,
                days_of_week: editItem.daysOfWeek || [0, 1, 2, 3, 4, 5, 6]
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
            targetId: cleanTargetId,
            daysOfWeek: editItem.daysOfWeek || [0, 1, 2, 3, 4, 5, 6]
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
    const baseItems = items.filter(item => {
        if (canEdit) return true; // Admin/Editor sees all available
        if (!myPerson) return item.targetType === 'all';
        if (item.targetType === 'all') return true;
        if (item.targetType === 'team' && myPerson.teamId === item.targetId) return true;
        if (item.targetType === 'role' && (myPerson.roleId === item.targetId || myPerson.roleIds?.includes(item.targetId || ''))) return true;
        return false;
    });

    // 2. View Filtering (User Selection - Union Logic)
    const filteredItems = baseItems.filter(item => {
        // Day Filter
        const days = item.daysOfWeek || [0, 1, 2, 3, 4, 5, 6];
        if (!days.includes(selectedDay)) return false;

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

    // SIMPLIFIED TIMELINE DATA FOR LIST VIEW
    const timelineData = React.useMemo(() => {
        if (filteredItems.length === 0) return { items: [], height: 0 };

        const sorted = [...filteredItems].sort((a, b) => a.startTime.localeCompare(b.startTime));

        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        const itemsWithStatus = sorted.map(item => {
            const start = minutesFromMidnight(item.startTime);
            const end = minutesFromMidnight(item.endTime);
            const isNow = currentMinutes >= start && currentMinutes < end;
            const isPast = currentMinutes >= end;
            return { ...item, isNow, isPast };
        });

        return { items: itemsWithStatus, height: 'auto' };
    }, [filteredItems]);


    // Auto-scroll to active item on mount/open
    useEffect(() => {
        if (isOpen && scrollContainerRef.current) {
            // We need a small timeout to allow rendering to complete
            setTimeout(() => {
                const activeItem = document.getElementById('war-clock-active-item');
                if (activeItem) {
                    activeItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 100);
        }
    }, [isOpen, timelineData]);

    const getItemColor = (item: ScheduleItem) => {
        let rawColor = '';
        if (item.targetType === 'team') {
            rawColor = teams.find(t => t.id === item.targetId)?.color || '#3b82f6';
        } else if (item.targetType === 'role') {
            rawColor = roles.find(r => r.id === item.targetId)?.color || '#a855f7';
        } else {
            return '#94a3b8'; // Default Slate (All)
        }

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
            <div className="flex flex-col gap-2">
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
                                onClick={() => setShowFilters(true)}
                                className={`p-2 rounded-full transition-colors ${filters.mode !== 'all' || filters.teams.length > 0 || filters.roles.length > 0 ? 'bg-indigo-100 text-indigo-700' : 'text-slate-400 hover:bg-slate-100'}`}
                            >
                                <Filter size={18} />
                            </button>
                        )}
                        {canEdit && isOpen && (
                            <button
                                onClick={() => {
                                    setEditItem({
                                        targetType: 'all',
                                        startTime: '08:00',
                                        endTime: '09:00',
                                        daysOfWeek: [0, 1, 2, 3, 4, 5, 6]
                                    });
                                    setIsEditing(true);
                                }}
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

                {/* Day Selector */}
                {isOpen && (
                    <div className="flex items-center justify-between bg-slate-100 p-1 rounded-xl mx-2 mb-2">
                        {DAYS.map(day => (
                            <button
                                key={day.id}
                                onClick={() => setSelectedDay(day.id)}
                                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${selectedDay === day.id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                aria-label={`הצג יום ${day.full}`}
                                aria-pressed={selectedDay === day.id}
                            >
                                {day.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Collapsible Content */}
            {isOpen && (
                <div className="animate-in slide-in-from-top-4 duration-300 ease-out">



                    {/* Timeline View - LIST STYLE */}
                    {timelineData.items.length > 0 ? (
                        <div
                            ref={scrollContainerRef}
                            className="relative w-full rounded-2xl bg-white shadow-sm border border-slate-100 overflow-y-auto scroll-smooth p-2"
                            style={{ height: '400px', maxHeight: '60vh' }}
                        >
                            {(() => {
                                // Clustering Logic for Parallel View
                                const sorted = timelineData.items;
                                type ItemWithStatus = typeof sorted[0];
                                const clusters: ItemWithStatus[][] = [];
                                let currentCluster: ItemWithStatus[] = [];
                                let clusterEnd = -1;

                                sorted.forEach(item => {
                                    const start = minutesFromMidnight(item.startTime);
                                    const end = minutesFromMidnight(item.endTime);

                                    if (currentCluster.length === 0) {
                                        currentCluster.push(item);
                                        clusterEnd = end;
                                    } else {
                                        // Overlap check: Item starts before cluster ends
                                        // Using a slightly more lenient overlap for visual grouping (soft overlap)
                                        // Or strict overlap. User said "Events happening at the same time".
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

                                return (
                                    <div className="flex flex-col gap-2">
                                        {clusters.map((cluster, clusterIndex) => (
                                            <div key={clusterIndex} className="flex gap-2">
                                                {/* Time Anchor for the Cluster */}
                                                <div className="flex flex-col items-center justify-start min-w-[3.5rem] pt-2">
                                                    <span className="text-xs font-mono font-bold text-slate-500">{cluster[0].startTime}</span>
                                                    <div className="w-px h-full bg-slate-200 my-1 dashed"></div>
                                                </div>

                                                {/* Parallel Items Container */}
                                                <div className="flex-1 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                                                    {(() => {
                                                        // -----------------------------------------------------------
                                                        // 1. Column Packing Algorithm (Fit First Strategy)
                                                        // -----------------------------------------------------------
                                                        // We want to stack items vertically if they don't overlap,
                                                        // but place them side-by-side if they do.

                                                        const columns: ItemWithStatus[][] = [];

                                                        // Sort by start time, then duration (longest first) for better packing
                                                        const sortedCluster = [...cluster].sort((a, b) => {
                                                            const startA = minutesFromMidnight(a.startTime);
                                                            const startB = minutesFromMidnight(b.startTime);
                                                            if (startA !== startB) return startA - startB;
                                                            // If same start, put longer first? Or end first?
                                                            return minutesFromMidnight(b.endTime) - minutesFromMidnight(a.endTime);
                                                        });

                                                        sortedCluster.forEach(item => {
                                                            const itemStart = minutesFromMidnight(item.startTime);

                                                            // Try to find a column where this item fits
                                                            // A column fits if the LAST item in that column ends BEFORE (or at) this item starts.
                                                            let placed = false;

                                                            for (let i = 0; i < columns.length; i++) {
                                                                const col = columns[i];
                                                                const lastItem = col[col.length - 1];
                                                                const lastEnd = minutesFromMidnight(lastItem.endTime);

                                                                if (lastEnd <= itemStart) {
                                                                    col.push(item);
                                                                    placed = true;
                                                                    break;
                                                                }
                                                            }

                                                            // If didn't fit in any existing column, create a new one
                                                            if (!placed) {
                                                                columns.push([item]);
                                                            }
                                                        });

                                                        // -----------------------------------------------------------
                                                        // 2. Render Columns
                                                        // -----------------------------------------------------------
                                                        return columns.map((colItems, colIndex) => (
                                                            <div key={colIndex} className="flex flex-col gap-2 min-w-[140px] md:min-w-[200px] flex-1">
                                                                {colItems.map(item => {
                                                                    const itemColor = getItemColor(item);
                                                                    return (
                                                                        <div
                                                                            key={item.id}
                                                                            id={item.isNow ? 'war-clock-active-item' : undefined}
                                                                            className={`
                                                                                relative flex-1 flex flex-col rounded-xl border border-l-4 transition-all cursor-pointer group hover:shadow-lg
                                                                                ${item.isNow ? 'bg-white shadow-md ring-1 ring-blue-500/20' : 'bg-white hover:bg-slate-50 shadow-sm'}
                                                                                ${item.isPast ? 'bg-slate-50/50' : ''}
                                                                            `}
                                                                            style={{
                                                                                borderLeftColor: itemColor,
                                                                                borderTopColor: '#e2e8f0', // slate-200
                                                                                borderRightColor: '#e2e8f0',
                                                                                borderBottomColor: '#e2e8f0'
                                                                            }}
                                                                            onClick={() => { if (canEdit) { setEditItem(item); setIsEditing(true); } }}
                                                                            tabIndex={0}
                                                                            role="button"
                                                                            aria-label={`${item.description} מ-${item.startTime} עד ${item.endTime}${item.isNow ? ', פעיל עכשיו' : ''}`}
                                                                            onKeyDown={(e) => {
                                                                                if (canEdit && (e.key === 'Enter' || e.key === ' ')) {
                                                                                    e.preventDefault();
                                                                                    setEditItem(item);
                                                                                    setIsEditing(true);
                                                                                }
                                                                            }}
                                                                        >
                                                                            <div className="p-3 flex flex-col h-full justify-between gap-2">
                                                                                <div>
                                                                                    <div className="flex justify-between items-start mb-1.5">
                                                                                        <div className="flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 w-fit max-w-full">
                                                                                            <span style={{ color: itemColor }} className="shrink-0 drop-shadow-sm">
                                                                                                {getTargetIcon(item.targetType, item.targetId)}
                                                                                            </span>
                                                                                            <span className="truncate">{getTargetLabel(item)}</span>
                                                                                        </div>
                                                                                        {canEdit && (
                                                                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-blue-600">
                                                                                                <Edit2 size={12} />
                                                                                            </div>
                                                                                        )}
                                                                                    </div>

                                                                                    <h4 className={`font-black text-slate-900 leading-tight break-words ${item.isNow ? 'text-base' : 'text-sm'}`}>{item.description}</h4>
                                                                                </div>

                                                                                <div className="flex items-center justify-between mt-1 pt-2 border-t border-slate-100">
                                                                                    <span className="text-xs font-black font-mono text-slate-700 tracking-tight bg-slate-100 px-1.5 py-0.5 rounded">
                                                                                        {item.startTime} - {item.endTime}
                                                                                    </span>
                                                                                    {item.isNow && <span className="flex h-2 w-2 relative">
                                                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                                                                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-600"></span>
                                                                                    </span>}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        ));
                                                    })()}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center p-12 bg-slate-50 rounded-2xl border border-slate-100 border-dashed text-center">
                            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm text-slate-300">
                                <Clock size={32} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-700 mb-1">היומן פנוי</h3>
                            <p className="text-slate-500 text-sm">אין לו"ז כרגע להיום.</p>
                            {canEdit && (
                                <button
                                    onClick={() => { setEditItem({ targetType: 'all', startTime: '08:00', endTime: '09:00' }); setIsEditing(true); }}
                                    className="mt-4 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-bold hover:bg-blue-200 transition-colors"
                                >
                                    + הוסף אירוע ראשון
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}



            {/* Filters Bottom Sheet */}
            <SheetModal
                isOpen={showFilters}
                onClose={() => setShowFilters(false)}
                title="סינון לוח זמנים"
            >
                <div className="flex flex-col gap-4">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">תצוגה כללית</label>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setFilters({ mode: 'all', general: false, teams: [], roles: [] })}
                                className={`flex-1 py-3 px-4 rounded-xl border font-bold text-sm transition-all flex items-center justify-center gap-2 ${filters.mode === 'all' ? 'bg-slate-800 text-white border-slate-800 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
                            >
                                {filters.mode === 'all' && <Check size={16} />}
                                הצג הכל
                            </button>
                        </div>
                    </div>

                    {canEdit ? (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase">סינון לפי צוותים</label>
                                <div className="flex flex-wrap gap-2">
                                    {teams.map(team => {
                                        const isSelected = filters.teams.includes(team.id);
                                        return (
                                            <button
                                                key={team.id}
                                                onClick={() => {
                                                    const newTeams = isSelected ? filters.teams.filter(t => t !== team.id) : [...filters.teams, team.id];
                                                    setFilters(p => ({ ...p, mode: 'custom', teams: newTeams }));
                                                }}
                                                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${isSelected ? `bg-blue-50 text-blue-700 border-blue-200` : 'bg-slate-50 text-slate-600 border-transparent hover:bg-slate-100'}`}
                                            >
                                                {team.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase">סינון לפי תפקידים</label>
                                <div className="flex flex-wrap gap-2">
                                    {roles.map(role => {
                                        const isSelected = filters.roles.includes(role.id);
                                        return (
                                            <button
                                                key={role.id}
                                                onClick={() => {
                                                    const newRoles = isSelected ? filters.roles.filter(r => r !== role.id) : [...filters.roles, role.id];
                                                    setFilters(p => ({ ...p, mode: 'custom', roles: newRoles }));
                                                }}
                                                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${isSelected ? `bg-purple-50 text-purple-700 border-purple-200` : 'bg-slate-50 text-slate-600 border-transparent hover:bg-slate-100'}`}
                                            >
                                                {role.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3">
                            {myPerson?.teamId && (
                                <button onClick={() => setFilters(p => ({ ...p, mode: 'custom', teams: p.teams.includes(myPerson.teamId!) ? p.teams.filter(t => t !== myPerson.teamId) : [...p.teams, myPerson.teamId!] }))} className={`py-3 px-4 rounded-xl border font-bold text-sm transition-all flex items-center justify-center gap-2 ${filters.teams.includes(myPerson.teamId) ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>הצוות שלי</button>
                            )}
                            {myPerson?.roleId && (
                                <button onClick={() => setFilters(p => ({ ...p, mode: 'custom', roles: p.roles.includes(myPerson.roleId!) ? p.roles.filter(r => r !== myPerson.roleId) : [...p.roles, myPerson.roleId!] }))} className={`py-3 px-4 rounded-xl border font-bold text-sm transition-all flex items-center justify-center gap-2 ${filters.roles.includes(myPerson.roleId) ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>התפקיד שלי</button>
                            )}
                        </div>
                    )}
                </div>
            </SheetModal>

            {/* Modals */}
            <Modal
                isOpen={isEditing}
                onClose={() => setIsEditing(false)}
                title={editItem.id ? 'עריכת אירוע' : 'אירוע חדש'}
                footer={
                    <div className="flex justify-between w-full">
                        {editItem.id ? (
                            <Button variant="danger" icon={Trash2} onClick={() => { setItemToDeleteId(editItem.id!); setIsEditing(false); }} />
                        ) : <div></div>}
                        <div className="flex gap-2">
                            <Button variant="ghost" onClick={() => setIsEditing(false)}>ביטול</Button>
                            <Button onClick={handleSaveItem}>שמור</Button>
                        </div>
                    </div>
                }
            >
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-2 md:gap-4">
                        <div>
                            <CustomTimePicker
                                label="התחלה"
                                value={editItem.startTime || ''}
                                onChange={val => setEditItem({ ...editItem, startTime: val })}
                            />
                        </div>
                        <div>
                            <CustomTimePicker
                                label="סיום"
                                value={editItem.endTime || ''}
                                onChange={val => setEditItem({ ...editItem, endTime: val })}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500">חזרה שבועית</label>
                        <div className="flex items-center justify-between gap-1 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
                            {DAYS.map(day => {
                                const isSelected = (editItem.daysOfWeek || [0, 1, 2, 3, 4, 5, 6]).includes(day.id);
                                return (
                                    <button
                                        key={day.id}
                                        onClick={() => {
                                            const current = editItem.daysOfWeek || [0, 1, 2, 3, 4, 5, 6];
                                            let newDays;
                                            if (isSelected) {
                                                // Prevent deselecting all? Or allow it? Allowing for now, but usually at least 1 day needed.
                                                newDays = current.filter(d => d !== day.id);
                                            } else {
                                                newDays = [...current, day.id];
                                            }
                                            setEditItem({ ...editItem, daysOfWeek: newDays });
                                        }}
                                        className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-bold transition-all ${isSelected ? 'bg-blue-500 text-white shadow-md shadow-blue-200 scale-105' : 'text-slate-400 hover:bg-white hover:text-slate-600'}`}
                                        aria-label={day.full}
                                        aria-pressed={isSelected}
                                    >
                                        {day.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <Input
                        label="תיאור"
                        value={editItem.description || ''}
                        onChange={e => setEditItem({ ...editItem, description: e.target.value })}
                        placeholder="זמן מנוחה / שמירה..."
                    />

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">שיוך</label>
                        <div className="flex bg-slate-100 p-1 rounded-xl mb-3">
                            <button onClick={() => setEditItem({ ...editItem, targetType: 'all', targetId: null })} className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-all ${editItem.targetType === 'all' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>כולם</button>
                            <button onClick={() => setEditItem({ ...editItem, targetType: 'team', targetId: teams[0]?.id || null })} className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-all ${editItem.targetType === 'team' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>צוות</button>
                            <button onClick={() => setEditItem({ ...editItem, targetType: 'role', targetId: roles[0]?.id || null })} className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-all ${editItem.targetType === 'role' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>תפקיד</button>
                        </div>
                        {editItem.targetType !== 'all' && (
                            <Select
                                value={editItem.targetId || ''}
                                onChange={(val) => setEditItem({ ...editItem, targetId: val })}
                                options={(editItem.targetType === 'team' ? teams : roles).map(t => ({ value: t.id, label: t.name }))}
                                placeholder={editItem.targetType === 'team' ? 'בחר צוות' : 'בחר תפקיד'}
                            />
                        )}
                    </div>
                </div>
            </Modal>

            <ConfirmationModal
                isOpen={!!itemToDeleteId}
                title="מחיקת אירוע?"
                message="פעולה זו לא ניתנת לביטול."
                confirmText="מחק"
                type="danger"
                onConfirm={() => { if (itemToDeleteId) handleDelete(itemToDeleteId); setItemToDeleteId(null); }}
                onCancel={() => setItemToDeleteId(null)}
            />
        </div>
    );
};
