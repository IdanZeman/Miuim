import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { Shield, Search, RefreshCw } from 'lucide-react';

interface LogEntry {
    id: string;
    created_at: string;
    event_type: string;
    event_category: string;
    action_description: string;
    entity_type: string;
    entity_id: string;
    user_id: string;
    user_email: string;
    user_name: string;
    organization_id: string;
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
    const [hideMyLogs, setHideMyLogs] = useState(false);
    const [limit, setLimit] = useState(initialLimit);

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

            // Fetch Organization Names manually since no foreign key relation typicaly exists on log table or it's loose
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
            (log.org_name && log.org_name.toLowerCase().includes(filter.toLowerCase()));

        const matchesUser = hideMyLogs ? log.user_email !== user?.email : true;
        const matchesExclude = excludeUserId ? log.user_id !== excludeUserId : true;

        return matchesSearch && matchesUser && matchesExclude;
    });

    const getCategoryColor = (category: string) => {
        switch (category) {
            case 'security': return 'bg-red-100 text-red-700 border-red-200';
            case 'scheduling': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'data': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
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
            {/* Controls */}
            <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-4 justify-between bg-slate-50/50">
                <div className="flex items-center gap-2 flex-1">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="חיפוש (פעולה, משתמש, ישות...)"
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="w-full pr-10 pl-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                    <button
                        onClick={() => setHideMyLogs(!hideMyLogs)}
                        className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${hideMyLogs
                            ? 'bg-blue-50 border-blue-200 text-blue-700'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                    >
                        הסתר פעולות שלי
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={limit}
                        onChange={(e) => setLimit(Number(e.target.value))}
                        className="bg-white px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 cursor-pointer"
                    >
                        <option value="50">50 אחרונים</option>
                        <option value="100">100 אחרונים</option>
                        <option value="500">500 אחרונים</option>
                    </select>
                    <button
                        onClick={fetchLogs}
                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
                        title="רענן"
                    >
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-right">
                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                        <tr>
                            <th className="px-4 py-3 whitespace-nowrap w-40">זמן</th>
                            <th className="px-4 py-3 whitespace-nowrap w-24">קטגוריה</th>
                            <th className="px-4 py-3 whitespace-nowrap w-32">סוג אירוע</th>
                            <th className="px-4 py-3 whitespace-nowrap w-64">תיאור</th>
                            <th className="px-4 py-3 whitespace-nowrap w-48">משתמש</th>
                            <th className="px-4 py-3 whitespace-nowrap w-32">ארגון</th>
                            <th className="px-4 py-3 whitespace-nowrap">ישות מושפעת</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-slate-50/80 transition-colors group">
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
                                    <div className="flex flex-col">
                                        <span className="text-xs font-medium text-slate-700">{log.entity_type}</span>
                                        <span className="text-[10px] text-slate-400 font-mono truncate max-w-[150px]">{log.entity_id}</span>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filteredLogs.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
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
