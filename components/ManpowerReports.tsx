
import React, { useState, useMemo } from 'react';
import { Person, Team, Role } from '../types';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Users, Calendar, TrendingUp, AlertCircle, CheckCircle2, XCircle, LayoutGrid, List } from 'lucide-react';
import { Select } from './ui/Select';

interface ManpowerReportsProps {
    people: Person[];
    teams: Team[];
    roles: Role[];
}

export const ManpowerReports: React.FC<ManpowerReportsProps> = ({ people, teams, roles }) => {
    // State
    // State
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [viewMode, setViewMode] = useState<'daily' | 'trends'>('daily');
    const [selectedTeamId, setSelectedTeamId] = useState<string>('all');
    const [selectedRoleId, setSelectedRoleId] = useState<string>('all');

    const dateKey = selectedDate.toLocaleDateString('en-CA');

    // Helper: Get attendance for a specific date
    const getAttendanceForDate = (dateIso: string, subsetPeople: Person[]) => {
        let present = 0;
        let absent = 0;
        let total = subsetPeople.length;

        subsetPeople.forEach(p => {
            const availability = p.dailyAvailability?.[dateIso];
            // Default is available if not marked otherwise
            const isAvailable = availability ? availability.isAvailable : true;
            if (isAvailable) present++;
            else absent++;
        });

        return { present, absent, total, percentage: total > 0 ? Math.round((present / total) * 100) : 0 };
    };

    // Derived Data
    const stats = useMemo(() => {
        const filteredPeople = selectedTeamId === 'all'
            ? people
            : people.filter(p => p.teamId === selectedTeamId);

        // 1. Daily Snapshot Data
        const dailyStats = getAttendanceForDate(dateKey, filteredPeople);

        // 2. Role Breakdown (Daily)
        const roleBreakdown = roles.map(role => {
            if (selectedRoleId !== 'all' && role.id !== selectedRoleId) return null;
            const peopleWithRole = filteredPeople.filter(p => p.roleIds.includes(role.id));
            if (peopleWithRole.length === 0) return null;
            const roleStats = getAttendanceForDate(dateKey, peopleWithRole);
            return { ...role, ...roleStats };
        }).filter(Boolean);

        // 3. Team Breakdown (Daily - Only relevant if "All Org" is selected)
        const teamBreakdown = teams.map(team => {
            const teamPeople = people.filter(p => p.teamId === team.id);
            if (teamPeople.length === 0) return null;
            const teamStats = getAttendanceForDate(dateKey, teamPeople);
            return { name: team.name, ...teamStats, color: team.color };
        }).filter(Boolean);

        // 4. Trend Data (Last 14 Days)
        const trendData = [];
        for (let i = 13; i >= 0; i--) {
            const d = new Date(selectedDate);
            d.setDate(d.getDate() - i);
            const dKey = d.toLocaleDateString('en-CA');
            const dStats = getAttendanceForDate(dKey, filteredPeople);
            trendData.push({
                date: dKey.slice(5), // MM-DD
                percentage: dStats.percentage,
                present: dStats.present
            });
        }

        return { dailyStats, roleBreakdown, teamBreakdown, trendData };
    }, [people, selectedDate, selectedTeamId, selectedRoleId, roles, teams]);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header / Controls */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
                        {viewMode === 'daily' ? <LayoutGrid size={24} /> : <TrendingUp size={24} />}
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">
                            {viewMode === 'daily' ? 'תמונת מצב יומית' : 'מגמות וניתוח נתונים'}
                        </h2>
                        <p className="text-sm text-slate-500">דוח מפקדים - כוח אדם</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    {/* View Toggle */}
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button
                            onClick={() => setViewMode('daily')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'daily' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500'}`}
                        >
                            יומי
                        </button>
                        <button
                            onClick={() => setViewMode('trends')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'trends' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500'}`}
                        >
                            מגמות
                        </button>
                    </div>

                    <div className="h-8 w-px bg-slate-200 mx-1"></div>

                    {/* Date Picker */}
                    <div className="relative">
                        <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="date"
                            value={dateKey}
                            onChange={(e) => setSelectedDate(new Date(e.target.value))}
                            className="pl-4 pr-10 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Team Filter */}
                    <div className="w-60 md:w-60">
                        <Select
                            value={selectedTeamId}
                            onChange={setSelectedTeamId}
                            options={[{ value: 'all', label: 'כל הארגון' }, ...teams.map(t => ({ value: t.id, label: t.name }))]}
                        />
                    </div>

                </div>
            </div>

            {viewMode === 'daily' && (
                <>
                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <KPICard
                            title='מצבת כוח אדם'
                            value={stats.dailyStats.total}
                            icon={<Users size={24} />}
                            color="blue"
                        />
                        <KPICard
                            title='נוכחים'
                            value={stats.dailyStats.present}
                            subtext={`${stats.dailyStats.percentage}% מהכוח`}
                            icon={<CheckCircle2 size={24} />}
                            color="green"
                        />
                        <KPICard
                            title='חסרים'
                            value={stats.dailyStats.absent}
                            icon={<XCircle size={24} />}
                            color="red"
                        />
                        <KPICard
                            title='כשירות מבצעית'
                            value={`${stats.dailyStats.percentage}%`}
                            icon={<TrendingUp size={24} />}
                            color={stats.dailyStats.percentage > 80 ? 'emerald' : stats.dailyStats.percentage > 50 ? 'yellow' : 'red'}
                        />
                    </div>

                    {/* Role Breakdown Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <List size={20} className="text-slate-400" />
                                    זמינות לפי תפקיד
                                </h3>
                                <div className="w-60">
                                    <Select
                                        value={selectedRoleId}
                                        onChange={setSelectedRoleId}
                                        options={[{ value: 'all', label: 'כל התפקידים' }, ...roles.map(r => ({ value: r.id, label: r.name }))]}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                {stats.roleBreakdown.map((role: any) => (
                                    <div key={role.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                                        <div className={`absolute top-0 right-0 w-1 h-full bg-${role.percentage === 100 ? 'green' : role.percentage > 50 ? 'yellow' : 'red'}-500`}></div>
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="font-bold text-slate-700">{role.name}</span>
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${role.percentage === 100 ? 'bg-green-100 text-green-700' :
                                                role.percentage > 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                                                }`}>
                                                {role.percentage}%
                                            </span>
                                        </div>
                                        <div className="flex items-end gap-1">
                                            <span className="text-2xl font-bold text-slate-800">{role.present}</span>
                                            <span className="text-sm text-slate-400 mb-1">/ {role.total}</span>
                                        </div>
                                        {/* Mini Progress Bar */}
                                        <div className="w-full h-1.5 bg-slate-100 rounded-full mt-3 overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${role.percentage === 100 ? 'bg-green-500' : role.percentage > 50 ? 'bg-yellow-400' : 'bg-red-500'}`}
                                                style={{ width: `${role.percentage}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Team Comparison Chart (Vertical) */}
                        {selectedTeamId === 'all' && (
                            <div className="bg-white p-6 rounded-xl shadow-portal">
                                <h3 className="text-lg font-bold text-slate-800 mb-6">השוואה צוותית</h3>
                                <div className="h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={stats.teamBreakdown} layout="vertical" margin={{ left: 0, right: 30 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                            <XAxis type="number" domain={[0, 100]} hide />
                                            <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                                            <Tooltip
                                                cursor={{ fill: '#f8fafc' }}
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                            />
                                            <Bar dataKey="percentage" radius={[0, 4, 4, 0]} barSize={20} background={{ fill: '#f1f5f9', radius: [0, 4, 4, 0] }}>
                                                {stats.teamBreakdown.map((entry: any, index: number) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color?.replace('border-', 'bg-').replace('text-', 'bg-') || '#3b82f6'} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}

            {viewMode === 'trends' && (
                <div className="bg-white p-6 rounded-xl shadow-portal">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <TrendingUp className="text-blue-500" size={20} />
                        מגמת נוכחות (14 ימים אחרונים)
                    </h3>
                    <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stats.trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorAttendance" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} unit="%" />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    formatter={(value: number) => [`${value}%`, 'נוכחות']}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="percentage"
                                    stroke="#3b82f6"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorAttendance)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}
        </div>
    );
};

// Helper Component for KPI Cards
const KPICard: React.FC<{ title: string, value: string | number, subtext?: string, icon: React.ReactNode, color: string }> = ({ title, value, subtext, icon, color }) => {
    const colorClasses: Record<string, string> = {
        blue: 'bg-blue-50 text-blue-600',
        green: 'bg-green-50 text-green-600',
        red: 'bg-red-50 text-red-600',
        yellow: 'bg-yellow-50 text-yellow-600',
        emerald: 'bg-emerald-50 text-emerald-600',
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
            <div>
                <p className="text-slate-500 font-medium text-sm mb-1">{title}</p>
                <h3 className="text-3xl font-bold text-slate-800">{value}</h3>
                {subtext && <p className="text-xs text-slate-400 mt-1 font-medium">{subtext}</p>}
            </div>
            <div className={`p-3 rounded-xl ${colorClasses[color] || colorClasses.blue}`}>
                {icon}
            </div>
        </div>
    );
};
