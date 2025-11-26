import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { FileText, Filter, Download, Search, AlertCircle, Info, AlertTriangle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface Log {
    id: string;
    created_at: string;
    user_email: string;
    user_name: string;
    event_type: string;
    event_category: string;
    action_description: string;
    entity_type: string;
    entity_id: string;
    entity_name: string;
    before_data: any;
    after_data: any;
    user_agent: string;
}

export const AdminLogsViewer: React.FC = () => {
    const { profile } = useAuth();
    const [logs, setLogs] = useState<Log[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterAction, setFilterAction] = useState('');
    const [filterSeverity, setFilterSeverity] = useState('');
    const [page, setPage] = useState(0);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const LIMIT = 50;

    const isSuperAdmin = profile?.email === 'idanzeman@gmail.com';

    useEffect(() => {
        if (isSuperAdmin) {
            fetchLogs();
        }
    }, [isSuperAdmin, page, filterAction, filterSeverity]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('audit_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .range(page * LIMIT, (page + 1) * LIMIT - 1);

            if (filterAction) {
                query = query.eq('event_type', filterAction);
            }

            if (filterSeverity) {
                query = query.eq('event_category', filterSeverity);
            }

            const { data, error } = await query;

            if (error) throw error;
            setLogs(data || []);
        } catch (error) {
            console.error('Error fetching logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const exportLogs = async () => {
        const csv = [
            'תאריך,משתמש,פעולה,תיאור,סוג,שם פריט,קטגוריה',
            ...logs.map(log =>
                `${new Date(log.created_at).toLocaleString('he-IL')},${log.user_name || log.user_email || 'אורח'},${log.event_type},${log.action_description},${log.entity_type || '-'},${log.entity_name || '-'},${log.event_category}`
            )
        ].join('\n');

        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    const toggleRow = (id: string) => {
        setExpandedRows(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const renderDiff = (before: any, after: any) => {
        if (!before && !after) return null;

        // For CREATE: only show new data
        if (!before && after) {
            return (
                <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                    <h4 className="font-bold text-green-800 mb-2 flex items-center gap-2">
                        <span className="text-xs bg-green-200 px-2 py-0.5 rounded">נוצר חדש</span>
                    </h4>
                    <div className="space-y-1 text-sm">
                        {Object.entries(after).map(([key, value]) => (
                            <div key={key} className="flex gap-2">
                                <span className="font-medium text-green-700 min-w-[120px]">{key}:</span>
                                <span className="text-green-900 font-mono">{JSON.stringify(value)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        // For DELETE: only show old data
        if (before && !after) {
            return (
                <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                    <h4 className="font-bold text-red-800 mb-2 flex items-center gap-2">
                        <span className="text-xs bg-red-200 px-2 py-0.5 rounded">נמחק</span>
                    </h4>
                    <div className="space-y-1 text-sm">
                        {Object.entries(before).map(([key, value]) => (
                            <div key={key} className="flex gap-2">
                                <span className="font-medium text-red-700 min-w-[120px]">{key}:</span>
                                <span className="text-red-900 line-through font-mono">{JSON.stringify(value)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        // For UPDATE: show diff
        const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
        const changes: { key: string; before: any; after: any; changed: boolean }[] = [];

        allKeys.forEach(key => {
            const beforeVal = before?.[key];
            const afterVal = after?.[key];
            const changed = JSON.stringify(beforeVal) !== JSON.stringify(afterVal);
            if (changed) {
                changes.push({ key, before: beforeVal, after: afterVal, changed });
            }
        });

        if (changes.length === 0) {
            return <div className="text-slate-500 text-sm italic">אין שינויים</div>;
        }

        return (
            <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                <h4 className="font-bold text-amber-800 mb-2 flex items-center gap-2">
                    <span className="text-xs bg-amber-200 px-2 py-0.5 rounded">עודכן ({changes.length} שינויים)</span>
                </h4>
                <div className="space-y-2">
                    {changes.map(({ key, before, after }) => (
                        <div key={key} className="border-r-2 border-amber-400 pr-3">
                            <div className="font-medium text-amber-900 text-xs mb-1">{key}</div>
                            <div className="flex gap-3 items-center text-sm">
                                <div className="flex-1 bg-red-100 px-2 py-1 rounded">
                                    <span className="text-xs text-red-600 font-bold">לפני:</span>
                                    <span className="text-red-800 font-mono ml-2">{JSON.stringify(before)}</span>
                                </div>
                                <span className="text-amber-600">→</span>
                                <div className="flex-1 bg-green-100 px-2 py-1 rounded">
                                    <span className="text-xs text-green-600 font-bold">אחרי:</span>
                                    <span className="text-green-800 font-mono ml-2">{JSON.stringify(after)}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderMetadata = (metadata: any) => {
        if (!metadata) return null;

        return (
            <div className="bg-red-50 p-3 rounded-lg border border-red-200 mt-2">
                <h4 className="font-bold text-red-800 mb-2 flex items-center gap-2">
                    <span className="text-xs bg-red-200 px-2 py-0.5 rounded">פרטי שגיאה</span>
                </h4>
                <div className="space-y-1 text-sm dir-ltr text-left">
                    {metadata.message && (
                        <div className="font-mono text-red-900 font-bold">{metadata.message}</div>
                    )}
                    {metadata.url && (
                        <div className="text-slate-600 text-xs">URL: {metadata.url}</div>
                    )}
                    {metadata.componentStack && (
                        <div className="mt-2">
                            <div className="font-semibold text-xs text-slate-500">Component Stack:</div>
                            <pre className="text-xs text-slate-700 overflow-x-auto whitespace-pre-wrap">{metadata.componentStack}</pre>
                        </div>
                    )}
                    {metadata.stack && (
                        <div className="mt-2">
                            <div className="font-semibold text-xs text-slate-500">Stack Trace:</div>
                            <pre className="text-xs text-slate-700 overflow-x-auto whitespace-pre-wrap">{metadata.stack}</pre>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const getCategoryIcon = (category: string) => {
        switch (category) {
            case 'auth': return <Info className="text-blue-600" size={16} />;
            case 'data': return <AlertTriangle className="text-green-600" size={16} />;
            case 'scheduling': return <AlertCircle className="text-purple-600" size={16} />;
            case 'navigation': return <ChevronDown className="text-orange-600" size={16} />;
            case 'ui': return <ChevronUp className="text-pink-600" size={16} />;
            default: return <Info className="text-slate-600" size={16} />;
        }
    };

    const getCategoryColor = (category: string) => {
        switch (category) {
            case 'auth': return 'bg-blue-50 border-blue-200 text-blue-900';
            case 'data': return 'bg-green-50 border-green-200 text-green-900';
            case 'scheduling': return 'bg-purple-50 border-purple-200 text-purple-900';
            case 'navigation': return 'bg-orange-50 border-orange-200 text-orange-900';
            case 'ui': return 'bg-pink-50 border-pink-200 text-pink-900';
            default: return 'bg-slate-50 border-slate-200 text-slate-900';
        }
    };

    const filteredLogs = logs.filter(log => {
        const searchLower = searchTerm.toLowerCase();
        return (
            log.user_email?.toLowerCase().includes(searchLower) ||
            log.user_name?.toLowerCase().includes(searchLower) ||
            log.event_type.toLowerCase().includes(searchLower) ||
            log.entity_type?.toLowerCase().includes(searchLower) ||
            log.entity_name?.toLowerCase().includes(searchLower)
        );
    });

    if (!isSuperAdmin) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-100">
                <div className="text-center">
                    <AlertCircle className="mx-auto mb-4 text-red-500" size={48} />
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">גישה נדחתה</h2>
                    <p className="text-slate-600">אין לך הרשאות לצפות בלוגים</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                            <FileText className="text-indigo-600" size={28} />
                            לוגים מערכתיים
                        </h1>
                        <p className="text-slate-500 mt-1">מעקב מפורט אחרי כל פעולות המשתמשים</p>
                    </div>

                    <button
                        onClick={exportLogs}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        <Download size={18} />
                        ייצא ל-CSV
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="relative">
                        <Search className="absolute right-3 top-3 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="חיפוש..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pr-10 px-4 py-2 border-2 border-slate-200 rounded-lg focus:border-indigo-500 outline-none"
                        />
                    </div>

                    <select
                        value={filterAction}
                        onChange={e => setFilterAction(e.target.value)}
                        className="px-4 py-2 border-2 border-slate-200 rounded-lg focus:border-indigo-500 outline-none"
                    >
                        <option value="">כל הפעולות</option>
                        <option value="CREATE">יצירה</option>
                        <option value="UPDATE">עדכון</option>
                        <option value="DELETE">מחיקה</option>
                        <option value="LOGIN">כניסה</option>
                        <option value="LOGOUT">יציאה</option>
                        <option value="AUTO_SCHEDULE">שיבוץ אוטומטי</option>
                        <option value="ASSIGN">שיבוץ</option>
                        <option value="UNASSIGN">ביטול שיבוץ</option>
                        <option value="VIEW">צפייה</option>
                        <option value="CLICK">לחיצה</option>
                        <option value="ERROR">שגיאה</option>
                    </select>

                    <select
                        value={filterSeverity}
                        onChange={e => setFilterSeverity(e.target.value)}
                        className="px-4 py-2 border-2 border-slate-200 rounded-lg focus:border-indigo-500 outline-none"
                    >
                        <option value="">כל הקטגוריות</option>
                        <option value="auth">אימות</option>
                        <option value="data">נתונים</option>
                        <option value="scheduling">שיבוץ</option>
                        <option value="settings">הגדרות</option>
                        <option value="system">מערכת</option>
                        <option value="navigation">ניווט</option>
                        <option value="ui">ממשק</option>
                    </select>

                    <button
                        onClick={() => {
                            setSearchTerm('');
                            setFilterAction('');
                            setFilterSeverity('');
                        }}
                        className="px-4 py-2 border-2 border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                        נקה פילטרים
                    </button>
                </div>
            </div>

            {/* Logs Table */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="text-right py-3 px-4 font-bold text-slate-700 w-10"></th>
                                <th className="text-right py-3 px-4 font-bold text-slate-700">תאריך</th>
                                <th className="text-right py-3 px-4 font-bold text-slate-700">משתמש</th>
                                <th className="text-right py-3 px-4 font-bold text-slate-700">פעולה</th>
                                <th className="text-right py-3 px-4 font-bold text-slate-700">תיאור</th>
                                <th className="text-right py-3 px-4 font-bold text-slate-700">פריט</th>
                                <th className="text-right py-3 px-4 font-bold text-slate-700">קטגוריה</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-12">
                                        <div className="animate-spin w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full mx-auto"></div>
                                    </td>
                                </tr>
                            ) : filteredLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-12 text-slate-400">
                                        אין לוגים להצגה
                                    </td>
                                </tr>
                            ) : (
                                filteredLogs.map(log => (
                                    <React.Fragment key={log.id}>
                                        <tr className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => toggleRow(log.id)}>
                                            <td className="py-3 px-4">
                                                {(log.before_data || log.after_data || log.metadata) && (
                                                    expandedRows.has(log.id) ?
                                                        <ChevronUp size={16} className="text-slate-400" /> :
                                                        <ChevronDown size={16} className="text-slate-400" />
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-slate-600">
                                                {new Date(log.created_at).toLocaleString('he-IL')}
                                            </td>
                                            <td className="py-3 px-4 text-sm font-medium text-slate-800">
                                                <div>{log.user_name || 'אורח'}</div>
                                                <div className="text-xs text-slate-500">{log.user_email}</div>
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className="inline-flex items-center px-2 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-medium">
                                                    {log.event_type}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-sm text-slate-600">
                                                {log.action_description}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-slate-600">
                                                <div className="font-medium">{log.entity_name || '-'}</div>
                                                <div className="text-xs text-slate-500">{log.entity_type}</div>
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border ${getCategoryColor(log.event_category)}`}>
                                                    {getCategoryIcon(log.event_category)}
                                                    {log.event_category}
                                                </span>
                                            </td>
                                        </tr>
                                        {expandedRows.has(log.id) && (log.before_data || log.after_data || log.metadata) && (
                                            <tr className="bg-slate-50">
                                                <td colSpan={7} className="p-4">
                                                    {renderDiff(log.before_data, log.after_data)}
                                                    {renderMetadata(log.metadata)}
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="flex justify-between items-center p-4 border-t border-slate-200">
                    <button
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={page === 0}
                        className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        הקודם
                    </button>
                    <span className="text-slate-600">עמוד {page + 1}</span>
                    <button
                        onClick={() => setPage(p => p + 1)}
                        disabled={logs.length < LIMIT}
                        className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        הבא
                    </button>
                </div>
            </div>
        </div>
    );
};
