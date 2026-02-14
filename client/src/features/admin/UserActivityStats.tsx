import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { adminService } from '../../services/adminService';
import {
    Layout as LayoutIcon,
    CursorClick as MousePointerClickIcon,
    Pulse as ActivityIcon,
    ChartBar as BarChartIcon,
    Trophy as TrophyIcon
} from '@phosphor-icons/react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { DashboardSkeleton } from '../../components/ui/DashboardSkeleton';

type TimeRange = 'today' | 'week' | 'month';

interface DashboardStats {
    topUsers: { user_name: string; user_email: string; action_count: number }[];
    topPages: { page_name: string; view_count: number }[];
    topActions: { action_name: string; usage_count: number }[];
    activityGraph: { date_bucket: string; count: number }[];
}

interface UserActivityStatsProps {
    isEmbedded?: boolean;
}

export const UserActivityStats: React.FC<UserActivityStatsProps> = ({ isEmbedded = false }) => {
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
            // Fetch more than 5 users initially to allow for super-admin filtering
            const [topUsers, topPages, topActions, activityGraph] = await Promise.all([
                adminService.getOrgTopUsers(timeRange, 15),
                adminService.getOrgTopPages(timeRange, 5),
                adminService.getOrgTopActions(timeRange, 5),
                adminService.getOrgActivityGraph(timeRange)
            ]);

            let filteredUsers = topUsers || [];

            // --- FILTER: Exclude Super Admins from "Top Users" list ---
            if (filteredUsers.length > 0) {
                const userEmails = filteredUsers.map((u: any) => u.user_email);
                const superAdmins = await adminService.fetchSuperAdmins(userEmails);

                const superAdminEmails = new Set(superAdmins?.map((sa: any) => sa.email) || []);
                filteredUsers = filteredUsers.filter((u: any) => !superAdminEmails.has(u.user_email));
            }

            setStats({
                topUsers: filteredUsers.slice(0, 5),
                topPages: topPages || [],
                topActions: topActions || [],
                activityGraph: activityGraph || []
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
        <div className={isEmbedded ? "" : "bg-white rounded-[2rem] md:rounded-[2.5rem] border border-slate-200/60 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-6rem)] md:h-[calc(100vh-8rem)] relative z-20"}>
            {/* Premium Header - Only show if not embedded */}
            {!isEmbedded && (
                <div className="flex flex-col md:flex-row items-center justify-between px-6 py-6 md:px-8 md:h-24 bg-white border-b border-slate-100 shrink-0 gap-4">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-sm shadow-indigo-100">
                            <ActivityIcon size={24} weight="bold" />
                        </div>
                        <div>
                            <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-none">ניתוח פעילות משתמשים</h2>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">User Activity Analytics</p>
                        </div>
                    </div>

                    <div className="flex bg-slate-50 border border-slate-200/60 p-1 rounded-xl text-xs font-bold shadow-none w-full md:w-auto overflow-x-auto">
                        {(['today', 'week', 'month'] as const).map((t) => (
                            <button
                                key={t}
                                onClick={() => setTimeRange(t)}
                                className={`px-4 py-2 rounded-lg transition-all whitespace-nowrap flex-1 md:flex-none ${timeRange === t ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                {t === 'today' ? 'היום' : t === 'week' ? '7 ימים' : '30 יום'}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Content Area */}
            <div className={`flex-1 overflow-y-auto custom-scrollbar ${isEmbedded ? "" : "p-6 md:p-8"}`}>
                {loading ? (
                    <DashboardSkeleton />
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* 1. Activity Graph */}
                        <div className="col-span-1 md:col-span-2 bg-slate-50 rounded-2xl border border-slate-200/60 p-6">
                            <div className="flex items-center justify-between mb-6 border-b border-slate-200/60 pb-4">
                                <div className="flex items-center gap-2">
                                    <BarChartIcon className="text-indigo-500" size={20} weight="bold" />
                                    <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">מגמת פעילות</h3>
                                </div>
                                {stats.activityGraph.length > 0 && (
                                    <div className="text-[10px] font-bold text-slate-400">
                                        Total Actions: {stats.activityGraph.reduce((a, b) => a + Number(b.count), 0)}
                                    </div>
                                )}
                            </div>

                            {stats.activityGraph.length > 0 ? (
                                <div className="h-64 w-full text-[10px]" dir="ltr">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={stats.activityGraph} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                            <XAxis
                                                dataKey="date_bucket"
                                                tick={{ fontSize: 10, fill: '#94a3b8' }}
                                                axisLine={false}
                                                tickLine={false}
                                                dy={10}
                                            />
                                            <YAxis
                                                allowDecimals={false}
                                                tick={{ fontSize: 10, fill: '#94a3b8' }}
                                                axisLine={false}
                                                tickLine={false}
                                            />
                                            <Tooltip
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', backgroundColor: 'rgba(15, 23, 42, 0.95)', color: '#fff' }}
                                                itemStyle={{ color: '#fff', fontSize: '12px' }}
                                                cursor={{ fill: '#f1f5f9' }}
                                                formatter={(value: number) => [value, 'פעולות']}
                                                labelStyle={{ color: '#94a3b8', fontSize: '10px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                                            />
                                            <Bar
                                                dataKey="count"
                                                fill="#6366f1"
                                                radius={[4, 4, 0, 0]}
                                                barSize={32}
                                                name="פעולות"
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="h-48 flex items-center justify-center text-slate-400 text-sm italic bg-slate-100/50 rounded-xl border border-dashed border-slate-200">
                                    אין נתונים לתקופה זו
                                </div>
                            )}
                        </div>

                        {/* 2. Top Users */}
                        <div className="bg-slate-50 rounded-2xl border border-slate-200/60 p-6 flex flex-col h-full">
                            <div className="flex items-center gap-2 mb-6 border-b border-slate-200/60 pb-4">
                                <TrophyIcon className="text-amber-500" size={18} weight="bold" />
                                <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">משתמשים מובילים</h3>
                            </div>
                            <div className="flex-1">
                                {stats.topUsers.length > 0 ? (
                                    <div className="space-y-3">
                                        {stats.topUsers.map((user, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-100 hover:border-amber-200 rounded-xl transition-all group shadow-sm">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black shadow-sm transition-transform group-hover:scale-110 ${idx === 0 ? 'bg-amber-400 text-white' : idx === 1 ? 'bg-slate-400 text-white' : idx === 2 ? 'bg-amber-700/60 text-white' : 'bg-slate-100 text-slate-500 shadow-none'}`}>
                                                        {idx + 1}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-xs text-slate-800 truncate max-w-[120px]">{user.user_name}</div>
                                                        <div className="text-[9px] text-slate-400 font-mono truncate max-w-[120px]">{user.user_email}</div>
                                                    </div>
                                                </div>
                                                <div className="bg-slate-50 px-2 py-1 rounded-lg text-xs font-black text-slate-600 border border-slate-100">
                                                    {user.action_count}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-8 text-center text-slate-400 text-xs italic">אין נתונים</div>
                                )}
                            </div>
                        </div>

                        {/* 3. Top Pages */}
                        <div className="bg-slate-50 rounded-2xl border border-slate-200/60 p-6 flex flex-col h-full">
                            <div className="flex items-center gap-2 mb-6 border-b border-slate-200/60 pb-4">
                                <LayoutIcon className="text-emerald-500" size={18} weight="bold" />
                                <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">דפים נצפים ביותר</h3>
                            </div>
                            <div className="flex-1">
                                {stats.topPages.length > 0 ? (
                                    <div className="space-y-3">
                                        {stats.topPages.map((page, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-100 hover:border-emerald-200 rounded-xl transition-all group shadow-sm">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                                                        <LayoutIcon size={14} weight="bold" />
                                                    </div>
                                                    <div className="font-bold text-xs text-slate-700 truncate max-w-[150px]" title={translateItem(page.page_name, 'page')}>
                                                        {translateItem(page.page_name, 'page')}
                                                    </div>
                                                </div>
                                                <div className="text-[10px] font-mono font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">
                                                    {page.view_count} view
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-8 text-center text-slate-400 text-xs italic">אין נתונים</div>
                                )}
                            </div>
                        </div>

                        {/* 4. Top Actions */}
                        <div className="md:col-span-2 bg-slate-50 rounded-2xl border border-slate-200/60 p-6 flex flex-col hover:border-purple-200/50 transition-colors">
                            <div className="flex items-center gap-2 mb-6 border-b border-slate-200/60 pb-4">
                                <MousePointerClickIcon className="text-purple-500" size={18} weight="bold" />
                                <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">פעולות נפוצות</h3>
                            </div>
                            <div className="flex-1">
                                {stats.topActions.length > 0 ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {stats.topActions.map((action, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl hover:border-purple-200 hover:shadow-sm transition-all group">
                                                <div className="font-bold text-xs text-slate-700 truncate pr-2 flex items-center gap-2" title={translateItem(action.action_name, 'action')}>
                                                    <div className="w-1.5 h-1.5 rounded-full bg-purple-400 group-hover:scale-125 transition-transform"></div>
                                                    {translateItem(action.action_name, 'action')}
                                                </div>
                                                <div className="bg-purple-50 group-hover:bg-purple-100 group-hover:text-purple-700 px-2 py-1 rounded-lg text-[10px] font-black text-purple-600 transition-colors">
                                                    {action.usage_count}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-8 text-center text-slate-400 text-xs italic">אין נתונים</div>
                                )}
                            </div>
                        </div>

                    </div>
                )}
            </div>
        </div>
    );
};
