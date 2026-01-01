import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
        queryKey: ['globalStats', timeframe],
        queryFn: async () => {
            const startDate = getDateFilter();

            // 1. Fetch KPIs and more efficient system stats via RPC
            const [kpiRes, activityRes, topOrgsRes, newOrgsRes] = await Promise.all([
                supabase.rpc('get_dashboard_kpis'),
                supabase.rpc('get_system_activity_chart', { time_range: timeframe }),
                supabase.rpc('get_top_organizations', { time_range: 'month', limit_count: 10 }),
                supabase.rpc('get_new_orgs_stats', { limit_count: 5 })
            ]);

            // 2. Fetch recent logs for deep interaction/geo metrics (clientside aggregation)
            const { data: logs, error: logsError } = await supabase
                .from('audit_logs')
                .select('*')
                .gte('created_at', startDate)
                .order('created_at', { ascending: false })
                .limit(2000);

            if (logsError) throw logsError;

            // -- Aggregation Logic for Geo/Devices --
            const deviceCounts: Record<string, number> = { 'Desktop': 0, 'Mobile': 0, 'Tablet': 0 };
            const countryCounts: Record<string, number> = {};
            const cityCounts: Record<string, number> = {};
            let totalClicks = 0;
            const userCounts: Record<string, { count: number, email: string }> = {};

            const locationCounts: Record<string, { count: number, lat?: number, lon?: number, label: string }> = {};

            logs.forEach(log => {
                // Devices
                const device = log.metadata?.device_type || log.device_type || 'Desktop';
                if (deviceCounts[device] !== undefined) deviceCounts[device]++;

                // Geo
                const country = log.metadata?.country || log.country;
                const city = log.metadata?.city || log.city;
                const lat = log.metadata?.latitude;
                const lon = log.metadata?.longitude;

                if (country) countryCounts[country] = (countryCounts[country] || 0) + 1;
                if (city) cityCounts[city] = (cityCounts[city] || 0) + 1;

                // Detailed Location Mapping
                // Prefer Lat/Lon if available, otherwise city/country name
                // We key by coordinates if possible to cluster effectively, or name if not
                let locKey = '';
                if (lat && lon) {
                    locKey = `${lat.toFixed(2)},${lon.toFixed(2)}`; // Cluster nearby
                } else if (city) {
                    locKey = city;
                } else if (country) {
                    locKey = country;
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

                    // Backfill lat/lon if we found a log that has it for this key (e.g. if key is city name)
                    if (!locationCounts[locKey].lat && lat) {
                        locationCounts[locKey].lat = lat;
                        locationCounts[locKey].lon = lon;
                    }
                }

                // Clicks
                if (log.event_type === 'CLICK') totalClicks++;

                // Users
                const name = log.user_name || 'System';
                if (!userCounts[name]) userCounts[name] = { count: 0, email: log.user_email };
                userCounts[name].count++;
            });

            // Convert locationCounts to Map Data
            const mapData = Object.values(locationCounts).map(l => ({
                name: l.label,
                value: l.count,
                lat: l.lat,
                lon: l.lon
            }));

            const activityTrend = (activityRes.data || []).map((d: any) => ({
                date: d.date_label,
                count: d.action_count
            }));

            const deviceStats = Object.entries(deviceCounts)
                .map(([name, value]) => ({ name, value }))
                .filter(d => d.value > 0);

            const geoStats = Object.entries(countryCounts)
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 5);

            const cityStats = Object.entries(cityCounts)
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 5);

            const topUsers = Object.entries(userCounts)
                .map(([name, data]) => ({ name, email: data.email, count: data.count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);

            return {
                kpis: kpiRes.data,
                activityTrend,
                deviceStats,
                geoStats, // Keeping for tables logic if needed, but Map will use mapData
                mapData, // New prop
                cityStats,
                topUsers,
                topOrgs: topOrgsRes.data || [],
                newOrgs: newOrgsRes.data || [],
                totalClicks,
                totalActions: logs?.length || 0
            };
        },
        staleTime: 1000 * 30, // 30 seconds for near real-time updates
    });

    if (isLoading) {
        return <DashboardSkeleton />;
    }

    const {
        kpis, activityTrend, deviceStats, geoStats,
        cityStats, topUsers, topOrgs, newOrgs, totalClicks, totalActions
    } = stats || {
        kpis: {}, activityTrend: [], deviceStats: [],
        geoStats: [], cityStats: [], topUsers: [],
        topOrgs: [], newOrgs: [], totalClicks: 0, totalActions: 0
    };

    return (
        <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] border border-slate-200/60 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-6rem)] md:h-[calc(100vh-8rem)] relative z-20">
            {/* Premium Header */}
            <div className="flex flex-col md:flex-row items-center justify-between px-6 py-6 md:px-8 md:h-24 bg-white border-b border-slate-100 shrink-0 gap-4">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-sm shadow-blue-100">
                        <ActivityIcon size={24} weight="duotone" />
                    </div>
                    <div>
                        <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-none">מרכז הבקרה הגלובלי</h3>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Real-time System Monitoring</p>
                    </div>
                </div>

                <div className="flex bg-slate-50 border border-slate-200/60 p-1 rounded-xl text-xs font-bold shadow-none">
                    {(['today', 'week', 'month'] as const).map((t) => (
                        <button
                            key={t}
                            onClick={() => setTimeframe(t)}
                            className={`px-4 py-2 rounded-lg transition-all ${timeframe === t ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            {t === 'today' ? 'היום' : t === 'week' ? '7 ימים' : '30 יום'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Scrollable Dashboard Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 space-y-6">

                {/* Principal KPIs */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <KPICard
                        title="ארגונים פעילים"
                        value={kpis.total_orgs || 0}
                        sub={`+${kpis.new_orgs_month || 0} החודש`}
                        icon={<Building2Icon size={24} weight="duotone" />}
                        color="blue"
                    />
                    <KPICard
                        title="משתמשים רשומים"
                        value={kpis.total_users || 0}
                        sub={`+${kpis.new_users_month || 0} החודש`}
                        icon={<UsersIcon size={24} weight="duotone" />}
                        color="indigo"
                    />
                    <KPICard
                        title="פעילים כעת"
                        value={kpis.active_users_now || 0}
                        sub="ב-15 דקות האחרונות"
                        icon={<ActivityIcon size={24} weight="duotone" />}
                        color="emerald"
                        pulse
                    />
                    <KPICard
                        title="פעילות היום"
                        value={kpis.actions_24h || 0}
                        sub="עומס מערכת כולל"
                        icon={<TrendingUpIcon size={24} weight="duotone" />}
                        color="amber"
                    />
                    {/* Optional 5th KPI or remove/stack */}
                </div>

                {/* Interaction Row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* 1. Activity Trend */}
                    <div className="bg-slate-50 rounded-2xl border border-slate-200/60 p-6 lg:col-span-2">
                        <div className="flex justify-between items-center mb-6 border-b border-slate-200/60 pb-4">
                            <h4 className="font-black text-slate-800 flex items-center gap-2 text-sm uppercase tracking-wider">
                                <TrendingUpIcon size={18} className="text-blue-500" weight="duotone" />
                                מגמות פעילות
                            </h4>
                            <div className="text-[10px] font-bold text-slate-400">Total: {activityTrend.reduce((acc: number, curr: any) => acc + curr.count, 0)} actions</div>
                        </div>
                        <div className="h-64 w-full text-[10px] min-h-[256px]" dir="ltr">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={activityTrend}>
                                    <defs>
                                        <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Area type="monotone" dataKey="count" stroke="#3b82f6" fillOpacity={1} fill="url(#colorTrend)" strokeWidth={3} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* 2. Device Analysis */}
                    <div className="bg-slate-50 rounded-2xl border border-slate-200/60 p-6">
                        <h4 className="font-black text-slate-800 mb-6 flex items-center gap-2 text-sm border-b border-slate-200/60 pb-4 uppercase tracking-wider">
                            <SmartphoneIcon size={18} className="text-purple-500" weight="duotone" />
                            התקני גישה
                        </h4>
                        <div className="h-64 w-full text-[10px] min-h-[256px]" dir="ltr">
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
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Top Organizations */}
                    <div className="bg-slate-50 rounded-2xl border border-slate-200/60 p-6">
                        <h4 className="font-black text-slate-800 mb-6 flex items-center gap-2 text-sm border-b border-slate-200/60 pb-4 uppercase tracking-wider">
                            <TrophyIcon size={18} className="text-emerald-500" weight="duotone" />
                            ארגונים מובילים (פעילות חודשית)
                        </h4>
                        <div className="space-y-3">
                            {topOrgs.map((org: any, i: number) => (
                                <div key={org.org_id} className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-100 hover:border-blue-200 transition-all group">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs text-white shadow-sm transition-transform group-hover:scale-110
                                            ${i === 0 ? 'bg-amber-400' : i === 1 ? 'bg-slate-400' : i === 2 ? 'bg-amber-700/60' : 'bg-slate-200 text-slate-500 shadow-none'}
                                        `}>
                                            {i + 1}
                                        </div>
                                        <div>
                                            <div className="text-xs font-black text-slate-800">{org.org_name}</div>
                                            <div className="text-[10px] text-slate-400 font-bold">{org.users_count} משתמשים רשומים</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs font-black text-emerald-600">{org.shifts_count}</div>
                                        <div className="text-[9px] text-slate-400 uppercase font-bold">פעולות</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Engagement Analysis */}
                    <div className="bg-slate-50 rounded-2xl border border-slate-200/60 p-6">
                        <h4 className="font-black text-slate-800 mb-6 flex items-center gap-2 text-sm border-b border-slate-200/60 pb-4 uppercase tracking-wider">
                            <MousePointerClickIcon size={18} className="text-indigo-500" weight="bold" />
                            משתמשים פעילים (Deep Engagement)
                        </h4>
                        <div className="space-y-3">
                            {topUsers.map((user: any, j: number) => (
                                <div key={user.email} className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-100 hover:border-indigo-200 transition-all group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-xs group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                            {user.name.substring(0, 2).toUpperCase()}
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
                            ))}
                        </div>
                    </div>
                </div>

                {/* Geo-Intelligence Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Geo Map */}
                    <div className="bg-slate-50 rounded-2xl border border-slate-200/60 p-6">
                        <h4 className="font-black text-slate-800 mb-6 flex items-center gap-2 text-sm border-b border-slate-200/60 pb-4 uppercase tracking-wider">
                            <GlobeIcon size={18} className="text-emerald-600" weight="duotone" />
                            מפת תפוצה (Live Map)
                        </h4>
                        <LocationMap data={stats?.mapData || []} total={totalActions} />
                    </div>

                    {/* Cities */}
                    <div className="bg-slate-50 rounded-2xl border border-slate-200/60 p-6 flex flex-col">
                        <h4 className="font-black text-slate-800 mb-6 flex items-center gap-2 text-sm border-b border-slate-200/60 pb-4 uppercase tracking-wider">
                            <MapPinIcon size={18} className="text-blue-500" weight="duotone" />
                            ערים מובילות
                        </h4>
                        <div className="flex flex-wrap gap-2 content-start">
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
        </div>
    );
};

