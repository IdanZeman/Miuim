import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../auth/AuthContext';
import {
    Pulse as ActivityIcon,
    Users as UsersIcon,
    Buildings as Building2Icon,
    TrendUp as TrendingUpIcon,
    ArrowUpRight as ArrowUpRightIcon,
    Trophy as TrophyIcon
} from '@phosphor-icons/react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

interface SystemStats {
    totalOrgs: number;
    totalUsers: number;
    activeUsersNow: number;
    newUsersToday: number;
    newUsersWeek: number;
    newUsersMonth: number;
    newOrgsToday: number;
    newOrgsWeek: number;
    newOrgsMonth: number;
    actions24h: number;
    activityData: any[];
}

interface TopOrg {
    id: string;
    name: string;
    shifts_count: number;
    users_count: number;
    created_at: string;
}

interface TopUser {
    id: string;
    email: string;
    full_name: string;
    org_name: string;
    activity_count: number;
}

export const SystemStatsDashboard: React.FC = () => {
    const { user, profile } = useAuth();
    const [loading, setLoading] = useState(true);

    // Stats State
    const [stats, setStats] = useState<SystemStats>({
        totalOrgs: 0,
        totalUsers: 0,
        activeUsersNow: 0,
        newUsersToday: 0,
        newUsersWeek: 0,
        newUsersMonth: 0,
        newOrgsToday: 0,
        newOrgsWeek: 0,
        newOrgsMonth: 0,
        actions24h: 0,
        activityData: [],
    });

    const [topOrgs, setTopOrgs] = useState<TopOrg[]>([]);
    const [topUsers, setTopUsers] = useState<TopUser[]>([]);
    const [newOrgs, setNewOrgs] = useState<TopOrg[]>([]);

    // UI Controls
    const [userLeaderboardTimeframe, setUserLeaderboardTimeframe] = useState<'all' | 'month' | 'week' | 'today'>('week');
    const [growthTimeframe, setGrowthTimeframe] = useState<'today' | 'week' | 'month'>('today');
    const [activityTimeframe, setActivityTimeframe] = useState<'today' | 'week' | 'month'>('today');

    // Initial Load - KPIs and Static Lists only
    useEffect(() => {
        if (profile?.is_super_admin) {
            fetchStaticData();
        }
    }, [user, profile]);

    // Leaderboard Effect - Re-fetch when filter changes (Initial fetch handled here too)
    useEffect(() => {
        if (profile?.is_super_admin) {
            fetchTopUsers(userLeaderboardTimeframe);
        }
    }, [userLeaderboardTimeframe, user, profile]);

    // Activity Chart Effect - Re-fetch when filter changes (Initial fetch handled here too)
    useEffect(() => {
        if (profile?.is_super_admin) {
            fetchActivityChart(activityTimeframe);
        }
    }, [activityTimeframe, user, profile]);

    const fetchStaticData = async () => {
        // Only fetch things that don't depend on independent filters
        setLoading(true);
        try {
            await Promise.all([
                fetchKPIs(),
                fetchTopOrgs(),
                fetchNewOrgs()
            ]);
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchKPIs = async () => {
        const { data, error } = await supabase.rpc('get_dashboard_kpis');
        if (error) throw error;

        if (data) {
            setStats(prev => ({
                ...prev,
                totalOrgs: data.total_orgs,
                totalUsers: data.total_users,
                activeUsersNow: data.active_users_now,
                newUsersToday: data.new_users_today,
                newUsersWeek: data.new_users_week,
                newUsersMonth: data.new_users_month,
                newOrgsToday: data.new_orgs_today,
                newOrgsWeek: data.new_orgs_week,
                newOrgsMonth: data.new_orgs_month,
                actions24h: data.actions_24h,
            }));
        }
    };

    const fetchActivityChart = async (range: 'today' | 'week' | 'month') => {
        const { data, error } = await supabase.rpc('get_system_activity_chart', { time_range: range });
        if (error) console.error('Error fetching activity:', error);

        if (data) {
            // Map RPC result to chart format
            const activityData = data.map((d: any) => ({
                date: d.date_label,
                count: d.action_count
            }));
            setStats(prev => ({ ...prev, activityData }));
        }
    };

    const fetchTopOrgs = async () => {
        const { data, error } = await supabase.rpc('get_top_organizations', {
            time_range: 'month',
            limit_count: 10
        });

        if (error) console.error('Error fetching top orgs:', error);

        if (data) {
            setTopOrgs(data.map((org: any) => ({
                id: org.org_id,
                name: org.org_name,
                shifts_count: org.shifts_count,
                users_count: org.users_count
            })));
        }
    };

    const fetchNewOrgs = async () => {
        const { data, error } = await supabase.rpc('get_new_orgs_stats', { limit_count: 5 });

        if (error) console.error('Error fetching new orgs:', error);

        if (data) {
            setNewOrgs(data.map((o: any) => ({
                id: o.id,
                name: o.name,
                created_at: o.created_at,
                shifts_count: 0,
                users_count: o.users_count
            })));
        }
    };

    const fetchTopUsers = async (range: 'all' | 'month' | 'week' | 'today') => {
        // Map 'all' to a very long time range or handle in RPC
        const rpcRange = range === 'all' ? 'year' : range; // RPC supports today/week/month. 'year' will fall to default/all in SQL logic if not handled, checking SQL... SQL handles "else" as 1970.

        const { data, error } = await supabase.rpc('get_top_users', {
            time_range: rpcRange,
            limit_count: 10
        });

        if (error) console.error('Error fetching top users:', error);

        if (data) {
            setTopUsers(data.map((u: any) => ({
                id: u.user_id,
                email: u.email,
                full_name: u.full_name,
                org_name: u.org_name,
                activity_count: u.activity_count
            })));
        }
    };

    const getGrowthValue = (type: 'users' | 'orgs') => {
        if (type === 'orgs') {
            if (growthTimeframe === 'today') return stats.newOrgsToday;
            if (growthTimeframe === 'week') return stats.newOrgsWeek;
            return stats.newOrgsMonth;
        } else {
            if (growthTimeframe === 'today') return stats.newUsersToday;
            if (growthTimeframe === 'week') return stats.newUsersWeek;
            return stats.newUsersMonth;
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-6rem)]">
                <ActivityIcon className="animate-spin text-emerald-600 mb-4" size={32} weight="bold" />
                <span className="text-slate-500 font-bold text-sm">טוען נתונים...</span>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] border border-slate-200/60 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-6rem)] md:h-[calc(100vh-8rem)] relative z-20">
            {/* Premium Header */}
            <div className="flex items-center justify-between px-6 py-6 md:px-8 md:h-24 bg-white border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-sm shadow-emerald-100">
                        <ActivityIcon size={24} weight="bold" />
                    </div>
                    <div>
                        <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-none">מדדי מערכת</h2>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Global System Analytics</p>
                    </div>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 space-y-6">

                {/* Key Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                        title="ארגונים במערכת"
                        value={stats.totalOrgs}
                        icon={<Building2Icon size={24} weight="bold" />}
                        color="blue"
                        subtext={`+${stats.newOrgsMonth} החודש`}
                    />
                    <StatCard
                        title="משתמשים רשומים"
                        value={stats.totalUsers}
                        icon={<UsersIcon size={24} weight="bold" />}
                        color="indigo"
                        subtext={`+${stats.newUsersMonth} החודש`}
                    />
                    <StatCard
                        title="פעילים כעת"
                        value={stats.activeUsersNow}
                        icon={<ActivityIcon size={24} weight="bold" />}
                        color="emerald"
                        subtext="ב-15 דקות האחרונות"
                        pulse
                    />
                    <StatCard
                        title="פעולות היום"
                        value={stats.actions24h}
                        icon={<TrendingUpIcon size={24} weight="bold" />}
                        color="amber"
                        subtext="עומס מערכת"
                    />
                </div>

                {/* Growth Stats Breakdown */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200/60">
                    <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                        <h3 className="text-sm font-black text-slate-800 flex items-center uppercase tracking-wider">
                            <TrendingUpIcon className="w-5 h-5 mr-2 text-rose-500" weight="bold" />
                            מדדי צמיחה
                        </h3>
                        <div className="flex bg-white border border-slate-200/60 p-1 rounded-xl text-xs font-bold shadow-sm">
                            {(['today', 'week', 'month'] as const).map((t) => (
                                <button
                                    key={t}
                                    onClick={() => setGrowthTimeframe(t)}
                                    className={`px-4 py-1.5 rounded-lg transition-all ${growthTimeframe === t ? 'bg-slate-100 text-rose-600 font-bold' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    {t === 'today' ? 'היום' : t === 'week' ? 'השבוע' : 'החודש'}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-100 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                                    <Building2Icon size={24} weight="bold" />
                                </div>
                                <div>
                                    <h4 className="text-slate-500 text-xs font-bold uppercase tracking-wide">ארגונים חדשים</h4>
                                    <div className="text-[10px] text-slate-400 font-medium">
                                        {growthTimeframe === 'today' ? 'נוספו היום' : growthTimeframe === 'week' ? 'נוספו השבוע' : 'נוספו החודש'}
                                    </div>
                                </div>
                            </div>
                            <div className="text-3xl font-black text-slate-800 tracking-tight">
                                {getGrowthValue('orgs')}
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-100 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
                                    <UsersIcon size={24} weight="bold" />
                                </div>
                                <div>
                                    <h4 className="text-slate-500 text-xs font-bold uppercase tracking-wide">משתמשים חדשים</h4>
                                    <div className="text-[10px] text-slate-400 font-medium">
                                        {growthTimeframe === 'today' ? 'הצטרפו היום' : growthTimeframe === 'week' ? 'הצטרפו השבוע' : 'הצטרפו החודש'}
                                    </div>
                                </div>
                            </div>
                            <div className="text-3xl font-black text-slate-800 tracking-tight">
                                {getGrowthValue('users')}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Activity Chart */}
                    <div className="lg:col-span-2 bg-slate-50 p-6 rounded-2xl border border-slate-200/60">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-sm font-black text-slate-800 flex items-center uppercase tracking-wider">
                                <ActivityIcon className="w-5 h-5 mr-2 text-blue-500" weight="bold" />
                                פעילות מערכת
                            </h3>
                            <div className="flex bg-white border border-slate-200/60 p-1 rounded-xl text-xs font-bold shadow-sm">
                                <button
                                    onClick={() => setActivityTimeframe('today')}
                                    className={`px-3 py-1 rounded-lg transition-all ${activityTimeframe === 'today' ? 'bg-slate-100 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    היום
                                </button>
                                <button
                                    onClick={() => setActivityTimeframe('week')}
                                    className={`px-3 py-1 rounded-lg transition-all ${activityTimeframe === 'week' ? 'bg-slate-100 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    שבוע
                                </button>
                                <button
                                    onClick={() => setActivityTimeframe('month')}
                                    className={`px-3 py-1 rounded-lg transition-all ${activityTimeframe === 'month' ? 'bg-slate-100 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    חודש
                                </button>
                            </div>
                        </div>

                        <div className="h-[250px] w-full text-[10px] font-bold">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={stats.activityData}>
                                    <defs>
                                        <linearGradient id="colorActivity" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis dataKey="date" tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={activityTimeframe === 'month' ? 3 : 0} dy={10} />
                                    <YAxis tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', backgroundColor: 'rgba(15, 23, 42, 0.95)', color: '#fff' }} />
                                    <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorActivity)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* New Organizations List */}
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200/60">
                        <h3 className="text-sm font-black text-slate-800 mb-6 flex items-center uppercase tracking-wider">
                            <Building2Icon className="w-5 h-5 mr-2 text-green-500" weight="bold" />
                            ארגונים חדשים
                        </h3>
                        <div className="space-y-3">
                            {newOrgs.map(org => (
                                <div key={org.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl hover:border-green-200 transition-all shadow-sm">
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-xs">{org.name}</h4>
                                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">{new Date(org.created_at).toLocaleDateString('he-IL')}</p>
                                    </div>
                                    <div className="text-[10px] font-bold bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 text-slate-500">
                                        {org.users_count} users
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Top Organizations Table */}
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200/60">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-sm font-black text-slate-800 flex items-center uppercase tracking-wider">
                                <TrophyIcon className="w-5 h-5 mr-2 text-yellow-500" weight="bold" />
                                ארגונים מובילים (כל הזמנים)
                            </h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead className="bg-slate-100 text-slate-400 border-b border-slate-200">
                                    <tr>
                                        <th className="px-4 py-3 text-right font-bold uppercase tracking-wider rounded-tr-lg">שם ארגון</th>
                                        <th className="px-4 py-3 text-center font-bold uppercase tracking-wider">פעילות (30 יום)</th>
                                        <th className="px-4 py-3 text-center font-bold uppercase tracking-wider rounded-tl-lg">משתמשים</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {topOrgs.length > 0 ? topOrgs.map((org, idx) => (
                                        <tr key={org.id} className="hover:bg-white group transition-colors">
                                            <td className="px-4 py-3 font-bold flex items-center gap-2 group-hover:text-blue-600 transition-colors">
                                                <span className={`flex items-center justify-center w-5 h-5 rounded-md text-[10px] font-black ${idx < 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-200 text-slate-500'}`}>
                                                    {idx + 1}
                                                </span>
                                                {org.name}
                                            </td>
                                            <td className="px-4 py-3 text-center text-slate-500 font-mono font-medium">
                                                {org.shifts_count}
                                            </td>
                                            <td className="px-4 py-3 text-center text-slate-500 font-mono font-medium">
                                                {org.users_count}
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={3} className="text-center py-6 text-slate-400 italic">לא נמצאו נתונים</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* User Leaderboard */}
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200/60">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                            <h3 className="text-sm font-black text-slate-800 flex items-center uppercase tracking-wider">
                                <UsersIcon className="w-5 h-5 mr-2 text-purple-500" weight="bold" />
                                משתמשים פעילים
                            </h3>
                            <div className="flex bg-white border border-slate-200/60 p-1 rounded-xl text-xs font-bold shadow-sm">
                                {(['today', 'week', 'month', 'all'] as const).map((t) => (
                                    <button
                                        key={t}
                                        onClick={() => setUserLeaderboardTimeframe(t)}
                                        className={`px-3 py-1 rounded-lg transition-all ${userLeaderboardTimeframe === t ? 'bg-slate-100 text-purple-600' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        {t === 'today' ? 'היום' : t === 'week' ? 'שבוע' : t === 'month' ? 'חודש' : 'הכל'}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-2">
                            {topUsers.map((user, idx) => (
                                <div key={`${user.id}-${idx}`} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl hover:border-purple-200 hover:shadow-sm transition-all group">
                                    <div className="flex items-center gap-3">
                                        <div className={`flex items-center justify-center w-8 h-8 rounded-lg text-xs font-black transition-transform group-hover:scale-110 ${idx < 3 ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-500'}`}>
                                            {idx + 1}
                                        </div>
                                        <div>
                                            <div className="font-bold text-xs text-slate-800 mb-0.5">{user.full_name}</div>
                                            <div className="text-[10px] text-slate-400">{user.org_name}</div>
                                        </div>
                                    </div>
                                    <div className="text-[10px] font-black text-slate-600 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 group-hover:bg-purple-50 group-hover:text-purple-600 group-hover:border-purple-100 transition-colors">
                                        {user.activity_count} פעולות
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const StatCard: React.FC<{
    title: string;
    value: number;
    icon: React.ReactNode;
    color: string;
    subtext: string;
    pulse?: boolean;
}> = ({ title, value, icon, color, subtext, pulse }) => {
    const colorClasses: any = {
        blue: 'bg-blue-100/50 text-blue-600',
        indigo: 'bg-indigo-100/50 text-indigo-600',
        emerald: 'bg-emerald-100/50 text-emerald-600',
        amber: 'bg-amber-100/50 text-amber-600',
    };

    return (
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200/60 hover:border-slate-300 transition-all relative overflow-hidden group">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">{title}</h3>
                    <div className="text-2xl font-black text-slate-800 tracking-tight">{value.toLocaleString()}</div>
                </div>
                <div className={`p-3 rounded-xl ${colorClasses[color] || 'bg-slate-100 text-slate-600'} group-hover:scale-110 transition-transform`}>
                    {icon}
                </div>
            </div>
            <div className="text-[10px] text-slate-400 font-bold flex items-center bg-white/50 w-fit px-2 py-1 rounded-lg">
                {pulse && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2 animate-pulse" />}
                {subtext}
            </div>
        </div>
    );
};

export default SystemStatsDashboard;
