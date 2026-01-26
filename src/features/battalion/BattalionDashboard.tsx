import React, { useState } from 'react';
import { useAuth } from '../../features/auth/AuthContext';
import { useBattalionData } from '../../hooks/useBattalionData';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Users, House as Home, Shield, ArrowLeft, CircleNotch as Loader2, TrendUp as TrendingUp, ListChecks, Gear as Settings, ChartBar, Info } from '@phosphor-icons/react';
import { getEffectiveAvailability, isStatusPresent } from '../../utils/attendanceUtils';

// Sub-components for tabs
import { BattalionPersonnelTable } from './BattalionPersonnelTable';
import { BattalionAttendanceManager } from './BattalionAttendanceManager';
import { BattalionSettings } from './BattalionSettings';

// Helper to get min rest for a shift
const getShiftMinRest = (shift: any, taskTemplates: any[]) => {
    // 1. Try snapshot requirement
    if (shift.requirements?.minRest !== undefined) return shift.requirements.minRest;

    // 2. Try template lookup
    if (shift.taskId && shift.segmentId) {
        const template = taskTemplates.find((t: any) => t.id === shift.taskId);
        const segment = template?.segments?.find((s: any) => s.id === shift.segmentId);
        if (segment?.minRestHoursAfter !== undefined) return segment.minRestHoursAfter;
    }

    return 0; // Default
};