// Helper Components
const KPICard: React.FC<{ title: string, value: number, sub: string, icon: any, color: string, pulse?: boolean }> = ({ title, value, sub, icon, color, pulse }) => {
    const colors: any = {
        blue: "bg-blue-100 text-blue-600",
        indigo: "bg-indigo-100 text-indigo-600",
        emerald: "bg-emerald-100 text-emerald-600",
        amber: "bg-amber-100 text-amber-600",
        cyan: "bg-cyan-100 text-cyan-600"
    };

    return (
        <div className={`bg-slate-50 p-6 rounded-2xl border border-slate-200/60 transition-all hover:bg-white hover:shadow-md hover:border-slate-200 group`}>
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-2xl ${colors[color]} transition-colors bg-opacity-50 group-hover:bg-opacity-100`}>
                    {icon}
                </div>
                {pulse && <div className="flex h-3 w-3 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </div>}
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-1">{value.toLocaleString()}</h3>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider">{title}</p>
            <div className="mt-4 pt-4 border-t border-slate-200/60 flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500">{sub}</span>
                <TrendingUpIcon size={12} className="text-emerald-500" weight="bold" />
            </div>
        </div>
    );
};

const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-slate-900/95 backdrop-blur-sm p-3 rounded-xl shadow-xl border border-slate-800 text-white">
                <p className="text-[10px] font-black uppercase text-slate-400 mb-1">{payload[0].payload.date}</p>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-sm font-black">{payload[0].value} פעולות</span>
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

