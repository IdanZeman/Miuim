import React, { useMemo } from 'react';
import { TaskTemplate, SchedulingSegment } from '@/types';
import { Users, Clock, WarningCircle as AlertCircle } from '@phosphor-icons/react';

interface StaffingAnalysisProps {
    tasks: TaskTemplate[];
    totalPeople: number;
    viewStartDate?: Date;
    viewEndDate?: Date;
}

export const StaffingAnalysis: React.FC<StaffingAnalysisProps> = ({ tasks, totalPeople, viewStartDate, viewEndDate }) => {

    const { headers, tableData, totalDaily, maxReq, simulationRange } = useMemo(() => {
        // 1. Determine Date Range
        let simStart = viewStartDate ? new Date(viewStartDate) : new Date();
        let simEnd = viewEndDate ? new Date(viewEndDate) : new Date();

        if (!viewStartDate || !viewEndDate) {
            // Auto-detect range if not provided
            simEnd.setMonth(simEnd.getMonth() + 2);
            const taskStarts = tasks.map(t => t.startDate ? new Date(t.startDate) : null).filter(d => d) as Date[];
            const taskEnds = tasks.map(t => t.endDate ? new Date(t.endDate) : null).filter(d => d) as Date[];

            if (taskStarts.length > 0) simStart = new Date(Math.min(...taskStarts.map(d => d.getTime())));
            if (taskEnds.length > 0) simEnd = new Date(Math.max(...taskEnds.map(d => d.getTime())));

            if (simEnd <= simStart) {
                simEnd = new Date(simStart);
                simEnd.setDate(simEnd.getDate() + 30);
            }
        }

        // Ensure range isn't too huge for display, cap at ~60 days for table sanity if auto-detected
        // But if viewStartDate is provided, respect it.

        const headers: { date: Date, label: string, subLabel: string, iso: string }[] = [];
        const dayMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

        for (let d = new Date(simStart); d <= simEnd; d.setDate(d.getDate() + 1)) {
            headers.push({
                date: new Date(d),
                label: d.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' }),
                subLabel: d.toLocaleDateString('he-IL', { weekday: 'short' }),
                iso: d.toLocaleDateString('en-CA')
            });
        }

        const totalDaily: Record<string, number> = {};
        let maxReq = 0;
        headers.forEach(h => totalDaily[h.iso] = 0);

        // 2. Build Table Rows
        const tableData = tasks.map(task => {
            const rowCells: Record<string, number | null> = {};
            const taskStart = task.startDate ? task.startDate : '1900-01-01';
            const taskEnd = task.endDate ? task.endDate : '2100-01-01';

            headers.forEach(h => {
                const dateKey = h.iso;
                // Check Global Task Range
                if (dateKey < taskStart || dateKey > taskEnd) {
                    rowCells[dateKey] = null;
                    return;
                }

                // Check Segments
                let dailySum = 0;
                let isActive = false;

                if (!task.segments || task.segments.length === 0) {
                    // No segments -> 0
                } else {
                    task.segments.forEach(seg => {
                        let segActive = false;
                        if (seg.frequency === 'daily') {
                            segActive = true;
                        } else if (seg.frequency === 'specific_date') {
                            if (seg.specificDate === dateKey) segActive = true;
                        } else if (seg.frequency === 'weekly') {
                            const dayName = dayMap[h.date.getDay()];
                            if (seg.daysOfWeek?.includes(dayName)) segActive = true;
                        } else if (seg.frequency === 'one_time') { // Fallback/Legacy
                            const s = (seg as any).startDate;
                            const e = (seg as any).endDate;
                            if (s && e && dateKey >= s && dateKey <= e) segActive = true;
                        }

                        if (segActive) {
                            isActive = true;
                            dailySum += seg.requiredPeople;
                        }
                    });
                }

                if (isActive) {
                    rowCells[dateKey] = dailySum;
                    totalDaily[dateKey] += dailySum;
                } else {
                    rowCells[dateKey] = null; // Not active on this specific day (e.g. weekend for weekday task)
                }
            });

            return { task, cells: rowCells };
        });

        // Calc max
        Object.values(totalDaily).forEach(v => {
            if (v > maxReq) maxReq = v;
        });

        return { headers, tableData, totalDaily, maxReq, simulationRange: { start: simStart, end: simEnd } };

    }, [tasks, viewStartDate, viewEndDate]);

    const surplus = totalPeople - maxReq;
    const isDeficit = surplus < 0;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full max-h-[80vh]">
            {/* Header Status */}
            <div className={`p-4 border-b flex items-center justify-between shrink-0 ${isDeficit ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${isDeficit ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                        <Users size={20} weight="bold" />
                    </div>
                    <div>
                        <h3 className={`font-black text-lg ${isDeficit ? 'text-red-900' : 'text-green-900'}`}>
                            {isDeficit ? 'חוסר בסד״כ!' : 'סד״כ תקין'}
                        </h3>
                        <p className={`text-xs ${isDeficit ? 'text-red-700' : 'text-green-700'}`}>
                            שיא הדרישה: {maxReq} לוחמים (יש {totalPeople})
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

            {/* Matrix Table Wrapper */}
            <div className="relative flex-1 overflow-auto bg-white" dir="rtl">
                <table className="w-full border-collapse">
                    <thead className="sticky top-0 z-20 bg-slate-50 shadow-sm">
                        <tr>
                            <th className="sticky right-0 z-30 bg-slate-50 border-b border-l border-slate-200 p-2 text-right text-xs font-bold w-48 min-w-[12rem] text-slate-700 shadow-[1px_0_3px_rgba(0,0,0,0.05)]">
                                משימה / תאריך
                            </th>
                            {headers.map(h => (
                                <th key={h.iso} className="border-b border-l border-slate-100 p-1 text-center min-w-[3.5rem] w-14">
                                    <div className="text-xs font-bold text-slate-700">{h.label}</div>
                                    <div className="text-[10px] text-slate-400 font-normal">{h.subLabel}</div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {tableData.map((row, idx) => (
                            <tr key={row.task.id} className={`hover:bg-slate-50/50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                                <td className="sticky right-0 z-10 bg-white border-l border-b border-slate-100 p-2 text-right shadow-[1px_0_3px_rgba(0,0,0,0.05)]">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1 h-6 rounded-full shrink-0" style={{ backgroundColor: row.task.color || '#cbd5e1' }} />
                                        <div className="min-w-0">
                                            <div className="text-xs font-bold text-slate-700 truncate max-w-[10rem]" title={row.task.name}>{row.task.name}</div>
                                            {/* Mini date range if specific */}
                                            {(row.task.startDate || row.task.endDate) && (
                                                <div className="text-[9px] text-slate-400 flex items-center gap-1">
                                                    <Clock size={8} weight="bold" />
                                                    {row.task.startDate ? new Date(row.task.startDate).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' }) : '∞'} -
                                                    {row.task.endDate ? new Date(row.task.endDate).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' }) : '∞'}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                {headers.map(h => {
                                    const val = row.cells[h.iso];
                                    return (
                                        <td key={h.iso} className="border-b border-l border-slate-100 p-1 text-center">
                                            {val !== null ? (
                                                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${val > 0 ? 'bg-blue-50 text-blue-700' : 'text-slate-300'}`}>
                                                    {val > 0 ? val : '-'}
                                                </span>
                                            ) : (
                                                <span className="text-slate-200 text-[10px]">•</span>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                    <tfoot className="sticky bottom-0 z-20 bg-slate-50 font-bold border-t border-slate-200 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
                        <tr className="bg-slate-100">
                            <td className="sticky right-0 z-30 bg-slate-100 border-l border-slate-200 p-2 text-right text-xs text-slate-800 shadow-[1px_0_3px_rgba(0,0,0,0.05)]">
                                סה״כ יומי
                            </td>
                            {headers.map(h => {
                                const total = totalDaily[h.iso];
                                const isOverCapacity = total > totalPeople;
                                return (
                                    <td key={h.iso} className={`border-l border-slate-200 p-1 text-center text-xs ${isOverCapacity ? 'text-red-600 bg-red-50' : 'text-slate-700'}`}>
                                        {total}
                                    </td>
                                );
                            })}
                        </tr>
                    </tfoot>
                </table>
            </div>
            <div className="p-2 text-center text-[10px] text-slate-400 border-t bg-white shrink-0">
                * הטבלה מציגה דרשיות כוח אדם לכל יום. ייתכן שחלק מהמשימות אינן פעילות בימים מסוימים (למשל סופ"ש).
            </div>
        </div>
    );
};
