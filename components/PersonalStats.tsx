import React, { useMemo } from 'react';
import { Person, Shift, TaskTemplate } from '../types';
import { Moon, Sun, Clock, Award } from 'lucide-react';

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

            const duration = task.durationHours;
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

    return (
        <div
            onClick={onClick}
            className={`bg-white rounded-xl shadow-sm border border-slate-100 p-4 hover:shadow-md transition-all ${onClick ? 'cursor-pointer hover:border-blue-300 hover:scale-[1.02]' : ''}`}
        >
            <div className="flex items-center gap-3 mb-4 border-b border-slate-50 pb-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-sm" style={{ backgroundColor: person.color }}>
                    {person.name.charAt(0)}
                </div>
                <div>
                    <h4 className="font-bold text-slate-800">{person.name}</h4>
                    <p className="text-xs text-slate-500">{stats.shiftCount} משמרות</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-slate-50 p-2 rounded-lg">
                    <div className="flex items-center gap-1 text-slate-500 text-xs mb-1">
                        <Clock size={12} />
                        <span>סה"כ שעות</span>
                    </div>
                    <p className="font-bold text-slate-800 text-lg">{stats.totalHours}</p>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg">
                    <div className="flex items-center gap-1 text-slate-500 text-xs mb-1">
                        <Award size={12} />
                        <span>ניקוד עומס</span>
                    </div>
                    <p className="font-bold text-slate-800 text-lg">{stats.totalLoad}</p>
                </div>
            </div>

            <div className="space-y-3">
                {/* Day/Night Bar */}
                <div>
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                        <span className="flex items-center gap-1"><Sun size={10} /> יום ({stats.dayHours})</span>
                        <span className="flex items-center gap-1"><Moon size={10} /> לילה ({stats.nightHours})</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex">
                        <div style={{ width: `${(stats.dayHours / (stats.totalHours || 1)) * 100}%` }} className="bg-amber-400 h-full"></div>
                        <div style={{ width: `${(stats.nightHours / (stats.totalHours || 1)) * 100}%` }} className="bg-indigo-500 h-full"></div>
                    </div>
                </div>

                {/* Rest Stats */}
                <div className="pt-2 border-t border-slate-50">
                    <p className="text-xs font-medium text-slate-400 mb-2">זמני מנוחה (שעות)</p>
                    <div className="flex justify-between text-center">
                        <div>
                            <p className="text-[10px] text-slate-400">מינימום</p>
                            <p className="font-bold text-slate-700">{stats.minRest.toFixed(1)}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-slate-400">ממוצע</p>
                            <p className="font-bold text-slate-700">{stats.avgRest.toFixed(1)}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-slate-400">מקסימום</p>
                            <p className="font-bold text-slate-700">{stats.maxRest.toFixed(1)}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
