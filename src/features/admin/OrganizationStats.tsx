import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../services/supabaseClient';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area, Cell } from 'recharts';
import { Trophy, Activity, Eye, TrendingUp, Users } from 'lucide-react';

interface OrganizationStatsProps {
    organizationId: string;
}

interface TopUser {
    name: string;
    email: string;
    count: number;
}

interface PageView {
    page: string;
    count: number;
}

interface CategoryStat {
    name: string;
    value: number;
}

type Timeframe = 'today' | 'week' | 'month';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export const OrganizationStats: React.FC<OrganizationStatsProps> = ({ organizationId }) => {
    const queryClient = useQueryClient();
    const [timeframe, setTimeframe] = useState<Timeframe>('week');

    const getDateFilter = () => {
        const now = new Date();
        if (timeframe === 'today') {
            now.setHours(0, 0, 0, 0);
        } else if (timeframe === 'week') {
            now.setDate(now.getDate() - 7);
        } else if (timeframe === 'month') {
            now.setDate(now.getDate() - 30);
        }
        return now.toISOString();
    };

    const { data: stats, isLoading } = useQuery({
        queryKey: ['organizationStats', organizationId, timeframe],
        queryFn: async () => {
            const startDate = getDateFilter();

            // Run count and data fetch in parallel
            const [countResult, logsResult] = await Promise.all([
                // 1. Fetch True Count
                supabase
                    .from('audit_logs')
                    .select('*', { count: 'exact', head: true })
                    .eq('organization_id', organizationId)
                    .gte('created_at', startDate),

                // 2. Fetch Data (Limited)
                supabase
                    .from('audit_logs')
                    .select('user_name, user_email, event_type, event_category, action_description, created_at')
                    .eq('organization_id', organizationId)
                    .gte('created_at', startDate)
                    .limit(1000)
            ]);

            const totalActions = countResult.count || 0;
            const logs = logsResult.data || [];

            // -- Aggregation Logic --

            // A. Top Users
            const userCounts: Record<string, { count: number, email: string }> = {};
            logs.forEach(log => {
                const name = log.user_name || 'System';
                if (!userCounts[name]) userCounts[name] = { count: 0, email: log.user_email };
                userCounts[name].count++;
            });

            const topUsers = Object.entries(userCounts)
                .map(([name, data]) => ({ name, email: data.email, count: data.count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);

            // B. Top Pages
            const pageCounts: Record<string, number> = {};
            logs.forEach(log => {
                if (log.event_type === 'VIEW' || log.event_category === 'navigation') {
                    let pageName = log.action_description || 'Unknown';
                    // Cleanup common prefixes
                    pageName = pageName
                        .replace('Viewed ', '')
                        .replace('Navigated to ', '')
                        .replace('צפה בעמוד ', '')
                        .replace('נכנס לעמוד ', '');
                    pageCounts[pageName] = (pageCounts[pageName] || 0) + 1;
                }
            });

            const topPages = Object.entries(pageCounts)
                .map(([page, count]) => ({ page, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);

            // C. Categories Breakdown
            const catCounts: Record<string, number> = {};
            logs.forEach(log => {
                const cat = log.event_category || 'Other';
                catCounts[cat] = (catCounts[cat] || 0) + 1;
            });
            const categories = Object.entries(catCounts).map(([name, value]) => ({ name, value }));

            // D. Activity Trend
            const trendMap = new Map<string, number>();
            logs.forEach(log => {
                const date = new Date(log.created_at);
                let key = '';
                if (timeframe === 'today') {
                    key = `${date.getHours().toString().padStart(2, '0')}:00`;
                } else {
                    key = date.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
                }
                trendMap.set(key, (trendMap.get(key) || 0) + 1);
            });

            const trendData = Array.from(trendMap.entries())
                .map(([date, count]) => ({ date, count }))
                .sort((a, b) => a.date.localeCompare(b.date));

            return {
                totalActions,
                topUsers,
                topPages,
                categories,
                activityTrend: trendData
            };
        },
        enabled: !!organizationId,
        staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    });

    const { totalActions, topUsers, topPages, categories, activityTrend } = stats || {
        totalActions: 0,
        topUsers: [],
        topPages: [],
        categories: [],
        activityTrend: []
    };

    if (isLoading) {
        return <div className="p-8 text-center text-slate-400 animate-pulse">טוען נתונים...</div>;
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Controls */}
            <div className="flex justify-end mb-4">
                <div className="flex bg-slate-100 p-1 rounded-lg text-xs font-medium">
                    {(['today', 'week', 'month'] as const).map((t) => (
                        <button
                            key={t}
                            onClick={() => setTimeframe(t)}
                            className={`px-3 py-1.5 rounded transition-all ${timeframe === t ? 'bg-white shadow text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            {t === 'today' ? 'היום' : t === 'week' ? '7 ימים' : '30 יום'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Quick Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                        <p className="text-slate-500 text-xs font-bold mb-1">סה״כ פעולות</p>
                        <h3 className="text-2xl font-black text-slate-800">{totalActions}</h3>
                    </div>
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-lg shrink-0">
                        <Activity size={20} />
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                        <p className="text-slate-500 text-xs font-bold mb-1">משתמש הכי פעיל</p>
                        <h3 className="text-lg font-bold text-slate-800 break-words leading-tight" title={topUsers[0]?.name}>
                            {topUsers[0]?.name || '-'}
                        </h3>
                        <p className="text-[10px] text-slate-400">{topUsers[0]?.count || 0} פעולות</p>
                    </div>
                    <div className="p-3 bg-amber-50 text-amber-600 rounded-lg shrink-0">
                        <Trophy size={20} />
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                        <p className="text-slate-500 text-xs font-bold mb-1">העמוד הנצפה ביותר</p>
                        <h3 className="text-lg font-bold text-slate-800 break-words leading-tight" title={topPages[0]?.page}>
                            {topPages[0]?.page || '-'}
                        </h3>
                        <p className="text-[10px] text-slate-400">{topPages[0]?.count || 0} צפיות</p>
                    </div>
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
                        <Eye size={20} />
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                        <p className="text-slate-500 text-xs font-bold mb-1">אינטראקטיביות (קליקים)</p>
                        <h3 className="text-2xl font-black text-slate-800">
                            {categories.find(c => c.name === 'ui')?.value || 0}
                        </h3>
                        <p className="text-[10px] text-slate-400">לחיצות על כפתורים ותפריטים</p>
                    </div>
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
                        <Activity size={20} />
                    </div>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* 1. Activity Trend */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                    <h4 className="font-bold text-slate-800 mb-4 flex items-center text-sm">
                        <TrendingUp size={16} className="mr-2 text-blue-500" />
                        מגמת פעילות
                    </h4>
                    <div className="h-64 w-full text-xs" dir="ltr">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={activityTrend}>
                                <defs>
                                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} />
                                <YAxis axisLine={false} tickLine={false} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                />
                                <Area type="monotone" dataKey="count" stroke="#3b82f6" fillOpacity={1} fill="url(#colorCount)" strokeWidth={3} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. Top 5 Users Bar Chart */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                    <h4 className="font-bold text-slate-800 mb-4 flex items-center text-sm">
                        <Users size={16} className="mr-2 text-purple-500" />
                        5 המשתמשים הפעילים ביותר
                    </h4>
                    <div className="h-64 w-full text-xs" dir="ltr">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={topUsers} layout="vertical" margin={{ left: 40 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                <XAxis type="number" axisLine={false} tickLine={false} />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    width={100}
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 11, fill: '#64748b' }}
                                />
                                <Tooltip
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                />
                                <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 3. Category Breakdown Pie */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 lg:col-span-2">
                    <h4 className="font-bold text-slate-800 mb-4 flex items-center text-sm">
                        <Activity size={16} className="mr-2 text-slate-500" />
                        התפלגות פעולות לפי קטגוריה
                    </h4>
                    <div className="h-64 w-full text-xs" dir="ltr">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={categories}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                <YAxis axisLine={false} tickLine={false} />
                                <Tooltip
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                />
                                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40}>
                                    {categories.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

            </div>
        </div>
    );
};
