import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import {
    Shield, Search, Filter, Download, RefreshCw,
    Activity, Users, Building2, AlertTriangle, Database,
    LayoutDashboard, List, Clock, Timer
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area, PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts';

interface LogEntry {
    id: string;
    created_at: string;
    event_type: string;
    event_category: string;
    action_description: string;
    entity_type: string;
    entity_id: string;
    user_id: string;
    user_email: string;
    user_name: string;
    organization_id: string;
    before_data: any;
    after_data: any;
}

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
    actionDistribution: any[];
    uniqueUsersData: any[];
    hourlyActivityData: any[];
    sessionDurationData: any[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export const AdminLogsViewer: React.FC = () => {
    const { user } = useAuth();
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const [hideMyLogs, setHideMyLogs] = useState(false);
    const [limit, setLimit] = useState(100);
    const [viewMode, setViewMode] = useState<'dashboard' | 'logs'>('dashboard');
    const [activityRange, setActivityRange] = useState<'day' | 'week' | 'month'>('week');

    // Analytics State
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
        actionDistribution: [],
        uniqueUsersData: [],
        hourlyActivityData: [],
        sessionDurationData: []
    });

    useEffect(() => {
        if (user?.email === 'idanzeman@gmail.com') {
            fetchLogs();
            fetchKPIs();
        }
    }, [user, limit]);

    useEffect(() => {
        if (user?.email === 'idanzeman@gmail.com') {
            fetchChartData();
        }
    }, [user, activityRange]);

    const fetchKPIs = async () => {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayIso = today.toISOString();

            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            const weekIso = weekAgo.toISOString();

            const monthAgo = new Date();
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            const monthIso = monthAgo.toISOString();

            // 1. Counts
            const { count: orgsCount } = await supabase.from('organizations').select('*', { count: 'exact', head: true });
            const { count: usersCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
            
            // New Orgs
            const { count: newOrgsToday } = await supabase.from('organizations').select('*', { count: 'exact', head: true }).gte('created_at', todayIso);
            const { count: newOrgsWeek } = await supabase.from('organizations').select('*', { count: 'exact', head: true }).gte('created_at', weekIso);
            const { count: newOrgsMonth } = await supabase.from('organizations').select('*', { count: 'exact', head: true }).gte('created_at', monthIso);

            // New Users
            const { count: newUsersToday } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', todayIso);
            const { count: newUsersWeek } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', weekIso);
            const { count: newUsersMonth } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', monthIso);

            // Active Users (Last 15m)
            const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
            const { data: activeLogs } = await supabase
                .from('audit_logs')
                .select('user_id')
                .gte('created_at', fifteenMinsAgo)
                .neq('user_email', 'idanzeman@gmail.com'); // Filter admin
            const activeUsersNow = new Set(activeLogs?.map(l => l.user_id).filter(Boolean)).size;

            // Actions 24h
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            const { count: actions24h } = await supabase
                .from('audit_logs')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', oneDayAgo)
                .neq('user_email', 'idanzeman@gmail.com'); // Filter admin

            setStats(prev => ({
                ...prev,
                totalOrgs: orgsCount || 0,
                totalUsers: usersCount || 0,
                activeUsersNow,
                newUsersToday: newUsersToday || 0,
                newUsersWeek: newUsersWeek || 0,
                newUsersMonth: newUsersMonth || 0,
                newOrgsToday: newOrgsToday || 0,
                newOrgsWeek: newOrgsWeek || 0,
                newOrgsMonth: newOrgsMonth || 0,
                actions24h: actions24h || 0,
            }));

        } catch (error) {
            console.error('Error fetching KPIs:', error);
        }
    };

    const fetchChartData = async () => {
        try {
            const now = new Date();
            let startDate = new Date();
            
            if (activityRange === 'day') {
                startDate.setHours(startDate.getHours() - 24);
            } else if (activityRange === 'week') {
                startDate.setDate(startDate.getDate() - 7);
            } else if (activityRange === 'month') {
                startDate.setDate(startDate.getDate() - 30);
            }

            const { data: chartLogs } = await supabase
                .from('audit_logs')
                .select('created_at, event_type, user_id')
                .gte('created_at', startDate.toISOString())
                .neq('user_email', 'idanzeman@gmail.com'); // Filter admin

            if (!chartLogs) return;

            // Process Activity Data
            const activityMap = new Map();
            const actionMap = new Map();
            const uniqueUsersMap = new Map<string, Set<string>>();
            const hourlyMap = new Array(24).fill(0);
            const userSessions: Record<string, Date[]> = {};

            // Initialize map based on range to ensure 0 values are shown
            if (activityRange === 'day') {
                for (let i = 0; i < 24; i++) {
                    const d = new Date(now);
                    d.setHours(d.getHours() - i);
                    const key = d.getHours().toString().padStart(2, '0') + ':00';
                    activityMap.set(key, 0);
                    uniqueUsersMap.set(key, new Set());
                }
            } else {
                const days = activityRange === 'week' ? 7 : 30;
                for (let i = 0; i < days; i++) {
                    const d = new Date(now);
                    d.setDate(d.getDate() - i);
                    const key = d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
                    activityMap.set(key, 0);
                    uniqueUsersMap.set(key, new Set());
                }
            }

            chartLogs.forEach(log => {
                let key;
                const logDate = new Date(log.created_at);
                
                if (activityRange === 'day') {
                    key = logDate.getHours().toString().padStart(2, '0') + ':00';
                } else {
                    key = logDate.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
                }

                if (activityMap.has(key)) {
                    activityMap.set(key, activityMap.get(key) + 1);
                }

                if (uniqueUsersMap.has(key) && log.user_id) {
                    uniqueUsersMap.get(key)?.add(log.user_id);
                }

                const hour = logDate.getHours();
                hourlyMap[hour]++;

                actionMap.set(log.event_type, (actionMap.get(log.event_type) || 0) + 1);

                // Collect timestamps for session calculation
                if (log.user_id) {
                    if (!userSessions[log.user_id]) userSessions[log.user_id] = [];
                    userSessions[log.user_id].push(logDate);
                }
            });

            // Calculate Sessions
            const sessionDurations: number[] = [];
            Object.values(userSessions).forEach(timestamps => {
                timestamps.sort((a, b) => a.getTime() - b.getTime());
                if (timestamps.length === 0) return;

                let sessionStart = timestamps[0];
                let lastTime = timestamps[0];

                for (let i = 1; i < timestamps.length; i++) {
                    const currentTime = timestamps[i];
                    const diffMinutes = (currentTime.getTime() - lastTime.getTime()) / (1000 * 60);
                    
                    if (diffMinutes > 30) { // 30 min timeout for session
                        const duration = (lastTime.getTime() - sessionStart.getTime()) / (1000 * 60);
                        sessionDurations.push(duration);
                        sessionStart = currentTime;
                    }
                    lastTime = currentTime;
                }
                // Add last session
                const lastDuration = (lastTime.getTime() - sessionStart.getTime()) / (1000 * 60);
                sessionDurations.push(lastDuration);
            });

            // Bucketize Sessions
            const sessionBuckets = {
                '0-1 דק׳': 0,
                '1-5 דק׳': 0,
                '5-15 דק׳': 0,
                '15-30 דק׳': 0,
                '30+ דק׳': 0
            };

            sessionDurations.forEach(d => {
                if (d < 1) sessionBuckets['0-1 דק׳']++;
                else if (d < 5) sessionBuckets['1-5 דק׳']++;
                else if (d < 15) sessionBuckets['5-15 דק׳']++;
                else if (d < 30) sessionBuckets['15-30 דק׳']++;
                else sessionBuckets['30+ דק׳']++;
            });

            const sessionDurationData = Object.entries(sessionBuckets).map(([name, count]) => ({ name, count }));

            let activityData = Array.from(activityMap.entries())
                .map(([date, count]) => ({ date, count }));
            
            let uniqueUsersData = Array.from(uniqueUsersMap.entries())
                .map(([date, set]) => ({ date, count: set.size }));

            const hourlyActivityData = hourlyMap.map((count, hour) => ({
                hour: `${hour.toString().padStart(2, '0')}:00`,
                count
            }));

            // Sort logic
            if (activityRange === 'day') {
                activityData.reverse(); 
                uniqueUsersData.reverse();
            } else {
                const sortFn = (a: any, b: any) => {
                    const [d1, m1] = a.date.split('.');
                    const [d2, m2] = b.date.split('.');
                    return new Date(2024, parseInt(m1) - 1, parseInt(d1)).getTime() - new Date(2024, parseInt(m2) - 1, parseInt(d2)).getTime();
                };
                activityData.sort(sortFn);
                uniqueUsersData.sort(sortFn);
            }

            const actionDistribution = Array.from(actionMap.entries())
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 5); // Top 5 actions

            setStats(prev => ({
                ...prev,
                activityData,
                actionDistribution,
                uniqueUsersData,
                hourlyActivityData,
                sessionDurationData
            }));

        } catch (error) {
            console.error('Error fetching chart data:', error);
        }
    };

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('audit_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;
            setLogs(data || []);
        } catch (error) {
            console.error('Error fetching logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredLogs = logs.filter(log => {
        const matchesSearch =
            log.event_type?.toLowerCase().includes(filter.toLowerCase()) ||
            log.action_description?.toLowerCase().includes(filter.toLowerCase()) ||
            log.user_email?.toLowerCase().includes(filter.toLowerCase()) ||
            log.user_name?.toLowerCase().includes(filter.toLowerCase()) ||
            log.entity_type?.toLowerCase().includes(filter.toLowerCase());

        const matchesUser = hideMyLogs ? log.user_email !== 'idanzeman@gmail.com' : true;

        return matchesSearch && matchesUser;
    });

    const getCategoryColor = (category: string) => {
        switch (category) {
            case 'security': return 'bg-red-100 text-red-700 border-red-200';
            case 'scheduling': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'data': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    if (user?.email !== 'idanzeman@gmail.com') {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400">
                <Shield size={64} className="mb-4 opacity-20" />
                <h2 className="text-xl font-bold">Access Denied</h2>
                <p>This area is restricted to system administrators.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-4 md:p-8 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white text-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
                        <Shield className="text-emerald-600" />
                        System Admin Center
                    </h1>
                    <p className="text-slate-500 mt-1">ניטור, בקרה ולוגים של המערכת</p>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button
                        onClick={() => setViewMode('dashboard')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${viewMode === 'dashboard' ? 'bg-white text-emerald-600 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <LayoutDashboard size={18} />
                        <span>דשבורד</span>
                    </button>
                    <button
                        onClick={() => setViewMode('logs')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${viewMode === 'logs' ? 'bg-white text-emerald-600 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <List size={18} />
                        <span>לוגים גולמיים</span>
                    </button>
                </div>
            </div>

            {viewMode === 'dashboard' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <p className="text-slate-500 text-sm font-medium">ארגונים</p>
                                    <h3 className="text-3xl font-bold text-slate-800">{stats.totalOrgs}</h3>
                                </div>
                                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Building2 size={24} /></div>
                            </div>
                            <div className="flex gap-2 text-xs text-slate-500 mt-2 pt-2 border-t border-slate-100">
                                <span title="היום" className="flex items-center gap-1"><span className="font-bold text-green-600">+{stats.newOrgsToday}</span> היום</span>
                                <span className="text-slate-300">|</span>
                                <span title="השבוע" className="flex items-center gap-1"><span className="font-bold text-slate-700">+{stats.newOrgsWeek}</span> שבוע</span>
                                <span className="text-slate-300">|</span>
                                <span title="החודש" className="flex items-center gap-1"><span className="font-bold text-slate-700">+{stats.newOrgsMonth}</span> חודש</span>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <p className="text-slate-500 text-sm font-medium">משתמשים</p>
                                    <h3 className="text-3xl font-bold text-slate-800">{stats.totalUsers}</h3>
                                </div>
                                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl"><Users size={24} /></div>
                            </div>
                            <div className="flex gap-2 text-xs text-slate-500 mt-2 pt-2 border-t border-slate-100">
                                <span title="היום" className="flex items-center gap-1"><span className="font-bold text-green-600">+{stats.newUsersToday}</span> היום</span>
                                <span className="text-slate-300">|</span>
                                <span title="השבוע" className="flex items-center gap-1"><span className="font-bold text-slate-700">+{stats.newUsersWeek}</span> שבוע</span>
                                <span className="text-slate-300">|</span>
                                <span title="החודש" className="flex items-center gap-1"><span className="font-bold text-slate-700">+{stats.newUsersMonth}</span> חודש</span>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                            <div>
                                <p className="text-slate-500 text-sm font-medium">משתמשים פעילים כעת</p>
                                <h3 className="text-3xl font-bold text-emerald-600">{stats.activeUsersNow}</h3>
                                <p className="text-xs text-slate-400 mt-1">ב-15 דקות האחרונות</p>
                            </div>
                            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl animate-pulse"><Activity size={24} /></div>
                        </div>
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                            <div>
                                <p className="text-slate-500 text-sm font-medium">פעולות (24 שעות)</p>
                                <h3 className="text-3xl font-bold text-slate-800">{stats.actions24h}</h3>
                            </div>
                            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl"><Activity size={24} /></div>
                        </div>
                    </div>

                    {/* Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <Activity size={20} className="text-blue-500" />
                                    נפח פעילות
                                </h3>
                                <div className="flex bg-slate-100 p-1 rounded-lg">
                                    <button
                                        onClick={() => setActivityRange('day')}
                                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${activityRange === 'day' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}
                                    >
                                        יום
                                    </button>
                                    <button
                                        onClick={() => setActivityRange('week')}
                                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${activityRange === 'week' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}
                                    >
                                        שבוע
                                    </button>
                                    <button
                                        onClick={() => setActivityRange('month')}
                                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${activityRange === 'month' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}
                                    >
                                        חודש
                                    </button>
                                </div>
                            </div>
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={stats.activityData}>
                                        <defs>
                                            <linearGradient id="colorActivity" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="date" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                        <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorActivity)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <h3 className="text-lg font-bold text-slate-800 mb-6">פעולות נפוצות</h3>
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={stats.actionDistribution}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={100}
                                            paddingAngle={2}
                                            dataKey="value"
                                        >
                                            {stats.actionDistribution.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip 
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                        />
                                        <Legend 
                                            layout="vertical" 
                                            verticalAlign="middle" 
                                            align="right"
                                            iconType="circle"
                                            wrapperStyle={{ fontSize: '12px', fontFamily: 'sans-serif' }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Engagement Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                                <Users size={20} className="text-indigo-500" />
                                משתמשים פעילים ייחודיים
                            </h3>
                            <div className="h-[250px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={stats.uniqueUsersData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="date" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                        <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: '#6366f1' }} activeDot={{ r: 6 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                                <Clock size={20} className="text-amber-500" />
                                פעילות לפי שעות היממה
                            </h3>
                            <div className="h-[250px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={stats.hourlyActivityData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="hour" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval={2} />
                                        <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                        <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Session Duration Chart */}
                    <div className="grid grid-cols-1 gap-6">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                                <Timer size={20} className="text-purple-500" />
                                התפלגות זמן סשיין (משוער)
                            </h3>
                            <div className="h-[250px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={stats.sessionDurationData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                        <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={40} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {viewMode === 'logs' && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Controls */}
                    <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-4 justify-between bg-slate-50/50">
                        <div className="flex items-center gap-2 flex-1">
                            <div className="relative flex-1 max-w-md">
                                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="חיפוש (פעולה, משתמש, ישות...)"
                                    value={filter}
                                    onChange={(e) => setFilter(e.target.value)}
                                    className="w-full pr-10 pl-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            <button
                                onClick={() => setHideMyLogs(!hideMyLogs)}
                                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${hideMyLogs
                                        ? 'bg-blue-50 border-blue-200 text-blue-700'
                                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                    }`}
                            >
                                הסתר פעולות שלי
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            <select
                                value={limit}
                                onChange={(e) => setLimit(Number(e.target.value))}
                                className="bg-white px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 cursor-pointer"
                            >
                                <option value="50">50 אחרונים</option>
                                <option value="100">100 אחרונים</option>
                                <option value="500">500 אחרונים</option>
                            </select>
                            <button
                                onClick={fetchLogs}
                                className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
                                title="רענן"
                            >
                                <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                            </button>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-right">
                            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-3 whitespace-nowrap w-40">זמן</th>
                                    <th className="px-4 py-3 whitespace-nowrap w-24">קטגוריה</th>
                                    <th className="px-4 py-3 whitespace-nowrap w-32">סוג אירוע</th>
                                    <th className="px-4 py-3 whitespace-nowrap w-64">תיאור</th>
                                    <th className="px-4 py-3 whitespace-nowrap w-48">משתמש</th>
                                    <th className="px-4 py-3 whitespace-nowrap">ישות מושפעת</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredLogs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors group">
                                        <td className="px-4 py-3 text-slate-500" dir="ltr">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-700 text-xs">
                                                    {new Date(log.created_at).toLocaleDateString('he-IL')}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-mono">
                                                    {new Date(log.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
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
                                            <div className="text-slate-800 font-medium truncate max-w-[150px]" title={log.user_email}>
                                                {log.user_name || log.user_email || 'System'}
                                            </div>
                                            <div className="text-[10px] text-slate-400 font-mono truncate max-w-[150px]">
                                                {log.user_email}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-medium text-slate-700">{log.entity_type}</span>
                                                <span className="text-[10px] text-slate-400 font-mono truncate max-w-[150px]">{log.entity_id}</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredLogs.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                                            לא נמצאו לוגים התואמים את החיפוש
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};
