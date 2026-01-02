import React from 'react';
import { useAuth } from '../../features/auth/AuthContext';
import { useBattalionData } from '../../hooks/useBattalionData';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Users, House as Home, Shield, ArrowLeft, CircleNotch as Loader2, TrendUp as TrendingUp } from '@phosphor-icons/react';

export const BattalionDashboard: React.FC<{ setView?: any }> = ({ setView }) => {
    const { organization } = useAuth();

    // Optimized Data Hook
    const {
        companies = [],
        people = [],
        presenceSummary = [],
        isLoading
    } = useBattalionData(organization?.battalion_id);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <Loader2 className="animate-spin text-indigo-600 mb-4" size={40} />
                <p className="text-slate-500 font-bold">טוען נתוני גדוד...</p>
            </div>
        );
    }

    const totalStrength = people.length;
    const activeStrength = people.filter(p => p.isActive !== false).length;
    const presentOnBase = presenceSummary.filter(p => p.status === 'base').length;
    const atHomeOrLeave = presenceSummary.filter(p => p.status === 'home' || p.status === 'leave').length;

    const chartData = companies.map(org => {
        const orgPeople = people.filter(p => p.organization_id === org.id);
        const orgPeopleCount = orgPeople.length;
        const orgActiveCount = orgPeople.filter(p => p.isActive !== false).length;
        const percent = orgPeopleCount > 0 ? Math.round((orgActiveCount / orgPeopleCount) * 100) : 0;

        return {
            name: org.name,
            percent,
            active: orgActiveCount,
            total: orgPeopleCount
        };
    }).sort((a, b) => b.percent - a.percent);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard
                    title="סד&quot;כ כללי"
                    value={activeStrength}
                    icon={Users}
                    color="indigo"
                    subtitle={`מתוך ${totalStrength} חיילים רשומים`}
                />
                <StatCard
                    title="נוכחים בגזרה"
                    value={presentOnBase}
                    icon={Shield}
                    color="emerald"
                    subtitle={`${activeStrength > 0 ? Math.round((presentOnBase / activeStrength) * 100) : 0}% מהפעילים`}
                />
                <StatCard
                    title="נמצאים בבית"
                    value={atHomeOrLeave}
                    icon={Home}
                    color="blue"
                    subtitle="בחופשה / אפטר / בית"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Presence Chart */}
                <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
                    <div className="flex items-center justify-between mb-8 border-b border-slate-50 pb-6">
                        <div>
                            <h2 className="text-xl font-black text-slate-900 tracking-tight">סטטוס התייצבות לקו</h2>
                            <p className="text-sm font-bold text-slate-400">אחוז חיילים פעילים מתוך כלל הסד"כ</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100">
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                                <span className="text-[10px] font-black text-slate-600">מעל 80%</span>
                            </div>
                            <div className="bg-indigo-50 text-indigo-700 p-2 rounded-xl">
                                <TrendingUp size={20} />
                            </div>
                        </div>
                    </div>

                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748b', fontWeight: 700, fontSize: 12 }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748b', fontWeight: 700, fontSize: 12 }}
                                    domain={[0, 100]}
                                    tickFormatter={(v) => `${v}%`}
                                />
                                <Tooltip
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const data = payload[0].payload;
                                            return (
                                                <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-xl border border-slate-800">
                                                    <p className="font-black mb-1">{data.name}</p>
                                                    <p className="text-xs text-slate-400 font-bold">{data.percent}% נוכחות</p>
                                                    <div className="mt-2 text-sm font-bold">
                                                        {data.active} מתוך {data.total}
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Bar dataKey="percent" radius={[8, 8, 0, 0]} barSize={40}>
                                    {chartData.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={entry.percent > 80 ? '#10b981' : entry.percent > 50 ? '#6366f1' : '#f43f5e'}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Company Status List */}
                <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
                    <div className="p-6 border-b border-slate-100">
                        <h2 className="text-lg font-black text-slate-900">סטטוס פלוגות</h2>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {chartData.map((org, idx) => (
                            <div key={idx} className="p-4 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 group">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${org.percent > 80 ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'
                                            }`}>
                                            {org.name.substring(0, 1)}
                                        </div>
                                        <div>
                                            <p className="font-black text-slate-800">{org.name}</p>
                                            <p className="text-xs font-bold text-slate-400">{org.active} פעילים מתוך {org.total}</p>
                                        </div>
                                    </div>
                                    <div className="text-left">
                                        <p className="font-black text-slate-900">{org.percent}%</p>
                                        <div className="w-20 h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${org.percent > 80 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                                                style={{ width: `${org.percent}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={() => setView?.('battalion-personnel' as any)}
                        className="p-4 text-center text-sm font-bold text-blue-600 hover:bg-blue-50 transition-colors border-t border-slate-100 flex items-center justify-center gap-2"
                    >
                        צפה בדוח כוח אדם מלא
                        <ArrowLeft size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};

const StatCard: React.FC<{ title: string; value: number; icon: any; color: string; subtitle: string }> = ({ title, value, icon: Icon, color, subtitle }) => {
    const colorClasses: Record<string, string> = {
        indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
        emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        blue: 'bg-blue-50 text-blue-600 border-blue-100',
        rose: 'bg-rose-50 text-rose-600 border-rose-100',
    };

    return (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-2xl border ${colorClasses[color]}`}>
                    <Icon size={24} />
                </div>
                <div className="text-left">
                    <span className="text-3xl font-black text-slate-900 tabular-nums">{value}</span>
                </div>
            </div>
            <h3 className="font-black text-slate-400 text-sm uppercase tracking-wide group-hover:text-slate-600 transition-colors">{title}</h3>
            <p className="text-xs font-bold text-slate-400 mt-1">{subtitle}</p>
        </div>
    );
};
