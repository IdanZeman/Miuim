import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../services/supabaseClient';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    CartesianGrid, AreaChart, Area, Cell, PieChart, Pie, Legend
} from 'recharts';
import {
    Trophy, Activity, Eye, TrendingUp, Users,
    Smartphone, Monitor, Globe, MapPin, MousePointerClick, Building2
} from 'lucide-react';
import { LocationMap } from './LocationMap';

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
        return (
            <div className="flex flex-col items-center justify-center p-24 text-slate-400 gap-4">
                <Activity className="animate-spin text-blue-500" size={32} />
                <div className="text-sm font-bold animate-pulse">מנתח נתוני מערכת גלובליים...</div>
            </div>
        );
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
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header & Controls */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                        <Activity className="text-blue-600" size={24} />
                        מרכז הבקרה הגלובלי
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">ניהול וניטור מערכתי בזמן אמת</p>
                </div>
                <div className="flex bg-slate-50 border border-slate-100 p-1.5 rounded-xl text-xs font-bold shadow-inner transition-all hover:bg-slate-100">
                    {(['today', 'week', 'month'] as const).map((t) => (
                        <button
                            key={t}
                            onClick={() => setTimeframe(t)}
                            className={`px-4 py-2 rounded-lg transition-all ${timeframe === t ? 'bg-white shadow-md text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            {t === 'today' ? 'היום' : t === 'week' ? '7 ימים' : '30 יום'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Principal KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard
                    title="ארגונים פעילים"
                    value={kpis.total_orgs || 0}
                    sub={`+${kpis.new_orgs_month || 0} החודש`}
                    icon={<Building2 size={24} />}
                    color="blue"
                />
                <KPICard
                    title="משתמשים רשומים"
                    value={kpis.total_users || 0}
                    sub={`+${kpis.new_users_month || 0} החודש`}
                    icon={<Users size={24} />}
                    color="indigo"
                />
                <KPICard
                    title="פעילים כעת"
                    value={kpis.active_users_now || 0}
                    sub="ב-15 דקות האחרונות"
                    icon={<Activity size={24} />}
                    color="emerald"
                    pulse
                />
                <KPICard
                    title="פעילות היום"
                    value={kpis.actions_24h || 0}
                    sub="עומס מערכת כולל"
                    icon={<TrendingUp size={24} />}
                    color="amber"
                />
                <KPICard
                    title="אינטראקציות"
                    value={totalClicks || 0}
                    sub="לחיצות כפתורים (Tracking)"
                    icon={<MousePointerClick size={24} />}
                    color="cyan"
                />
            </div>

            {/* Interaction Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 1. Activity Trend */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-2">
                    <div className="flex justify-between items-center mb-6 border-b border-slate-50 pb-4">
                        <h4 className="font-black text-slate-800 flex items-center gap-2 text-sm uppercase tracking-wider">
                            <TrendingUp size={18} className="text-blue-500" />
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
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} />
                                <YAxis axisLine={false} tickLine={false} />
                                <Tooltip content={<CustomTooltip />} />
                                <Area type="monotone" dataKey="count" stroke="#3b82f6" fillOpacity={1} fill="url(#colorTrend)" strokeWidth={4} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. Device Analysis */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h4 className="font-black text-slate-800 mb-6 flex items-center gap-2 text-sm border-b border-slate-50 pb-4 uppercase tracking-wider">
                        <Smartphone size={18} className="text-purple-500" />
                        התקני גישה
                    </h4>
                    <div className="h-64 w-full text-[10px] min-h-[256px]" dir="ltr">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={deviceStats}
                                    cx="50%"
                                    cy="45%"
                                    innerRadius={65}
                                    outerRadius={85}
                                    paddingAngle={8}
                                    dataKey="value"
                                    cornerRadius={6}
                                >
                                    {deviceStats.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomPieTooltip />} />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Tables Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Organizations (Growth Focus) */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h4 className="font-black text-slate-800 mb-6 flex items-center gap-2 text-sm border-b border-slate-50 pb-4 uppercase tracking-wider">
                        <Trophy size={18} className="text-emerald-500" />
                        ארגונים מובילים (פעילות חודשית)
                    </h4>
                    <div className="space-y-4">
                        {topOrgs.map((org: any, i: number) => (
                            <div key={org.org_id} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100 group">
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
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h4 className="font-black text-slate-800 mb-6 flex items-center gap-2 text-sm border-b border-slate-50 pb-4 uppercase tracking-wider">
                        <MousePointerClick size={18} className="text-indigo-500" />
                        משתמשים פעילים (Deep Engagement)
                    </h4>
                    <div className="space-y-4">
                        {topUsers.map((user: any, j: number) => (
                            <div key={user.email} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100 group">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-xs group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                        {user.name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="text-xs font-black text-slate-800">{user.name}</div>
                                        <div className="text-[10px] text-slate-400 font-mono">{user.email}</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs font-black text-indigo-600">{user.count}</div>
                                    <div className="text-[9px] text-slate-400 uppercase font-bold">אינטראקציות</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Geo-Intelligence Row */}
            {/* Geo-Intelligence Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Geo Map */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h4 className="font-black text-slate-800 mb-6 flex items-center gap-2 text-sm border-b border-slate-50 pb-4 uppercase tracking-wider">
                        <Globe size={18} className="text-emerald-600" />
                        מפת תפוצה (Live Map)
                    </h4>
                    <LocationMap data={stats?.mapData || []} total={totalActions} />
                </div>

                {/* Cities List & Pie Combo */}
                <div className="flex flex-col gap-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex-1">
                        <h4 className="font-black text-slate-800 mb-6 flex items-center gap-2 text-sm border-b border-slate-50 pb-4 uppercase tracking-wider">
                            <MapPin size={18} className="text-blue-500" />
                            ערים מובילות
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            {cityStats.length > 0 ? cityStats.map(city => (
                                <div key={city.name} className="px-4 py-2 bg-slate-50 text-slate-700 rounded-xl text-xs font-bold border border-slate-100 hover:bg-white hover:shadow-sm transition-all cursor-default flex justify-between gap-3 min-w-[120px]">
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
        blue: "bg-blue-50 text-blue-600 border-blue-100",
        indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
        emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
        amber: "bg-amber-50 text-amber-600 border-amber-100",
        cyan: "bg-cyan-50 text-cyan-600 border-cyan-100"
    };

    return (
        <div className={`bg-white p-6 rounded-2xl shadow-sm border border-slate-200 transition-all hover:shadow-md hover:-translate-y-1 group`}>
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-2xl ${colors[color]} transition-colors group-hover:scale-110 duration-300`}>
                    {icon}
                </div>
                {pulse && <div className="flex h-3 w-3 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </div>}
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-1">{value.toLocaleString()}</h3>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider">{title}</p>
            <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500">{sub}</span>
                <TrendingUp size={12} className="text-emerald-500" />
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

