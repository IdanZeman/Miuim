import React, { useMemo } from 'react';
import { Person, Shift, TaskTemplate } from '../../types';
import { Clock, CalendarBlank, ChartBar, Sparkle } from '@phosphor-icons/react';
import { getPersonInitials } from '../../utils/nameUtils';

interface PersonalStatsProps {
    person: Person;
    shifts: Shift[];
    tasks: TaskTemplate[];
    onClick?: () => void;
    nightShiftStart?: string;
    nightShiftEnd?: string;
}

export const PersonalStats: React.FC<PersonalStatsProps> = ({
    person,
    shifts,
    tasks,
    onClick,
    nightShiftStart = '22:00',
    nightShiftEnd = '06:00'
}) => {

    const stats = useMemo(() => {
        const personShifts = shifts.filter(s => s.assignedPersonIds.includes(person.id))
            .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

        let totalHours = 0;
        let nightHours = 0;
        let totalLoad = 0;

        personShifts.forEach((shift) => {
            const task = tasks.find(t => t.id === shift.taskId);
            if (!task) return;

            const duration = (new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) / (1000 * 60 * 60);
            totalHours += duration;
            totalLoad += duration * task.difficulty;

            // Night Hours Calculation
            const start = new Date(shift.startTime);
            const end = new Date(shift.endTime);
            let current = new Date(start);

            const startHour = parseInt(nightShiftStart.split(':')[0]);
            const endHour = parseInt(nightShiftEnd.split(':')[0]);

            while (current < end) {
                const h = current.getHours();
                const isNight = startHour > endHour
                    ? (h >= startHour || h < endHour)
                    : (h >= startHour && h < endHour);

                if (isNight) {
                    nightHours += 1;
                }
                current.setHours(current.getHours() + 1);
            }
        });

        return {
            totalHours,
            nightHours,
            dayHours: totalHours - nightHours,
            totalLoad,
            shiftCount: personShifts.length,
            futureShifts: personShifts.filter(s => new Date(s.startTime) >= new Date())
        };
    }, [person, shifts, tasks, nightShiftStart, nightShiftEnd]);

    const { totalHours, shiftCount, totalLoad } = stats;

    return (
        <div
            onClick={onClick}
            className="group relative bg-white rounded-2xl p-3 border border-slate-200 shadow-sm transition-all duration-300 hover:shadow-md hover:border-blue-200 cursor-pointer overflow-hidden"
        >
            <div className="relative flex items-center justify-between gap-4">
                {/* Right Area: Identity */}
                <div className="flex items-center gap-3.5 min-w-0">
                    <div className="relative shrink-0">
                        <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center text-slate-800 text-lg font-black shadow-sm transition-all duration-300 group-hover:scale-105 border-2 border-white ring-1 ring-slate-100"
                            style={{
                                backgroundColor: person.color || '#F1F5F9',
                                backgroundImage: person.color
                                    ? `linear-gradient(135deg, ${person.color}, ${person.color}dd)`
                                    : 'none',
                                color: '#1e293b' // slate-800
                            }}
                        >
                            {getPersonInitials(person.name)}
                        </div>
                    </div>

                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                            <h3 className="text-base font-black text-slate-800 truncate group-hover:text-blue-700 transition-colors tracking-tight">{person.name}</h3>
                            <Sparkle size={12} weight="fill" className="text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 px-2 py-0.5 bg-slate-50 rounded-lg group-hover:bg-blue-50 transition-colors border border-slate-100/50">
                                <Clock size={12} className="text-slate-400 group-hover:text-blue-500" />
                                <span className="text-[11px] font-black text-slate-600 group-hover:text-blue-700">{totalHours.toFixed(1)} <span className="text-[9px] opacity-40">ש'</span></span>
                            </div>
                            <div className="flex items-center gap-1 px-2 py-0.5 bg-slate-50 rounded-lg group-hover:bg-emerald-50 transition-colors border border-slate-100/50">
                                <CalendarBlank size={12} className="text-slate-400 group-hover:text-emerald-500" />
                                <span className="text-[11px] font-black text-slate-600 group-hover:text-emerald-700">{shiftCount} <span className="text-[9px] opacity-40">מש'</span></span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Left Area: Load Points */}
                <div className="flex items-center gap-4 shrink-0 px-4">
                    <div className="w-px h-8 bg-slate-100" />
                    <div className="text-left">
                        <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">ניקוד עומס</div>
                        <div className="text-xl font-black text-slate-400 group-hover:text-blue-600 transition-colors flex items-baseline gap-1">
                            {totalLoad.toFixed(0)}<span className="text-[10px] opacity-40">PT</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="absolute top-0 left-0 px-2 py-1 bg-blue-600 text-white text-[8px] font-black rounded-br-lg opacity-0 group-hover:opacity-100 transition-all translate-x-[-10px] group-hover:translate-x-0">
                פרטים מלאים
            </div>
        </div>
    );
};
