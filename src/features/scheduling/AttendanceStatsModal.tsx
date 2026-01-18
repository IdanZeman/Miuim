import React, { useMemo } from 'react';
import { Person, Team, TeamRotation, Absence, HourlyBlockage } from '@/types';
import { X, House as Home, Wall as Base, TrendUp, ChartBar, ListNumbers, Users } from '@phosphor-icons/react';
import { getEffectiveAvailability } from '@/utils/attendanceUtils';

interface AttendanceStatsModalProps {
    person?: Person;
    team?: Team;
    people: Person[];
    teamRotations: TeamRotation[];
    absences: Absence[];
    hourlyBlockages: HourlyBlockage[];
    dates: Date[];
    onClose: () => void;
}

export const AttendanceStatsModal: React.FC<AttendanceStatsModalProps> = ({
    person, team, people, teamRotations, absences, hourlyBlockages, dates, onClose
}) => {
    // 1. Calculate Stats
    const stats = useMemo(() => {
        const targetPeople = person ? [person] : (team?.id === 'all' ? people : people.filter(p => p.teamId === team?.id));

        let totalBase = 0;
        let totalHome = 0;
        const cycles: { type: 'base' | 'home', count: number }[] = [];

        targetPeople.forEach(p => {
            let lastStatus: 'base' | 'home' | null = null;
            let currentCount = 0;

            dates.forEach(d => {
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

        const totalDays = targetPeople.length * dates.length;
        const baseRatio = totalDays > 0 ? (totalBase / totalDays) * 100 : 0;
        const homeRatio = totalDays > 0 ? (totalHome / totalDays) * 100 : 0;

        // Company/Team Averages for Comparison
        let companyBase = 0;
        let companyHome = 0;
        let teamBase = 0;
        let teamHome = 0;

        // Company Average (All People)
        people.forEach(p => {
            dates.forEach(d => {
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
                dates.forEach(d => {
                    const av = getEffectiveAvailability(p, d, teamRotations, absences, hourlyBlockages);
                    if (av.status === 'base' || av.status === 'full' || av.status === 'arrival') teamBase++;
                    else teamHome++;
                });
            });
        }
        const teamBaseAvg = teamPeople.length > 0 ? teamBase / teamPeople.length : 0;
        const teamHomeAvg = teamPeople.length > 0 ? teamHome / teamPeople.length : 0;

        const personBase = person ? totalBase : (totalBase / targetPeople.length);
        const personHome = person ? totalHome : (totalHome / targetPeople.length);

        // Normalize to 14-day cycle
        const scaledHome = Math.round((personHome / dates.length) * 14);
        const scaledBase = 14 - scaledHome;

        const teamHomeAvgNorm = Math.round((teamHomeAvg / dates.length) * 14);
        const teamBaseAvgNorm = 14 - teamHomeAvgNorm;

        const companyHomeAvgNorm = Math.round((companyHomeAvg / dates.length) * 14);
        const companyBaseAvgNorm = 14 - companyHomeAvgNorm;

        return {
            personBase,
            personHome,
            scaledHome,
            scaledBase,
            teamBaseAvgNorm,
            teamHomeAvgNorm,
            companyBaseAvgNorm,
            companyHomeAvgNorm,
            baseRatio,
            homeRatio,
            cycles,
            totalDays: dates.length
        };
    }, [person, team, people, teamRotations, absences, hourlyBlockages, dates]);

    const title = person ? person.name : (team?.id === 'all' ? 'סטטיסטיקה פלוגתית' : `סטטיסטיקה: ${team?.name}`);

    return (
        <div className="fixed inset-0 z-[11000] flex items-start justify-center p-4 pt-28 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-200">
                            <ChartBar size={24} weight="fill" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-800">{title}</h3>
                            <p className="text-xs font-bold text-slate-500">ניתוח נוכחות לתקופה שנבחרה ({stats.totalDays} ימים)</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                        <X size={20} weight="bold" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-8 overflow-y-auto custom-scrollbar space-y-8">
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
                            <h4 className="font-black text-slate-800">יחס פריסה</h4>
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
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">יחס פריסה (14 יום)</span>
                                <span className="text-2xl font-black text-slate-800">{stats.scaledHome} / {stats.scaledBase}</span>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">אחוזים</span>
                                <span className="text-sm font-black text-slate-500">{Math.round(stats.homeRatio)}% / {Math.round(stats.baseRatio)}%</span>
                            </div>
                        </div>
                    </div>

                    {/* Benchmarks */}
                    <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                        <div className="flex items-center gap-2">
                            <Users size={18} className="text-slate-600" weight="bold" />
                            <h4 className="font-black text-slate-800">השוואת ביצועים (ממוצע ימים בסבב)</h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Individual/Current */}
                            <div className="p-4 bg-white rounded-xl border-2 border-blue-100 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-1 bg-blue-500 text-[8px] text-white font-black rounded-bl-lg uppercase">נוכחי</div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">יחס אישי</span>
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
