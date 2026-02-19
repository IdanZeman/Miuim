import React, { useEffect, useState } from 'react';
import { callBackend } from '../../services/backendService';
import { useAuth } from '../../features/auth/AuthContext';
import {
    Shield as ShieldIcon,
    MagnifyingGlass as SearchIcon,
    ArrowsClockwise as RefreshIcon,
    Funnel as FilterIcon,
    User as UserIcon,
    Clock as ClockIcon,
    CalendarBlank as CalendarIcon,
    CheckCircle as CheckIcon,
    Warning as WarnIcon,
    XCircle as ErrorIcon,
    Info as InfoIcon,
    ArrowUpRight as AssignIcon,
    ArrowDownLeft as UnassignIcon,
    Globe as GlobeIcon,
    Desktop as DesktopIcon,
    DeviceMobile as MobileIcon,
    SignIn as LoginIcon,
    SignOut as LogoutIcon,
    PencilSimple as EditIcon,
    Trash as DeleteIcon,
    Plus as CreateIcon,
    IdentificationBadge as ProfileIcon,
    Buildings as OrgIcon,
    ListChecks as TaskIcon
} from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import type { LogLevel } from '../../services/loggingService';
import { Select } from '../../components/ui/Select';
import { ExportButton } from '../../components/ui/ExportButton';
import { AdminLogsSkeleton } from './AdminLogsSkeleton';

interface LogEntry {
    id: string;
    created_at: string;
    log_level: LogLevel;
    event_type: string;
    event_category: string;
    action_description: string;
    entity_type: string;
    entity_id: string;
    user_id: string;
    user_email: string;
    user_name: string;
    organization_id: string;
    component_name?: string;
    performance_ms?: number;
    before_data: any;
    after_data: any;
    metadata?: any;
    org_data?: { name: string };
    org_name?: string;
}

interface AdminLogsViewerProps {
    excludeUserId?: string;
    limit?: number;
}

