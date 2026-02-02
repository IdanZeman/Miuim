import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createPortal } from 'react-dom';
import { supabase } from '../../services/supabaseClient';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    CartesianGrid, AreaChart, Area, Cell, PieChart, Pie, Legend
} from 'recharts';
import {
    Trophy as TrophyIcon, Pulse as ActivityIcon, Eye as EyeIcon, TrendUp as TrendingUpIcon, Users as UsersIcon,
    DeviceMobile as SmartphoneIcon, Desktop as MonitorIcon, Globe as GlobeIcon, MapPin as MapPinIcon,
    CursorClick as MousePointerClickIcon, Buildings as Building2Icon
} from '@phosphor-icons/react';
import { LocationMap } from './LocationMap';
import { DashboardSkeleton } from '../../components/ui/DashboardSkeleton';

interface GlobalStatsProps {
    // No organizationId needed for global stats
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f43f5e'];

type Timeframe = 'today' | 'week' | 'month';

export const GlobalStats: React.FC<GlobalStatsProps> = () => {
    const [timeframe, setTimeframe] = useState<Timeframe>('today');
    const [selectedMetric, setSelectedMetric] = useState<{
        title: string;
        type: 'orgs' | 'users' | 'actions';
        data: any[];
    } | null>(null);
    const [trendTab, setTrendTab] = useState<'actions' | 'users' | 'orgs'>('actions');

    const getDateFilter = () => {
        const now = new Date();
        if (timeframe === 'today') {
            now.setHours(0, 0, 0, 0);
        } else if (timeframe === 'week') {
            now.setDate(now.getDate() - 7);
            now.setHours(0, 0, 0, 0);
        } else if (timeframe === 'month') {
            now.setDate(now.getDate() - 30);
            now.setHours(0, 0, 0, 0);
        }
        return now.toISOString();
    };

    const { data: stats, isLoading } = useQuery({
        queryKey: ['globalStats', timeframe],
        queryFn: async () => {
            const startDate = getDateFilter();
            console.log('Fetching Global Stats for:', timeframe, 'StartDate:', startDate);

            const [
                activityRes,
                globalStatsRes,
                topOrgsRes,
                topUsersRes,
                newOrgsListQuery,
                newUsersListQuery,
                logsRes,
                usersTrendRes,
                orgsTrendRes
            ] = await Promise.all([
                // A. System Activity Chart (Actions)
                supabase.rpc('get_system_activity_chart', { time_range: timeframe }),

                // B. Global Counters (Aggregated Server-Side)
                supabase.rpc('get_global_stats_aggregated', { time_range: timeframe }),

                // C. Top Organizations (Fixed RPC)
                (async () => {
                    try {
                        const res = await supabase.rpc('get_top_organizations', { time_range: timeframe, limit_count: 100 });
                        if (res.error) throw res.error;
                        return res;
                    } catch (e) {
                        console.error('RPC Error: get_top_organizations', e);
                        return { data: [] };
                    }
                })(),

                // D. Top Users (Server-Side)
                // D. Active Users (Direct DB Query as requested)
                supabase.from('audit_logs')
                    .select('user_id')
                    .gte('created_at', startDate)
                    .limit(5000)
                    .then(async ({ data: logs, error }) => {
                        if (error) throw error;

                        // Aggregate counts client-side
                        const userCounts: Record<string, number> = {};
                        logs?.forEach((l: any) => {
                            // Handle possible varied column names if needed, but 'user_id' is standard
                            const uid = l.user_id || l.userId;
                            if (uid) userCounts[uid] = (userCounts[uid] || 0) + 1;
                        });

                        const userIds = Object.keys(userCounts);

                        // Fetch details for these users
                        if (userIds.length === 0) return { data: [] };

                        const { data: profiles } = await supabase
                            .from('profiles')
                            .select('*, organizations(name)')
                            .in('id', userIds)
                            .eq('is_super_admin', false);

                        // Merge details with counts
                        return {
                            data: profiles?.map(p => ({
                                user_id: p.id,
                                full_name: p.full_name || p.email, // Fallback
                                email: p.email,
                                org_name: p.organizations?.name,
                                activity_count: userCounts[p.id]
                            })).sort((a, b) => b.activity_count - a.activity_count) || []
                        };
                    }),

                // E. New Organizations List (for modal)
                supabase.from('organizations')
                    .select('*')
                    .gte('created_at', startDate)
                    .order('created_at', { ascending: false })
                    .limit(1000),

                // F. New Users List (for modal)
                supabase.from('profiles')
                    .select('*, organizations(name)')
                    .gte('created_at', startDate)
                    .order('created_at', { ascending: false })
                    .limit(1000),

                // G. Audit Logs (Only for Map & Device Stats - sample is fine)
                supabase.from('audit_logs')
                    .select('created_at, user_id, organization_id, metadata, city, country, device_type')
                    .gte('created_at', startDate)
                    .order('created_at', { ascending: false })
                    .limit(2000), // Reduced sample size as trends now server-side

                // H. Users Trend (Server-Side)
                supabase.rpc('get_system_users_chart', { time_range: timeframe }),

                // I. Orgs Trend (Server-Side)
                supabase.rpc('get_system_orgs_chart', { time_range: timeframe })
            ]);

            const activityData = activityRes.data || [];
            const usersTrendData = usersTrendRes.data || [];
            const orgsTrendData = orgsTrendRes.data || [];
            const globalStats = globalStatsRes.data || {};
            const activeOrgsList = topOrgsRes.data || [];
            const topUsersList = topUsersRes.data || [];
            const newOrgsList = newOrgsListQuery.data || [];
            // Map new users to include flattened org name
            const newUsersList = (newUsersListQuery.data || []).map((u: any) => ({
                ...u,
                org_name: u.organizations?.name
            }));
            const logsSample = logsRes.data || [];

            // -- Visual Aggregation (Map, Devices, Cities) & Trend Aggregation (Users, Orgs) --
            const deviceCounts: Record<string, number> = { 'Desktop': 0, 'Mobile': 0, 'Tablet': 0 };
            const locationCounts: Record<string, { count: number, lat?: number, lon?: number, label: string }> = {};
            const cityCounts: Record<string, number> = {};

            // Client-side Trend Aggregation buckets (Removed)

            logsSample.forEach(log => {
                // 1. Devices & Location processing
                const device = log.metadata?.device_type || log.device_type || 'Desktop';
                if (deviceCounts[device] !== undefined) deviceCounts[device]++;

                const city = log.metadata?.city || log.city;
                if (city) cityCounts[city] = (cityCounts[city] || 0) + 1;

                const country = log.metadata?.country || log.country;
                const lat = log.metadata?.latitude;
                const lon = log.metadata?.longitude;

                let locKey = '';
                if (lat && lon) {
                    locKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;
                } else if (city) {
                    locKey = city;
                }

                if (locKey) {
                    if (!locationCounts[locKey]) {
                        locationCounts[locKey] = {
                            count: 0,
                            lat: lat,
                            lon: lon,
                            label: city || country || 'Unknown'
                        };
                    }
                    locationCounts[locKey].count++;
                    if (!locationCounts[locKey].lat && lat) {
                        locationCounts[locKey].lat = lat;
                        locationCounts[locKey].lon = lon;
                    }
                }


            });

            // Prepare Trend Data Series


            // Generate Date Range for Consistency across all charts
            const getDatesInRange = () => {
                const dates: string[] = [];
                const end = new Date();
                const start = new Date();

                if (timeframe === 'today') {
                    // Generate 24 hours: 00:00 to 23:00
                    for (let i = 0; i < 24; i++) {
                        dates.push(`${i.toString().padStart(2, '0')}:00`);
                    }
                    return dates;
                } else if (timeframe === 'week') {
                    start.setDate(end.getDate() - 7);
                } else if (timeframe === 'month') {
                    start.setDate(end.getDate() - 30);
                }

                // Iterate from start to end
                for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                    // Match the DD/MM format of the RPC output
                    dates.push(d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' }));
                }
                return dates;
            };

            const dateRange = getDatesInRange();

            // Helper to merge data with full date range
            const normalizeData = (data: any[], valueKey: string) => {
                if (!dateRange) return data;

                // Create a map of existing data
                const dataMap = new Map(data.map(d => [d.date_label, Number(d[valueKey])]));

                // Map over full range
                return dateRange.map(date => ({
                    date: date,
                    count: dataMap.get(date) || 0
                }));
            };

            const activityTrend = normalizeData(activityData, 'action_count');
            const usersTrend = normalizeData(usersTrendData, 'count');
            const orgsTrend = normalizeData(orgsTrendData, 'count');

            const deviceStats = Object.entries(deviceCounts)
                .map(([name, value]) => ({ name, value }))
                .filter(d => d.value > 0);

            const cityStats = Object.entries(cityCounts)
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 5);

            const mapData = Object.values(locationCounts).map(l => ({
                name: l.label,
                value: l.count,
                lat: l.lat,
                lon: l.lon
            }));

            const formattedTopUsers = topUsersList.map((u: any) => ({
                name: u.full_name,
                email: u.email,
                count: u.activity_count,
                org_name: u.org_name
            })).filter((u: any) => u.count > 0);

            // Derive active orgs from Top Users (Action based) to match KPI
            const derivedActiveOrgs = Object.values(formattedTopUsers.reduce((acc: any, user: any) => {
                if (!user.org_name) return acc;
                if (!acc[user.org_name]) {
                    acc[user.org_name] = {
                        org_name: user.org_name, // standardized key
                        name: user.org_name,
                        shifts_count: 0,
                        count: 0,
                        users_count: 0
                    };
                }
                acc[user.org_name].shifts_count += user.count;
                acc[user.org_name].count += user.count;
                acc[user.org_name].users_count += 1;
                return acc;
            }, {}));

            return {
                newOrgsCount: globalStats.new_orgs_count || 0,
                newOrgsList,
                newUsersCount: globalStats.new_users_count || 0,
                newUsersList,
                activeOrgsCount: derivedActiveOrgs.length, // Derived count
                activeOrgsList: derivedActiveOrgs, // Derived list
                activeUsersCount: formattedTopUsers.length, // Derived count
                topUsers: formattedTopUsers,
                totalActions: globalStats.total_actions || 0,
                // Return all 3 trends
                activityTrend,
                usersTrend,
                orgsTrend,
                deviceStats,
                mapData,
                cityStats,
                topOrgs: activeOrgsList.slice(0, 10), // Keep original topOrgs for the table below if needed, or switch to derived? Keeping original for now as table has different columns.
            };
        },
        staleTime: 1000 * 30,
    });

