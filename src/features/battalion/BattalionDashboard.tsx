import React from 'react';
import { useAuth } from '../../features/auth/AuthContext';
import { useBattalionData } from '../../hooks/useBattalionData';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Users, House as Home, Shield, ArrowLeft, CircleNotch as Loader2, TrendUp as TrendingUp } from '@phosphor-icons/react';

export const BattalionDashboard: React.FC<{ setView?: any }> = ({ setView }) => {
    const { organization } = useAuth();

    // Optimized Data Hook
    // Optimized Data Hook
    const {
        companies = [],
        people = [],
        presenceSummary = [],
        computedStats,
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
    const activeStrength = computedStats?.totalActive || 0;

    // Calculate global stats using computed logic (synchronized with Attendance Log)
    const presentOnBase = computedStats?.totalPresent || 0;
    const atHomeOrLeave = computedStats?.totalHome || 0;
    const notReportedCount = computedStats?.unreportedCount || 0;

    const chartData = companies.map(org => {
        const orgPeople = people.filter(p => p.organization_id === org.id);
        const orgTotalCount = orgPeople.length;

        const orgStats = computedStats?.companyStats[org.id] || { present: 0, total: 0, home: 0 };
        const orgActiveCount = orgStats.total;
        const orgPresentInSector = orgStats.present;
        const orgPresentHome = orgStats.home;

        // Tag logic: Sector Presence / Total Active
        const presencePercent = orgActiveCount > 0 ? Math.round((orgPresentInSector / orgActiveCount) * 100) : 0;

        // Legend logic (activity): Active / Total
        const activityPercent = orgTotalCount > 0 ? Math.round((orgActiveCount / orgTotalCount) * 100) : 0;

        return {
            name: org.name,
            percent: presencePercent, // Using presence for the primary tag
            activityPercent,
            active: orgActiveCount,
            total: orgTotalCount,
            presentInSector: orgPresentInSector,
            presentHome: orgPresentHome
        };
    }).sort((a, b) => b.percent - a.percent);

    return (
        <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm p-10 min-h-full">
            {/* Header Section */}
            <div className="mb-10">
                <div className="flex items-center gap-4 mb-2">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm">
                        <Users size={28} weight="bold" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">מבט גדודי יומי</h1>
                        <p className="text-slate-500 font-bold text-sm tracking-wide uppercase">תמונת מצב נוכחות ופעילות לוחמים</p>
                    </div>
                </div>
            </div>

            <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <StatCard
                        title="סד&quot;כ פעיל"
                        value={activeStrength}
                        icon={Users}
                        color="indigo"
                        subtitle={`מתוך ${totalStrength} רשומים`}
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
                    <StatCard
                        title="טרם דווחו"
                        value={notReportedCount}
                        icon={TrendingUp}
                        color="rose"
                        subtitle="חסר דיווח ביומן"
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Company Status List (Renamed to Line Attendance Status) */}
                    <div className="lg:col-span-1 bg-slate-50/50 rounded-3xl border border-slate-200 overflow-hidden flex flex-col h-fit">
                        <div className="p-6 border-b border-slate-200/60 flex items-center justify-between bg-white/50 backdrop-blur-sm">
                            <h2 className="text-lg font-black text-slate-900">סטטוס התייצבות לקו</h2>
                            <div className="bg-indigo-50 text-indigo-700 p-1.5 rounded-lg">
                                <TrendingUp size={18} />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto max-h-[500px] divide-y divide-slate-100">
                            {chartData.map((org, idx) => (
                                <div key={idx} className="p-4 hover:bg-white transition-colors group bg-transparent">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${org.activityPercent > 80 ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'
                                                }`}>
                                                {org.name.substring(0, 1)}
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-800 text-sm">{org.name}</p>
                                                <p className="text-[10px] font-bold text-slate-400" dir="ltr">{org.active} / {org.total}</p>
                                            </div>
                                        </div>
                                        <div className="text-left">
                                            <p className="font-black text-slate-900 text-sm">{org.activityPercent}%</p>
                                            <div className="w-16 h-1 bg-slate-200 rounded-full mt-1 overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${org.activityPercent > 80 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                                                    style={{ width: `${org.activityPercent}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={() => setView?.('battalion-personnel' as any)}
                            className="p-4 text-center text-xs font-bold text-blue-600 hover:bg-white transition-colors border-t border-slate-200 flex items-center justify-center gap-2 bg-white/50"
                        >
                            צפה בדוח כוח אדם מלא
                            <ArrowLeft size={14} />
                        </button>
                    </div>

                    {/* Main Grid: Company Cards */}
                    <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 h-fit">
                        {chartData.map((org, idx) => {
                            return (
                                <div key={idx} className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group flex flex-col">
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors shadow-inner">
                                                <Shield size={24} weight="bold" />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-black text-slate-900 leading-tight">{org.name}</h3>
                                                <p className="text-xs font-bold text-slate-400 tracking-wide uppercase">סטטוס פלוגתי</p>
                                            </div>
                                        </div>
                                        <div className={`px-3 py-1.5 rounded-full text-[10px] font-black border shadow-sm ${org.percent >= 80 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                            org.percent >= 50 ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                                'bg-rose-50 text-rose-600 border-rose-100'
                                            }`}>
                                            {org.percent}% נוכחים היום בגזרה
                                        </div>
                                    </div>

                                    <div className="mt-auto">
                                        <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">נוכחים היום בגזרה</p>
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-3xl font-black text-slate-900">{org.presentInSector}</span>
                                                <span className="text-sm font-bold text-slate-400">חיילים</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
                                            <span className="text-[11px] font-bold text-slate-600">{org.presentInSector} בגזרה</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.3)]" />
                                            <span className="text-[11px] font-bold text-slate-600">{org.presentHome} בבית</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
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