export const BattalionDashboard: React.FC<{ setView?: any }> = ({ setView }) => {
    const { organization } = useAuth();

    // Optimized Data Hook
    const {
        companies = [],
        people = [],
        shifts = [],
        taskTemplates = [],
        teamRotations = [],
        absences = [],
        hourlyBlockages = [],
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

    // Filter companies to exclude potentially the Battalion itself if it shows up as an organization
    const activeCompanies = companies.filter(c => c.org_type !== 'battalion');

    // Helper to check if a person is currently on a task
    const isPersonOnTask = (personId: string, now: Date) => {
        return shifts.some(s =>
            s.assignedPersonIds.includes(personId) &&
            !s.isCancelled &&
            new Date(s.startTime) <= now &&
            new Date(s.endTime) >= now
        );
    };

    // Helper to check if a person is "Recovering" (in min rest period after task)
    const isPersonRecovering = (personId: string, now: Date) => {
        // Find last finished shift
        const finishedShifts = shifts.filter(s =>
            s.assignedPersonIds.includes(personId) &&
            !s.isCancelled &&
            new Date(s.endTime) <= now
        );

        if (finishedShifts.length === 0) return false;

        // Get the most recent one
        const lastShift = finishedShifts.sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime())[0];

        const minRestHours = getShiftMinRest(lastShift, taskTemplates);
        if (!minRestHours || minRestHours <= 0) return false;

        const endTime = new Date(lastShift.endTime);
        const restEndTime = new Date(endTime.getTime() + minRestHours * 60 * 60 * 1000);

        return now < restEndTime;
    };

    // Calculate Company Load Stats
    const companyLoadStats = activeCompanies.map(comp => {
        const compPeople = people.filter(p => p.organization_id === comp.id && p.isActive !== false);

        let presentCount = 0;
        let onTaskCount = 0;
        let recoveringCount = 0;

        const now = new Date(); // Consistency for all checks

        compPeople.forEach(p => {
            const avail = getEffectiveAvailability(p, now, teamRotations, absences, hourlyBlockages);
            const isPresent = isStatusPresent(avail, now.getHours() * 60 + now.getMinutes());

            if (isPresent) {
                presentCount++;
                if (isPersonOnTask(p.id, now)) {
                    onTaskCount++;
                } else if (isPersonRecovering(p.id, now)) {
                    recoveringCount++;
                }
            }
        });

        const readyCount = Math.max(0, presentCount - onTaskCount - recoveringCount);

        const taskPercent = presentCount > 0 ? Math.round((onTaskCount / presentCount) * 100) : 0;
        const recoveringPercent = presentCount > 0 ? Math.round((recoveringCount / presentCount) * 100) : 0;
        // The remainder is ready percent, we calculate it to ensure sum represents reality or use gap
        const readyPercent = presentCount > 0 ? Math.round((readyCount / presentCount) * 100) : 0;

        return {
            ...comp,
            presentCount,
            onTaskCount,
            recoveringCount,
            readyCount,
            taskPercent,
            recoveringPercent,
            readyPercent
        };
    }).sort((a, b) => b.taskPercent - a.taskPercent);

    const chartData = activeCompanies.map(org => {
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
        <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm p-10 animate-in fade-in duration-500">
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

                {/* Company Load Dashboard */}
                <div className="bg-slate-50/50 rounded-3xl border border-slate-200 p-6 md:p-8">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="bg-indigo-600 text-white p-2 rounded-xl shadow-lg shadow-indigo-200">
                            <ChartBar size={24} weight="bold" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl font-black text-slate-900">מדד עומס פלוגתי</h2>
                                <div className="group relative z-10">
                                    <Info size={20} className="text-slate-400 cursor-help hover:text-indigo-600 transition-colors" />
                                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-72 p-4 bg-slate-900 text-white text-xs rounded-xl shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none duration-200 z-50">
                                        <div className="font-bold mb-2 text-sm border-b border-slate-700 pb-2">הסבר על המדד</div>
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                                                <span><span className="font-bold">במשימה:</span> מבצעים כרגע משמרת/משימה.</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                                                <span><span className="font-bold">ירדו ממשימה:</span> סיימו משימה וטרם סיימו את זמן המנוחה המוגדר.</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                                                <span><span className="font-bold">פנויים:</span> במנוחה מלאה וזמינים להקפצה/משימה.</span>
                                            </div>
                                        </div>
                                        <div className="mt-3 text-slate-400 italic border-t border-slate-700 pt-2">מחושב מתוך סך הנוכחים בפלוגה.</div>
                                    </div>
                                </div>
                            </div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">זמין למשימה vs במשימה (מתוך הנוכחים)</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {companyLoadStats.map(stat => (
                            <div key={stat.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-4">
                                    <h3 className="font-black text-slate-900 text-lg">{stat.name}</h3>
                                    <div className="bg-slate-100 px-2 py-1 rounded-lg text-xs font-bold text-slate-500">
                                        {stat.presentCount} נוכחים
                                    </div>
                                </div>

                                <div className="flex items-end gap-2 mb-2">
                                    <span className="text-4xl font-black text-indigo-600">{stat.taskPercent}%</span>
                                    <span className="text-sm font-bold text-slate-400 mb-1">במשימה</span>
                                </div>

                                {/* Multi-segmented Bar */}
                                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex mb-3">
                                    <TooltipBar width={stat.taskPercent} color="bg-indigo-500" label="במשימה" />
                                    <TooltipBar width={stat.recoveringPercent} color="bg-amber-400" label="ירדו ממשימה (מנוחה)" />
                                    <TooltipBar width={stat.readyPercent} color="bg-emerald-400" label="פנויים" />
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-500">
                                    <div className="flex items-center gap-1.5" title="במשימה">
                                        <div className="w-2 h-2 rounded-full bg-indigo-500" />
                                        <span>{stat.onTaskCount} במשימה</span>
                                    </div>
                                    {stat.recoveringCount > 0 && (
                                        <div className="flex items-center gap-1.5" title="ירדו ממשימה (במנוחה)">
                                            <div className="w-2 h-2 rounded-full bg-amber-400" />
                                            <span>{stat.recoveringCount} ירדו ממשימה</span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-1.5" title="פנויים למשימה">
                                        <div className="w-2 h-2 rounded-full bg-emerald-400" />
                                        <span>{stat.readyCount} במנוחה</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
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
                            onClick={() => setView?.('battalion-personnel')}
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

// Internal Helper Component for Bar
const TooltipBar = ({ width, color, label }: { width: number, color: string, label: string }) => {
    if (width <= 0) return null;
    return (
        <div className={`${color} h-full transition-all duration-500 relative group/bar`} style={{ width: `${width}%` }}>
            {/* Tooltip on Hover */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover/bar:block whitespace-nowrap z-20">
                <div className="bg-slate-800 text-white text-[10px] font-bold py-1 px-2 rounded shadow-lg">
                    {label} ({width}%)
                </div>
                <div className="w-2 h-2 bg-slate-800 rotate-45 absolute left-1/2 -translate-x-1/2 -bottom-1"></div>
            </div>
        </div>
    );
};
