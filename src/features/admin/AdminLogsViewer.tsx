import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../features/auth/AuthContext';
import { Shield, Search, RefreshCw, Filter, Download } from 'lucide-react';
import type { LogLevel } from '../../services/loggingService';
import { Select } from '../../components/ui/Select';
import { GlobalStats } from './GlobalStats';

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
                <Shield size={64} className="mb-4 opacity-20" />
                <h2 className="text-xl font-bold">Access Denied</h2>
                <p>This area is restricted to system administrators.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Log Management Toolbar */}
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex justify-between items-center transition-all hover:shadow-md">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                        <Shield size={20} />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-slate-800">יומן פעילות מערכתי</h3>
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">System Activity Stream (Raw Data)</p>
                    </div>
                </div>
                <button
                    onClick={exportToCSV}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-all text-xs font-bold shadow-sm active:scale-95"
                >
                    <Download size={14} />
                    <span>Export CSV</span>
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                {/* Filters */}
                <div className="p-4 border-b border-slate-100 flex flex-col gap-3 bg-slate-50/50">
                    <div className="flex flex-wrap gap-3 items-center">
                        {/* Search */}
                        <div className="relative flex-1 w-full md:w-auto md:min-w-[300px]">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="חיפוש לפי פעולה, משתמש, ארגון או קומפוננטה..."
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                className="w-full pr-10 pl-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                            />
                        </div>

                        {/* Quick Filters */}
                        <div className="flex flex-wrap gap-2 items-center">
                            <div className="w-[140px]">
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
                                    className="bg-white border-slate-200"
                                />
                            </div>

                            <button
                                onClick={() => setHideMyLogs(!hideMyLogs)}
                                className={`px-4 py-2 rounded-xl border text-xs font-bold transition-all ${hideMyLogs
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                    }`}
                            >
                                {hideMyLogs ? 'מציג לוגים של אחרים' : 'מציג גם פעולות שלי'}
                            </button>

                            <div className="w-[130px]">
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
                                    className="bg-white border-slate-200"
                                />
                            </div>

                            <button
                                onClick={fetchLogs}
                                className="p-2 hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 rounded-xl text-slate-600 transition-all active:scale-95"
                                title="רענן"
                            >
                                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto hidden md:block">
                    <table className="w-full text-sm text-right">
                        <thead className="bg-slate-50/80 text-slate-500 font-bold border-b border-slate-100 uppercase text-[10px] tracking-wider">
                            <tr>
                                <th className="px-4 py-4 w-32">זמן</th>
                                <th className="px-4 py-4 w-20">רמה</th>
                                <th className="px-4 py-4 w-32">סוג אירוע</th>
                                <th className="px-4 py-4">תיאור</th>
                                <th className="px-4 py-4 w-40">משתמש</th>
                                <th className="px-4 py-4 w-32">ארגון</th>
                                <th className="px-4 py-4 w-32">קומפוננטה</th>
                                <th className="px-4 py-4 w-20">⏱️</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredLogs.map((log) => (
                                <React.Fragment key={log.id}>
                                    <tr
                                        className={`hover:bg-blue-50/30 transition-colors group cursor-pointer ${expandedRow === log.id ? 'bg-blue-50/50' : ''}`}
                                        onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}
                                    >
                                        <td className="px-4 py-4 text-slate-500" dir="ltr">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-700 text-xs">
                                                    {new Date(log.created_at).toLocaleDateString('he-IL')}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-mono">
                                                    {new Date(log.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase border ${getLevelColor(log.log_level)}`}>
                                                {log.log_level}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 font-bold text-slate-800 text-xs">
                                            {log.event_type}
                                        </td>
                                        <td className="px-4 py-4 text-slate-600 text-xs leading-relaxed">
                                            {log.action_description}
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="text-slate-800 font-bold text-xs truncate max-w-[150px]" title={log.user_email}>
                                                {log.user_name || log.user_email || 'System'}
                                            </div>
                                            <div className="text-[9px] text-slate-400 font-mono truncate max-w-[150px]">
                                                {log.user_email}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="text-slate-700 text-xs font-medium truncate max-w-[120px]" title={log.org_name}>
                                                {log.org_name}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className="text-[10px] text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                                                {log.component_name || '-'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4">
                                            {log.performance_ms && (
                                                <span className={`text-[10px] font-mono font-bold ${log.performance_ms > 1000 ? 'text-red-600' : log.performance_ms > 500 ? 'text-yellow-600' : 'text-green-600'}`}>
                                                    {log.performance_ms}ms
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                    {expandedRow === log.id && (
                                        <tr className="bg-slate-50/80">
                                            <td colSpan={8} className="px-6 py-6 border-y border-slate-100">
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
                                                    <div className="space-y-3">
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Client Environment</span>
                                                        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm space-y-2 text-xs">
                                                            <div className="flex justify-between">
                                                                <strong>Device:</strong>
                                                                <span className="text-slate-600">
                                                                    {(log as any).device_type || (log as any).metadata?.device_type || 'Desktop'}
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <strong>Location:</strong>
                                                                <span className="text-slate-600">
                                                                    {(log as any).city || (log as any).metadata?.city || 'Unknown'}, {(log as any).country || (log as any).metadata?.country || 'Unknown'}
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <strong>IP Address:</strong>
                                                                <span className="font-mono text-blue-600">
                                                                    {(log as any).ip_address || (log as any).metadata?.ip || '0.0.0.0'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-3">
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Target Entity</span>
                                                        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm space-y-2 text-xs">
                                                            <div className="flex justify-between"><strong>Type:</strong> <span className="bg-slate-100 px-1.5 rounded">{log.entity_type || 'N/A'}</span></div>
                                                            <div><strong>ID:</strong> <div className="font-mono text-[10px] text-slate-400 mt-1 break-all bg-slate-50 p-1.5 rounded">{log.entity_id || 'N/A'}</div></div>
                                                        </div>
                                                    </div>
                                                    {(log.before_data || log.after_data) && (
                                                        <div className="space-y-3">
                                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Raw Data Payload</span>
                                                            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 shadow-inner max-h-48 overflow-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-700">
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
                                    <td colSpan={8} className="px-4 py-16 text-center text-slate-400">
                                        <div className="flex flex-col items-center gap-2">
                                            <Search size={32} className="opacity-20" />
                                            <p className="font-medium">לא נמצאו לוגים התואמים את החיפוש</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile List View */}
                <div className="md:hidden divide-y divide-slate-100">
                    {filteredLogs.map((log) => (
                        <div key={log.id} className="p-4 bg-white active:bg-slate-50 transition-colors">
                            <div className="flex justify-between items-start mb-2">
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase border ${getLevelColor(log.log_level)}`}>
                                    {log.log_level}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                    {new Date(log.created_at).toLocaleString('he-IL')}
                                </span>
                            </div>

                            <div className="mb-2">
                                <div className="text-sm font-bold text-slate-800">{log.event_type}</div>
                                <div className="text-xs text-slate-600 line-clamp-2">{log.action_description}</div>
                            </div>

                            <div className="flex justify-between items-end mt-3">
                                <div className="text-xs text-slate-500">
                                    <span className="font-bold text-slate-700">{log.user_name || log.user_email || 'System'}</span>
                                    {log.org_name && <span className="mx-1">• {log.org_name}</span>}
                                </div>
                                <button
                                    onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}
                                    className="text-blue-600 text-xs font-bold bg-blue-50 px-3 py-1.5 rounded-lg active:scale-95 transition-transform"
                                >
                                    {expandedRow === log.id ? 'סגור פרטים' : 'פרטים מלאים'}
                                </button>
                            </div>

                            {/* Mobile Expanded Details */}
                            {expandedRow === log.id && (
                                <div className="mt-4 pt-4 border-t border-slate-100 space-y-4 animate-in fade-in slide-in-from-top-1">
                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                        <div className="bg-slate-50 p-2 rounded border border-slate-100">
                                            <div className="text-slate-400 font-bold mb-1">Component</div>
                                            {log.component_name || '-'}
                                        </div>
                                        <div className="bg-slate-50 p-2 rounded border border-slate-100">
                                            <div className="text-slate-400 font-bold mb-1">Entity</div>
                                            {log.entity_type} {log.entity_id && `#${log.entity_id.slice(0, 4)}`}
                                        </div>
                                        <div className="bg-slate-50 p-2 rounded border border-slate-100 col-span-2">
                                            <div className="text-slate-400 font-bold mb-1">Client</div>
                                            {(log as any).ip_address || 'IP Unknown'} • {(log as any).device_type || 'Device Unknown'}
                                        </div>
                                    </div>
                                    {(log.before_data || log.after_data) && (
                                        <div className="rounded-lg border border-slate-200 overflow-hidden">
                                            <div className="bg-slate-900 px-3 py-1 text-[10px] font-bold text-slate-400 tracking-wider">RAW DATA</div>
                                            <div className="bg-slate-800 p-3 max-h-40 overflow-auto">
                                                <pre className="text-[10px] font-mono text-emerald-400 leading-relaxed whitespace-pre-wrap word-break-all">
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
                        <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-2">
                            <Search size={32} className="opacity-20" />
                            <p className="font-medium text-sm">לא נמצאו לוגים</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
