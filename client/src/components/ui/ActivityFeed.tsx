import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, ClockCounterClockwise, Calendar, Funnel, CaretDown, Check, MagnifyingGlass as SearchIcon, ArrowLeft, UserPlus, PencilSimple, Eye, DownloadSimple, CheckCircle, User, Trash, PlusCircle, ArrowsLeftRight } from '@phosphor-icons/react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { AuditLog } from '@/services/auditService';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { Person, TaskTemplate, Team } from '@/types';
import { useActivityLogs } from '@/hooks/useActivityLogs';
import { DatePicker, DateTimePicker } from './DatePicker';
import { generateAuditExcel } from '@/utils/auditExport';
import { fetchLogs } from '@/services/auditService';
import { GenericModal } from './GenericModal';

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
    const { logs, isLoading, isLoadingMore, hasMore, filters, updateFilters, loadMore } = useActivityLogs({ organizationId, entityTypes, initialFilters, people });
    const observerTarget = useRef<HTMLDivElement>(null);
    const personSelectRef = useRef<HTMLDivElement>(null);

    const [showFilters, setShowFilters] = useState(false);
    const [personSelectorOpen, setPersonSelectorOpen] = useState(false);
    const [personSearchTerm, setPersonSearchTerm] = useState('');
    const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(new Set());
    const [isExporting, setIsExporting] = useState(false);
    const [showViews, setShowViews] = useState(false); // Toggle to show "Viewed" (CLICK) events

    // Export Modal State
    const [exportModalOpen, setExportModalOpen] = useState(false);
    const [exportRange, setExportRange] = useState({
        start: format(new Date(new Date().setHours(0, 0, 0, 0)), "yyyy-MM-dd'T'HH:mm"),
        end: format(new Date(), "yyyy-MM-dd'T'HH:mm")
    });

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

    // Filter out CLICK events if showViews is false
    // AND filter out non-attendance relevant person updates (color, phone, email only)
    const visibleLogs = useMemo(() => {
        return logs.filter(log => {
            // 1. Filter Views/Clicks
            if (!showViews && (log.event_type === 'CLICK' || log.event_type === 'VIEW')) {
                return false;
            }

            // 2. Filter Person Updates - only show relevant (Active, Team, Role, Name)
            //    Hide if ONLY color/phone/email/preferences changed.
            // 2. Filter Person/Admin Events
            //    Strictly hide administrative actions (Create User, Update Details) from the Attendance Log.
            //    Only show "Active" status changes (e.g. Deactivation) as they affect availability.
            const isPersonEvent =
                log.event_type === 'PERSON_CREATE' ||
                log.event_type === 'PERSON_UPDATE' ||
                (log.entity_type === 'person' || log.entity_type === 'people');

            if (isPersonEvent) {
                // Always hide Create events (administrative)
                if (log.event_type === 'PERSON_CREATE' || log.event_type === 'CREATE') {
                    return false;
                }

                // For Updates, ONLY show if the Active status changed (Availability change)
                if (log.event_type === 'PERSON_UPDATE' || log.event_type === 'UPDATE') {
                    if (log.before_data && log.after_data) {
                        // Check for Active status change
                        const isActiveChanged = log.before_data.isActive !== log.after_data.isActive;
                        if (isActiveChanged) {
                            return true;
                        }
                    }
                    // Hide all other updates (Name, Team, Role, Phone, etc.)
                    return false;
                }

                // Default hide for other person events
                return false;
            }

            return true;
        });
    }, [logs, showViews]);

    // Auto-load more if client-side filtering hides too many items
    useEffect(() => {
        if (!isLoading && !isLoadingMore && hasMore && visibleLogs.length < 5 && logs.length > 0) {
            // If we have loaded logs but mapped them all out (e.g. they are irrelevant updates),
            // we should automatically load more to fill the view.
            loadMore();
        }
    }, [isLoading, isLoadingMore, hasMore, visibleLogs.length, logs.length, loadMore]);

    const translateAction = (action: string, entityType: string, description: string) => {
        if (!description) return action;

        // Common translations for generic fallbacks
        let txt = description;
        txt = txt.replace(/Assigned (.*) to shift/i, 'שיבץ את $1 למשמרת');
        txt = txt.replace(/Unassigned (.*) from shift/i, 'הסיר את $1 מהמשמרת');
        txt = txt.replace(/Created (.*) (.*)/i, 'יצר/ה $1 $2');
        txt = txt.replace(/Updated (.*) (.*)/i, 'עדכן/ה $1 $2');
        txt = txt.replace(/Deleted (.*) (.*)/i, 'מחק/ה $1 $2');
        txt = txt.replace(/Cancelled shift/i, 'ביטול משמרת');
        txt = txt.replace(/Restored shift/i, 'שחזור משמרת');

        return txt;
    };

    const translateEntityType = (entityType: string) => {
        const types: Record<string, string> = {
            'people': 'חייל',
            'person': 'חייל',
            'shift': 'משמרת',
            'shifts': 'משמרת',
            'attendance': 'נוכחות',
            'daily_presence': 'נוכחות',
            'daily_presence_v2': 'נוכחות',
            'battalion': 'גדוד',
            'team': 'צוות',
            'teams': 'צוות',
            'organization': 'ארגון',
            'task': 'משימה',
            'tasks': 'משימה'
        };
        return types[entityType] || entityType;
    };

    const formatLogMessage = (log: AuditLog) => {
        const userName = log.user_name || 'מערכת';
        const eventType = log.event_type;
        const entityType = log.entity_type;

        // --- Handle VIEW / CLICK Events ---
        if (eventType === 'CLICK' || eventType === 'VIEW') {
            return (
                <div className="flex items-center gap-2 text-[10px] text-slate-400 bg-slate-50/50 px-2 py-1.5 rounded-xl border border-dashed border-slate-200">
                    <Eye size={14} weight="bold" className="text-slate-300" />
                    <span className="font-bold text-slate-500">{userName}</span>
                    <span> {eventType === 'VIEW' ? 'צפה בפרטים' : 'לחץ על אלמנט'}</span>
                    {log.action_description && log.action_description !== 'No description provided' && (
                        <span className="text-slate-300 mx-1 underline decoration-dotted underline-offset-2">
                            • {translateAction(eventType, entityType, log.action_description)}
                        </span>
                    )}
                </div>
            );
        }

        // --- Handle PERSON Events (Create/Update) ---
        if (entityType === 'people' || entityType === 'person' || eventType === 'PERSON_CREATE' || eventType === 'PERSON_UPDATE' || (eventType === 'UPDATE' && (entityType === 'person' || entityType === 'people'))) {
            const isCreate = eventType === 'PERSON_CREATE' || eventType === 'CREATE';
            const personName = log.entity_name || log.metadata?.personName || log.metadata?.name || 'חייל';

            // Try to detect changes for updates
            let changes: string[] = [];
            if (!isCreate && log.before_data && log.after_data) {
                if (log.before_data.name !== log.after_data.name) changes.push('שינוי שם');
                if (log.before_data.phone !== log.after_data.phone) changes.push('שינוי טלפון');
                if (log.before_data.email !== log.after_data.email) changes.push('שינוי אימייל');
                if (log.before_data.isActive !== log.after_data.isActive) changes.push(log.after_data.isActive ? 'הפעלת משתמש' : 'השבתת משתמש');
                if (log.before_data.teamId !== log.after_data.teamId || log.before_data.team_id !== log.after_data.team_id) changes.push('שינוי צוות');
                if (JSON.stringify(log.before_data.roleIds) !== JSON.stringify(log.after_data.roleIds)) changes.push('עדכון תפקידים');
                if (log.before_data.color !== log.after_data.color) changes.push('שינוי צבע');
                // Check if changes array is empty but data IS different (deep comparison needed?)
                if (changes.length === 0) changes.push('עידכון פרטים');
            }

            return (
                <div className="flex flex-col gap-1.5 w-full">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center text-[10px] font-black text-purple-700 shadow-inner border border-white">
                                {userName.charAt(0)}
                            </div>
                            <span className="leading-relaxed">
                                <span className="font-black text-slate-800">{userName}</span>
                                <span className="mx-1 text-slate-500">{isCreate ? 'יצר/ה את ' : 'עדכן/ה את '}</span>
                                <span className="font-black text-slate-900 underline decoration-purple-200 underline-offset-4">{personName}</span>
                            </span>
                        </div>
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg font-black text-[9px] shadow-sm border ${isCreate ? 'text-green-700 bg-green-50 border-green-100' : 'text-purple-700 bg-purple-50 border-purple-100'}`}>
                            {isCreate ? <UserPlus size={12} weight="bold" /> : <PencilSimple size={12} weight="bold" />}
                            <span>{isCreate ? 'יצירה' : 'עדכון'}</span>
                        </div>
                    </div>

                    {!isCreate && changes.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2 pr-2 border-r-2 border-slate-100 mr-9">
                            {changes.map((change, idx) => (
                                <span key={idx} className="bg-white text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-lg border border-slate-200 shadow-sm flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                                    {change}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            );
        }

        // --- Handle SHIFT Events ---
        if (log.entity_type === 'shift' || log.entity_type === 'shifts') {
            const personName = log.metadata?.personName || 'חייל';
            const action = log.event_type;
            const isUpdate = action === 'UPDATE' || action === 'SHIFT_UPDATE';

            if (action === 'ASSIGN') {
                return (
                    <div className="flex flex-col gap-1 w-full">
                        <div className="flex items-center justify-between text-[11px] text-slate-600">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 border border-blue-200 shadow-sm">
                                    <PlusCircle size={14} weight="fill" />
                                </div>
                                <span className="leading-relaxed">
                                    <span className="font-black text-slate-900">{userName}</span>
                                    <span className="mx-1">שיבץ את</span>
                                    <span className="font-black text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-md border border-blue-100">{personName}</span>
                                    <span className="mx-1">למשמרת</span>
                                </span>
                            </div>
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
                        <div className="flex items-center justify-between text-[11px] text-slate-600">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg bg-red-100 flex items-center justify-center text-red-600 border border-red-200 shadow-sm">
                                    <Trash size={14} weight="fill" />
                                </div>
                                <span className="leading-relaxed text-right">
                                    <span className="font-black text-slate-900">{userName}</span>
                                    <span className="mx-1">הסיר את</span>
                                    <span className="font-black text-red-700 bg-red-50 px-1.5 py-0.5 rounded-md border border-red-100">{personName}</span>
                                    <span className="mx-1">מהמשמרת</span>
                                </span>
                            </div>
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
            } else if (isUpdate) {
                // Detect specific shift changes
                const changes: string[] = [];
                if (log.before_data && log.after_data) {
                    if (log.before_data.start_time !== log.after_data.start_time) changes.push('שינוי זמן התחלה');
                    if (log.before_data.end_time !== log.after_data.end_time) changes.push('שינוי זמן סיום');
                    if (JSON.stringify(log.before_data.assigned_person_ids) !== JSON.stringify(log.after_data.assigned_person_ids)) changes.push('עדכון שיבוצים');
                    if (log.before_data.is_cancelled !== log.after_data.is_cancelled) changes.push(log.after_data.is_cancelled ? 'ביטול משמרת' : 'שחזור משמרת');
                    if (log.before_data.is_locked !== log.after_data.is_locked) changes.push(log.after_data.is_locked ? 'נעילת משמרת' : 'פתיחת משמרת');
                    // Check metadata for commander change
                    if (log.before_data.metadata?.commanderId !== log.after_data.metadata?.commanderId) changes.push('שינוי מפקד משמרת');
                }

                if (changes.length === 0) changes.push('עדכון פרטי משמרת');

                return (
                    <div className="flex flex-col gap-1.5 w-full">
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center text-[10px] font-black text-blue-700 shadow-inner border border-white">
                                    {userName.charAt(0)}
                                </div>
                                <span className="leading-relaxed">
                                    <span className="font-black text-slate-800">{userName}</span>
                                    <span className="mx-1 text-slate-500">עדכן/ה את המשמרת</span>
                                </span>
                            </div>
                            <div className="text-blue-700 bg-blue-50 px-2 py-1 rounded-lg font-black text-[9px] flex items-center gap-1.5 border border-blue-100 shadow-sm">
                                <PencilSimple size={12} weight="bold" />
                                <span>עדכון</span>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5 mt-2 pr-2 border-r-2 border-slate-100 mr-9">
                            {changes.map((change, idx) => (
                                <span key={idx} className="bg-white text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-lg border border-blue-100 shadow-sm flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-300"></div>
                                    {change}
                                </span>
                            ))}
                        </div>

                        {log.metadata?.taskName && (
                            <div className="text-[10px] font-bold text-slate-400 mt-2 pr-9 flex items-center gap-1.5">
                                <div className="w-1 h-1 rounded-full bg-slate-300" />
                                <span>משימה: {log.metadata.taskName}</span>
                            </div>
                        )}
                    </div>
                );
            } else {
                return (
                    <div className="flex flex-col gap-1 w-full">
                        <div className="flex items-center gap-2 text-[11px] text-slate-600 border-r-2 border-slate-300 pr-3 mr-1 bg-slate-50/50 py-1 rounded-l-lg">
                            <ArrowsLeftRight size={14} weight="bold" className="text-slate-400" />
                            <span className="font-black text-slate-900">{userName}</span>
                            <span className="mx-0.5"> {translateAction(log.event_type, log.entity_type, log.action_description)}</span>
                        </div>
                    </div>
                );
            }
        }

        const soldierName = log.entity_name || log.metadata?.entity_name || log.metadata?.personName;
        const isBulk = log.event_type === 'daily_presence_bulk_upsert';
        const isAttendanceType = log.entity_type === 'attendance' || log.entity_type === 'daily_presence' || log.entity_type === 'daily_presence_v2' || isBulk;

        // Extract structured data from metadata if available, otherwise fallback to before/after_data
        const meta = log.metadata || {};

        // Helper to determine badge props from raw status string/object
        const extractProps = (val: any, homeType?: string, isNew?: boolean) => {
            if (!val) return { status: 'unknown' };

            // Handle Object (V2 Strategy & General structured data)
            if (typeof val === 'object' && val !== null) {
                const status = val.v2_state || val.status || 'unknown';
                const hType = val.home_status_type || homeType;

                if (status === 'home') {
                    return { status: 'home', homeStatusType: hType || 'leave_shamp' };
                }

                if (status === 'base' || status === 'בסיס') {
                    const start = val.start_time || val.startHour || (isNew ? meta.start : null) || '00:00';
                    const end = val.end_time || val.endHour || (isNew ? meta.end : null) || '23:59';

                    if (start !== '00:00') return { status: `הגעה (${start})` };
                    if (end !== '23:59' && end !== '00:00') return { status: `יציאה (${end})` };
                    return { status: 'base' };
                }

                return { status: status.toString() };
            }

            const str = typeof val === 'string' ? val : JSON.stringify(val);

            // If explicit home type is known
            if (homeType) return { status: 'home', homeStatusType: homeType };

            // Handle Arrival/Departure specifically for New Status
            if (isNew && (str.startsWith('base') || str.startsWith('בסיס'))) {
                const start = meta.start || '00:00';
                const end = meta.end || '23:59';
                if (start !== '00:00') return { status: `הגעה (${start})` };
                if (start === '00:00' && end !== '23:59' && end !== '00:00') return { status: `יציאה (${end})` };
            }

            return { status: str };
        };

        // Handle Soldier-specific updates (Attendance)
        if (isAttendanceType) {
            const oldStatusRaw = log.before_data || meta.oldStatus;
            const newStatusRaw = log.after_data || meta.status;

            const oldBadgeProps = extractProps(oldStatusRaw);
            const newBadgeProps = extractProps(newStatusRaw, meta.homeStatusType, true);

            return (
                <div className="flex flex-col gap-2 w-full">
                    {/* Header: User & Soldier info */}
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-[10px] font-black text-slate-600 shadow-inner border border-white">
                                {userName.charAt(0)}
                            </div>
                            <span className="leading-relaxed">
                                <span className="font-black text-slate-800">{userName}</span>
                                <span className="mx-1">עדכן/ה את</span>
                                <span className="font-black text-slate-900 underline decoration-slate-200 underline-offset-4">{soldierName || 'נתוני נוכחות'}</span>
                            </span>
                        </div>
                        {isBulk && (
                            <div className="flex items-center gap-1.5 text-blue-600 bg-blue-50 px-2 py-1 rounded-lg font-black text-[9px] border border-blue-100 shadow-sm">
                                <ClockCounterClockwise size={12} weight="bold" />
                                <span>סנכרון מרוכז</span>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-3 bg-white p-2.5 rounded-2xl border border-slate-100 shadow-sm mr-9 w-fit">
                        {/* RTL Flow: [New (Left)] <- [Old (Right)] */}
                        {oldStatusRaw && (
                            <>
                                <StatusBadge {...oldBadgeProps} size="sm" className="opacity-60 scale-90 grayscale-[0.2]" />
                                <div className="text-slate-300 flex items-center justify-center bg-slate-50 w-6 h-6 rounded-full border border-slate-100">
                                    <ArrowLeft size={14} weight="bold" />
                                </div>
                            </>
                        )}
                        <StatusBadge {...newBadgeProps} size="md" className="shadow-sm font-black transform scale-105" />
                    </div>
                </div>
            );
        }

        if (isBulk) {
            const count = meta.updated_count || meta.inserted_count || 1;
            return (
                <div className="flex flex-col gap-2 w-full">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 border border-blue-200 shadow-sm">
                                <ClockCounterClockwise size={16} weight="fill" />
                            </div>
                            <span className="leading-relaxed">
                                <span className="font-black text-slate-800">{userName}</span>
                                <span className="mx-1">ביצע/ה</span>
                                <span className="font-black text-blue-700 underline decoration-blue-200 underline-offset-4">סנכרון נתונים מרוכז</span>
                            </span>
                        </div>
                    </div>
                    <div className="bg-blue-50/50 p-2.5 rounded-xl border border-blue-100/50 mr-9">
                        <div className="text-[10px] text-blue-800 font-bold mb-1">{log.action_description || 'עדכון נוכחות מרוכז'}</div>
                        <div className="text-[9px] text-blue-600/70 italic flex items-center gap-1">
                            <CheckCircle size={10} weight="bold" />
                            עודכנו {count} רשומות במערכת
                        </div>
                    </div>
                </div>
            );
        }

        // Generic fallback for other entities
        const oldStatusRaw = log.before_data || meta.oldStatus;
        const newStatusRaw = log.after_data || meta.status;
        const oldBadgeProps = extractProps(oldStatusRaw);
        const newBadgeProps = extractProps(newStatusRaw, meta.homeStatusType, true);

        return (
            <div className="flex flex-col gap-2 w-full">
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-600 border border-white shadow-sm font-mono">
                            {userName.charAt(0)}
                        </div>
                        <span className="leading-relaxed">
                            <span className="font-black text-slate-800">{userName}</span>
                            <span className="mx-1"> {log.action_description?.includes('Created') || log.action_description?.includes('יצר') ? 'יצר/ה את' : 'עדכן/ה את'} </span>
                            <span className="font-black text-slate-900">{soldierName || translateEntityType(log.entity_type)}</span>
                        </span>
                    </div>
                </div>

                {(oldStatusRaw || newStatusRaw) && (
                    <div className="flex items-center gap-3 bg-slate-50/30 p-2.5 rounded-xl border border-slate-100 mr-9 w-fit">
                        {oldStatusRaw && (
                            <>
                                <StatusBadge {...oldBadgeProps} size="sm" className="opacity-60 scale-90" />
                                <div className="text-slate-300">
                                    <ArrowLeft size={14} weight="bold" />
                                </div>
                            </>
                        )}
                        <StatusBadge {...newBadgeProps} size="sm" className="shadow-sm font-black" />
                    </div>
                )}
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
        const cleared = { personId: undefined, taskId: undefined, date: undefined, createdDate: undefined, entityId: undefined, startTime: undefined, startDate: undefined, endDate: undefined };
        setDraftFilters(cleared);
        updateFilters(cleared);
    };

    const hasActiveFilters = !!(filters.personId || filters.date || filters.createdDate || filters.taskId || filters.entityId || filters.startTime || filters.startDate || filters.endDate);

    const handleExport = async () => {
        try {
            setIsExporting(true);
            // Fetch ALL matching logs for export (bypassing limit)
            const exportLogs = await fetchLogs(organizationId, {
                ...filters,
                startDateTime: exportRange.start,
                endDateTime: exportRange.end,
                limit: 5000 // Higher limit for full export
            });

            if (exportLogs.length === 0) {
                alert('לא נמצאו נתונים לייצוא בטווח הזמנים שנבחר');
                return;
            }

            await generateAuditExcel(exportLogs, `דוח_פעולות_${format(new Date(exportRange.start), 'dd-MM-HHmm')}_עד_${format(new Date(exportRange.end), 'dd-MM-HHmm')}.xlsx`);
            setExportModalOpen(false);
        } catch (error) {
            console.error('Export failed:', error);
            alert('ייצוא נכשל. אנא נסה שוב.');
        } finally {
            setIsExporting(false);
        }
    };

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
        <div className="fixed top-[8.5rem] md:top-16 bottom-0 right-0 w-full md:w-96 bg-white/80 backdrop-blur-2xl border-left border-slate-200 flex flex-col h-[calc(100%-8.5rem)] md:h-[calc(100%-64px)] shadow-[0_0_50px_-12px_rgba(0,0,0,0.25)] z-[10001] animate-in slide-in-from-right duration-500 overflow-hidden" dir="rtl">
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
                    <button
                        onClick={() => setShowViews(!showViews)}
                        className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 ${showViews ? 'bg-blue-100 text-blue-600' : 'hover:bg-slate-200 text-slate-400'}`}
                        title={showViews ? "הסתר צפיות" : "הצג צפיות"}
                    >
                        <Eye size={20} weight={showViews ? "fill" : "bold"} />
                    </button>
                    <button
                        onClick={() => setExportModalOpen(true)}
                        className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 transition-colors flex items-center gap-1"
                        title="הורדה לאקסל"
                    >
                        <DownloadSimple size={20} weight="bold" />
                    </button>
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
                    <div className="grid grid-cols-2 gap-2">
                        <DatePicker
                            value={draftFilters.startDate || ''}
                            onChange={(val) => setDraftFilters(prev => ({ ...prev, startDate: val || undefined }))}
                            variant="compact"
                            label="מתאריך"
                            className="w-full"
                        />
                        <DatePicker
                            value={draftFilters.endDate || ''}
                            onChange={(val) => setDraftFilters(prev => ({ ...prev, endDate: val || undefined }))}
                            variant="compact"
                            label="עד תאריך"
                            className="w-full"
                        />
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                        <button onClick={handleApplyFilters} className="flex-1 h-9 bg-blue-600 text-white rounded-xl text-xs font-black hover:bg-blue-700 transition-colors shadow-sm flex items-center justify-center gap-2">
                            <Check size={14} weight="bold" />
                            <span>החל סינון</span>
                        </button>
                        {(draftFilters.personId || draftFilters.date || draftFilters.taskId || draftFilters.startDate || draftFilters.endDate || draftFilters.createdDate) && (
                            <button onClick={handleClearFilters} className="px-3 h-9 bg-slate-100 text-slate-500 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors">נקה</button>
                        )}
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 md:p-3 space-y-3">
                {isLoading && visibleLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
                        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-bold">טוען פעולות...</span>
                    </div>
                ) : visibleLogs.length === 0 ? (
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
                        {visibleLogs.map((log) => (
                            <div key={log.id} onClick={() => onLogClick?.(log)} className={`p-4 bg-white/70 backdrop-blur-md rounded-[24px] border border-slate-200/50 hover:border-blue-400/30 hover:bg-white hover:shadow-xl hover:shadow-blue-900/5 transition-all duration-300 group relative overflow-hidden ${onLogClick ? 'cursor-pointer active:scale-[0.99] active:shadow-inner' : ''}`}>
                                {/* Subtle Background Gradient for Premium Feel */}
                                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/5 to-transparent rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700" />

                                <div className="flex justify-between items-start mb-3 relative z-10">
                                    <div className="flex items-center gap-3">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] font-black text-slate-400 tracking-[0.2em] uppercase mb-0.5">זמן עריכה</span>
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shadow-sm shadow-blue-500/50" />
                                                <span className="text-[11px] font-black text-slate-700">{format(new Date(log.created_at), 'HH:mm • dd/MM/yy', { locale: he })}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-slate-100 group-hover:bg-blue-500 transition-all duration-500 shadow-sm" />
                                        <div className="w-1 h-8 rounded-full bg-slate-100 group-hover:bg-blue-100 transition-colors duration-500" />
                                    </div>
                                </div>

                                <div className="relative z-10 mb-3">
                                    {formatLogMessage(log)}
                                </div>

                                {(() => {
                                    const metaDate = log.after_data?.date || log.metadata?.date || (log.metadata?.startTime ? format(new Date(log.metadata.startTime), 'yyyy-MM-dd') : null);
                                    if (!metaDate) return null;

                                    // Format the date nicely (dd/MM/yyyy)
                                    let formattedTargetDate = metaDate;
                                    try {
                                        formattedTargetDate = format(new Date(metaDate), 'dd MMMM yyyy', { locale: he });
                                    } catch (e) {
                                        console.warn('[ActivityFeed] Failed to format metaDate:', metaDate);
                                    }

                                    return (
                                        <div className="mt-3 flex items-center gap-2 text-[10px] text-blue-700 font-black bg-gradient-to-r from-blue-50 to-transparent px-3 py-1.5 rounded-xl w-fit border border-blue-100/30 group-hover:from-blue-100/50 transition-all duration-300">
                                            <Calendar size={14} weight="fill" className="text-blue-500" />
                                            <span>עבור יום: {formattedTargetDate}</span>
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
            <GenericModal
                isOpen={exportModalOpen}
                onClose={() => setExportModalOpen(false)}
                title="ייצוא היסטוריה לאקסל"
                size="sm"
                footer={
                    <div className="flex gap-3 w-full">
                        <button
                            onClick={() => setExportModalOpen(false)}
                            className="flex-1 h-12 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                        >
                            ביטול
                        </button>
                        <button
                            onClick={handleExport}
                            disabled={isExporting}
                            className="flex-[2] h-12 bg-blue-600 text-white rounded-xl font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isExporting ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>מייצא נתונים...</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle size={20} weight="bold" />
                                    <span>הורד אקסל</span>
                                </>
                            )}
                        </button>
                    </div>
                }
            >
                <div className="flex flex-col gap-6 py-2">
                    <p className="text-sm text-slate-500 leading-relaxed">
                        בחר את טווח הזמנים לייצוא ההיסטוריה. הקובץ יכיל את כל השינויים שבוצעו בטווח זה בצורה ברורה ומפורטת.
                    </p>

                    <div className="space-y-4">
                        <DateTimePicker
                            label="מתאריך ושעה"
                            value={exportRange.start}
                            onChange={(val) => setExportRange(prev => ({ ...prev, start: val }))}
                        />
                        <DateTimePicker
                            label="עד תאריך ושעה"
                            value={exportRange.end}
                            onChange={(val) => setExportRange(prev => ({ ...prev, end: val }))}
                        />
                    </div>

                </div>
            </GenericModal>
        </div>,
        document.body
    );
}, (prev, next) => {
    // Custom comparison for React.memo to prevent unnecessary re-renders
    // We only care if relevant props change
    if (prev.onClose !== next.onClose) return false;
    if (prev.organizationId !== next.organizationId) return false;
    if (prev.people !== next.people) return false; // Reference equality check for people array

    // Deep compare initialFilters only if they exist
    if (JSON.stringify(prev.initialFilters) !== JSON.stringify(next.initialFilters)) return false;

    return true;
});
