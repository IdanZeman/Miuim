
import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { Shield, Search, RefreshCw, Filter, Download, User as UserIcon, Activity } from 'lucide-react';
import type { LogLevel } from '../services/loggingService';
import { Select } from './ui/Select';
import { OrganizationStats } from './OrganizationStats';
import { PageInfo } from './ui/PageInfo';

// Consistent interface with Admin Logs
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
    org_name?: string;
}

interface OrganizationLogsViewerProps {
    limit?: number;
}

export const OrganizationLogsViewer: React.FC<OrganizationLogsViewerProps> = ({ limit: initialLimit = 50 }) => {
    const { organization, profile, user } = useAuth();
    const [activeTab, setActiveTab] = useState<'dashboard' | 'logs'>('dashboard');

    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
    const [limit, setLimit] = useState(initialLimit);
    const [expandedRow, setExpandedRow] = useState<string | null>(null);

    // Check permissions
    const canView = profile?.is_super_admin ||
        profile?.role === 'admin' ||
        profile?.permissions?.screens?.['logs'] === 'view' ||
        profile?.permissions?.screens?.['logs'] === 'edit';

    useEffect(() => {
        if (canView && organization?.id && activeTab === 'logs') {
            fetchLogs();
        }
    }, [organization?.id, limit, canView, activeTab]);

    const fetchLogs = async () => {
        if (!organization?.id) return;

        setLoading(true);
        try {
            // Fetch significantly more logs initially because we're going to filter many out client-side
            const { data, error } = await supabase
                .from('audit_logs')
                .select('*')
                .eq('organization_id', organization.id)
                .order('created_at', { ascending: false })
                .limit(limit * 3); // Fetch 3x limit to ensure we have enough after filtering

            if (error) throw error;
            setLogs(data || []);
        } catch (error) {
            console.error('Error fetching org logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredLogs = logs.filter(log => {
        // --- STRICT FILTERING LOGIC ---

        // 1. Hide Errors and Fatal logs (System Errors)
        if (log.log_level === 'ERROR' || log.log_level === 'FATAL') return false;

        // 2. Hide purely technical/noise events
        const ignoredTypes = ['VIEW', 'CLICK', 'HOVER', 'SCROLL', 'ERROR', 'EXCEPTION'];
        if (ignoredTypes.includes(log.event_type)) return false;

        // 3. User Filter (Search)
        const matchesSearch =
            log.action_description?.toLowerCase().includes(filter.toLowerCase()) ||
            log.user_name?.toLowerCase().includes(filter.toLowerCase()) ||
            log.user_email?.toLowerCase().includes(filter.toLowerCase()) ||
            log.event_type?.toLowerCase().includes(filter.toLowerCase()) ||
            log.entity_type?.toLowerCase().includes(filter.toLowerCase());

        // 4. Category Filter
        const matchesCategory = categoryFilter === 'ALL' || log.event_category === categoryFilter;

        return matchesSearch && matchesCategory;
    }).slice(0, limit);

    // Reuse styling helpers from AdminLogsViewer
    const getLevelColor = (level: LogLevel) => {
        switch (level) {
            case 'TRACE': return 'bg-gray-100 text-gray-600 border-gray-300';
            case 'DEBUG': return 'bg-blue-100 text-blue-700 border-blue-300';
            case 'INFO': return 'bg-green-100 text-green-700 border-green-300';
            case 'WARN': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
            // Errors shouldn't be here, but just in case
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
        const headers = ['תאריך', 'שעה', 'משתמש', 'אימייל', 'סוג', 'פעולה', 'תיאור', 'ישות'];
        const rows = filteredLogs.map(log => {
            const date = new Date(log.created_at);
            return [
                date.toLocaleDateString('he-IL'),
                date.toLocaleTimeString('he-IL'),
                log.user_name || 'System',
                log.user_email,
                log.event_type,
                log.event_category,
                log.action_description,
                log.entity_type
            ];
        });

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `org_activity_log_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    // Helper to calculate diff
    const getDiff = (before: any, after: any) => {
        if (!before && !after) return { before: {}, after: {} };
        if (!before) return { before: null, after: after }; // Creation
        if (!after) return { before: before, after: null }; // Deletion

        const diffBefore: any = {};
        const diffAfter: any = {};

        // Get unique keys from both
        const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);

        allKeys.forEach(key => {
            const valBefore = before?.[key];
            const valAfter = after?.[key];

            // Skip ignored keys
            if (['updated_at', 'created_at', 'last_login', 'id', 'maxHoursPerWeek', 'unavailableDates'].includes(key)) return;

            // Simple comparison for primitives
            if (JSON.stringify(valBefore) !== JSON.stringify(valAfter)) {
                // Special handling for dailyAvailability
                if (key === 'dailyAvailability' && typeof valBefore === 'object' && typeof valAfter === 'object') {
                    // Only show dates that changed
                    const dateKeys = new Set([...Object.keys(valBefore || {}), ...Object.keys(valAfter || {})]);
                    const availDiffBefore: any = {};
                    const availDiffAfter: any = {};
                    let hasChange = false;

                    dateKeys.forEach(dKey => {
                        if (JSON.stringify(valBefore?.[dKey]) !== JSON.stringify(valAfter?.[dKey])) {
                            availDiffBefore[dKey] = valBefore?.[dKey];
                            availDiffAfter[dKey] = valAfter?.[dKey];
                            hasChange = true;
                        }
                    });

                    if (hasChange) {
                        diffBefore[key] = availDiffBefore;
                        diffAfter[key] = availDiffAfter;
                    }
                } else {
                    diffBefore[key] = valBefore;
                    diffAfter[key] = valAfter;
                }
            }
        });

        return { before: diffBefore, after: diffAfter };
    };

    if (!canView) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-slate-400">
                <Shield size={48} className="mb-2 opacity-20" />
                <p>אין לך הרשאות לצפות ביומן הפעילות.</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-[600px]">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 bg-gradient-to-l from-slate-50 to-white">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <Activity className="text-blue-600" size={24} />
                            יומן פעילות
                            <PageInfo
                                title="יומן פעילות"
                                description={
                                    <>
                                        <p className="mb-2">תיעוד מלא של כל הפעולות שבוצעו במערכת.</p>
                                        <p className="mb-2">היומן מאפשר מעקב ושקיפות על:</p>
                                        <ul className="list-disc list-inside space-y-1 mb-2 text-right">
                                            <li><b>שינויי שיבוץ:</b> מי שיבץ, את מי, ומתי.</li>
                                            <li><b>עריכת נתונים:</b> עדכוני פרטי חיילים, יצירת משימות, ומחיקת אילוצים.</li>
                                            <li><b>אבטחה:</b> כניסות למערכת ושינויי הרשאות.</li>
                                        </ul>
                                        <p className="text-sm bg-slate-100 p-2 rounded text-slate-600">
                                            רק מנהלים מורשים יכולים לצפות ביומן זה.
                                        </p>
                                    </>
                                }
                            />
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">תיעוד וניתוח פעולות בארגון</p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 mt-6 border-b border-slate-200">
                    <button
                        onClick={() => setActiveTab('dashboard')}
                        className={`px-4 py-2 text-sm font-bold transition-all border-b-2 ${activeTab === 'dashboard'
                            ? 'border-blue-500 text-blue-600 bg-blue-50/50'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                            }`}
                    >
                        דשבורד וסטטיסטיקות
                    </button>
                    <button
                        onClick={() => setActiveTab('logs')}
                        className={`px-4 py-2 text-sm font-bold transition-all border-b-2 ${activeTab === 'logs'
                            ? 'border-blue-500 text-blue-600 bg-blue-50/50'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                            }`}
                    >
                        מבט רשומות (טבלה)
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="bg-white">
                {activeTab === 'dashboard' ? (
                    <div className="p-4 md:p-6 bg-slate-50/30">
                        {organization?.id && <OrganizationStats organizationId={organization.id} />}
                    </div>
                ) : (
                    <>
                        {/* Filters */}
                        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row gap-3">
                            <div className="relative flex-1">
                                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="חיפוש לפי פעולה, שם או תיאור..."
                                    value={filter}
                                    onChange={(e) => setFilter(e.target.value)}
                                    className="w-full pr-10 pl-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                />
                            </div>

                            <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
                                <Select
                                    value={categoryFilter}
                                    onChange={(val) => setCategoryFilter(val)}
                                    options={[
                                        { value: 'ALL', label: 'כל הקטגוריות' },
                                        { value: 'auth', label: 'כניסה/יציאה' },
                                        { value: 'data', label: 'נתונים (יצירה/עריכה)' },
                                        { value: 'scheduling', label: 'שיבוץ ומשמרות' },
                                        { value: 'security', label: 'אבטחה והרשאות' },
                                        { value: 'settings', label: 'הגדרות' }
                                    ]}
                                    placeholder="קטגוריה"
                                />

                                <Select
                                    value={limit.toString()}
                                    onChange={(val) => setLimit(Number(val))}
                                    options={[
                                        { value: '50', label: '50 אחרונים' },
                                        { value: '100', label: '100 אחרונים' },
                                        { value: '200', label: '200 אחרונים' }
                                    ]}
                                />

                                <button
                                    onClick={exportToCSV}
                                    className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium whitespace-nowrap"
                                    title="ייצוא CSV"
                                >
                                    <Download size={16} />
                                    <span className="hidden md:inline">ייצוא</span>
                                </button>

                                <button
                                    onClick={fetchLogs}
                                    className="p-2 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 text-slate-600 transition-colors"
                                    title="רענן נתונים"
                                >
                                    <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                                </button>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto min-h-0">
                            <table className="w-full text-sm text-right min-w-[800px]">
                                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                                    <tr>
                                        <th className="px-4 py-3 whitespace-nowrap w-32">זמן</th>
                                        <th className="px-4 py-3 whitespace-nowrap w-24">קטגוריה</th>
                                        <th className="px-4 py-3 whitespace-nowrap w-32">סוג אירוע</th>
                                        <th className="px-4 py-3 whitespace-nowrap">תיאור</th>
                                        <th className="px-4 py-3 whitespace-nowrap w-40">משתמש</th>
                                        <th className="px-4 py-3 whitespace-nowrap w-20">ישות</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredLogs.map((log) => (
                                        <React.Fragment key={log.id}>
                                            <tr
                                                className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                                                onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}
                                            >
                                                <td className="px-4 py-3 text-slate-500" dir="ltr">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-700 text-xs text-right">
                                                            {new Date(log.created_at).toLocaleDateString('he-IL')}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 font-mono text-right">
                                                            {new Date(log.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
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
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-xs">
                                                            {log.user_name ? log.user_name.charAt(0) : <UserIcon size={12} />}
                                                        </div>
                                                        <div className="w-full overflow-hidden">
                                                            <div className="text-slate-800 font-medium truncate text-xs" title={log.user_email}>
                                                                {log.user_name || 'מערכת'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                                        {log.entity_type || '-'}
                                                    </span>
                                                </td>
                                            </tr>
                                            {expandedRow === log.id && (log.before_data || log.after_data) && (
                                                <tr className="bg-slate-50">
                                                    <td colSpan={6} className="px-4 py-3">
                                                        <div className="bg-white rounded border border-slate-200 p-3 shadow-sm">
                                                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">פירוט שינויי נתונים:</h4>
                                                            {(() => {
                                                                const { before, after } = getDiff(log.before_data, log.after_data);

                                                                // Translations map
                                                                const translations: Record<string, string> = {
                                                                    name: 'שם',
                                                                    email: 'אימייל',
                                                                    phone: 'טלפון',
                                                                    roleId: 'תפקיד',
                                                                    teamId: 'צוות',
                                                                    color: 'צבע',
                                                                    isActive: 'סטטוס',
                                                                    maxShiftsPerWeek: 'מקס׳ משמרות',
                                                                    customFields: 'שדות מותאמים',
                                                                    preferences: 'העדפות',
                                                                    dailyAvailability: 'זמינות',
                                                                    personalRotation: 'סבב אישי',
                                                                    organization_id: 'מזהה ארגון',
                                                                    created_at: 'נוצר ב',
                                                                    updated_at: 'עודכן ב',
                                                                    id: 'מזהה',
                                                                    permissions: 'הרשאות',
                                                                    role: 'תפקיד מערכת',
                                                                    dataScope: 'היקף נתונים',
                                                                    allowedTeamIds: 'צוותים מורשים',
                                                                    screens: 'גישה למסכים'
                                                                };

                                                                // Format value for display
                                                                const formatVal = (val: any) => {
                                                                    if (val === null || val === undefined) return 'ריק';
                                                                    if (val === true) return 'פעיל/כן';
                                                                    if (val === false) return 'לא פעיל/לא';
                                                                    if (typeof val === 'object') return JSON.stringify(val); // Fallback for complex
                                                                    return String(val);
                                                                };

                                                                const changes: React.JSX.Element[] = [];
                                                                const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);

                                                                if (allKeys.size === 0) {
                                                                    return <div className="text-slate-400 text-xs italic">לא נמצאו שינויים בנתונים</div>;
                                                                }

                                                                allKeys.forEach(key => {
                                                                    const valBefore = before?.[key];
                                                                    const valAfter = after?.[key];
                                                                    const label = translations[key] || key;

                                                                    // Handle Custom Fields specifically
                                                                    if (key === 'customFields' && typeof valAfter === 'object') {
                                                                        const cfKeys = new Set([...Object.keys(valBefore || {}), ...Object.keys(valAfter || {})]);
                                                                        cfKeys.forEach(cfKey => {
                                                                            const vB = valBefore?.[cfKey];
                                                                            const vA = valAfter?.[cfKey];
                                                                            if (vB !== vA) {
                                                                                if (!vB && vA) changes.push(<div key={`cf-add-${cfKey}`}>📌 <b>{translations['customFields']}</b>: התווסף נתון <u>{cfKey}</u> עם ערך <b>{vA}</b></div>);
                                                                                else if (vB && !vA) changes.push(<div key={`cf-rem-${cfKey}`}>📌 <b>{translations['customFields']}</b>: הוסר נתון <u>{cfKey}</u></div>);
                                                                                else changes.push(<div key={`cf-upd-${cfKey}`}>📝 <b>{translations['customFields']}</b>: <u>{cfKey}</u> שונה מ-<i>{vB}</i> ל-<b>{vA}</b></div>);
                                                                            }
                                                                        });
                                                                        return;
                                                                    }

                                                                    // Handle Preferences
                                                                    if (key === 'preferences' && typeof valAfter === 'object') {
                                                                        changes.push(<div key="pref-upd">⚙️ <b>העדפות</b> עודכנו</div>);
                                                                        return;
                                                                    }

                                                                    // Handle Permissions
                                                                    if (key === 'permissions' && typeof valAfter === 'object') {
                                                                        const permDiffBefore = valBefore || {};
                                                                        const permDiffAfter = valAfter || {};

                                                                        // Check specific permission fields
                                                                        if (permDiffBefore.dataScope !== permDiffAfter.dataScope) {
                                                                            changes.push(<div key="perm-scope">🛡️ <b>היקף נתונים</b> שונה מ-<u>{permDiffBefore.dataScope || 'רגיל'}</u> ל-<b>{permDiffAfter.dataScope}</b></div>);
                                                                        }

                                                                        // Check restricted teams
                                                                        const teamsBefore = (permDiffBefore.allowedTeamIds || []).length;
                                                                        const teamsAfter = (permDiffAfter.allowedTeamIds || []).length;
                                                                        if (teamsBefore !== teamsAfter) {
                                                                            changes.push(<div key="perm-teams">🛡️ <b>צוותים מורשים</b>: עודכן (כעת {teamsAfter} צוותים)</div>);
                                                                        }

                                                                        // Check Screens
                                                                        const screensBefore = permDiffBefore.screens || {};
                                                                        const screensAfter = permDiffAfter.screens || {};
                                                                        const allScreens = new Set([...Object.keys(screensBefore), ...Object.keys(screensAfter)]);
                                                                        let screenChanges = 0;
                                                                        allScreens.forEach(s => {
                                                                            if (screensBefore[s] !== screensAfter[s]) screenChanges++;
                                                                        });

                                                                        if (screenChanges > 0) {
                                                                            changes.push(<div key="perm-screens">🛡️ <b>הרשאות מסכים</b>: עודכנו {screenChanges} מסכים</div>);
                                                                        }

                                                                        if (changes.length === 0) {
                                                                            changes.push(<div key="perm-gen">🛡️ <b>הרשאות</b> עודכנו</div>);
                                                                        }
                                                                        return;
                                                                    }

                                                                    // Handle Availability
                                                                    if (key === 'dailyAvailability' && typeof valAfter === 'object') {
                                                                        changes.push(<div key="avail-upd">📅 <b>זמינות</b> עודכנה עבור {Object.keys(valAfter).length} תאריכים</div>);
                                                                        return;
                                                                    }

                                                                    // General Changes
                                                                    if (valBefore !== undefined && valAfter !== undefined) {
                                                                        // Changed
                                                                        changes.push(
                                                                            <div key={key} className="flex items-start gap-2 text-slate-700">
                                                                                <span className="w-5 text-center">📝</span>
                                                                                <span>
                                                                                    <b>{label}</b> שונה מ-
                                                                                    <span className="bg-red-50 text-red-600 px-1 rounded mx-1 line-through decoration-red-300 decoration-1 text-[10px]">{formatVal(valBefore)}</span>
                                                                                    ל-
                                                                                    <span className="bg-emerald-50 text-emerald-600 px-1 rounded mx-1 font-medium">{formatVal(valAfter)}</span>
                                                                                </span>
                                                                            </div>
                                                                        );
                                                                    } else if (valBefore === undefined && valAfter !== undefined) {
                                                                        // Added
                                                                        changes.push(
                                                                            <div key={key} className="flex items-start gap-2 text-slate-700">
                                                                                <span className="w-5 text-center">➕</span>
                                                                                <span>
                                                                                    התווסף <b>{label}</b>: <span className="bg-blue-50 text-blue-600 px-1 rounded font-medium">{formatVal(valAfter)}</span>
                                                                                </span>
                                                                            </div>
                                                                        );
                                                                    } else if (valBefore !== undefined && valAfter === undefined) {
                                                                        // Removed
                                                                        changes.push(
                                                                            <div key={key} className="flex items-start gap-2 text-slate-700">
                                                                                <span className="w-5 text-center">➖</span>
                                                                                <span>
                                                                                    הוסר <b>{label}</b>
                                                                                </span>
                                                                            </div>
                                                                        );
                                                                    }
                                                                });

                                                                return (
                                                                    <div className="bg-slate-50 rounded-lg border border-slate-100 p-3 space-y-2 text-xs font-mono">
                                                                        {changes}
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))}

                                    {filteredLogs.length === 0 && !loading && (
                                        <tr>
                                            <td colSpan={6} className="py-12 text-center text-slate-400">
                                                <div className="flex flex-col items-center justify-center">
                                                    <Search size={32} className="mb-2 opacity-20" />
                                                    <p>לא נמצאו פעולות התואמות את החיפוש</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {loading && (
                            <div className="p-12 flex justify-center text-blue-600">
                                <RefreshCw size={32} className="animate-spin opacity-50" />
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};
