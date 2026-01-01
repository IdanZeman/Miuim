import React, { useMemo } from 'react';
import { Person, Shift, TaskTemplate } from '../../types';
import { Moon, Sun, Clock, Medal as Award } from '@phosphor-icons/react';

interface PersonalStatsProps {
    person: Person;
    shifts: Shift[];
    tasks: TaskTemplate[];
    onClick?: () => void;
    nightShiftStart?: string;
    nightShiftEnd?: string;
}

export const PersonalStats: React.FC<PersonalStatsProps> = ({ person, shifts, tasks, onClick, nightShiftStart = '22:00', nightShiftEnd = '06:00' }) => {

    const stats = useMemo(() => {
        const personShifts = shifts.filter(s => s.assignedPersonIds.includes(person.id))
            .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

        let totalHours = 0;
        let nightHours = 0;
        let totalLoad = 0;
        let restTimes: number[] = [];

        personShifts.forEach((shift, index) => {
            const task = tasks.find(t => t.id === shift.taskId);
            if (!task) return;

            const duration = (new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) / (1000 * 60 * 60);
            totalHours += duration;
            totalLoad += duration * task.difficulty;

            // Night Hours Calculation
            const start = new Date(shift.startTime);
            const end = new Date(shift.endTime);

            // Check each hour of the shift
            let current = new Date(start);
            let shiftNightHours = 0;

            const startHour = parseInt(nightShiftStart.split(':')[0]);
            const endHour = parseInt(nightShiftEnd.split(':')[0]);

            while (current < end) {
                const h = current.getHours();
                const isNight = startHour > endHour
                    ? (h >= startHour || h < endHour)
                    : (h >= startHour && h < endHour);

                if (isNight) {
                    shiftNightHours += 1; // Count full hours for simplicity
                }
                current.setHours(current.getHours() + 1);
            }
            nightHours += shiftNightHours;

            // Rest Time
            if (index < personShifts.length - 1) {
                const nextShift = personShifts[index + 1];
                const nextStart = new Date(nextShift.startTime);
                const diffMs = nextStart.getTime() - end.getTime();
                const diffHours = diffMs / (1000 * 60 * 60);
                if (diffHours > 0) restTimes.push(diffHours);
            }
        });

        const minRest = restTimes.length > 0 ? Math.min(...restTimes) : 0;
        const maxRest = restTimes.length > 0 ? Math.max(...restTimes) : 0;
        const avgRest = restTimes.length > 0 ? restTimes.reduce((a, b) => a + b, 0) / restTimes.length : 0;

        return {
            totalHours,
            nightHours,
            dayHours: totalHours - nightHours,
            totalLoad,
            shiftCount: personShifts.length,
            minRest,
            maxRest,
            avgRest
        };
    }, [person, shifts, tasks, nightShiftStart, nightShiftEnd]);

    const [isOpen, setIsOpen] = React.useState(false);

    // Derived colors
    const loadColor = stats.totalLoad > 15 ? 'text-red-600' : stats.totalLoad < 5 ? 'text-green-600' : 'text-slate-700';
    const dayRatio = (stats.dayHours / (stats.totalHours || 1)) * 100;
    const nightRatio = (stats.nightHours / (stats.totalHours || 1)) * 100;

    return (
        <div
            onClick={() => setIsOpen(!isOpen)}
            className="group bg-white hover:bg-slate-50 transition-all border-b border-slate-100 last:border-0 cursor-pointer select-none"
        >
            {/* Summary Row - Compact ~80px */}
            <div className="relative p-4 flex items-center justify-between">
                {/* Left: Avatar + Name */}
                <div className="flex items-center gap-3">
                    <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-sm ring-2 ring-white"
                        style={{ backgroundColor: person.color }}
                    >
                        {person.name.charAt(0)}
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-800 text-base">{person.name}</h4>
                        <span className="text-xs text-slate-400">{stats.shiftCount} משמרות</span>
                    </div>
                </div>

                {/* Right: Load Score */}
                <div className="text-right">
                    <div className={`text-2xl font-black ${loadColor} leading-none`}>
                        {stats.totalLoad.toFixed(0)}
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">ניקוד עומס</span>
                </div>

                {/* Bottom Slim Bar - Day/Night Ratio with Icons */}
                <div className="absolute bottom-2 right-4 opacity-50">
                    <Sun size={10} className="text-amber-500 fill-amber-500" weight="fill" />
                </div>
                <div className="absolute bottom-2 left-4 opacity-50">
                    <Moon size={10} className="text-indigo-500 fill-indigo-500" weight="fill" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-1.5 flex opacity-90">
                    <div style={{ width: `${dayRatio}%` }} className="bg-amber-400 h-full transition-all duration-500" />
                    <div style={{ width: `${nightRatio}%` }} className="bg-indigo-500 h-full transition-all duration-500" />
                </div>
            </div>

            {/* Expanded Details */}
            {isOpen && (
                <div className="px-4 pb-4 pt-0 animate-in slide-in-from-top-2 duration-200">
                    <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-3 gap-y-4 gap-x-2 text-center relative mt-2">
                        {/* Decorative Arrow */}
                        <div className="absolute -top-1.5 right-6 w-3 h-3 bg-slate-50 rotate-45 transform" />

                        {/* Rest Times */}
                        <div className="col-span-3 text-xs font-bold text-slate-400 text-right mb-1">
                            זמני מנוחה (שעות)
                        </div>

                        <div>
                            <span className="text-[10px] text-slate-400 block mb-0.5">מינימום</span>
                            <span className="font-bold text-slate-700">{stats.minRest.toFixed(1)}</span>
                        </div>
                        <div className="border-x border-slate-200/60">
                            <span className="text-[10px] text-slate-400 block mb-0.5">ממוצע</span>
                            <span className="font-bold text-slate-800 text-lg leading-none">{stats.avgRest.toFixed(1)}</span>
                        </div>
                        <div>
                            <span className="text-[10px] text-slate-400 block mb-0.5">מקסימום</span>
                            <span className="font-bold text-slate-700">{stats.maxRest.toFixed(1)}</span>
                        </div>

                        {/* Divider */}
                        <div className="col-span-3 h-px bg-slate-200/60 my-1" />

                        {/* Hours Breakdown */}
                        <div className="col-span-3 grid grid-cols-2 gap-4 pt-1">
                            <div className="flex items-center justify-between bg-white p-2 rounded-lg shadow-sm border border-slate-100">
                                <div className="flex items-center gap-2">
                                    <Clock size={14} className="text-blue-500" weight="duotone" />
                                    <span className="text-xs font-bold text-slate-600">סה"כ שעות</span>
                                </div>
                                <span className="font-black text-slate-800">{stats.totalHours.toFixed(0)}</span>
                            </div>
                            <div className="flex items-center justify-between bg-white p-2 rounded-lg shadow-sm border border-slate-100">
                                <div className="flex items-center gap-2">
                                    <Moon size={14} className="text-indigo-500" weight="duotone" />
                                    <span className="text-xs font-bold text-slate-600">שעות לילה</span>
                                </div>
                                <span className="font-black text-slate-800">{stats.nightHours}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
