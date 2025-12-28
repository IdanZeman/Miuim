import React, { useMemo } from 'react';
import { TaskTemplate, SchedulingSegment } from '@/types';
import { Users, Clock, AlertCircle } from 'lucide-react';

interface StaffingAnalysisProps {
    tasks: TaskTemplate[];
    totalPeople: number;
}

export const StaffingAnalysis: React.FC<StaffingAnalysisProps> = ({ tasks, totalPeople }) => {

    // Calculate Needs
    const analysis = useMemo(() => {
        let totalRequired = 0;
        const breakdown = tasks.map(task => {
            // 1. Calculate Daily Man-Hours Demand
            let dailyManHours = 0;
            let totalDuration = 0;
            let totalRest = 0; // Accumulated rest for weighting

            // If no segments, assume 24h coverage with template defaults? 
            // Better to rely on segments.
            const segments = task.segments || [];

            if (segments.length === 0) {
                // Fallback: Assume 1 person, 24/7 ??? No, safer to return 0 and warn.
                return {
                    id: task.id,
                    name: task.name,
                    staffNeeded: 0,
                    details: 'לא הוגדרו משמרות (Segments)',
                    error: true
                };
            }

            segments.forEach(seg => {
                if (seg.isRepeat) {
                    // Constant 24/7 coverage
                    dailyManHours += 24 * seg.requiredPeople;
                    // Duration and Rest still relevant for calculating the Work/Rest Ratio
                    totalDuration += seg.durationHours;
                    totalRest += (seg.minRestHoursAfter * seg.durationHours);
                } else if (seg.frequency === 'daily') {
                    dailyManHours += seg.durationHours * seg.requiredPeople;
                    totalDuration += seg.durationHours;
                    totalRest += (seg.minRestHoursAfter * seg.durationHours);
                }
                // Handle Weekly? (For "SADAK" we usually look at max daily load or average)
                // Let's assume daily for the core calc
            });

            if (totalDuration === 0) {
                return {
                    id: task.id,
                    name: task.name,
                    staffNeeded: 0,
                    details: 'אין משמרות יומיות פעילות',
                    error: true
                };
            }

            const avgRest = totalRest / totalDuration;
            const avgDuration = totalDuration / segments.length; // Approximate

            // Work Ratio: How much of the time is a person Working vs Total Cycle?
            // Ratio = Duration / (Duration + Rest)
            // Example Hamal: 2 / (2+6) = 0.25 (25% of time working)
            const workRatio = avgDuration / (avgDuration + avgRest);

            // Staff Needed = ManHoursNeeded / (24 * WorkRatio)
            // Example Hamal: 24 / (24 * 0.25) = 4.
            const exactStaffNeeded = dailyManHours / (24 * workRatio);

            // However, a simpler discrete math for 24h cycle:
            // "Sum of people in all shifts" (Sayur logic: 4+4+5=13)
            // This applies if Cycle == 24h.
            // If Cycle < 24h, logic is ManHours based.
            // Let's use the ManHours formula as it generalizes.

            const staffNeeded = Math.ceil(exactStaffNeeded);
            totalRequired += staffNeeded;

            return {
                id: task.id,
                name: task.name,
                staffNeeded,
                exact: exactStaffNeeded.toFixed(1),
                manHours: dailyManHours,
                avgRest: avgRest.toFixed(1),
                details: `${dailyManHours} שעות אדם ביום / יחס תעסוקה ${(workRatio * 100).toFixed(0)}%`,
                error: false,
                data: {
                    duration: avgDuration.toFixed(1),
                    rest: avgRest.toFixed(1),
                    cycle: (avgDuration + avgRest).toFixed(1),
                    shiftsPerDay: (24 / (avgDuration + avgRest)).toFixed(1)
                }
            };
        });

        return { totalRequired, breakdown };
    }, [tasks]);

    const surplus = totalPeople - analysis.totalRequired;
    const isDeficit = surplus < 0;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in duration-300">
            {/* Header Status */}
            <div className={`p-4 border-b flex items-center justify-between ${isDeficit ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${isDeficit ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                        <Users size={20} />
                    </div>
                    <div>
                        <h3 className={`font-black text-lg ${isDeficit ? 'text-red-900' : 'text-green-900'}`}>
                            {isDeficit ? 'חוסר בסד״כ!' : 'סד״כ תקין'}
                        </h3>
                        <p className={`text-xs ${isDeficit ? 'text-red-700' : 'text-green-700'}`}>
                            נדרשים {analysis.totalRequired} לוחמים למילוי משימות (יש {totalPeople})
                        </p>
                    </div>
                </div>
                <div className="text-center">
                    <span className={`text-2xl font-black ${isDeficit ? 'text-red-600' : 'text-green-600'}`}>
                        {surplus > 0 ? '+' : ''}{surplus}
                    </span>
                    <span className="block text-[10px] text-slate-500 uppercase font-bold">Reserves</span>
                </div>
            </div>

            {/* Breakdown Table */}
            <div className="p-0">
                <table className="w-full text-right text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                        <tr>
                            <th className="px-4 py-3">משימה</th>
                            <th className="px-4 py-3">נגזרת (אנשים)</th>
                            <th className="px-4 py-3 text-center">פרטים</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {analysis.breakdown.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50/50">
                                <td className="px-4 py-3 font-medium text-slate-700">{item.name}</td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                                            {item.staffNeeded}
                                        </span>
                                        <span className="text-xs text-slate-400">
                                            ({item.exact})
                                        </span>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    {item.error ? (
                                        <span className="text-red-500 flex items-center justify-start gap-1">
                                            <AlertCircle size={12} /> {item.details}
                                        </span>
                                    ) : (
                                        <div className="flex flex-col gap-0.5 text-right">
                                            <span className="font-bold text-slate-600 block">
                                                משמרת {item.data?.duration} שעות + {item.data?.rest} שעות מנוחה
                                            </span>
                                            <span className="text-slate-400">
                                                מחזוריות: {item.data?.cycle} שעות
                                            </span>
                                            <span className="text-[10px] text-slate-400 bg-slate-50 border border-slate-100 rounded px-1.5 py-0.5 inline-block w-fit mt-1">
                                                {item.data?.shiftsPerDay} משמרות ביום (לאדם) = נדרשים {item.exact} אנשים למילוי רציף
                                            </span>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 text-center">
                * החישוב מתבסס על מחזוריות משמרת + מנוחה נדרשת ל-24 שעות
            </div>
        </div>
    );
};
