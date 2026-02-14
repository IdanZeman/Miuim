import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Clock, Plus, Trash as Trash2, PencilSimple as Edit2, Copy, FloppyDisk as Save, X, Eye, Users, Shield, Globe, CaretUp as ChevronUp, CaretDown as ChevronDown, Funnel as Filter, Warning as AlertTriangle, Check, ArrowsOut, ArrowsIn } from '@phosphor-icons/react';
import * as AllIcons from '@phosphor-icons/react';
import { useAuth } from '../../features/auth/AuthContext';
import { Person, Team, Role, WarClockItem as ScheduleItem } from '../../types';
import { warClockService } from '../../services/warClockService';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '../../contexts/ToastContext';
import { logger } from '../../services/loggingService';
import { Select } from '../../components/ui/Select';
import { GenericModal } from '../../components/ui/GenericModal';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';
import { DatePicker, TimePicker } from '@/components/ui/DatePicker';
import { DateNavigator } from '@/components/ui/DateNavigator';
import { format, isWithinInterval, parseISO, startOfDay } from 'date-fns';
import { he } from 'date-fns/locale';
import { useTacticalDelete } from '@/hooks/useTacticalDelete';
import { TacticalDeleteStyles } from '@/components/ui/TacticalDeleteWrapper';

// ScheduleItem is now imported as an alias for WarClockItem from global types

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
    darkMode?: boolean;
}


