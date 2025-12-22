import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { Shield, Search, RefreshCw, Filter, Download } from 'lucide-react';
import type { LogLevel } from '../services/loggingService';

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
    const [levelFilter, setLevelFilter] = useState<LogLevel | 'ALL'>('ALL');  // NEW
    const [componentFilter, setComponentFilter] = useState('');  // NEW
    const [hideMyLogs, setHideMyLogs] = useState(true);
    const [limit, setLimit] = useState(initialLimit);
    const [expandedRow, setExpandedRow] = useState<string | null>(null);  // NEW

    useEffect(() => {
        if (profile?.is_super_admin) {
            fetchLogs();
        }
    }, [user, limit, profile]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            // Fetch logs
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
        const headers = ['Time', 'Level', 'Category', 'Event', 'Description', 'User', 'Organization', 'Component', 'Performance (ms)'];
        const rows = filteredLogs.map(log => [
            new Date(log.created_at).toLocaleString('he-IL'),
            log.log_level,
            log.event_category,
            log.event_type,
            log.action_description,
            log.user_name || log.user_email || 'System',
            log.org_name,
            log.component_name || '',
            log.performance_ms || ''
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `logs_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    if (!profile?.is_super_admin) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400">
                <Shield size={64} className="mb-4 opacity-20" />
                <h2 className="text-xl font-bold">Access Denied</h2>
                <p>This area is restricted to system administrators.</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 bg-gradient-to-l from-slate-50 to-white">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">System Logs</h2>
                        <p className="text-sm text-slate-500">מעקב אחרי כל הפעילות במערכת</p>
                    </div>
                    <button
                        onClick={exportToCSV}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <Download size={16} />
                        <span>ייצא CSV</span>
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="p-4 border-b border-slate-100 flex flex-col gap-3 bg-slate-50/50">
                {/* Search */}
                <div className="relative flex-1">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="חיפוש (פעולה, משתמש, קומפוננטה...)"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="w-full pr-10 pl-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>

                {/* Filter Row */}
                <div className="flex flex-wrap gap-2 items-center">
                    <Filter size={16} className="text-slate-400" />

                    {/* Log Level Filter */}
                    <select
                        value={levelFilter}
                        onChange={(e) => setLevelFilter(e.target.value as LogLevel | 'ALL')}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 cursor-pointer bg-white"
                    >
                        <option value="ALL">כל הרמות</option>
                        <option value="TRACE">🔍 TRACE</option>
                        <option value="DEBUG">🐛 DEBUG</option>
                        <option value="INFO">ℹ️ INFO</option>
                        <option value="WARN">⚠️ WARN</option>
                        <option value="ERROR">❌ ERROR</option>
                        <option value="FATAL">💀 FATAL</option>
                    </select>

                    {/* Component Filter */}
                    {uniqueComponents.length > 0 && (
                        <select
                            value={componentFilter}
                            onChange={(e) => setComponentFilter(e.target.value)}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 cursor-pointer bg-white"
                        >
                            <option value="">כל הקומפוננטות</option>
                            {uniqueComponents.map(comp => (
                                <option key={comp} value={comp}>{comp}</option>
                            ))}
                        </select>
                    )}

                    {/* Hide My Logs */}
                    <button
                        onClick={() => setHideMyLogs(!hideMyLogs)}
                        className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${hideMyLogs
                            ? 'bg-blue-50 border-blue-200 text-blue-700'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                    >
                        הסתר פעולות שלי
                    </button>

                    {/* Limit */}
                    <select
                        value={limit}
                        onChange={(e) => setLimit(Number(e.target.value))}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 cursor-pointer bg-white"
                    >
                        <option value="50">50 אחרונים</option>
                        <option value="100">100 אחרונים</option>
                        <option value="500">500 אחרונים</option>
                        <option value="1000">1000 אחרונים</option>
                    </select>

                    {/* Refresh */}
                    <button
                        onClick={fetchLogs}
                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
                        title="רענן"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>

                    {/* Results Count */}
                    <span className="mr-auto text-sm text-slate-500">
                        {filteredLogs.length} תוצאות
                    </span>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-right">
                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                        <tr>
                            <th className="px-4 py-3 whitespace-nowrap w-32">זמן</th>
                            <th className="px-4 py-3 whitespace-nowrap w-20">רמה</th>
                            <th className="px-4 py-3 whitespace-nowrap w-24">קטגוריה</th>
                            <th className="px-4 py-3 whitespace-nowrap w-32">סוג אירוע</th>
                            <th className="px-4 py-3 whitespace-nowrap">תיאור</th>
                            <th className="px-4 py-3 whitespace-nowrap w-40">משתמש</th>
                            <th className="px-4 py-3 whitespace-nowrap w-32">ארגון</th>
                            <th className="px-4 py-3 whitespace-nowrap w-32">קומפוננטה</th>
                            <th className="px-4 py-3 whitespace-nowrap w-20">⏱️</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredLogs.map((log) => (
                            <React.Fragment key={log.id}>
                                <tr
                                    className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                                    onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}
                                >
                                    <td className="px-4 py-3 text-slate-500" dir="ltr">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-700 text-xs">
                                                {new Date(log.created_at).toLocaleDateString('he-IL')}
                                            </span>
                                            <span className="text-[10px] text-slate-400 font-mono">
                                                {new Date(log.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getLevelColor(log.log_level)}`}>
                                            {log.log_level}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getCategoryColor(log.event_category)}`}>
                                            {log.event_category}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 font-medium text-slate-700">
                                        {log.event_type}
                                    </td>
                                    <td className="px-4 py-3 text-slate-600">
                                        {log.action_description}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="text-slate-800 font-medium truncate max-w-[150px]" title={log.user_email}>
                                            {log.user_name || log.user_email || 'System'}
                                        </div>
                                        <div className="text-[10px] text-slate-400 font-mono truncate max-w-[150px]">
                                            {log.user_email}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="text-slate-700 text-xs font-medium truncate max-w-[120px]" title={log.org_name}>
                                            {log.org_name}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-xs text-slate-600 font-mono">
                                            {log.component_name || '-'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        {log.performance_ms && (
                                            <span className={`text-xs font-mono ${log.performance_ms > 1000 ? 'text-red-600 font-bold' : log.performance_ms > 500 ? 'text-yellow-600' : 'text-green-600'}`}>
                                                {log.performance_ms}ms
                                            </span>
                                        )}
                                    </td>
                                </tr>
                                {expandedRow === log.id && (
                                    <tr className="bg-slate-50">
                                        <td colSpan={9} className="px-4 py-3">
                                            <div className="grid grid-cols-2 gap-4 text-xs">
                                                <div>
                                                    <span className="font-bold text-slate-700">Entity:</span>
                                                    <div className="mt-1 p-2 bg-white rounded border border-slate-200">
                                                        <div><strong>Type:</strong> {log.entity_type || 'N/A'}</div>
                                                        <div className="font-mono text-[10px] text-slate-500"><strong>ID:</strong> {log.entity_id || 'N/A'}</div>
                                                    </div>
                                                </div>
                                                {(log.before_data || log.after_data) && (
                                                    <div>
                                                        <span className="font-bold text-slate-700">Data Changes:</span>
                                                        <div className="mt-1 p-2 bg-white rounded border border-slate-200 max-h-32 overflow-auto">
                                                            <pre className="text-[10px] font-mono">{JSON.stringify({ before: log.before_data, after: log.after_data }, null, 2)}</pre>
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
                                <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                                    לא נמצאו לוגים התואמים את החיפוש
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
