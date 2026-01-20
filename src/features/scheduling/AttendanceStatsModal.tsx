import React, { useMemo } from 'react';
import { Person, Team, TeamRotation, Absence, HourlyBlockage } from '@/types';
import { X, House as Home, Wall as Base, TrendUp, ChartBar, ListNumbers, Users, Warning, DownloadSimple, CheckSquare, Square, CaretDown, CaretLeft } from '@phosphor-icons/react';
import ExcelJS from 'exceljs';
import { getEffectiveAvailability } from '@/utils/attendanceUtils';

interface AttendanceStatsModalProps {
    person?: Person;
    team?: Team;
    people: Person[];
    teams: Team[];
    teamRotations: TeamRotation[];
    absences: Absence[];
    hourlyBlockages: HourlyBlockage[];
    dates: Date[];
    onClose: () => void;
}

export const AttendanceStatsModal: React.FC<AttendanceStatsModalProps> = ({
    person, team, people = [], teams = [], teamRotations = [], absences = [], hourlyBlockages = [], dates = [], onClose
}) => {
    const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
    const [expandedPersonId, setExpandedPersonId] = React.useState<string | null>(null);
    const [collapsedTeamIds, setCollapsedTeamIds] = React.useState<Set<string>>(new Set());

    // Date Range Selection State
    const [rangeStart, setRangeStart] = React.useState<string>(dates && dates.length > 0 ? dates[0].toISOString().split('T')[0] : '');
    const [rangeEnd, setRangeEnd] = React.useState<string>(dates && dates.length > 0 ? dates[dates.length - 1].toISOString().split('T')[0] : '');

    // Initialize selection when stats change
    React.useEffect(() => {
        const targetPeople = person ? [person] : (team?.id === 'all' ? people : people.filter(p => p.teamId === team?.id));
        setSelectedIds(new Set(targetPeople.map(p => p.id)));
    }, [person, team, people]);

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        const targetPeople = person ? [person] : (team?.id === 'all' ? people : people.filter(p => p.teamId === team?.id));
        if (selectedIds.size === targetPeople.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(targetPeople.map(p => p.id)));
        }
    };

    const effectiveDates = useMemo(() => {
        if (!rangeStart || !rangeEnd) return dates;
        const start = new Date(rangeStart);
        const end = new Date(rangeEnd);
        if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return dates;

        const result: Date[] = [];
        const curr = new Date(start);
        while (curr <= end) {
            result.push(new Date(curr));
            curr.setDate(curr.getDate() + 1);
        }
        return result;
    }, [rangeStart, rangeEnd, dates]);

    // 1. Calculate Stats
    const stats = useMemo(() => {
        const targetPeople = person ? [person] : (team?.id === 'all' ? people : people.filter(p => p.teamId === team?.id));

        let totalBase = 0;
        let totalHome = 0;
        const cycles: { type: 'base' | 'home', count: number }[] = [];

        targetPeople.forEach(p => {
            let lastStatus: 'base' | 'home' | null = null;
            let currentCount = 0;

            effectiveDates.forEach(d => {
                const av = getEffectiveAvailability(p, d, teamRotations, absences, hourlyBlockages);
                const status = (av.status === 'base' || av.status === 'full' || av.status === 'arrival') ? 'base' : 'home';

                if (status === 'base') totalBase++;
                else totalHome++;

                // Track cycles for individuals
                if (person) {
                    if (status === lastStatus) {
                        currentCount++;
                    } else {
                        if (lastStatus) cycles.push({ type: lastStatus, count: currentCount });
                        lastStatus = status;
                        currentCount = 1;
                    }
                }
            });
            if (person && lastStatus) cycles.push({ type: lastStatus, count: currentCount });
        });

        const totalDaysCount = targetPeople.length * effectiveDates.length;
        const baseRatio = totalDaysCount > 0 ? (totalBase / totalDaysCount) * 100 : 0;
        const homeRatio = totalDaysCount > 0 ? (totalHome / totalDaysCount) * 100 : 0;

        // Company/Team Averages for Comparison
        let companyBase = 0;
        let companyHome = 0;
        let teamBase = 0;
        let teamHome = 0;

        // Company Average (All People)
        people.forEach(p => {
            effectiveDates.forEach(d => {
                const av = getEffectiveAvailability(p, d, teamRotations, absences, hourlyBlockages);
                if (av.status === 'base' || av.status === 'full' || av.status === 'arrival') companyBase++;
                else companyHome++;
            });
        });
        const companyBaseAvg = people.length > 0 ? companyBase / people.length : 0;
        const companyHomeAvg = people.length > 0 ? companyHome / people.length : 0;

        // Team Average (Filtered by target team)
        const teamId = team?.id || person?.teamId;
        const teamPeople = teamId && teamId !== 'all' ? people.filter(p => p.teamId === teamId) : [];
        if (teamPeople.length > 0) {
            teamPeople.forEach(p => {
                effectiveDates.forEach(d => {
                    const av = getEffectiveAvailability(p, d, teamRotations, absences, hourlyBlockages);
                    if (av.status === 'base' || av.status === 'full' || av.status === 'arrival') teamBase++;
                    else teamHome++;
                });
            });
        }
        const teamBaseAvg = teamPeople.length > 0 ? teamBase / teamPeople.length : 0;
        const teamHomeAvg = teamPeople.length > 0 ? teamHome / teamPeople.length : 0;

        const personBase = person ? totalBase : (totalBase / Math.max(1, targetPeople.length));
        const personHome = person ? totalHome : (totalHome / Math.max(1, targetPeople.length));

        // Individual Metrics for Table
        const peopleMetrics = targetPeople.map(p => {
            let pBase = 0;
            let pHome = 0;
            let maxConsecutiveBase = 0;
            let currentConsecutiveBase = 0;

            effectiveDates.forEach(d => {
                const av = getEffectiveAvailability(p, d, teamRotations, absences, hourlyBlockages);
                const isBase = (av.status === 'base' || av.status === 'full' || av.status === 'arrival');
                if (isBase) {
                    pBase++;
                    currentConsecutiveBase++;
                    maxConsecutiveBase = Math.max(maxConsecutiveBase, currentConsecutiveBase);
                } else {
                    pHome++;
                    currentConsecutiveBase = 0;
                }
            });

            const pTotal = effectiveDates.length;
            const homePerc = pTotal > 0 ? (pHome / pTotal) * 100 : 0;
            const sHome = Math.round((pHome / Math.max(1, pTotal)) * 14);
            const sBase = 14 - sHome;
            const relHomeTime = (pHome / 30 * 100).toFixed(1);

            // Breakdown data
            const dayBreakdown: { date: Date, status: 'base' | 'home', detail?: string }[] = [];
            effectiveDates.forEach(d => {
                const av = getEffectiveAvailability(p, d, teamRotations, absences, hourlyBlockages);
                dayBreakdown.push({
                    date: d,
                    status: (av.status === 'base' || av.status === 'full' || av.status === 'arrival') ? 'base' : 'home',
                    detail: av.homeStatusType === 'leave_shamp' ? 'חופשה' : av.homeStatusType === 'gimel' ? 'גימלים' : av.homeStatusType === 'absent' ? 'נפקד' : av.homeStatusType === 'organization_days' ? 'התארגנות' : undefined
                });
            });

            return {
                id: p.id,
                name: p.name,
                teamId: p.teamId,
                base: pBase,
                home: pHome,
                homePerc,
                cycle: `${sHome}-${sBase}`,
                relativeHomeTime: relHomeTime,
                maxConsecutiveBase,
                dayBreakdown
            };
        });

        // Determine dynamic threshold for anomalies (Top 10% or minimum 12 days)
        const allConsecutiveDays = peopleMetrics.map(p => p.maxConsecutiveBase).sort((a, b) => b - a);
        const top10PercentIndex = Math.floor(allConsecutiveDays.length * 0.1);
        const dynamicThreshold = Math.max(12, allConsecutiveDays[top10PercentIndex] || 0);

        const metricsWithAnomalies = peopleMetrics.map(p => ({
            ...p,
            isAnomaly: p.maxConsecutiveBase >= dynamicThreshold && p.maxConsecutiveBase > 0
        }));

        // Normalize to 14-day cycle
        const scHome = Math.round((personHome / Math.max(1, effectiveDates.length)) * 14);
        const scBase = 14 - scHome;

        const teamHomeAvgNorm = Math.round((teamHomeAvg / Math.max(1, effectiveDates.length)) * 14);
        const teamBaseAvgNorm = 14 - teamHomeAvgNorm;

        const companyHomeAvgNorm = Math.round((companyHomeAvg / Math.max(1, effectiveDates.length)) * 14);
        const companyBaseAvgNorm = 14 - companyHomeAvgNorm;

        return {
            personBase,
            personHome,
            scaledHome: scHome,
            scaledBase: scBase,
            teamBaseAvgNorm,
            teamHomeAvgNorm,
            companyBaseAvgNorm,
            companyHomeAvgNorm,
            baseRatio,
            homeRatio,
            cycles,
            peopleMetrics: metricsWithAnomalies,
            totalDays: effectiveDates.length,
            anomalyThreshold: dynamicThreshold
        };
    }, [person, team, people, teamRotations, absences, hourlyBlockages, effectiveDates]);

    const handleExport = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('דוח סטטיסטיקה', { views: [{ rightToLeft: true }] });

        worksheet.columns = [
            { header: 'שם מלא', key: 'name', width: 25 },
            { header: 'צוות', key: 'team', width: 20 },
            { header: 'ימים בבסיס', key: 'base', width: 15 },
            { header: 'ימים בבית', key: 'home', width: 15 },
            { header: 'אחוז זמן בית', key: 'homeTime', width: 15 },
            { header: 'סבב ממוצע (X-Y)', key: 'cycle', width: 20 },
            { header: 'חריג עומס', key: 'anomaly', width: 15 }
        ];

        const selectedData = stats.peopleMetrics.filter(p => selectedIds.has(p.id));

        selectedData.forEach(p => {
            worksheet.addRow({
                name: p.name,
                team: teams.find(t => t.id === p.teamId)?.name || 'ללא צוות',
                base: Math.round(p.base),
                home: Math.round(p.home),
                homeTime: `${Math.round(p.homePerc)}%`,
                cycle: p.cycle,
                anomaly: p.isAnomaly ? 'כן' : 'לא'
            });
        });

        // Style header
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).alignment = { horizontal: 'center' };

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `statistics_report_${new Date().toLocaleDateString('he-IL')}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const title = person ? person.name : (team?.id === 'all' ? 'סטטיסטיקה פלוגתית' : `סטטיסטיקה: ${team?.name}`);

    return (
        <div className="fixed inset-0 z-[11000] flex items-start justify-center p-4 pt-28 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-20">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-200">
                            <ChartBar size={24} weight="fill" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-800">{title}</h3>
                            <p className="text-xs font-bold text-slate-500">ניתוח נוכחות לתקופה שנבחרה ({stats.totalDays} ימים)</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {(!person) && (
                            <button
                                onClick={handleExport}
                                className="flex items-center gap-2 px-4 h-10 bg-emerald-50 text-emerald-600 rounded-xl font-black text-xs hover:bg-emerald-100 transition-all border border-emerald-100"
                            >
                                <DownloadSimple size={18} weight="bold" />
                                ייצוא נתונים ({selectedIds.size})
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                            <X size={20} weight="bold" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-8 overflow-y-auto custom-scrollbar space-y-8">
                    {/* Date Range Selection */}
                    <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 flex-wrap">
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase mr-1">מתאריך</label>
                            <input
                                type="date"
                                value={rangeStart}
                                onChange={(e) => setRangeStart(e.target.value)}
                                className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all bg-white"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase mr-1">עד תאריך</label>
                            <input
                                type="date"
                                value={rangeEnd}
                                onChange={(e) => setRangeEnd(e.target.value)}
                                className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all bg-white"
                            />
                        </div>
                        <div className="flex-1 flex flex-col justify-end pb-1">
                            <p className="text-[10px] font-bold text-slate-500 bg-white px-3 py-2 rounded-xl border border-slate-100 italic">
                                * הסטטיסטיקה מחושבת מחדש עבור הטווח הנבחר
                            </p>
                        </div>
                    </div>

                    {/* Main Stats Cards */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-100 relative overflow-hidden group">
                            <Base size={40} weight="bold" className="absolute -right-2 -bottom-2 text-emerald-200/50 group-hover:scale-110 transition-transform" />
                            <span className="text-xs font-black text-emerald-600 uppercase tracking-wider">ימים בבסיס</span>
                            <div className="mt-1 flex items-baseline gap-2" dir="ltr">
                                <span className="text-3xl font-black text-emerald-700">{Math.round(stats.personBase)}</span>
                                <span className="text-sm font-bold text-emerald-600/60">/ {stats.totalDays}</span>
                            </div>
                        </div>
                        <div className="p-6 rounded-2xl bg-red-50 border border-red-100 relative overflow-hidden group">
                            <Home size={40} weight="bold" className="absolute -right-2 -bottom-2 text-red-200/50 group-hover:scale-110 transition-transform" />
                            <span className="text-xs font-black text-red-600 uppercase tracking-wider">ימים בבית</span>
                            <div className="mt-1 flex items-baseline gap-2" dir="ltr">
                                <span className="text-3xl font-black text-red-700">{Math.round(stats.personHome)}</span>
                                <span className="text-sm font-bold text-red-600/60">/ {stats.totalDays}</span>
                            </div>
                        </div>
                    </div>

                    {/* Visualization Section */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <TrendUp size={18} className="text-blue-600" weight="bold" />
                            <h4 className="font-black text-slate-800">יחס פריסה ממוצע</h4>
                        </div>

                        <div className="h-6 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner border border-slate-200" dir="ltr">
                            <div
                                className="h-full bg-gradient-to-r from-red-500 to-red-400 transition-all duration-1000 ease-out"
                                style={{ width: `${stats.homeRatio}%` }}
                                title={`בית: ${Math.round(stats.homeRatio)}%`}
                            />
                            <div
                                className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-1000 ease-out"
                                style={{ width: `${stats.baseRatio}%` }}
                                title={`בסיס: ${Math.round(stats.baseRatio)}%`}
                            />
                        </div>
                        <div className="flex justify-between items-end px-1" dir="ltr">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">ממוצע סבב (14 יום)</span>
                                <span className="text-2xl font-black text-slate-800">{stats.scaledHome} / {stats.scaledBase}</span>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">אחוזים</span>
                                <span className="text-sm font-black text-slate-500">{Math.round(stats.homeRatio)}% / {Math.round(stats.baseRatio)}%</span>
                            </div>
                        </div>
                    </div>

                    {/* Detailed Table (For Team/Company) */}
                    {!person && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Users size={18} className="text-blue-600" weight="bold" />
                                    <h4 className="font-black text-slate-800">פירוט יחסים אישי</h4>
                                </div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase bg-slate-100 px-2 py-1 rounded-lg flex items-center gap-1">
                                    <Warning size={12} className="text-amber-500" />
                                    מזהה חריגים (10% עם הרצף הארוך ביותר)
                                </div>
                            </div>

                            <div className="border border-slate-100 rounded-2xl overflow-hidden">
                                <table className="w-full text-right border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-100">
                                            <th className="p-3 text-[11px] font-black text-slate-500 uppercase tracking-wider w-10">
                                                <button onClick={toggleSelectAll} className="p-1 hover:bg-slate-200 rounded transition-colors">
                                                    {selectedIds.size === stats.peopleMetrics.length ? <CheckSquare size={18} weight="fill" className="text-blue-600" /> : <Square size={18} weight="bold" className="text-slate-400" />}
                                                </button>
                                            </th>
                                            <th className="p-3 text-[11px] font-black text-slate-500 uppercase tracking-wider">שם</th>
                                            <th className="p-3 text-[11px] font-black text-slate-500 uppercase tracking-wider text-center">זמן בית %</th>
                                            <th className="p-3 text-[11px] font-black text-slate-500 uppercase tracking-wider text-center">סבב (X-Y)</th>
                                            <th className="p-3 text-[11px] font-black text-slate-500 uppercase tracking-wider text-center">חריג</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {(() => {
                                            const grouped: { team: Team | { id: string, name: string, color: string }, members: typeof stats.peopleMetrics }[] = [];

                                            // 1. Defined Teams
                                            teams.forEach(t => {
                                                const members = stats.peopleMetrics.filter(pm => pm.teamId === t.id);
                                                if (members.length > 0) {
                                                    grouped.push({ team: t, members });
                                                }
                                            });

                                            // 2. Unassigned
                                            const unassigned = stats.peopleMetrics.filter(pm => !pm.teamId || !teams.find(t => t.id === pm.teamId));
                                            if (unassigned.length > 0) {
                                                grouped.push({
                                                    team: { id: 'unassigned', name: 'ללא צוות', color: 'bg-slate-500' },
                                                    members: unassigned
                                                });
                                            }

                                            return grouped.map(({ team: t, members }) => {
                                                const isCollapsed = collapsedTeamIds.has(t.id);
                                                return (
                                                    <React.Fragment key={t.id}>
                                                        <tr
                                                            className="bg-slate-50/80 cursor-pointer hover:bg-slate-100 transition-colors"
                                                            onClick={() => {
                                                                setCollapsedTeamIds(prev => {
                                                                    const next = new Set(prev);
                                                                    if (next.has(t.id)) next.delete(t.id);
                                                                    else next.add(t.id);
                                                                    return next;
                                                                });
                                                            }}
                                                        >
                                                            <td colSpan={5} className="px-4 py-2">
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className={`w-1 h-4 rounded-full ${t.color.replace('border-', 'bg-').split(' ')[0] || 'bg-blue-600'}`} />
                                                                        <span className="text-xs font-black text-slate-800">{t.name}</span>
                                                                        <span className="text-[10px] font-bold text-slate-400">({members.length} לוחמים)</span>
                                                                    </div>
                                                                    <div className="text-slate-400">
                                                                        {isCollapsed ? <CaretLeft size={14} weight="bold" /> : <CaretDown size={14} weight="bold" />}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                        {!isCollapsed && members.map(p => (
                                                            <React.Fragment key={p.id}>
                                                                <tr className={`hover:bg-slate-50 transition-colors ${p.isAnomaly ? 'bg-amber-50/30' : ''} ${expandedPersonId === p.id ? 'bg-blue-50/50' : ''}`}>
                                                                    <td className="p-3 text-center">
                                                                        <button onClick={(e) => { e.stopPropagation(); toggleSelect(p.id); }} className="p-1 hover:bg-slate-200 rounded transition-colors">
                                                                            {selectedIds.has(p.id) ? <CheckSquare size={18} weight="fill" className="text-blue-600" /> : <Square size={18} weight="bold" className="text-slate-400" />}
                                                                        </button>
                                                                    </td>
                                                                    <td className="p-3">
                                                                        <button
                                                                            onClick={() => setExpandedPersonId(expandedPersonId === p.id ? null : p.id)}
                                                                            className="text-xs font-black text-slate-700 hover:text-blue-600 transition-colors flex flex-col items-start gap-0.5"
                                                                        >
                                                                            {p.name}
                                                                            <span className="text-[9px] font-bold text-slate-400">לחץ לפירוט חישוב</span>
                                                                        </button>
                                                                    </td>
                                                                    <td className="p-3 text-xs font-bold text-slate-600 text-center" dir="ltr">{Math.round(p.homePerc)}%</td>
                                                                    <td className="p-3 text-xs font-black text-blue-600 text-center" dir="ltr">{p.cycle}</td>
                                                                    <td className="p-3 text-center">
                                                                        {p.isAnomaly ? (
                                                                            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-black border border-amber-200 animate-pulse">
                                                                                <Warning size={10} weight="fill" />
                                                                                חריג עומס
                                                                            </div>
                                                                        ) : (
                                                                            <span className="text-[10px] text-slate-300">-</span>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                                {expandedPersonId === p.id && (
                                                                    <tr>
                                                                        <td colSpan={5} className="p-0 bg-slate-50/50">
                                                                            <div className="p-6 space-y-4 animate-in slide-in-from-top-2 duration-200">
                                                                                <div className="flex items-center justify-between">
                                                                                    <h5 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                                                                        <ListNumbers size={14} className="text-blue-600" />
                                                                                        פירוט חישוב ונוכחות ({p.base} בבסיס, {p.home} בבית)
                                                                                    </h5>
                                                                                </div>
                                                                                <div className="grid grid-cols-7 gap-1">
                                                                                    {p.dayBreakdown.map((d, i) => (
                                                                                        <div
                                                                                            key={i}
                                                                                            className={`p-2 rounded-lg border text-center flex flex-col gap-1 transition-all ${d.status === 'base'
                                                                                                ? 'bg-emerald-50 border-emerald-100'
                                                                                                : 'bg-red-50 border-red-100'
                                                                                                }`}
                                                                                        >
                                                                                            <span className="text-[9px] font-black opacity-40 uppercase">
                                                                                                {d.date.toLocaleDateString('he-IL', { weekday: 'short' })}
                                                                                            </span>
                                                                                            <span className="text-[10px] font-black text-slate-700">
                                                                                                {d.date.getDate()}/{d.date.getMonth() + 1}
                                                                                            </span>
                                                                                            {d.detail && (
                                                                                                <span className="text-[8px] font-bold text-red-600/60 leading-none">
                                                                                                    {d.detail}
                                                                                                </span>
                                                                                            )}
                                                                                            <div className={`w-1.5 h-1.5 rounded-full mx-auto mt-1 ${d.status === 'base' ? 'bg-emerald-500' : 'bg-red-500'
                                                                                                }`} />
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                                <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
                                                                                    <p className="text-[10px] font-bold text-blue-800 leading-relaxed">
                                                                                        <span className="font-black italic ml-1">* נוסחת החישוב:</span>
                                                                                        יחס הבית מחושב לפי {p.home} ימים מתוך {stats.totalDays} ימי הטווח ({Math.round(p.homePerc)}%).
                                                                                        סבב ה-X-Y מנורמל ל-14 ימים (X=בית, Y=בסיס).
                                                                                        חריג עומס מסומן עבור ה-10% עם רצף הימים הארוך ביותר בבסיס (כרגע מעל {stats.anomalyThreshold} ימים).
                                                                                    </p>
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                            </React.Fragment>
                                                        ))}
                                                    </React.Fragment>
                                                );
                                            });
                                        })()}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Benchmarks */}
                    <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                        <div className="flex items-center gap-2">
                            <Users size={18} className="text-slate-600" weight="bold" />
                            <h4 className="font-black text-slate-800">השוואת ביצועים (ממוצע ימים בסבב)</h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Individual/Current */}
                            <div className="p-4 bg-white rounded-xl border-2 border-blue-100 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-1 bg-blue-500 text-[8px] text-white font-black rounded-bl-lg uppercase">{person ? 'אישי' : 'ממוצע'}</div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">יחס נוכחי</span>
                                <div className="text-xl font-black text-blue-600 flex items-baseline gap-1" dir="ltr">
                                    <span>{stats.scaledHome}</span>
                                    <span className="text-slate-300">/</span>
                                    <span>{stats.scaledBase}</span>
                                </div>
                            </div>

                            {/* Team */}
                            <div className="p-4 bg-white rounded-xl border border-slate-200">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">ממוצע צוותי</span>
                                <div className="text-xl font-black text-slate-700 flex items-baseline gap-1" dir="ltr">
                                    <span>{stats.teamHomeAvgNorm}</span>
                                    <span className="text-slate-200">/</span>
                                    <span>{stats.teamBaseAvgNorm}</span>
                                </div>
                            </div>

                            {/* Company */}
                            <div className="p-4 bg-white rounded-xl border border-slate-200">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">ממוצע פלוגתי</span>
                                <div className="text-xl font-black text-slate-500 flex items-baseline gap-1" dir="ltr">
                                    <span>{stats.companyHomeAvgNorm}</span>
                                    <span className="text-slate-200">/</span>
                                    <span>{stats.companyBaseAvgNorm}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Cycles Section (Only for Person) */}
                    {person && stats.cycles.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <ListNumbers size={18} className="text-blue-600" weight="bold" />
                                <h4 className="font-black text-slate-800">פירוט סבבים (ימים רצופים)</h4>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {stats.cycles.map((c, i) => (
                                    <div
                                        key={i}
                                        className={`px-4 py-2 rounded-xl border flex flex-col items-center min-w-[70px] transition-transform hover:scale-105 ${c.type === 'base'
                                            ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                                            : 'bg-red-50 border-red-100 text-red-700'
                                            }`}
                                    >
                                        <span className="text-xl font-black">{c.count}</span>
                                        <span className="text-[10px] font-bold uppercase tracking-tighter opacity-70">
                                            {c.type === 'base' ? 'בבסיס' : 'בבית'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 h-11 bg-slate-800 text-white rounded-xl font-black text-sm hover:bg-slate-900 transition-all shadow-lg shadow-slate-200"
                    >
                        סגור
                    </button>
                </div>
            </div>
        </div>
    );
};
