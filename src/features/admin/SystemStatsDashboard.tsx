import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../auth/AuthContext';
import {
    Activity, Users, Building2, TrendingUp,
    ArrowUpRight, Trophy
} from 'lucide-react';
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
            <div className="flex items-center justify-center p-12">
                <Activity className="animate-spin text-emerald-600 mr-2" />
                <span className="text-slate-500">טוען נתונים...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="ארגונים במערכת"
                    value={stats.totalOrgs}
                    icon={<Building2 size={24} />}
                    color="blue"
                    subtext={`+${stats.newOrgsMonth} החודש`}
                />
                <StatCard
                    title="משתמשים רשומים"
                    value={stats.totalUsers}
                    icon={<Users size={24} />}
                    color="indigo"
                    subtext={`+${stats.newUsersMonth} החודש`}
                />
                <StatCard
                    title="פעילים כעת"
                    value={stats.activeUsersNow}
                    icon={<Activity size={24} />}
                    color="emerald"
                    subtext="ב-15 דקות האחרונות"
                    pulse
                />
                <StatCard
                    title="פעולות היום"
                    value={stats.actions24h}
                    icon={<TrendingUp size={24} />}
                    color="amber"
                    subtext="עומס מערכת"
                />
            </div>

            {/* Growth Stats Breakdown */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center">
                        <TrendingUp className="w-5 h-5 mr-2 text-rose-500" />
                        מדדי צמיחה
                    </h3>
                    <div className="flex bg-slate-100 p-1 rounded-lg text-xs font-medium">
                        {(['today', 'week', 'month'] as const).map((t) => (
                            <button
                                key={t}
                                onClick={() => setGrowthTimeframe(t)}
                                className={`px-4 py-1.5 rounded transition-all ${growthTimeframe === t ? 'bg-white shadow text-rose-600 font-bold' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                {t === 'today' ? 'היום' : t === 'week' ? 'השבוע' : 'החודש'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="flex items-center justify-between p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
                                <Building2 size={24} />
                            </div>
                            <div>
                                <h4 className="text-slate-500 text-sm font-medium">ארגונים חדשים</h4>
                                <div className="text-sm text-slate-400">
                                    {growthTimeframe === 'today' ? 'נוספו היום' : growthTimeframe === 'week' ? 'נוספו השבוע' : 'נוספו החודש'}
                                </div>
                            </div>
                        </div>
                        <div className="text-3xl font-bold text-slate-800">
                            {getGrowthValue('orgs')}
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-indigo-100 text-indigo-600 rounded-lg">
                                <Users size={24} />
                            </div>
                            <div>
                                <h4 className="text-slate-500 text-sm font-medium">משתמשים חדשים</h4>
                                <div className="text-sm text-slate-400">
                                    {growthTimeframe === 'today' ? 'הצטרפו היום' : growthTimeframe === 'week' ? 'הצטרפו השבוע' : 'הצטרפו החודש'}
                                </div>
                            </div>
                        </div>
                        <div className="text-3xl font-bold text-slate-800">
                            {getGrowthValue('users')}
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Activity Chart */}
                <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center">
                            <Activity className="w-5 h-5 mr-2 text-blue-500" />
                            פעילות מערכת
                        </h3>
                        <div className="flex bg-slate-100 p-1 rounded-lg text-xs font-medium">
                            <button
                                onClick={() => setActivityTimeframe('today')}
                                className={`px-3 py-1 rounded transition-all ${activityTimeframe === 'today' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                היום
                            </button>
                            <button
                                onClick={() => setActivityTimeframe('week')}
                                className={`px-3 py-1 rounded transition-all ${activityTimeframe === 'week' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                שבוע
                            </button>
                            <button
                                onClick={() => setActivityTimeframe('month')}
                                className={`px-3 py-1 rounded transition-all ${activityTimeframe === 'month' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                חודש
                            </button>
                        </div>
                    </div>

                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stats.activityData}>
                                <defs>
                                    <linearGradient id="colorActivity" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval={activityTimeframe === 'month' ? 3 : 0} />
                                <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorActivity)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* New Organizations List */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                        <Building2 className="w-5 h-5 mr-2 text-green-500" />
                        ארגונים חדשים
                    </h3>
                    <div className="space-y-4">
                        {newOrgs.map(org => (
                            <div key={org.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                                <div>
                                    <h4 className="font-bold text-slate-800 text-sm">{org.name}</h4>
                                    <p className="text-xs text-slate-500">{new Date(org.created_at).toLocaleDateString('he-IL')}</p>
                                </div>
                                <div className="text-xs font-medium bg-white px-2 py-1 rounded border border-slate-200 text-slate-600">
                                    {org.users_count} משתמשים
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Organizations Table */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center">
                            <Trophy className="w-5 h-5 mr-2 text-yellow-500" />
                            ארגונים מובילים (כל הזמנים)
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-slate-500">
                                <tr>
                                    <th className="px-4 py-2 text-right rounded-r-lg">שם ארגון</th>
                                    <th className="px-4 py-2 text-center">פעילות (30 יום)</th>
                                    <th className="px-4 py-2 text-center rounded-l-lg">משתמשים</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {topOrgs.length > 0 ? topOrgs.map((org, idx) => (
                                    <tr key={org.id} className="hover:bg-slate-50/50">
                                        <td className="px-4 py-3 font-medium flex items-center gap-2">
                                            <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${idx < 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-500'}`}>
                                                {idx + 1}
                                            </span>
                                            {org.name}
                                        </td>
                                        <td className="px-4 py-3 text-center text-slate-600 font-mono">
                                            {org.shifts_count}
                                        </td>
                                        <td className="px-4 py-3 text-center text-slate-600 font-mono">
                                            {org.users_count}
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={3} className="text-center py-6 text-slate-400">לא נמצאו נתונים</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* User Leaderboard */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center">
                            <Users className="w-5 h-5 mr-2 text-purple-500" />
                            משתמשים פעילים
                        </h3>
                        <div className="flex bg-slate-100 p-1 rounded-lg text-xs font-medium">
                            {(['today', 'week', 'month', 'all'] as const).map((t) => (
                                <button
                                    key={t}
                                    onClick={() => setUserLeaderboardTimeframe(t)}
                                    className={`px-3 py-1 rounded transition-all ${userLeaderboardTimeframe === t ? 'bg-white shadow text-purple-600 font-bold' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    {t === 'today' ? 'היום' : t === 'week' ? 'השבוע' : t === 'month' ? 'החודש' : 'הכל'}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-3">
                        {topUsers.map((user, idx) => (
                            <div key={`${user.id}-${idx}`} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${idx < 3 ? 'bg-purple-100 text-purple-700' : 'bg-slate-200 text-slate-600'}`}>
                                        {idx + 1}
                                    </div>
                                    <div>
                                        <div className="font-medium text-slate-800">{user.full_name}</div>
                                        <div className="text-xs text-slate-500">{user.org_name}</div>
                                    </div>
                                </div>
                                <div className="text-sm font-bold text-slate-600">
                                    {user.activity_count} פעולות
                                </div>
                            </div>
                        ))}
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
        blue: 'bg-blue-50 text-blue-600',
        indigo: 'bg-indigo-50 text-indigo-600',
        emerald: 'bg-emerald-50 text-emerald-600',
        amber: 'bg-amber-50 text-amber-600',
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow relative overflow-hidden">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-slate-500 text-sm font-medium mb-1">{title}</h3>
                    <div className="text-2xl font-bold text-slate-800">{value.toLocaleString()}</div>
                </div>
                <div className={`p-3 rounded-lg ${colorClasses[color] || 'bg-slate-100 text-slate-600'}`}>
                    {icon}
                </div>
            </div>
            <div className="text-xs text-slate-400 font-medium flex items-center">
                {pulse && <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />}
                {subtext}
            </div>
        </div>
    );
};

export default SystemStatsDashboard;