export const AdminLogsViewer: React.FC<AdminLogsViewerProps> = ({ excludeUserId, limit: initialLimit = 100 }) => {
    const { user, profile } = useAuth();
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const [levelFilter, setLevelFilter] = useState<LogLevel | 'ALL'>('ALL');
    const [componentFilter, setComponentFilter] = useState('');
    const [hideMyLogs, setHideMyLogs] = useState(true);
    const [limit, setLimit] = useState(initialLimit);
    const [expandedRow, setExpandedRow] = useState<string | null>(null);
    const [typeFilter, setTypeFilter] = useState<'ALL' | 'VIEWS' | 'CHANGES'>('ALL');

    // Debounce filters for server-side search to avoid excessive API calls
    const [debouncedFilter, setDebouncedFilter] = useState(filter);
    const [debouncedComponent, setDebouncedComponent] = useState(componentFilter);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedFilter(filter), 500);
        return () => clearTimeout(timer);
    }, [filter]);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedComponent(componentFilter), 500);
        return () => clearTimeout(timer);
    }, [componentFilter]);

    useEffect(() => {
        if (profile?.is_super_admin) {
            fetchLogs();
        }
    }, [user, limit, profile, debouncedFilter, debouncedComponent, levelFilter, typeFilter, hideMyLogs]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.append('limit', limit.toString());
            if (filter.trim()) params.append('filter', filter.trim());
            if (levelFilter !== 'ALL') params.append('level', levelFilter);
            if (componentFilter.trim()) params.append('component', componentFilter.trim());
            if (typeFilter !== 'ALL') params.append('type', typeFilter);
            if (excludeUserId) params.append('excludeUserId', excludeUserId);

            // 1. Fetch Logs from Backend
            const logsData = await callBackend(`/api/admin/audit-logs?${params.toString()}`, 'GET');

            // 2. Fetch Organization Names for the result set
            const orgIdsToFetch = [...new Set((logsData as LogEntry[])?.map(l => l.organization_id).filter(Boolean))];
            let orgMap: Record<string, string> = {};

            if (orgIdsToFetch.length > 0) {
                const orgs = await callBackend(`/api/org/list?ids=${orgIdsToFetch.join(',')}`, 'GET');
                (orgs || []).forEach((o: any) => orgMap[o.id] = o.name);
            }

            const processedLogs = (logsData || [])?.map((log: LogEntry) => ({
                ...log,
                org_name: log.organization_id ? (orgMap[log.organization_id] || 'N/A') : '-'
            })) || [];

            setLogs(processedLogs);
        } catch (error) {
            console.error('Error fetching logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredLogs = logs.filter(log => {
        const matchesSearch =
            log.event_type?.toLowerCase().includes(filter.toLowerCase()) ||
            log.action_description?.toLowerCase().includes(filter.toLowerCase()) ||
            log.user_email?.toLowerCase().includes(filter.toLowerCase()) ||
            log.user_name?.toLowerCase().includes(filter.toLowerCase()) ||
            log.entity_type?.toLowerCase().includes(filter.toLowerCase()) ||
            log.component_name?.toLowerCase().includes(filter.toLowerCase()) ||
            (log.org_name && log.org_name.toLowerCase().includes(filter.toLowerCase()));

        const matchesLevel = levelFilter === 'ALL' || log.log_level === levelFilter;
        const matchesComponent = !componentFilter || log.component_name?.toLowerCase().includes(componentFilter.toLowerCase());
        const matchesUser = hideMyLogs ? log.user_email !== user?.email : true;
        const matchesExclude = excludeUserId ? log.user_id !== excludeUserId : true;

        const VIEW_EVENTS = ['VIEW', 'CLICK', 'APP_LAUNCH', 'LOGIN', 'LOGOUT'];
        const matchesType = typeFilter === 'ALL' ||
            (typeFilter === 'VIEWS' ? VIEW_EVENTS.includes(log.event_type) : !VIEW_EVENTS.includes(log.event_type));

        return matchesSearch && matchesLevel && matchesComponent && matchesUser && matchesExclude && matchesType;
    });

    // Get unique components for filter
    const uniqueComponents = [...new Set(logs.map(l => l.component_name).filter(Boolean))];

    const getLevelColor = (level: LogLevel) => {
        switch (level) {
            case 'TRACE': return 'bg-slate-100 text-slate-500 border-slate-200';
            case 'DEBUG': return 'bg-cyan-100 text-cyan-700 border-cyan-200';
            case 'INFO': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'WARN': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'ERROR': return 'bg-rose-100 text-rose-700 border-rose-200';
            case 'FATAL': return 'bg-red-200 text-red-900 border-red-300 font-black';
            default: return 'bg-slate-50 text-slate-400 border-slate-100';
        }
    };

    const getEventIcon = (log: LogEntry) => {
        const type = log.event_type;
        const category = log.event_category;

        if (type === 'LOGIN') return <LoginIcon size={20} weight="bold" className="text-emerald-500" />;
        if (type === 'LOGOUT') return <LogoutIcon size={20} weight="bold" className="text-slate-500" />;
        if (type === 'ASSIGN') return <AssignIcon size={20} weight="bold" className="text-blue-500" />;
        if (type === 'UNASSIGN') return <UnassignIcon size={20} weight="bold" className="text-amber-500" />;
        if (type === 'CREATE') return <CreateIcon size={20} weight="bold" className="text-green-500" />;
        if (type === 'UPDATE' || type === 'CHECK_IN') return <EditIcon size={20} weight="bold" className="text-indigo-500" />;
        if (type === 'DELETE') return <DeleteIcon size={20} weight="bold" className="text-rose-500" />;
        if (type === 'EXPORT') return <GlobeIcon size={20} weight="bold" className="text-purple-500" />;

        if (category === 'auth') return <LoginIcon size={20} weight="bold" />;
        if (category === 'scheduling') return <TaskIcon size={20} weight="bold" />;
        if (category === 'security') return <ShieldIcon size={20} weight="bold" />;
        if (category === 'ui') return <DesktopIcon size={20} weight="bold" />;

        return <InfoIcon size={20} weight="bold" className="text-slate-400" />;
    };

    const humanizeLog = (log: LogEntry) => {
        const { event_type, user_name, metadata, before_data, after_data, entity_type } = log;
        const name = user_name || 'מערכת';
        const pName = metadata?.personName || metadata?.entity_name || log.entity_id || 'חייל';

        switch (event_type) {
            case 'LOGIN': return `המשתמש ${name} התחבר למערכת`;
            case 'LOGOUT': return `המשתמש ${name} התנתק מהמערכת`;
            case 'ASSIGN':
                return `המשתמש ${name} שיבץ את ${pName} למשימת ${metadata?.taskName || 'משימה'} בתאריך ${metadata?.date || ''}`;
            case 'UNASSIGN':
                return `המשתמש ${name} הסיר את ${pName} ממשימת ${metadata?.taskName || 'משימה'} בתאריך ${metadata?.date || ''}`;
            case 'UPDATE':
                if (entity_type === 'attendance') {
                    return `עודכן סטטוס ל${pName}: מעבר ל-${after_data} (במקום ${before_data})`;
                }
                if (entity_type === 'person') {
                    return `עודכנו פרטי חייל עבור ${pName}`;
                }
                return `בוצע עדכון ב-${entity_type}: ${log.action_description}`;
            case 'CHECK_IN':
                return `בוצע צ'ק-אין (נוכחות בבסיס) עבור ${pName}`;
            case 'CREATE':
                return `נוצר פריט חדש מסוג ${entity_type}: ${pName}`;
            case 'DELETE':
                return `נמחק פריט מסוג ${entity_type}: ${pName}`;
            case 'EXPORT':
                return `יוצאו נתונים לקובץ חיצוני על ידי ${name}`;
            case 'VIEW':
                return `המשתמש ${name} צפה בדף ${metadata?.pageName || metadata?.path || log.entity_id || 'מסוים'}`;
            case 'CLICK':
                const comp = metadata?.componentName || log.component_name || '';
                const compStr = comp && comp !== 'Global' ? ` ברכיב ${comp}` : '';
                const pg = metadata?.pageName || metadata?.path || metadata?.url || '';
                // Extract path from URL if needed
                let pathStr = pg;
                try {
                    if (pg.startsWith('http')) {
                        pathStr = new URL(pg).pathname;
                    }
                } catch (e) { }
                const displayedPg = pathStr ? ` בדף ${pathStr}` : '';
                return `בוצעה לחיצה על כפתור "${metadata?.elementName || 'רכיב'}"${compStr}${displayedPg} על ידי ${name}`;
            default:
                return log.action_description || 'פעילות מערכת כללית';
        }
    };

    const exportToCSV = () => {
        const headers = ['Time', 'Level', 'Category', 'Event', 'Description', 'User', 'Organization', 'Component', 'Performance (ms)', 'Device', 'IP', 'Location'];
        const rows = filteredLogs.map(log => [
            new Date(log.created_at).toLocaleString('he-IL'),
            log.log_level,
            log.event_category,
            log.event_type,
            log.action_description,
            log.user_name || log.user_email || 'System',
            log.org_name,
            log.component_name || '',
            log.performance_ms || '',
            (log as any).device_type || '',
            (log as any).ip_address || '',
            `${(log as any).city || ''} ${(log as any).country || ''}`
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `system_logs_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    if (!profile?.is_super_admin) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400">
                <ShieldIcon size={64} className="mb-4 opacity-20" weight="bold" />
                <h2 className="text-xl font-bold">Access Denied</h2>
                <p>This area is restricted to system administrators.</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] border border-slate-200/60 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-6rem)] md:h-[calc(100vh-8rem)] relative z-20" data-component="AdminLogsViewer">
            {/* Premium Header */}
            <div className="flex flex-col md:flex-row items-center justify-between px-6 py-6 md:px-8 md:h-24 bg-white border-b border-slate-100 shrink-0 gap-4">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-sm shadow-blue-100">
                        <ShieldIcon size={24} weight="bold" />
                    </div>
                    <div>
                        <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-none">יומן פעילות מערכתי</h1>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">System Activity Stream (Raw Data)</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <ExportButton
                        onExport={async () => {
                            const headers = ['Time', 'Level', 'Category', 'Event', 'Description', 'User', 'Organization', 'Component', 'Performance (ms)', 'Device', 'IP', 'Location'];
                            const rows = filteredLogs.map(log => [
                                new Date(log.created_at).toLocaleString('he-IL'),
                                log.log_level,
                                log.event_category,
                                log.event_type,
                                log.action_description,
                                log.user_name || log.user_email || 'System',
                                log.org_name,
                                log.component_name || '',
                                log.performance_ms || '',
                                (log as any).device_type || '',
                                (log as any).ip_address || '',
                                `${(log as any).city || ''} ${(log as any).country || ''}`
                            ]);

                            const csvContent = [
                                headers.join(','),
                                ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
                            ].join('\n');

                            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                            const link = document.createElement('a');
                            link.href = URL.createObjectURL(blob);
                            link.download = `system_logs_${new Date().toISOString().split('T')[0]}.csv`;
                            link.click();
                        }}
                        label="Export CSV"
                        className="flex-1 md:flex-none h-11 px-6 shadow-lg shadow-slate-200"
                    />
                </div>
            </div>

            {/* Filters Bar */}
            <div className="p-4 md:px-8 md:py-5 border-b border-slate-100 bg-slate-50/50 shrink-0">
                <div className="flex flex-col md:flex-row gap-4 items-center">
                    {/* Search - Growing */}
                    <div className="relative w-full md:flex-1">
                        <SearchIcon className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} weight="bold" />
                        <input
                            type="text"
                            placeholder="חיפוש לפי פעולה, משתמש, ארגון או קומפוננטה..."
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="w-full h-12 pr-12 pl-4 rounded-2xl border border-slate-200 shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-base font-medium placeholder:text-slate-400 bg-white"
                        />
                    </div>

                    {/* Quick Filters - Fixed Widths or Auto */}
                    <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
                        <div className="min-w-[140px]">
                            <Select
                                value={levelFilter}
                                onChange={(val) => setLevelFilter(val as LogLevel | 'ALL')}
                                options={[
                                    { value: 'ALL', label: 'כל הרמות' },
                                    { value: 'TRACE', label: '🔍 TRACE' },
                                    { value: 'DEBUG', label: '🐛 DEBUG' },
                                    { value: 'INFO', label: 'ℹ️ INFO' },
                                    { value: 'WARN', label: '⚠️ WARN' },
                                    { value: 'ERROR', label: '❌ ERROR' },
                                    { value: 'FATAL', label: '💀 FATAL' }
                                ]}
                                placeholder="סינון רמה"
                                className="bg-white border-slate-200 h-11"
                            />
                        </div>

                        <div className="min-w-[140px]">
                            <Select
                                value={typeFilter}
                                onChange={(val) => setTypeFilter(val as any)}
                                options={[
                                    { value: 'ALL', label: 'כל הפעילות' },
                                    { value: 'VIEWS', label: '👁️ תצוגה בלבד' },
                                    { value: 'CHANGES', label: '✍️ שינויים בלבד' }
                                ]}
                                placeholder="סוג פעילות"
                                className="bg-white border-slate-200 h-11"
                            />
                        </div>



                        <div className="min-w-[150px]">
                            <Select
                                value={limit.toString()}
                                onChange={(val) => setLimit(Number(val))}
                                options={[
                                    { value: '100', label: '100 אחרונים' },
                                    { value: '500', label: '500 אחרונים' },
                                    { value: '1000', label: '1000 אחרונים' },
                                    { value: '2000', label: '2000 אחרונים' }
                                ]}
                                placeholder="כמות"
                                className="bg-white border-slate-200 h-11"
                            />
                        </div>

                        <button
                            onClick={fetchLogs}
                            className="h-12 w-12 flex items-center justify-center bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl text-slate-600 transition-all active:scale-95 shadow-sm shrink-0"
                            title="רענן"
                        >
                            <RefreshIcon size={20} className={loading ? 'animate-spin' : ''} weight="bold" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Area - Timeline Redesign */}
            <div className="flex-1 overflow-hidden relative flex flex-col bg-slate-50/30">
                {loading ? (
                    <AdminLogsSkeleton />
                ) : (
                    <div className="flex-1 overflow-y-auto px-4 py-8 md:px-12 md:py-10 custom-scrollbar scroll-smooth">
                        <div className="max-w-5xl mx-auto relative">
                            {/* Vertical Line */}
                            <div className="absolute right-[23px] top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-200 via-slate-200 to-transparent"></div>

                            <AnimatePresence mode='popLayout'>
                                {filteredLogs.map((log, index) => (
                                    <motion.div
                                        key={log.id}
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ duration: 0.3, delay: index * 0.05 }}
                                        className={`relative pr-16 mb-8 last:mb-0 group`}
                                    >
                                        {/* Timeline Dot & Icon */}
                                        <div className={`absolute right-0 top-1 w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-300 group-hover:scale-110 z-10
                                            ${log.log_level === 'ERROR' || log.log_level === 'FATAL' ? 'bg-rose-50 border-rose-200 ring-4 ring-rose-50' :
                                                log.log_level === 'WARN' ? 'bg-amber-50 border-amber-200 ring-4 ring-amber-50' :
                                                    'bg-white border-slate-200 ring-4 ring-slate-50'
                                            } border cursor-pointer`}
                                            onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}
                                        >
                                            {getEventIcon(log)}
                                        </div>

                                        {/* Card */}
                                        <div
                                            className={`bg-white rounded-3xl border border-slate-200 shadow-sm p-4 md:p-6 transition-all duration-300 cursor-pointer
                                                ${expandedRow === log.id ? 'ring-2 ring-blue-500/20 border-blue-500/30 shadow-blue-100/50' : 'hover:border-slate-300 hover:shadow-md'}
                                            `}
                                            onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}
                                        >
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                <div className="space-y-1 flex-1">
                                                    <div className="flex items-center gap-3 flex-wrap">
                                                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border shadow-sm ${getLevelColor(log.log_level)}`}>
                                                            {log.log_level}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-md">
                                                            <OrgIcon size={12} weight="bold" />
                                                            {log.org_name}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-md">
                                                            <ClockIcon size={12} weight="bold" />
                                                            {format(new Date(log.created_at), 'HH:mm • dd/MM/yyyy', { locale: he })}
                                                        </span>
                                                    </div>

                                                    <h3 className="text-base font-black text-slate-800 leading-snug">
                                                        {humanizeLog(log)}
                                                    </h3>
                                                </div>

                                                <div className="flex items-center gap-3 shrink-0 bg-slate-50/50 p-2 rounded-2xl border border-slate-100">
                                                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-sm font-black text-slate-500 shadow-sm overflow-hidden">
                                                        {log.user_name ? log.user_name.charAt(0).toUpperCase() : <ShieldIcon size={20} />}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-black text-slate-700 truncate max-w-[120px]">
                                                            {log.user_name || 'System'}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 font-mono truncate max-w-[120px]">
                                                            {log.user_email || 'automated_agent'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Expanded Detailed View */}
                                            <AnimatePresence>
                                                {expandedRow === log.id && (
                                                    <motion.div
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: 'auto' }}
                                                        exit={{ opacity: 0, height: 0 }}
                                                        className="overflow-hidden"
                                                    >
                                                        <div className="pt-6 mt-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-top-2">
                                                            {/* Context */}
                                                            <div className="space-y-3">
                                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                                    <GlobeIcon size={14} className="text-blue-500" /> סביבת עבודה
                                                                </span>
                                                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3 text-xs">
                                                                    <div className="flex justify-between items-center pb-2 border-b border-white/60">
                                                                        <span className="text-slate-500 font-medium">מכשיר</span>
                                                                        <span className="font-bold text-slate-700 flex items-center gap-2">
                                                                            {((log as any).device_type || (log as any).metadata?.device_type) === 'Mobile' ? <MobileIcon size={14} /> : <DesktopIcon size={14} />}
                                                                            {(log as any).device_type || (log as any).metadata?.device_type || 'Desktop'}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center pb-2 border-b border-white/60">
                                                                        <span className="text-slate-500 font-medium">מיקום</span>
                                                                        <span className="font-bold text-slate-700">
                                                                            {(log as any).city || (log as any).metadata?.city || 'Unknown'}, {(log as any).country || (log as any).metadata?.country || 'Unknown'}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center">
                                                                        <span className="text-slate-500 font-medium">כתובת IP</span>
                                                                        <span className="font-mono text-blue-600 bg-blue-50/50 px-2 py-0.5 rounded-lg">
                                                                            {(log as any).ip_address || (log as any).metadata?.ip || '0.0.0.0'}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Technical Data */}
                                                            <div className="space-y-3">
                                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                                    <ProfileIcon size={14} className="text-indigo-500" /> פרטים טכניים
                                                                </span>
                                                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3 text-xs">
                                                                    <div className="flex justify-between items-center">
                                                                        <span className="text-slate-500 font-medium">סוג ישות</span>
                                                                        <span className="bg-white px-2 py-1 rounded-lg font-bold text-slate-700 border border-slate-100">{log.entity_type || 'N/A'}</span>
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <span className="text-slate-500 font-medium">מזהה פנימי</span>
                                                                        <div className="font-mono text-[10px] text-slate-400 bg-white p-2 rounded-xl border border-slate-100 break-all select-all">{log.entity_id || 'N/A'}</div>
                                                                    </div>
                                                                    <div className="flex justify-between items-center">
                                                                        <span className="text-slate-500 font-medium">קומפוננטה</span>
                                                                        <span className="text-xs font-bold text-slate-600 uppercase tracking-tight">{log.component_name || '-'}</span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Raw Payload */}
                                                            <div className="space-y-3">
                                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                                    <TaskIcon size={14} className="text-emerald-500" /> נתונים גולמיים
                                                                </span>
                                                                <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800 shadow-inner max-h-48 overflow-auto custom-scrollbar-dark ltr">
                                                                    <pre className="text-[10px] font-mono text-emerald-400 leading-relaxed">{JSON.stringify({
                                                                        description: log.action_description,
                                                                        before: log.before_data,
                                                                        after: log.after_data,
                                                                        metadata: log.metadata
                                                                    }, null, 2)}</pre>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>

                            {filteredLogs.length === 0 && (
                                <div className="py-24 text-center text-slate-400">
                                    <div className="flex flex-col items-center gap-6">
                                        <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center text-slate-200">
                                            <SearchIcon size={56} weight="bold" />
                                        </div>
                                        <div>
                                            <h3 className="font-black text-2xl text-slate-700">לא נמצאה פעילות</h3>
                                            <p className="text-slate-400 font-bold mt-2">נסה לשנות את מסנני החיפוש כדי לראות תוצאות אחרות</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