export const WarClock: React.FC<WarClockProps> = ({ myPerson, teams, roles }) => {
    const { profile, organization, checkAccess } = useAuth();
    const { showToast } = useToast();
    const canEdit = checkAccess('dashboard', 'edit');

    const [items, setItems] = useState<ScheduleItem[]>([]);
    const [isEditing, setIsEditing] = useState(false);
    const [editItem, setEditItem] = useState<Partial<ScheduleItem>>({});

    // Tactical Delete Hook
    const { handleTacticalDelete, isAnimating } = useTacticalDelete<string>(
        async (id: string) => {
            if (organization) {
                await warClockService.deleteItem(id);
                logger.info('DELETE', `Deleted war clock item: ${id}`, { id, category: 'scheduling' });
                showToast('האירוע נמחק', 'success');
                fetchItems();
            } else {
                setItems(prev => prev.filter(i => i.id !== id));
                showToast('נמחק מקומית', 'success');
            }
        },
        1300
    );

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

    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const selectedDay = selectedDate.getDay();
    const [isFullScreen, setIsFullScreen] = useState(false);

    const fetchItems = async () => {
        let loadedFromDb = false;

        if (organization) {
            try {
                const data = await warClockService.fetchItems(organization.id);
                setItems(data);
                loadedFromDb = true;
            } catch (err) {
                console.error('Failed to fetch war clock items', err);
            }
        }

        if (!loadedFromDb) {
            const saved = localStorage.getItem('miuim_war_clock');
            if (saved) setItems(JSON.parse(saved));
        }
    };

    useEffect(() => {
        fetchItems();

        if (!organization) return;
        const cleanup = warClockService.subscribeToItems(organization.id, fetchItems);
        return cleanup;
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

        // Validation for Date Range
        if ((editItem.startDate || editItem.endDate) && (!editItem.startDate || !editItem.endDate)) {
            showToast('במצב טווח תאריכים, חובה להזין גם תאריך התחלה וגם תאריך סיום', 'error');
            return;
        }

        if (editItem.startDate && editItem.endDate && editItem.startDate > editItem.endDate) {
            showToast('תאריך סיום חייב להיות אחרי תאריך התחלה', 'error');
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
                days_of_week: editItem.daysOfWeek || [0, 1, 2, 3, 4, 5, 6],
                start_date: editItem.startDate || null,
                end_date: editItem.endDate || null
            };

            try {
                // If editItem.id exists and is not a local-only ID, it's an update.
                // Otherwise, it's an insert (either new or promoting a local item).
                if (editItem.id) {
                    await warClockService.updateItem({ ...editItem, ...payload, id: editItem.id } as ScheduleItem);
                } else {
                    await warClockService.addItem(payload as any);
                }

                logger.info(editItem.id && !editItem.id.startsWith('local-') ? 'UPDATE' : 'CREATE',
                    `${editItem.id && !editItem.id.startsWith('local-') ? 'Updated' : 'Created'} war clock item: ${editItem.description}`,
                    { ...payload, id: editItem.id, category: 'scheduling' });

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
            daysOfWeek: editItem.daysOfWeek || [0, 1, 2, 3, 4, 5, 6],
            startDate: editItem.startDate,
            endDate: editItem.endDate
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

    const handleDuplicate = (item: ScheduleItem) => {
        setEditItem({
            ...item,
            id: undefined,
            description: `${item.description} (עותק)`
        });
        logger.info('CREATE', `Duplicated war clock item: ${item.description}`, {
            originalId: item.id,
            description: `${item.description} (עותק)`,
            category: 'scheduling'
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
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const days = item.daysOfWeek || [];

        // 1. If it's a specific date match (startDate == endDate == dateStr)
        const isSpecificDate = item.startDate && item.endDate && item.startDate === item.endDate;
        if (isSpecificDate) {
            return item.startDate === dateStr;
        }

        // 2. Day of Week Filter (for recurring)
        if (days.length > 0 && !days.includes(selectedDay)) return false;

        // 3. Date Range Filter (for recurring within a range)
        if (item.startDate && dateStr < item.startDate) return false;
        if (item.endDate && dateStr > item.endDate) return false;

        // Fallback for items with no days selected but are not specific dates (shouldn't happen with GUI but just in case)
        if (days.length === 0 && !isSpecificDate) return false;

        // 4. View Filters (Union logic for user-selected filters)
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

        const isToday = format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        const itemsWithStatus = sorted.map(item => {
            const start = minutesFromMidnight(item.startTime);
            const end = minutesFromMidnight(item.endTime);
            const isNow = isToday && currentMinutes >= start && currentMinutes < end;
            const isPast = (isToday && currentMinutes >= end) || (!isToday && format(selectedDate, 'yyyy-MM-dd') < format(new Date(), 'yyyy-MM-dd'));
            return { ...item, isNow, isPast };
        });

        return { items: itemsWithStatus, height: 'auto' };
    }, [filteredItems]);




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
        if (type === 'all') return <Globe size={14} weight="bold" />;
        if (type === 'team') return <Users size={14} weight="bold" />;
        if (type === 'role' && targetId) {
            const role = roles.find(r => r.id === targetId);
            // @ts-ignore
            if (role?.icon && AllIcons[role.icon]) {
                // @ts-ignore
                const IconComp = AllIcons[role.icon];
                return <IconComp size={14} weight="bold" />;
            }
        }
        return <Shield size={14} weight="bold" />;
    };



    return (
        <div className="w-full relative animate-in fade-in flex flex-col gap-4 transition-all" data-component="WarClock">
            {/* Minimal Header */}
            <div className="flex flex-col gap-2">
                <div
                    className="flex items-center justify-between px-2 cursor-pointer hover:bg-slate-50/50 p-2 rounded-xl transition-colors select-none"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <h3 className="text-sm md:text-lg font-bold text-slate-800 flex items-center gap-2">
                        <div className={`p-1 md:p-1.5 rounded-lg transition-colors ${isOpen ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                            <Clock size={16} className="md:w-5 md:h-5" weight="bold" />
                        </div>
                        סדר יום
                        {!isOpen && <span className="text-[9px] md:text-xs font-normal text-slate-400 px-2 py-0.5 bg-slate-100 rounded-full">{timelineData.items.length} אירועים</span>}
                    </h3>
                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        {isOpen && (
                            <button
                                onClick={() => setIsFullScreen(!isFullScreen)}
                                className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"
                                title={isFullScreen ? "מזער" : "מסך מלא"}
                            >
                                {isFullScreen ? <ArrowsIn size={18} weight="bold" /> : <ArrowsOut size={18} weight="bold" />}
                            </button>
                        )}
                        {isOpen && (
                            <button
                                onClick={() => setShowFilters(true)}
                                className={`p-2 rounded-full transition-colors ${filters.mode !== 'all' || filters.teams.length > 0 || filters.roles.length > 0 ? 'bg-indigo-100 text-indigo-700' : 'text-slate-400 hover:bg-slate-100'}`}
                            >
                                <Filter size={18} weight="bold" />
                            </button>
                        )}
                        {canEdit && isOpen && (
                            <button
                                onClick={() => {
                                    setEditItem({
                                        targetType: 'all',
                                        startTime: '08:00',
                                        endTime: '09:00',
                                        daysOfWeek: [] // Default to none as requested
                                    });
                                    setIsEditing(true);
                                }}
                                className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
                            >
                                <Plus size={18} weight="bold" />
                            </button>
                        )}
                        <button onClick={() => setIsOpen(!isOpen)} className="p-2 text-slate-400 hover:text-slate-600">
                            {isOpen ? <ChevronUp size={20} weight="bold" /> : <ChevronDown size={20} weight="bold" />}
                        </button>
                    </div>
                </div>

                {/* Day Navigation */}
                {isOpen && (
                    <div className="px-2 mb-2">
                        <DateNavigator
                            date={selectedDate}
                            onDateChange={setSelectedDate}
                        />
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
                            className={`
                                relative w-full rounded-2xl bg-white shadow-sm border border-slate-100 overflow-y-auto scroll-smooth p-2 no-scrollbar
                                ${isFullScreen ? 'h-full border-none shadow-none' : 'max-h-[60vh]'}
                            `}
                            style={isFullScreen ? {} : { height: '400px' }}
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
                                                <div className="flex flex-col items-center justify-start min-w-[3rem] md:min-w-[3.5rem] pt-2">
                                                    <span className="text-[10px] md:text-xs font-mono font-bold text-slate-500">{cluster[0].startTime}</span>
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
                                                        const columnCount = columns.length;
                                                        return columns.map((colItems, colIndex) => (
                                                            <div
                                                                key={colIndex}
                                                                className={`flex flex-col gap-2 flex-1`}
                                                                style={{
                                                                    minWidth: columnCount > 3 ? '100px' : (columnCount > 1 ? '140px' : '200px'),
                                                                    maxWidth: isFullScreen ? 'none' : (columnCount === 1 ? 'none' : '50%')
                                                                }}
                                                            >
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
                                                                            <div className="p-2 md:p-3 flex flex-col h-full justify-between gap-1.5 md:gap-2">
                                                                                <div>
                                                                                    <div className="flex justify-between items-start mb-1 md:mb-1.5">
                                                                                        <div className="flex items-center gap-1.5 text-[9px] md:text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 w-fit max-w-full">
                                                                                            <span style={{ color: itemColor }} className="shrink-0 drop-shadow-sm">
                                                                                                {getTargetIcon(item.targetType, item.targetId)}
                                                                                            </span>
                                                                                            <span className="truncate">{columnCount > 4 ? '' : getTargetLabel(item)}</span>
                                                                                        </div>
                                                                                        {canEdit && (
                                                                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-blue-600">
                                                                                                <Edit2 size={12} weight="bold" />
                                                                                            </div>
                                                                                        )}
                                                                                    </div>

                                                                                    <h4 className={`font-black text-slate-800 leading-tight break-words ${item.isNow ? 'text-sm md:text-base' : (columnCount > 3 ? 'text-[10px] md:text-xs' : 'text-xs md:text-sm')}`}>{item.description}</h4>
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
                                <Clock size={32} weight="bold" />
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
            <GenericModal
                isOpen={showFilters}
                onClose={() => setShowFilters(false)}
                title="סינון לוח זמנים"
                size="md"
            >
                <div className="flex flex-col gap-4">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">תצוגה כללית</label>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setFilters({ mode: 'all', general: false, teams: [], roles: [] })}
                                className={`flex-1 py-3 px-4 rounded-xl border font-bold text-sm transition-all flex items-center justify-center gap-2 ${filters.mode === 'all' ? 'bg-slate-800 text-white border-slate-800 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
                            >
                                {filters.mode === 'all' && <Check size={16} weight="bold" />}
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
            </GenericModal>

            {/* Modals */}
            <GenericModal
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
                        <TimePicker
                            label="התחלה"
                            value={editItem.startTime || ''}
                            onChange={val => setEditItem({ ...editItem, startTime: val })}
                        />
                        <TimePicker
                            label="סיום"
                            value={editItem.endTime || ''}
                            onChange={val => setEditItem({ ...editItem, endTime: val })}
                        />
                    </div>

                    <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <div className="flex flex-col gap-3">
                            <label className="text-sm font-bold text-slate-700">סוג אירוע</label>
                            <div className="flex bg-white p-1 rounded-xl border border-slate-200">
                                <button
                                    onClick={() => {
                                        const isAlreadyRecurring = !editItem.startDate || editItem.startDate !== editItem.endDate;
                                        if (!isAlreadyRecurring) {
                                            setEditItem({ ...editItem, startDate: undefined, endDate: undefined });
                                        }
                                    }}
                                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${(!editItem.startDate || editItem.startDate !== editItem.endDate) ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                                >
                                    אירוע חוזר
                                </button>
                                <button
                                    onClick={() => {
                                        const today = format(new Date(), 'yyyy-MM-dd');
                                        setEditItem({ ...editItem, startDate: today, endDate: today, daysOfWeek: [] });
                                    }}
                                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${(editItem.startDate && editItem.startDate === editItem.endDate) ? 'bg-purple-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                                >
                                    תאריך ספציפי
                                </button>
                            </div>
                        </div>

                        {/* RECURRING MODE UI */}
                        {(!editItem.startDate || editItem.startDate !== editItem.endDate) ? (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">באילו ימים:</label>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setEditItem({ ...editItem, daysOfWeek: [0, 1, 2, 3, 4, 5, 6] })}
                                                className="text-[10px] font-bold text-blue-600 hover:underline"
                                            >
                                                סמן הכל
                                            </button>
                                            <span className="text-slate-300 text-[10px]">|</span>
                                            <button
                                                onClick={() => setEditItem({ ...editItem, daysOfWeek: [] })}
                                                className="text-[10px] font-bold text-slate-500 hover:underline"
                                            >
                                                בטל הכל
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between gap-1">
                                        {DAYS.map(day => {
                                            const isSelected = (editItem.daysOfWeek || []).includes(day.id);
                                            return (
                                                <button
                                                    key={day.id}
                                                    onClick={() => {
                                                        const current = editItem.daysOfWeek || [];
                                                        const newDays = isSelected ? current.filter(d => d !== day.id) : [...current, day.id];
                                                        setEditItem({ ...editItem, daysOfWeek: newDays });
                                                    }}
                                                    className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-bold transition-all ${isSelected ? 'bg-blue-500 text-white shadow-md' : 'bg-white text-slate-400 border border-slate-200 hover:border-slate-300'}`}
                                                >
                                                    {day.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="pt-2 border-t border-slate-200/60">
                                    <label className="text-xs font-bold text-slate-400 block mb-2">טווח תאריכים (אופציונלי):</label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <DatePicker
                                            label="מתאריך"
                                            value={editItem.startDate || ''}
                                            onChange={(val) => setEditItem({ ...editItem, startDate: val })}
                                        />
                                        <DatePicker
                                            label="עד תאריך"
                                            value={editItem.endDate || ''}
                                            onChange={(val) => setEditItem({ ...editItem, endDate: val })}
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* SPECIFIC DATE MODE UI */
                            <div className="animate-in fade-in slide-in-from-top-2">
                                <DatePicker
                                    label="בחר תאריך"
                                    value={editItem.startDate || ''}
                                    onChange={(val) => setEditItem({ ...editItem, startDate: val, endDate: val })}
                                />
                                <p className="text-[10px] text-slate-400 mt-2 font-medium">האירוע יופיע רק בתאריך שנבחר.</p>
                            </div>
                        )}
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
            </GenericModal>

            <ConfirmationModal
                isOpen={!!itemToDeleteId}
                title="מחיקת אירוע?"
                message="פעולה זו לא ניתנת לביטול."
                confirmText="מחק"
                type="danger"
                onConfirm={() => { if (itemToDeleteId) handleTacticalDelete(itemToDeleteId); setItemToDeleteId(null); }}
                onCancel={() => setItemToDeleteId(null)}
            />
            {/* Full Screen Portal */}
            {isFullScreen && createPortal(
                <div className="fixed inset-0 z-[100] bg-slate-50 flex flex-col animate-in fade-in zoom-in-95 duration-300">
                    {/* Light Premium Header */}
                    <div className="bg-white/80 backdrop-blur-md text-slate-900 px-4 py-3 md:px-6 md:py-4 flex flex-col md:flex-row items-center justify-between shadow-sm border-b border-slate-200/60 gap-4">
                        <div className="flex items-center gap-4 w-full md:w-auto">
                            <div className="p-2.5 bg-blue-50 rounded-2xl border border-blue-100 shadow-sm">
                                <Clock size={28} weight="bold" className="text-blue-600" />
                            </div>
                            <div className="flex flex-col">
                                <h2 className="text-lg md:text-xl font-black tracking-tight leading-none mb-1 text-slate-900">לוח מלחמה</h2>
                                <p className="text-[10px] md:text-xs text-slate-500 font-bold uppercase tracking-widest">
                                    {format(selectedDate, 'eeee, dd MMMM yyyy', { locale: he })}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto">
                            <div className="flex-1 md:flex-none">
                                <DateNavigator
                                    date={selectedDate}
                                    onDateChange={setSelectedDate}
                                    className="!bg-slate-50 !border-slate-200 !text-slate-700 !h-10 hover:!bg-white transition-all shadow-sm"
                                />
                            </div>
                            <button
                                onClick={() => setIsFullScreen(false)}
                                className="h-10 w-10 flex items-center justify-center bg-white hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl transition-all border border-slate-200 hover:border-red-200 active:scale-95 shadow-sm group"
                                title="סגור תצוגה"
                            >
                                <X size={20} weight="bold" className="group-hover:rotate-90 transition-transform duration-300" />
                            </button>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1 overflow-hidden p-3 md:p-6 flex flex-col">
                        <div className="flex-1 bg-white rounded-[2rem] md:rounded-[3rem] shadow-2xl border border-slate-200/60 overflow-hidden flex flex-col">
                            {/* Sub-header / Legend */}
                            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/30 flex flex-col sm:flex-row justify-between items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-6 bg-blue-500 rounded-full"></div>
                                    <span className="text-xs font-black text-slate-800 uppercase tracking-widest">ציר זמן פעילות</span>
                                </div>
                                <div className="flex items-center gap-4 bg-white/50 backdrop-blur-sm px-4 py-2 rounded-full border border-slate-200/50 shadow-sm">
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
                                        <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse-slow"></div>
                                        <span>אירוע פעיל</span>
                                    </div>
                                    <div className="w-px h-3 bg-slate-200"></div>
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                                        <div className="w-2.5 h-2.5 rounded-full bg-slate-200"></div>
                                        <span>הסתיים</span>
                                    </div>
                                </div>
                            </div>

                            {/* Scrollable Timeline */}
                            <div className="flex-1 overflow-y-auto p-4 md:p-8 no-scrollbar bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px]">
                                {(() => {
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

                                    if (clusters.length === 0) {
                                        return (
                                            <div className="h-full flex flex-col items-center justify-center opacity-30 text-slate-400 py-20">
                                                <Clock size={64} weight="bold" className="mb-4" />
                                                <p className="text-xl font-bold">אין אירועים להצגה</p>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div className="flex flex-col gap-10 max-w-7xl mx-auto w-full">
                                            {clusters.map((cluster, clusterIndex) => (
                                                <div key={clusterIndex} className="flex flex-col md:flex-row gap-4 md:gap-8 group/cluster">
                                                    {/* Time Sidebar */}
                                                    <div className="flex flex-row md:flex-col items-center justify-start min-w-[5rem] md:pt-4">
                                                        <div className="bg-slate-900 text-white px-3 py-1.5 rounded-xl font-mono text-sm font-black shadow-xl border border-slate-700">
                                                            {cluster[0].startTime}
                                                        </div>
                                                        <div className="hidden md:block w-px flex-1 bg-gradient-to-b from-slate-300 via-slate-200 to-transparent my-3 group-last/cluster:h-12"></div>
                                                        <div className="md:hidden flex-1 h-px bg-slate-200 mx-3"></div>
                                                    </div>

                                                    {/* Event Cards Grid */}
                                                    <div className="flex-1 flex flex-col sm:flex-row flex-wrap gap-4">
                                                        {(() => {
                                                            const columns: ItemWithStatus[][] = [];
                                                            const sortedCluster = [...cluster].sort((a, b) => {
                                                                const startA = minutesFromMidnight(a.startTime);
                                                                const startB = minutesFromMidnight(b.startTime);
                                                                if (startA !== startB) return startA - startB;
                                                                return minutesFromMidnight(b.endTime) - minutesFromMidnight(a.endTime);
                                                            });
                                                            sortedCluster.forEach(item => {
                                                                let placed = false;
                                                                for (let i = 0; i < columns.length; i++) {
                                                                    const col = columns[i];
                                                                    if (minutesFromMidnight(col[col.length - 1].endTime) <= minutesFromMidnight(item.startTime)) {
                                                                        col.push(item);
                                                                        placed = true;
                                                                        break;
                                                                    }
                                                                }
                                                                if (!placed) columns.push([item]);
                                                            });

                                                            return columns.map((colItems, colIndex) => (
                                                                <div key={colIndex} className="flex flex-col gap-4 flex-1 min-w-[280px] max-w-full md:max-w-[45%] lg:max-w-[32%]">
                                                                    {colItems.map(item => {
                                                                        const itemColor = getItemColor(item);
                                                                        return (
                                                                            <div
                                                                                key={item.id}
                                                                                className={`
                                                                                    relative flex flex-col rounded-[1.5rem] border-2 border-l-[10px] transition-all cursor-pointer group/card
                                                                                    ${item.isNow ? 'bg-white ring-4 ring-blue-500/10 shadow-[0_20px_50px_rgba(0,0,0,0.1)] scale-[1.02] z-10' : 'bg-white shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_15px_35px_rgba(0,0,0,0.08)] hover:-translate-y-1'}
                                                                                    ${item.isPast ? 'opacity-60 grayscale-[0.2] hover:grayscale-0 transition-all' : ''}
                                                                                `}
                                                                                style={{ borderLeftColor: itemColor, borderColor: item.isNow ? '#f8fafc' : '#f1f5f9' }}
                                                                                onClick={() => { setEditItem(item); setIsEditing(true); }}
                                                                            >
                                                                                <div className="p-5 flex flex-col h-full gap-4">
                                                                                    <div className="flex justify-between items-center">
                                                                                        <div className="flex items-center gap-2.5 text-[10px] font-black px-3 py-1.5 rounded-full bg-slate-50 border border-slate-100 uppercase tracking-widest text-slate-500">
                                                                                            <span style={{ color: itemColor }}>{getTargetIcon(item.targetType, item.targetId)}</span>
                                                                                            <span className="truncate">{getTargetLabel(item)}</span>
                                                                                        </div>
                                                                                        {item.isNow && (
                                                                                            <div className="flex items-center gap-1.5 bg-green-50 text-green-600 px-2 py-1 rounded-full border border-green-100">
                                                                                                <div className="flex h-2 w-2 relative">
                                                                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                                                                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-600"></span>
                                                                                                </div>
                                                                                                <span className="text-[9px] font-black uppercase">LIVE</span>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>

                                                                                    <h4 className={`font-black text-slate-900 leading-tight tracking-tight ${item.isNow ? 'text-xl' : 'text-lg'}`}>
                                                                                        {item.description}
                                                                                    </h4>

                                                                                    <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between">
                                                                                        <div className="flex items-center gap-2 text-slate-400 group-hover/card:text-blue-500 transition-colors">
                                                                                            <Clock size={16} weight="bold" />
                                                                                            <span className="text-sm font-black font-mono tracking-tighter">
                                                                                                {item.startTime} - {item.endTime}
                                                                                            </span>
                                                                                        </div>
                                                                                        <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-all transform translate-x-2 group-hover/card:translate-x-0">
                                                                                            <Edit2 size={14} weight="bold" className="text-slate-400" />
                                                                                        </div>
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
                        </div>
                    </div>
                </div>,
                document.body
            )}
            <TacticalDeleteStyles />
        </div>
    );
};
