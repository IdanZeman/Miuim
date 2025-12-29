import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import {
    Users,
    Layout,
    MousePointer2,
    Activity,
    Calendar,
    BarChart3,
    Trophy
} from 'lucide-react';
import { Select } from '../../components/ui/Select';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

type TimeRange = 'today' | 'week' | 'month';

interface DashboardStats {
    topUsers: { user_name: string; user_email: string; action_count: number }[];
    topPages: { page_name: string; view_count: number }[];
    topActions: { action_name: string; usage_count: number }[];
    activityGraph: { date_bucket: string; count: number }[];
}

export const UserActivityStats: React.FC = () => {
    const [timeRange, setTimeRange] = useState<TimeRange>('week');
    const [stats, setStats] = useState<DashboardStats>({
        topUsers: [],
        topPages: [],
        topActions: [],
        activityGraph: []
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAllStats();
    }, [timeRange]);

    const fetchAllStats = async () => {
        setLoading(true);
        try {
            const [usersRes, pagesRes, actionsRes, graphRes] = await Promise.all([
                supabase.rpc('get_org_top_users', { time_range: timeRange, limit_count: 5 }),
                supabase.rpc('get_org_top_pages', { time_range: timeRange, limit_count: 5 }),
                supabase.rpc('get_org_top_actions', { time_range: timeRange, limit_count: 5 }),
                supabase.rpc('get_org_activity_graph', { time_range: timeRange })
            ]);

            if (usersRes.error) console.error('Error fetching users:', usersRes.error);
            if (pagesRes.error) console.error('Error fetching pages:', pagesRes.error);
            if (actionsRes.error) console.error('Error fetching actions:', actionsRes.error);
            if (graphRes.error) console.error('Error fetching graph:', graphRes.error);

            setStats({
                topUsers: usersRes.data || [],
                topPages: pagesRes.data || [],
                topActions: actionsRes.data || [],
                activityGraph: graphRes.data || []
            });

        } catch (err) {
            console.error('Failed to fetch dashboard stats:', err);
        } finally {
            setLoading(false);
        }
    };

    const translateItem = (text: string, type: 'page' | 'action'): string => {
        const lower = text.toLowerCase().trim();

        // 1. Page Translations
        if (type === 'page') {
            const pageMap: Record<string, string> = {
                'home': 'דף הבית',
                'navigated to home': 'דף הבית',
                'navigated to attendance': 'ניהול נוכחות',
                'attendance': 'ניהול נוכחות',
                'navigated to absences': 'היעדרויות',
                'absences': 'היעדרויות',
                'personnel manager': 'ניהול כוח אדם',
                'navigated to personnel': 'ניהול כוח אדם',
                'personnel': 'ניהול כוח אדם',
                'navigated to scheduling': 'לוח שיבוצים',
                'scheduling': 'לוח שיבוצים',
                'navigated to tasks': 'ניהול משימות',
                'tasks': 'ניהול משימות',
                'navigated to settings': 'הגדרות',
                'settings': 'הגדרות',
                'navigated to profile': 'פרופיל אישי',
                'navigated to login': 'התחברות',
                'navigated to system': 'ניהול מערכת'
            };
            if (pageMap[lower]) return pageMap[lower];

            // Cleanup "Navigated to" if no direct match
            if (lower.startsWith('navigated to ')) {
                return text.substring(13); // fallback: just show the page name
            }
        }

        // 2. Action Translations
        if (type === 'action') {
            // Exact matches
            const actionMap: Record<string, string> = {
                'main application mounted': 'כניסה למערכת',
                'app_launch': 'טעינת אפליקציה',
                'clicked shift_card': 'צפייה בפרטי שמירה',
                'clicked add_shift_button': 'הוספת שמירה',
                'clicked save_roster': 'שמירת לוח',
                'clicked publish_roster': 'פרסום לוח',
                'clicked export_excel': 'ייצוא לאקסל',
                'clicked locate_me_button': 'איתור מיקום במפה',
                'clicked user_menu': 'תפריט משתמש',
                'clicked logout': 'התנתקות'
            };
            if (actionMap[lower]) return actionMap[lower];

            // Partial matches / Dynamic strings
            if (lower.startsWith('clicked')) {
                // Try to clean up "Clicked some_button" -> "Some Button"
                let btn = lower.replace('clicked ', '').replace(/_/g, ' ');
                // Hebraize common terms if possible
                if (btn.includes('save')) return 'שמירה';
                if (btn.includes('cancel')) return 'ביטול';
                if (btn.includes('add')) return 'הוספה';
                if (btn.includes('delete')) return 'מחיקה';
                if (btn.includes('edit')) return 'עריכה';
                return btn;
            }
        }

        return text;
    };

    const maxGraphValue = Math.max(...stats.activityGraph.map(d => Number(d.count)), 10);

    return (
        <div className="space-y-6">
            {/* Header / Control Bar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                        <Activity size={20} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">ניתוח פעילות משתמשים</h2>
                        <p className="text-xs text-slate-500">סטטיסטיקות שימוש בארגון</p>
                    </div>
                </div>

                <div className="w-full sm:w-48">
                    <Select
                        value={timeRange}
                        onChange={(val) => setTimeRange(val as TimeRange)}
                        options={[
                            { value: 'today', label: 'היום' },
                            { value: 'week', label: 'השבוע' },
                            { value: 'month', label: 'החודש' }
                        ]}
                        className="bg-slate-50 border-slate-200"
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <LoadingSpinner />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* 1. Activity Graph */}
                    <div className="col-span-1 md:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                        <div className="flex items-center gap-2 mb-6">
                            <BarChart3 className="text-blue-500" size={20} />
                            <h3 className="font-bold text-slate-700">מגמת פעילות</h3>
                        </div>

                        {stats.activityGraph.length > 0 ? (
                            <div className="flex items-end justify-between h-48 gap-2 pt-4">
                                {stats.activityGraph.map((point, i) => {
                                    const count = Number(point.count);
                                    const heightPercent = maxGraphValue > 0 ? (count / maxGraphValue) * 100 : 0;
                                    return (
                                        <div key={i} className="flex flex-col items-center flex-1 group relative">
                                            <div
                                                className="w-full bg-blue-500 rounded-t-sm hover:bg-blue-600 transition-all relative min-h-[4px]"
                                                style={{ height: `${Math.max(heightPercent, 5)}%` }}
                                            >
                                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                                                    {count} פעולות
                                                </div>
                                            </div>
                                            <span className="text-[10px] text-slate-400 mt-2 font-mono rotate-0 sm:rotate-0 truncate w-full text-center">
                                                {point.date_bucket}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="h-48 flex items-center justify-center text-slate-400 text-sm italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                אין נתונים לתקופה זו
                            </div>
                        )}
                    </div>

                    {/* 2. Top Users */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <Trophy className="text-amber-500" size={18} />
                                <h3 className="font-bold text-slate-700 text-sm">משתמשים מובילים</h3>
                            </div>
                        </div>
                        <div className="p-2">
                            {stats.topUsers.length > 0 ? (
                                <div className="space-y-1">
                                    {stats.topUsers.map((user, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${idx === 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                                                    {idx + 1}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-sm text-slate-800">{user.user_name}</div>
                                                    <div className="text-[10px] text-slate-400 font-mono">{user.user_email}</div>
                                                </div>
                                            </div>
                                            <div className="bg-slate-100 px-2 py-1 rounded text-xs font-bold text-slate-600">
                                                {user.action_count}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-8 text-center text-slate-400 text-xs">אין נתונים</div>
                            )}
                        </div>
                    </div>

                    {/* 3. Top Pages */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <Layout className="text-emerald-500" size={18} />
                                <h3 className="font-bold text-slate-700 text-sm">דפים נצפים ביותר</h3>
                            </div>
                        </div>
                        <div className="p-2">
                            {stats.topPages.length > 0 ? (
                                <div className="space-y-1">
                                    {stats.topPages.map((page, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                                    <Layout size={14} />
                                                </div>
                                                <div className="font-medium text-sm text-slate-700 truncate max-w-[180px]" title={translateItem(page.page_name, 'page')}>
                                                    {translateItem(page.page_name, 'page')}
                                                </div>
                                            </div>
                                            <div className="text-xs font-mono text-slate-500">
                                                {page.view_count} צפיות
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-8 text-center text-slate-400 text-xs">אין נתונים</div>
                            )}
                        </div>
                    </div>

                    {/* 4. Top Actions */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:col-span-2">
                        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <MousePointer2 className="text-purple-500" size={18} />
                                <h3 className="font-bold text-slate-700 text-sm">פעולות נפוצות</h3>
                            </div>
                        </div>
                        <div className="p-4">
                            {stats.topActions.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {stats.topActions.map((action, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl hover:border-purple-200 hover:bg-purple-50 transition-all group">
                                            <div className="font-medium text-xs text-slate-700 truncate pr-2" title={translateItem(action.action_name, 'action')}>
                                                {translateItem(action.action_name, 'action')}
                                            </div>
                                            <div className="bg-slate-100 group-hover:bg-white px-2 py-0.5 rounded text-[10px] font-bold text-slate-600">
                                                {action.usage_count}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-8 text-center text-slate-400 text-xs">אין נתונים</div>
                            )}
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
};
