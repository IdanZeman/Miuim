import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../services/supabaseClient';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area, Cell } from 'recharts';
import { Trophy, Pulse as Activity, Eye, TrendUp as TrendingUp, Users } from '@phosphor-icons/react';

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

    return (
        <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] border border-slate-200/60 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-6rem)] md:h-[calc(100vh-8rem)] relative z-20">
            {/* Premium Header */}
            <div className="flex flex-col md:flex-row items-center justify-between px-6 py-6 md:px-8 md:h-24 bg-white border-b border-slate-100 shrink-0 gap-4">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-sm shadow-blue-100">
                        <Activity size={24} weight="bold" />
                    </div>
                    <div>
                        <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-none">סטטיסטיקות אירגון</h2>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Organization Analytics</p>
                    </div>
                </div>

                <div className="flex bg-slate-50 border border-slate-200/60 p-1 rounded-xl text-xs font-bold shadow-none w-full md:w-auto overflow-x-auto">
                    {(['today', 'week', 'month'] as const).map((t) => (
                        <button
                            key={t}
                            onClick={() => setTimeframe(t)}
                            className={`px-4 py-2 rounded-lg transition-all whitespace-nowrap flex-1 md:flex-none ${timeframe === t ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            {t === 'today' ? 'היום' : t === 'week' ? '7 ימים' : '30 יום'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 space-y-6">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4">
                        <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                        <span className="text-xs font-bold animate-pulse">טוען נתונים...</span>
                    </div>
                ) : (
                    <>
                        {/* Quick Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 flex flex-col justify-between h-full group hover:border-blue-200 transition-colors">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="p-2 bg-blue-100/50 text-blue-600 rounded-lg group-hover:scale-110 transition-transform">
                                        <Activity size={20} weight="bold" />
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Actions</span>
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-slate-800 tracking-tight">{totalActions}</h3>
                                    <p className="text-xs font-medium text-slate-500 mt-1">סה״כ פעולות</p>
                                </div>
                            </div>

                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 flex flex-col justify-between h-full group hover:border-amber-200 transition-colors">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="p-2 bg-amber-100/50 text-amber-600 rounded-lg group-hover:scale-110 transition-transform">
                                        <Trophy size={20} weight="bold" />
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Top User</span>
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-slate-800 tracking-tight truncate" title={topUsers[0]?.name}>
                                        {topUsers[0]?.name || '-'}
                                    </h3>
                                    <p className="text-xs font-medium text-slate-500 mt-1">{topUsers[0]?.count || 0} פעולות</p>
                                </div>
                            </div>

                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 flex flex-col justify-between h-full group hover:border-emerald-200 transition-colors">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="p-2 bg-emerald-100/50 text-emerald-600 rounded-lg group-hover:scale-110 transition-transform">
                                        <Eye size={20} weight="bold" />
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Top Page</span>
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-slate-800 tracking-tight truncate" title={topPages[0]?.page}>
                                        {topPages[0]?.page || '-'}
                                    </h3>
                                    <p className="text-xs font-medium text-slate-500 mt-1">{topPages[0]?.count || 0} צפיות</p>
                                </div>
                            </div>

                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 flex flex-col justify-between h-full group hover:border-indigo-200 transition-colors">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="p-2 bg-indigo-100/50 text-indigo-600 rounded-lg group-hover:scale-110 transition-transform">
                                        <Activity size={20} weight="bold" />
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Clicks</span>
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                                        {categories.find(c => c.name === 'ui')?.value || 0}
                                    </h3>
                                    <p className="text-xs font-medium text-slate-500 mt-1">אינטראקטיביות</p>
                                </div>
                            </div>
                        </div>

                        {/* Charts Row */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                            {/* 1. Activity Trend */}
                            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200/60">
                                <h4 className="font-black text-slate-800 mb-6 flex items-center text-sm uppercase tracking-wider">
                                    <TrendingUp size={18} weight="bold" className="mr-2 text-blue-500" />
                                    מגמת פעילות
                                </h4>
                                <div className="h-64 w-full text-[10px] font-bold" dir="ltr">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={activityTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} dy={10} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
                                            <Tooltip
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', backgroundColor: 'rgba(15, 23, 42, 0.95)', color: '#fff' }}
                                                itemStyle={{ color: '#fff' }}
                                                cursor={{ stroke: '#3b82f6', strokeWidth: 2 }}
                                            />
                                            <Area type="monotone" dataKey="count" stroke="#3b82f6" fillOpacity={1} fill="url(#colorCount)" strokeWidth={3} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* 2. Top 5 Users Bar Chart */}
                            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200/60">
                                <h4 className="font-black text-slate-800 mb-6 flex items-center text-sm uppercase tracking-wider">
                                    <Users size={18} weight="bold" className="mr-2 text-purple-500" />
                                    5 המשתמשים הפעילים ביותר
                                </h4>
                                <div className="h-64 w-full text-[10px] font-bold" dir="ltr">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={topUsers} layout="vertical" margin={{ left: 0, right: 20 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                                            <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
                                            <YAxis
                                                dataKey="name"
                                                type="category"
                                                width={100}
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: '#64748b' }}
                                            />
                                            <Tooltip
                                                cursor={{ fill: '#f1f5f9' }}
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', backgroundColor: 'rgba(15, 23, 42, 0.95)', color: '#fff' }}
                                                itemStyle={{ color: '#fff' }}
                                            />
                                            <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={24} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* 3. Category Breakdown Pie */}
                            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200/60 lg:col-span-2">
                                <h4 className="font-black text-slate-800 mb-6 flex items-center text-sm uppercase tracking-wider">
                                    <Activity size={18} weight="bold" className="mr-2 text-slate-500" />
                                    התפלגות פעולות לפי קטגוריה
                                </h4>
                                <div className="h-64 w-full text-[10px] font-bold" dir="ltr">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={categories}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} dy={10} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
                                            <Tooltip
                                                cursor={{ fill: '#f1f5f9' }}
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', backgroundColor: 'rgba(15, 23, 42, 0.95)', color: '#fff' }}
                                                itemStyle={{ color: '#fff' }}
                                            />
                                            <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} className="hover:opacity-80 transition-opacity">
                                                {categories.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