    if (isLoading) {
        return <DashboardSkeleton />;
    }

    const {
        newOrgsCount, newOrgsList, newUsersCount, newUsersList,
        activeOrgsCount, activeOrgsList, activeUsersCount,
        activityTrend, usersTrend, orgsTrend, deviceStats, cityStats, topUsers, topOrgs, mapData, totalActions
    } = stats || {
        newOrgsCount: 0, newOrgsList: [], newUsersCount: 0, newUsersList: [],
        activeOrgsCount: 0, activeOrgsList: [], activeUsersCount: 0,
        activityTrend: [], usersTrend: [], orgsTrend: [], deviceStats: [], cityStats: [], topUsers: [], topOrgs: [], mapData: [], totalActions: 0
    };

    // Determine current chart data properties
    const chartConfig = {
        actions: { data: activityTrend, color: '#3b82f6', id: 'colorTrendActions', label: 'פעולות' },
        users: { data: usersTrend, color: '#8b5cf6', id: 'colorTrendUsers', label: 'משתמשים שונים' },
        orgs: { data: orgsTrend, color: '#10b981', id: 'colorTrendOrgs', label: 'ארגונים פעילים' },
    };

    const currentChart = chartConfig[trendTab];

    return (
        <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-200/60 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-5rem)] md:h-[calc(100vh-8rem)] relative z-20">
            {/* Premium Header */}
            <div className="flex flex-col md:flex-row items-center justify-between px-4 py-4 md:px-8 md:h-24 bg-white border-b border-slate-100 shrink-0 gap-3">
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-50 text-blue-600 rounded-xl md:rounded-2xl flex items-center justify-center shadow-sm shadow-blue-100">
                        <ActivityIcon size={20} className="md:hidden" weight="bold" />
                        <ActivityIcon size={24} className="hidden md:block" weight="bold" />
                    </div>
                    <div>
                        <h3 className="text-lg md:text-2xl font-black text-slate-900 tracking-tight leading-none">מרכז הבקרה הגלובלי</h3>
                        <p className="text-[10px] md:text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 md:mt-1">Real-time System Monitoring</p>
                    </div>
                </div>

                <div className="flex bg-slate-50 border border-slate-200/60 p-1 rounded-lg md:rounded-xl text-[11px] md:text-xs font-bold shadow-none w-full md:w-auto">
                    {(['today', 'week', 'month'] as const).map((t) => (
                        <button
                            key={t}
                            onClick={() => setTimeframe(t)}
                            className={`flex-1 md:flex-none px-3 md:px-4 py-1.5 md:py-2 rounded-md md:rounded-lg transition-all ${timeframe === t ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            {t === 'today' ? 'היום' : t === 'week' ? 'השבוע' : 'החודש'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Scrollable Dashboard Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 md:p-8 space-y-4 md:space-y-6">

                {/* Principal KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-5 gap-2 md:gap-4">
                    <KPICard
                        title="ארגונים חדשים"
                        value={newOrgsCount}
                        sub="נוספו בטווח שנבחר"
                        icon={<Building2Icon size={24} weight="bold" />}
                        color="blue"
                        onClick={() => setSelectedMetric({ title: 'ארגונים חדשים', type: 'orgs', data: newOrgsList })}
                    />
                    <KPICard
                        title="משתמשים חדשים"
                        value={newUsersCount}
                        sub="נרשמו בטווח שנבחר"
                        icon={<UsersIcon size={24} weight="bold" />}
                        color="indigo"
                        onClick={() => setSelectedMetric({ title: 'משתמשים חדשים', type: 'users', data: newUsersList })}
                    />
                    <KPICard
                        title="משתמשים פעילים"
                        value={activeUsersCount}
                        sub={timeframe === 'today' ? 'פעילים היום' : timeframe === 'week' ? 'פעילים השבוע' : 'פעילים החודש'}
                        icon={<ActivityIcon size={24} weight="bold" />}
                        color="emerald"
                        pulse
                        onClick={() => setSelectedMetric({ title: 'משתמשים פעילים', type: 'users', data: topUsers })}
                    />
                    <KPICard
                        title="ארגונים פעילים"
                        value={activeOrgsCount}
                        sub="ביצעו פעולות בטווח"
                        icon={<GlobeIcon size={24} weight="bold" />}
                        color="cyan"
                        onClick={() => {
                            setSelectedMetric({ title: 'ארגונים פעילים', type: 'orgs', data: activeOrgsList });
                        }}
                    />
                    <KPICard
                        title="סה״כ פעולות"
                        value={totalActions}
                        sub="אינטראקציות מערכת"
                        icon={<TrendingUpIcon size={24} weight="bold" />}
                        color="amber"
                    // onClick={() => setSelectedMetric({ title: 'לוג פעולות', type: 'actions', data: [] })} // Not implemented yet
                    />
                </div>

                {/* Interaction Row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-6">
                    {/* 1. Activity Trend */}
                    <div className="bg-slate-50 rounded-xl md:rounded-2xl border border-slate-200/60 p-3 md:p-6 lg:col-span-2">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 md:mb-6 border-b border-slate-200/60 pb-3 md:pb-4 gap-3 md:gap-4">
                            <h4 className="font-black text-slate-800 flex items-center gap-2 text-xs md:text-sm uppercase tracking-wider">
                                <TrendingUpIcon size={16} className="md:hidden text-blue-500" weight="bold" />
                                <TrendingUpIcon size={18} className="hidden md:block text-blue-500" weight="bold" />
                                מגמות פעילות
                            </h4>

                            {/* Trend Tabs */}
                            <div className="flex bg-white border border-slate-200 p-0.5 md:p-1 rounded-lg text-[10px] md:text-[11px] font-bold shadow-sm w-full sm:w-auto">
                                <button
                                    onClick={() => setTrendTab('actions')}
                                    className={`flex-1 sm:flex-none px-2 md:px-3 py-1.5 md:py-2 rounded-md transition-all ${trendTab === 'actions' ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    פעולות
                                </button>
                                <button
                                    onClick={() => setTrendTab('users')}
                                    className={`flex-1 sm:flex-none px-2 md:px-3 py-1.5 md:py-2 rounded-md transition-all ${trendTab === 'users' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    משתמשים
                                </button>
                                <button
                                    onClick={() => setTrendTab('orgs')}
                                    className={`flex-1 sm:flex-none px-2 md:px-3 py-1.5 md:py-2 rounded-md transition-all ${trendTab === 'orgs' ? 'bg-emerald-50 text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    ארגונים
                                </button>
                            </div>
                        </div>
                        <div className="h-52 md:h-64 w-full text-[10px] min-h-[208px] md:min-h-[256px]" dir="ltr">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={currentChart.data}>
                                    <defs>
                                        <linearGradient id={currentChart.id} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={currentChart.color} stopOpacity={0.15} />
                                            <stop offset="95%" stopColor={currentChart.color} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
                                    <Tooltip content={<CustomTooltip label={currentChart.label} color={currentChart.color} />} />
                                    <Area
                                        type="monotone"
                                        dataKey="count"
                                        stroke={currentChart.color}
                                        fillOpacity={1}
                                        fill={`url(#${currentChart.id})`}
                                        strokeWidth={3}
                                        animationDuration={500}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* 2. Device Analysis */}
                    <div className="bg-slate-50 rounded-xl md:rounded-2xl border border-slate-200/60 p-3 md:p-6">
                        <h4 className="font-black text-slate-800 mb-3 md:mb-6 flex items-center gap-2 text-xs md:text-sm border-b border-slate-200/60 pb-3 md:pb-4 uppercase tracking-wider">
                            <SmartphoneIcon size={16} className="md:hidden text-purple-500" weight="bold" />
                            <SmartphoneIcon size={18} className="hidden md:block text-purple-500" weight="bold" />
                            התקני גישה
                        </h4>
                        <div className="h-48 md:h-64 w-full text-[10px] min-h-[192px] md:min-h-[256px]" dir="ltr">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={deviceStats}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                        cornerRadius={4}
                                        stroke="none"
                                    >
                                        {deviceStats.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomPieTooltip />} />
                                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Tables Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-6">
                    {/* Top Organizations */}
                    <div className="bg-slate-50 rounded-xl md:rounded-2xl border border-slate-200/60 p-3 md:p-6">
                        <h4 className="font-black text-slate-800 mb-3 md:mb-6 flex items-center gap-2 text-xs md:text-sm border-b border-slate-200/60 pb-3 md:pb-4 uppercase tracking-wider">
                            <TrophyIcon size={16} className="md:hidden text-emerald-500" weight="bold" />
                            <TrophyIcon size={18} className="hidden md:block text-emerald-500" weight="bold" />
                            ארגונים מובילים
                        </h4>
                        <div className="space-y-2 md:space-y-3">
                            {topOrgs.length > 0 ? topOrgs.map((org: any, i: number) => (
                                <div key={org.org_id} className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-100 hover:border-blue-200 transition-all group">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs text-white shadow-sm transition-transform group-hover:scale-110
                                            ${i === 0 ? 'bg-amber-400' : i === 1 ? 'bg-slate-400' : i === 2 ? 'bg-amber-700/60' : 'bg-slate-200 text-slate-500 shadow-none'}
                                        `}>
                                            {i + 1}
                                        </div>
                                        <div>
                                            <div className="text-xs font-black text-slate-800">{org.org_name}</div>
                                            <div className="text-[10px] text-slate-400 font-bold">{org.users_count} משתמשים פעילים</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs font-black text-emerald-600">{org.shifts_count}</div>
                                        <div className="text-[9px] text-slate-400 uppercase font-bold">פעולות</div>
                                    </div>
                                </div>
                            )) : (
                                <div className="text-center py-8 text-slate-400 text-xs italic">
                                    אין נתונים לטווח זה
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Engagement Analysis */}
                    <div className="bg-slate-50 rounded-xl md:rounded-2xl border border-slate-200/60 p-3 md:p-6">
                        <h4 className="font-black text-slate-800 mb-3 md:mb-6 flex items-center gap-2 text-xs md:text-sm border-b border-slate-200/60 pb-3 md:pb-4 uppercase tracking-wider">
                            <MousePointerClickIcon size={16} className="md:hidden text-indigo-500" weight="bold" />
                            <MousePointerClickIcon size={18} className="hidden md:block text-indigo-500" weight="bold" />
                            משתמשים מובילים
                        </h4>
                        <div className="space-y-2 md:space-y-3">
                            {topUsers.length > 0 ? topUsers.slice(0, 5).map((user: any, j: number) => (
                                <div key={user.email || j} className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-100 hover:border-indigo-200 transition-all group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-xs group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                            {(user.name || '?').substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="text-xs font-black text-slate-800">{user.name}</div>
                                            <div className="text-[10px] text-slate-400 font-mono truncate max-w-[150px]">{user.email}</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs font-black text-indigo-600">{user.count}</div>
                                        <div className="text-[9px] text-slate-400 uppercase font-bold">int.</div>
                                    </div>
                                </div>
                            )) : (
                                <div className="text-center py-8 text-slate-400 text-xs italic">
                                    אין נתונים לטווח זה
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Geo-Intelligence Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6">
                    {/* Geo Map */}
                    <div className="bg-slate-50 rounded-xl md:rounded-2xl border border-slate-200/60 p-3 md:p-6">
                        <h4 className="font-black text-slate-800 mb-3 md:mb-6 flex items-center gap-2 text-xs md:text-sm border-b border-slate-200/60 pb-3 md:pb-4 uppercase tracking-wider">
                            <GlobeIcon size={16} className="md:hidden text-emerald-600" weight="bold" />
                            <GlobeIcon size={18} className="hidden md:block text-emerald-600" weight="bold" />
                            מפת תפוצה
                        </h4>
                        <LocationMap data={mapData || []} total={totalActions} />
                    </div>

                    {/* Cities */}
                    <div className="bg-slate-50 rounded-xl md:rounded-2xl border border-slate-200/60 p-3 md:p-6 flex flex-col">
                        <h4 className="font-black text-slate-800 mb-3 md:mb-6 flex items-center gap-2 text-xs md:text-sm border-b border-slate-200/60 pb-3 md:pb-4 uppercase tracking-wider">
                            <MapPinIcon size={16} className="md:hidden text-blue-500" weight="bold" />
                            <MapPinIcon size={18} className="hidden md:block text-blue-500" weight="bold" />
                            ערים מובילות
                        </h4>
                        <div className="flex flex-wrap gap-1.5 md:gap-2 content-start">
                            {cityStats.length > 0 ? cityStats.map(city => (
                                <div key={city.name} className="px-4 py-2 bg-white text-slate-700 rounded-xl text-xs font-bold border border-slate-100 hover:border-blue-300 hover:text-blue-600 transition-all cursor-default flex justify-between gap-3 min-w-[120px] shadow-sm">
                                    <span>{city.name}</span>
                                    <span className="text-emerald-600 font-mono">{city.value}</span>
                                </div>
                            )) : <div className="text-slate-400 text-xs italic">אין נתונים עדיין...</div>}
                        </div>
                    </div>
                </div>
            </div>

            {/* Detailed List Modal */}
            {selectedMetric && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-0 md:p-4 animate-in fade-in duration-200" style={{ position: 'fixed' }}>
                    <div className="bg-white rounded-t-3xl md:rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] md:max-h-[80vh] flex flex-col animate-in slide-in-from-bottom md:zoom-in-95 duration-200 border border-white/20 safe-bottom pb-8 md:pb-0">
                        <div className="flex items-center justify-between p-4 md:p-5 border-b border-slate-100 bg-slate-50/50 rounded-t-3xl md:rounded-t-2xl">
                            <div>
                                <h3 className="text-base md:text-lg font-black text-slate-800">{selectedMetric.title}</h3>
                                <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedMetric.data.length} רשומות</p>
                            </div>
                            <button
                                onClick={() => setSelectedMetric(null)}
                                className="w-9 h-9 md:w-8 md:h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors active:scale-95"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256"><path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"></path></svg>
                            </button>
                        </div>
                        <div className="overflow-y-auto custom-scrollbar p-3 md:p-4 flex-1 space-y-1.5 md:space-y-2 pb-safe">
                            {selectedMetric.data.length > 0 ? selectedMetric.data.map((item: any, idx: number) => {
                                // Dynamic rendering based on type
                                const title = selectedMetric.type === 'orgs' ? (item.org_name || item.name) : (item.name || item.full_name);
                                const orgName = selectedMetric.type === 'users' ? item.org_name : null;
                                const sub = selectedMetric.type === 'orgs' ? (item.shifts_count ? `${item.shifts_count} פעולות` : new Date(item.created_at).toLocaleDateString()) : (item.email);
                                const count = item.count;

                                return (
                                    <div key={idx} className="flex items-center justify-between p-2.5 md:p-3 rounded-lg md:rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors active:scale-[0.98]">
                                        <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                                            <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-slate-100 flex items-center justify-center text-[11px] md:text-xs font-black text-slate-500 shrink-0">
                                                {idx + 1}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5 md:gap-2">
                                                    <div className="text-xs md:text-sm font-bold text-slate-800 truncate max-w-[140px] md:max-w-[200px]">{title}</div>
                                                    {orgName && (
                                                        <div className="text-[9px] md:text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 md:px-2 py-0.5 rounded-full truncate max-w-[80px] md:max-w-[120px]">
                                                            {orgName}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="text-[10px] md:text-[11px] text-slate-400 font-medium truncate">{sub}</div>
                                            </div>
                                        </div>
                                        {count && (
                                            <div className="text-right shrink-0">
                                                <div className="text-[11px] md:text-xs font-black text-emerald-600">{count}</div>
                                            </div>
                                        )}
                                    </div>
                                );
                            }) : (
                                <div className="text-center py-12 text-slate-400 text-sm flex flex-col items-center gap-2">
                                    <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center">
                                        <ActivityIcon size={24} className="opacity-20" />
                                    </div>
                                    אין נתונים להצגה
                                </div>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

// Helper Components
const KPICard: React.FC<{ title: string, value: number, sub: string, icon: any, color: string, pulse?: boolean, onClick?: () => void }> = ({ title, value, sub, icon, color, pulse, onClick }) => {
    const colors: any = {
        blue: "bg-blue-100 text-blue-600",
        indigo: "bg-indigo-100 text-indigo-600",
        emerald: "bg-emerald-100 text-emerald-600",
        amber: "bg-amber-100 text-amber-600",
        cyan: "bg-cyan-100 text-cyan-600"
    };

    return (
        <div
            onClick={onClick}
            className={`bg-slate-50 p-3 md:p-6 rounded-xl md:rounded-2xl border border-slate-200/60 transition-all hover:bg-white hover:shadow-md hover:border-slate-200 group ${onClick ? 'cursor-pointer active:scale-95' : ''}`}
        >
            <div className="flex justify-between items-start mb-2 md:mb-4">
                <div className={`p-2 md:p-3 rounded-xl md:rounded-2xl ${colors[color]} transition-colors bg-opacity-50 group-hover:bg-opacity-100`}>
                    {React.cloneElement(icon, { size: 18, className: 'md:hidden' })}
                    {React.cloneElement(icon, { size: 24, className: 'hidden md:block' })}
                </div>
                {pulse && <div className="flex h-2.5 w-2.5 md:h-3 md:w-3 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 md:h-3 md:w-3 bg-emerald-500"></span>
                </div>}
            </div>
            <h3 className="text-lg md:text-2xl font-black text-slate-800 mb-0.5 md:mb-1">{value.toLocaleString()}</h3>
            <p className="text-[9px] md:text-[11px] font-black text-slate-400 uppercase tracking-wider">{title}</p>
            <div className="mt-2 md:mt-4 pt-2 md:pt-4 border-t border-slate-200/60 flex items-center justify-between">
                <span className="text-[9px] md:text-[10px] font-bold text-slate-500 truncate">{sub}</span>
                <TrendingUpIcon size={10} className="md:hidden text-emerald-500 shrink-0" weight="bold" />
                <TrendingUpIcon size={12} className="hidden md:block text-emerald-500 shrink-0" weight="bold" />
            </div>
        </div>
    );
};

const CustomTooltip = ({ active, payload, label, color }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-slate-900/95 backdrop-blur-sm p-3 rounded-xl shadow-xl border border-slate-800 text-white">
                <p className="text-[10px] font-black uppercase text-slate-400 mb-1">{payload[0].payload.date}</p>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color || '#3b82f6' }} />
                    <span className="text-sm font-black">{payload[0].value} {label || 'פעולות'}</span>
                </div>
            </div>
        );
    }
    return null;
};

const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-slate-900/95 backdrop-blur-sm p-3 rounded-xl shadow-xl border border-slate-800 text-white">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: payload[0].payload.fill }} />
                    <span className="text-sm font-black">{payload[0].name}: {payload[0].value}</span>
                </div>
            </div>
        );
    }
    return null;
};
