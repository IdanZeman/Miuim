import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../features/auth/AuthContext';
import { Shield as ShieldIcon, MagnifyingGlass as SearchIcon, ArrowsClockwise as RefreshIcon, Funnel as FilterIcon } from '@phosphor-icons/react';
import type { LogLevel } from '../../services/loggingService';
import { Select } from '../../components/ui/Select';
import { ExportButton } from '../../components/ui/ExportButton';

interface LogEntry {
    id: string;
    created_at: string;
    log_level: LogLevel;  // NEW
    event_type: string;
    event_category: string;
    action_description: string;
    entity_type: string;
    entity_id: string;
    user_id: string;
    user_email: string;
    user_name: string;
    organization_id: string;
    component_name?: string;  // NEW
    performance_ms?: number;  // NEW
    before_data: any;
    after_data: any;
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

    useEffect(() => {
        if (profile?.is_super_admin) {
            fetchLogs();
        }
    }, [user, limit, profile]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            // Fetch logs (include TRACE/CLICK for admin)
            const { data: logsData, error } = await supabase
                .from('audit_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;

            // Fetch Organization Names
            const orgIds = [...new Set(logsData?.map(l => l.organization_id).filter(Boolean))];
            let orgMap: Record<string, string> = {};

            if (orgIds.length > 0) {
                const { data: orgs } = await supabase
                    .from('organizations')
                    .select('id, name')
                    .in('id', orgIds);

                orgs?.forEach(o => orgMap[o.id] = o.name);
            }

            const processedLogs = logsData?.map(log => ({
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

        return matchesSearch && matchesLevel && matchesComponent && matchesUser && matchesExclude;
    });

    // Get unique components for filter
    const uniqueComponents = [...new Set(logs.map(l => l.component_name).filter(Boolean))];

    const getLevelColor = (level: LogLevel) => {
        switch (level) {
            case 'TRACE': return 'bg-gray-100 text-gray-600 border-gray-300';
            case 'DEBUG': return 'bg-blue-100 text-blue-700 border-blue-300';
            case 'INFO': return 'bg-green-100 text-green-700 border-green-300';
            case 'WARN': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
            case 'ERROR': return 'bg-red-100 text-red-700 border-red-300';
            case 'FATAL': return 'bg-red-200 text-red-900 border-red-400 font-bold';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    const getCategoryColor = (category: string) => {
        switch (category) {
            case 'auth': return 'bg-purple-100 text-purple-700 border-purple-200';
            case 'security': return 'bg-red-100 text-red-700 border-red-200';
            case 'scheduling': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'data': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'navigation': return 'bg-cyan-100 text-cyan-700 border-cyan-200';
            case 'ui': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
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
        <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] border border-slate-200/60 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-6rem)] md:h-[calc(100vh-8rem)] relative z-20">
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

                        <button
                            onClick={() => setHideMyLogs(!hideMyLogs)}
                            className={`h-12 px-5 rounded-2xl border text-xs font-bold transition-all whitespace-nowrap shadow-sm ${hideMyLogs
                                ? 'bg-blue-600 border-blue-600 text-white shadow-blue-200'
                                : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                                }`}
                        >
                            {hideMyLogs ? 'מציג לוגים של אחרים' : 'מציג גם פעולות שלי'}
                        </button>

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

            {/* Content Area - Scrollable */}
            <div className="flex-1 overflow-hidden relative flex flex-col">
                {/* Desktop Table */}
                <div className="hidden md:block flex-1 overflow-y-auto custom-scrollbar">
                    <table className="w-full text-sm text-right">
                        <thead className="bg-slate-50/90 backdrop-blur sticky top-0 z-10 text-slate-500 font-bold border-b border-slate-100 uppercase text-[10px] tracking-wider shadow-sm">
                            <tr>
                                <th className="px-6 py-4 w-40">זמן</th>
                                <th className="px-4 py-4 w-24">רמה</th>
                                <th className="px-4 py-4 w-40">סוג אירוע</th>
                                <th className="px-4 py-4">תיאור</th>
                                <th className="px-4 py-4 w-48">משתמש</th>
                                <th className="px-4 py-4 w-32">ארגון</th>
                                <th className="px-4 py-4 w-32">קומפוננטה</th>
                                <th className="px-4 py-4 w-24 text-center">⏱️</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredLogs.map((log) => (
                                <React.Fragment key={log.id}>
                                    <tr
                                        className={`hover:bg-blue-50/40 transition-all duration-200 group cursor-pointer ${expandedRow === log.id ? 'bg-blue-50/60' : ''}`}
                                        onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}
                                    >
                                        <td className="px-6 py-4 text-slate-500" dir="ltr">
                                            <div className="flex flex-col items-end">
                                                <span className="font-bold text-slate-700 text-xs tabular-nums">
                                                    {new Date(log.created_at).toLocaleDateString('he-IL')}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-mono tabular-nums">
                                                    {new Date(log.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border shadow-sm ${getLevelColor(log.log_level)}`}>
                                                {log.log_level}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 font-bold text-slate-800 text-xs">
                                            {log.event_type}
                                        </td>
                                        <td className="px-4 py-4">
                                            <p className="text-slate-600 text-xs leading-relaxed line-clamp-2 max-w-[400px]" title={log.action_description}>
                                                {log.action_description}
                                            </p>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 border border-slate-200 shrink-0">
                                                    {(log.user_name || log.user_email || 'S').charAt(0).toUpperCase()}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-slate-800 font-bold text-xs truncate max-w-[150px]" title={log.user_email}>
                                                        {log.user_name || log.user_email || 'System'}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 font-mono truncate max-w-[150px]">
                                                        {log.user_email}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="text-slate-700 text-xs font-medium truncate max-w-[120px] bg-slate-50 px-2 py-1 rounded-lg border border-slate-100" title={log.org_name}>
                                                {log.org_name}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className="text-[10px] text-slate-500 font-bold bg-slate-100 px-2 py-1 rounded-lg uppercase tracking-wider">
                                                {log.component_name || '-'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            {log.performance_ms && (
                                                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${log.performance_ms > 1000 ? 'bg-red-50 text-red-600' : log.performance_ms > 500 ? 'bg-yellow-50 text-yellow-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                    {log.performance_ms}ms
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                    {expandedRow === log.id && (
                                        <tr className="bg-slate-50/50 shadow-inner">
                                            <td colSpan={8} className="px-8 py-6">
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
                                                    <div className="space-y-3">
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div> Client Environment
                                                        </span>
                                                        <div className="p-4 bg-white rounded-2xl border border-slate-200/60 shadow-sm space-y-3 text-xs">
                                                            <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                                                                <span className="text-slate-500 font-medium">Device</span>
                                                                <span className="font-bold text-slate-700">
                                                                    {(log as any).device_type || (log as any).metadata?.device_type || 'Desktop'}
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                                                                <span className="text-slate-500 font-medium">Location</span>
                                                                <span className="font-bold text-slate-700">
                                                                    {(log as any).city || (log as any).metadata?.city || 'Unknown'}, {(log as any).country || (log as any).metadata?.country || 'Unknown'}
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-slate-500 font-medium">IP Address</span>
                                                                <span className="font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                                                    {(log as any).ip_address || (log as any).metadata?.ip || '0.0.0.0'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-3">
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div> Target Entity
                                                        </span>
                                                        <div className="p-4 bg-white rounded-2xl border border-slate-200/60 shadow-sm space-y-3 text-xs">
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-slate-500 font-medium">Type</span>
                                                                <span className="bg-slate-100 px-2 py-1 rounded-lg font-bold text-slate-700 border border-slate-200">{log.entity_type || 'N/A'}</span>
                                                            </div>
                                                            <div className="space-y-1">
                                                                <span className="text-slate-500 font-medium">ID</span>
                                                                <div className="font-mono text-[10px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 break-all select-all">{log.entity_id || 'N/A'}</div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {(log.before_data || log.after_data) && (
                                                        <div className="space-y-3">
                                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div> Payload
                                                            </span>
                                                            <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800 shadow-inner max-h-48 overflow-auto custom-scrollbar-dark">
                                                                <pre className="text-[10px] font-mono text-emerald-400 leading-relaxed">{JSON.stringify({ before: log.before_data, after: log.after_data }, null, 2)}</pre>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                            {filteredLogs.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-4 py-24 text-center text-slate-400">
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                                                <SearchIcon size={32} className="opacity-40" weight="bold" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-lg text-slate-600">לא נמצאו תוצאות</h3>
                                                <p className="text-slate-400 text-sm">נסה לשנות את סינוני החיפוש או לנקות אותם</p>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile List View - Improved */}
                <div className="md:hidden flex-1 overflow-y-auto bg-slate-50/50 p-4 space-y-3">
                    {filteredLogs.map((log) => (
                        <div
                            key={log.id}
                            onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)} // Make whole card clickable for better UX
                            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden active:scale-[0.99] transition-transform duration-200"
                        >
                            <div className="p-4">
                                <div className="flex justify-between items-start mb-3">
                                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border shadow-sm ${getLevelColor(log.log_level)}`}>
                                        {log.log_level}
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-400 tabular-nums">
                                        {new Date(log.created_at).toLocaleString('he-IL')}
                                    </span>
                                </div>

                                <div className="mb-3 space-y-1">
                                    <div className="text-sm font-black text-slate-800">{log.event_type}</div>
                                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">{log.action_description}</p>
                                </div>

                                <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                                    <div className="flex items-center gap-2 text-xs">
                                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">
                                            {(log.user_name || log.user_email || 'S').charAt(0).toUpperCase()}
                                        </div>
                                        <span className="font-bold text-slate-700 truncate max-w-[120px]">{log.user_name || 'System'}</span>
                                    </div>
                                    <div className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
                                        {expandedRow === log.id ? 'סגור' : 'פרטים'}
                                    </div>
                                </div>
                            </div>

                            {/* Mobile Expanded Details */}
                            {expandedRow === log.id && (
                                <div className="bg-slate-50 border-t border-slate-100 p-4 space-y-4 animate-in slide-in-from-top-2">
                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                        <div className="bg-white p-2.5 rounded-xl border border-slate-200/60 shadow-sm">
                                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Component</div>
                                            <div className="font-medium text-slate-700">{log.component_name || '-'}</div>
                                        </div>
                                        <div className="bg-white p-2.5 rounded-xl border border-slate-200/60 shadow-sm">
                                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Entity</div>
                                            <div className="font-medium text-slate-700">{log.entity_type}</div>
                                        </div>
                                    </div>
                                    <div className="bg-white p-3 rounded-xl border border-slate-200/60 shadow-sm text-xs">
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-2">Location Data</div>
                                        <div className="flex items-center gap-2 text-slate-600">
                                            <span>{(log as any).city || 'Unknown City'}</span>
                                            <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                            <span className="font-mono text-[10px]">{(log as any).ip_address}</span>
                                        </div>
                                    </div>
                                    {(log.before_data || log.after_data) && (
                                        <div className="rounded-xl border border-slate-200/60 overflow-hidden shadow-sm">
                                            <div className="bg-slate-900 px-3 py-1.5 text-[9px] font-black text-slate-400 tracking-wider">RAW DATA</div>
                                            <div className="bg-slate-800 p-3 max-h-40 overflow-auto">
                                                <pre className="text-[10px] font-mono text-emerald-400 leading-relaxed whitespace-pre-wrap break-all">
                                                    {JSON.stringify({ before: log.before_data, after: log.after_data }, null, 2)}
                                                </pre>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                    {filteredLogs.length === 0 && (
                        <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
                            <SearchIcon size={40} className="opacity-20" weight="bold" />
                            <p className="font-medium text-sm">לא נמצאו לוגים</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
