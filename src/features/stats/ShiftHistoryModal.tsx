import React, { useState, useMemo } from 'react';
import { Person, Shift, TaskTemplate, Role } from '../../types';
import { GenericModal } from '../../components/ui/GenericModal';
import { Button } from '../../components/ui/Button';
import ExcelJS from 'exceljs';
import { useToast } from '../../contexts/ToastContext';
import {
    X, Clock, Moon, Sun, TrendUp, TrendDown, Minus,
    ChartBar, CalendarBlank, Sparkle, CheckCircle, Warning,
    Medal, Fire, ClipboardText as ClipboardList,
    DownloadSimple, WhatsappLogo, Copy, MicrosoftExcelLogo
} from '@phosphor-icons/react';
import { getPersonInitials } from '../../utils/nameUtils';
import { LiveIndicator } from '@/components/attendance/LiveIndicator';
import { MapPin } from '@phosphor-icons/react';

interface ShiftHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    person: Person;
    shifts: Shift[];
    tasks: TaskTemplate[];
    roles: Role[];
    people: Person[];
    teams: import('../../types').Team[];
    teamAverages: {
        avgHoursPerPerson: number;
        avgShiftsPerPerson: number;
        avgNightHoursPerPerson: number;
        avgLoadPerPerson: number;
    };
    nightShiftStart?: string;
    nightShiftEnd?: string;
}

type TabType = 'overview' | 'past' | 'future';

export const ShiftHistoryModal: React.FC<ShiftHistoryModalProps> = ({
    isOpen,
    onClose,
    person,
    shifts,
    tasks,
    roles,
    people,
    teams,
    teamAverages,
    nightShiftStart = '22:00',
    nightShiftEnd = '06:00'
}) => {
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState<TabType>('overview');

    // Calculate all metrics
    const metrics = useMemo(() => {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        const personShifts = shifts
            .filter(s => s.assignedPersonIds.includes(person.id))
            .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

        const pastShifts = personShifts.filter(s => new Date(s.endTime) < now); // All past shifts
        const futureShifts = personShifts.filter(s => new Date(s.startTime) >= now); // All future shifts

        let totalHours = 0;
        let nightHours = 0;
        let totalLoad = 0;
        let longestShift = 0;
        const taskCounts: Record<string, number> = {};

        // ... existing calculations ...
        const positionStats: Record<string, { taskName: string; timeRange: string; count: number, totalHours: number }> = {};

        personShifts.forEach(shift => {
            const task = tasks.find(t => t.id === shift.taskId);
            if (!task) return;

            const duration = (new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) / (1000 * 60 * 60);
            totalHours += duration;
            totalLoad += duration * task.difficulty;
            longestShift = Math.max(longestShift, duration);

            // Count tasks
            taskCounts[task.name] = (taskCounts[task.name] || 0) + 1;

            // Position Stats Logic
            const startStr = new Date(shift.startTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
            const endStr = new Date(shift.endTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
            const timeRange = `${startStr}-${endStr}`;
            const key = `${task.name}|${timeRange}`;

            if (!positionStats[key]) {
                positionStats[key] = { taskName: task.name, timeRange, count: 0, totalHours: 0 };
            }
            positionStats[key].count++;
            positionStats[key].totalHours += duration;

            // Night hours
            const start = new Date(shift.startTime);
            const end = new Date(shift.endTime);
            let current = new Date(start);
            const startHour = parseInt(nightShiftStart.split(':')[0]);
            const endHour = parseInt(nightShiftEnd.split(':')[0]);

            while (current < end) {
                const h = current.getHours();
                const isNight = startHour > endHour ? (h >= startHour || h < endHour) : (h >= startHour && h < endHour);
                if (isNight) nightHours++;
                current.setHours(current.getHours() + 1);
            }
        });

        const mostCommonTask = Object.entries(taskCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'אין';
        const avgShiftDuration = personShifts.length > 0 ? totalHours / personShifts.length : 0;
        const sortedPositionStats = Object.values(positionStats).sort((a, b) => b.count - a.count);



        // Comparison to averages
        const hoursVsAvg = teamAverages.avgHoursPerPerson > 0
            ? ((totalHours - teamAverages.avgHoursPerPerson) / teamAverages.avgHoursPerPerson) * 100
            : 0;
        const shiftsVsAvg = teamAverages.avgShiftsPerPerson > 0
            ? ((personShifts.length - teamAverages.avgShiftsPerPerson) / teamAverages.avgShiftsPerPerson) * 100
            : 0;
        const loadVsAvg = teamAverages.avgLoadPerPerson > 0
            ? ((totalLoad - teamAverages.avgLoadPerPerson) / teamAverages.avgLoadPerPerson) * 100
            : 0;

        return {
            totalShifts: personShifts.length,
            totalHours,
            nightHours,
            totalLoad,
            longestShift,
            mostCommonTask,
            avgShiftDuration,
            pastShifts,
            futureShifts,

            sortedPositionStats,
            hoursVsAvg,
            shiftsVsAvg,
            loadVsAvg
        };
    }, [person, shifts, tasks, teamAverages, nightShiftStart, nightShiftEnd]);

    const handleExportToExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Miuim App';
        workbook.created = new Date();

        // --- SHEET 1: OVERVIEW & BREAKDOWN ---
        const wsOverview = workbook.addWorksheet('סקירה וסיכום', { views: [{ rightToLeft: true }] });

        // Headers
        wsOverview.mergeCells('A1:C1');
        wsOverview.getCell('A1').value = `דוח סיכום לחייל: ${person.name}`;
        wsOverview.getCell('A1').font = { size: 16, bold: true };
        wsOverview.getCell('A1').alignment = { horizontal: 'center' };

        // General Stats
        wsOverview.addRow(['סה"כ שעות', 'סה"כ משמרות', 'שעות לילה', 'משימה נפוצה']);
        wsOverview.addRow([
            metrics.totalHours.toFixed(1),
            metrics.totalShifts,
            metrics.nightHours,
            metrics.mostCommonTask
        ]);
        wsOverview.getRow(2).font = { bold: true };

        wsOverview.addRow([]);

        // Shift Distribution Table
        wsOverview.addRow(['התפלגות משמרות (לפי משימה ושעה)']);
        wsOverview.getRow(5).font = { size: 12, bold: true, underline: true };

        wsOverview.addRow(['משימה', 'שעות', 'כמות פעמים', 'סה"כ שעות מצטבר']);
        wsOverview.getRow(6).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        wsOverview.getRow(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }; // Indigo

        metrics.sortedPositionStats.forEach(stat => {
            wsOverview.addRow([
                stat.taskName,
                stat.timeRange,
                stat.count,
                stat.totalHours.toFixed(1)
            ]);
        });

        wsOverview.getColumn(1).width = 20;
        wsOverview.getColumn(2).width = 20;
        wsOverview.getColumn(3).width = 15;
        wsOverview.getColumn(4).width = 20;


        // --- SHEET 2: PAST SHIFTS ---
        const wsPast = workbook.addWorksheet('היסטוריית משמרות', { views: [{ rightToLeft: true }] });
        wsPast.columns = [
            { header: 'תאריך', key: 'date', width: 15 },
            { header: 'יום', key: 'day', width: 10 },
            { header: 'שעות', key: 'time', width: 15 },
            { header: 'משימה', key: 'task', width: 25 },
            { header: 'משך (שעות)', key: 'duration', width: 12 },
        ];
        wsPast.getRow(1).font = { bold: true };
        wsPast.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };

        metrics.pastShifts.forEach(shift => {
            const task = tasks.find(t => t.id === shift.taskId);
            const start = new Date(shift.startTime);
            const end = new Date(shift.endTime);
            const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

            wsPast.addRow({
                date: start.toLocaleDateString('he-IL'),
                day: start.toLocaleDateString('he-IL', { weekday: 'long' }),
                time: `${start.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`,
                task: task?.name || 'משימה',
                duration: duration.toFixed(1)
            });
        });


        // --- SHEET 3: FUTURE SHIFTS ---
        const wsFuture = workbook.addWorksheet('משמרות עתידיות', { views: [{ rightToLeft: true }] });
        wsFuture.columns = [
            { header: 'תאריך', key: 'date', width: 15 },
            { header: 'יום', key: 'day', width: 10 },
            { header: 'שעות', key: 'time', width: 15 },
            { header: 'משימה', key: 'task', width: 25 },
            { header: 'משך (שעות)', key: 'duration', width: 12 },
        ];
        wsFuture.getRow(1).font = { bold: true };
        wsFuture.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };

        metrics.futureShifts.forEach(shift => {
            const task = tasks.find(t => t.id === shift.taskId);
            const start = new Date(shift.startTime);
            const end = new Date(shift.endTime);
            const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

            wsFuture.addRow({
                date: start.toLocaleDateString('he-IL'),
                day: start.toLocaleDateString('he-IL', { weekday: 'long' }),
                time: `${start.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`,
                task: task?.name || 'משימה',
                duration: duration.toFixed(1)
            });
        });

        // Generate File
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `דוח_חייל_${person.name}_${new Date().toLocaleDateString('he-IL').replace(/\./g, '_')}.xlsx`;
        link.click();
        URL.revokeObjectURL(url);
        showToast('הקובץ המלא (סקירה, היסטוריה ועתיד) נוצר בהצלחה', 'success');
    };

    const handleCopyToWhatsapp = () => {
        if (metrics.futureShifts.length === 0) {
            showToast('אין משימות עתידיות להעתקה', 'warning');
            return;
        }

        let message = `*משימות עתידיות עבור ${person.name}:*\n\n`;

        metrics.futureShifts.forEach(shift => {
            const task = tasks.find(t => t.id === shift.taskId);
            const start = new Date(shift.startTime);
            const dateStr = start.toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric' });
            const sStart = start.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
            const end = new Date(shift.endTime);
            const sEnd = end.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
            const isCrossDay = start.getDate() !== end.getDate();

            const personnelNames = shift.assignedPersonIds
                .map(id => people.find(p => p.id === id)?.name)
                .filter(Boolean)
                .join(', ');

            const timeStr = `\u202A${sStart} - ${sEnd}\u202C${isCrossDay ? ' (יום למחרת)' : ''}`;

            message += `• *${task?.name || 'משימה'}* | ${timeStr}: ${personnelNames}\n\n`;
        });

        message += `_הופק באמצעות מערכת סידור המשימות_`;

        navigator.clipboard.writeText(message).then(() => {
            showToast('הטקסט הועתק ללוח בפורמט וואטסאפ!', 'success');
            // Optionally open WhatsApp
            // window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
        });
    };

    const renderOverview = () => {
        return (
            <div className="space-y-4 pt-1">
                {/* Visual Stats Row */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900 p-4 rounded-3xl shadow-xl shadow-slate-200/50 text-white group">
                        <div className="absolute -right-4 -top-4 w-20 h-20 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="p-1.5 bg-white/10 rounded-lg backdrop-blur-md">
                                    <Clock size={16} weight="fill" className="text-blue-300" />
                                </div>
                                <div className="text-[10px] font-black uppercase tracking-widest opacity-70">שעות עבודה</div>
                            </div>
                            <div className="text-3xl font-black flex items-baseline gap-1">
                                {metrics.totalHours.toFixed(0)}
                                <span className="text-xs opacity-50 font-bold tracking-tighter">ש'</span>
                            </div>
                            <div className={`mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black border backdrop-blur-md ${metrics.hoursVsAvg >= 0 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-red-500/20 text-red-200 border-red-500/30'}`}>
                                {metrics.hoursVsAvg >= 0 ? <TrendUp size={10} weight="bold" /> : <TrendDown size={10} weight="bold" />}
                                {Math.abs(metrics.hoursVsAvg).toFixed(1)}% {metrics.hoursVsAvg >= 0 ? 'מעל' : 'מתחת'} הממוצע
                            </div>
                        </div>
                    </div>

                    <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 to-blue-700 p-4 rounded-3xl shadow-xl shadow-indigo-200/50 text-white group">
                        <div className="absolute -right-4 -top-4 w-20 h-20 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="p-1.5 bg-white/10 rounded-lg backdrop-blur-md">
                                    <Fire size={16} weight="fill" className="text-amber-300" />
                                </div>
                                <div className="text-[10px] font-black uppercase tracking-widest opacity-70">ניקוד עומס</div>
                            </div>
                            <div className="text-3xl font-black flex items-baseline gap-1">
                                {metrics.totalLoad.toFixed(0)}
                                <span className="text-xs opacity-50 font-bold tracking-tighter">PT</span>
                            </div>
                            <div className={`mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black border backdrop-blur-md ${metrics.loadVsAvg >= 0 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-red-500/20 text-red-200 border-red-500/30'}`}>
                                {metrics.loadVsAvg >= 0 ? <TrendUp size={10} weight="bold" /> : <TrendDown size={10} weight="bold" />}
                                {Math.abs(metrics.loadVsAvg).toFixed(1)}% {metrics.loadVsAvg >= 0 ? 'מעל' : 'מתחת'} הממוצע
                            </div>
                        </div>
                    </div>
                </div>

                {/* Secondary Metrics */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white border border-slate-100 p-3 rounded-2xl shadow-sm flex flex-col items-center group hover:border-indigo-200 transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                            <Moon size={16} weight="bold" />
                        </div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">שעות לילה</div>
                        <div className="text-lg font-black text-slate-800">{metrics.nightHours}<span className="text-[10px] opacity-40 ml-0.5">ש'</span></div>
                    </div>
                    <div className="bg-white border border-slate-100 p-3 rounded-2xl shadow-sm flex flex-col items-center group hover:border-blue-200 transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                            <ChartBar size={16} weight="bold" />
                        </div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">משמרות</div>
                        <div className="text-lg font-black text-slate-800">{metrics.totalShifts}</div>
                    </div>
                    <div className="bg-white border border-slate-100 p-3 rounded-2xl shadow-sm flex flex-col items-center group hover:border-emerald-200 transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-500 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                            <Sun size={16} weight="bold" />
                        </div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">ממוצע</div>
                        <div className="text-lg font-black text-slate-800">{metrics.avgShiftDuration.toFixed(1)}<span className="text-[10px] opacity-40 ml-0.5">ש'</span></div>
                    </div>
                </div>

                {/* Breakdown Table (Improved Design) */}
                <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
                    <div className="bg-slate-50/50 px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-1.5 h-4 bg-indigo-500 rounded-full" />
                            <h4 className="text-sm font-black text-slate-800 tracking-tight">התפלגות משימות ושעות</h4>
                        </div>
                        <div className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
                            {metrics.sortedPositionStats.length} וריאציות
                        </div>
                    </div>

                    <div>
                        <table className="w-full text-right border-collapse">
                            <thead className="bg-slate-50/30 sticky top-0 z-10 text-[10px] text-slate-400 font-black uppercase tracking-widest backdrop-blur-md">
                                <tr>
                                    <th className="px-5 py-3 text-right">משימה</th>
                                    <th className="px-3 py-3 text-right">טווח שעות</th>
                                    <th className="px-3 py-3 text-left">כמות</th>
                                    <th className="px-5 py-3 text-left">שעות מצטבר</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {metrics.sortedPositionStats.map((stat, idx) => (
                                    <tr key={`${stat.taskName}-${stat.timeRange}`} className="hover:bg-slate-50/80 transition-colors group">
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                                    {idx + 1}
                                                </div>
                                                <span className="text-xs font-black text-slate-700">{stat.taskName}</span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-3.5">
                                            <div className="text-[10px] font-black text-slate-500 bg-white px-2 py-1 rounded-lg border border-slate-100 inline-block text-center min-w-[75px] shadow-sm">
                                                {stat.timeRange}
                                            </div>
                                        </td>
                                        <td className="px-3 py-3.5 text-left">
                                            <span className="text-xs font-black text-indigo-600">
                                                {stat.count}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5 text-left">
                                            <span className="text-xs font-black text-slate-800">
                                                {stat.totalHours.toFixed(1)} <span className="opacity-40 text-[9px]">ש'</span>
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {metrics.sortedPositionStats.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="text-center py-12 text-sm text-slate-400 font-bold">
                                            אין נתונים להצגה
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>


            </div>
        );
    };

    const renderPastShifts = () => {
        if (metrics.pastShifts.length === 0) {
            return (
                <div className="bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 py-8 text-center">
                    <p className="font-black text-slate-400 text-sm">אין היסטוריה להצגה כרגע</p>
                </div>
            );
        }

        const grouped: Record<string, typeof metrics.pastShifts> = {};
        metrics.pastShifts.forEach(shift => {
            const date = new Date(shift.startTime);
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            const weekKey = weekStart.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
            if (!grouped[weekKey]) grouped[weekKey] = [];
            grouped[weekKey].push(shift);
        });

        return (
            <div className="space-y-4 relative pr-2 overflow-x-hidden pt-1">
                <div className="absolute right-[4px] top-6 bottom-4 w-px bg-slate-100" />
                {Object.entries(grouped).reverse().map(([week, weekShifts]) => (
                    <div key={week} className="relative">
                        <div className="absolute right-[-6px] top-2 w-2.5 h-2.5 bg-white border-2 border-slate-200 rounded-full z-10" />
                        <h4 className="text-[8px] font-black text-slate-400 bg-slate-50 px-2 py-0.5 rounded-lg inline-block uppercase mb-2 mr-3 border border-slate-100">שבוע {week}</h4>
                        <div className="space-y-1.5 mr-3">
                            {weekShifts.map(shift => {
                                const task = tasks.find(t => t.id === shift.taskId);
                                const duration = (new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) / (1000 * 60 * 60);
                                return (
                                    <div key={shift.id} className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm flex flex-col gap-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="w-7 h-7 rounded bg-slate-50 flex items-center justify-center text-slate-400 shrink-0 border border-slate-100">
                                                    <ClipboardList size={14} weight="bold" />
                                                </div>
                                                <div className="min-w-0">
                                                    <h5 className="font-black text-slate-800 text-[11px] leading-tight truncate">{task?.name || 'משימה'}</h5>
                                                    <p className="text-[8px] text-slate-400 font-bold">
                                                        {new Date(shift.startTime).toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric' })}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-left shrink-0 pl-1">
                                                <div className="text-xs font-black text-slate-800">{duration.toFixed(1)}<span className="text-[8px] opacity-40 ml-0.5">ש'</span></div>
                                                <div className="text-[8px] text-slate-400 font-bold">
                                                    {new Date(shift.startTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Real-time Attendance Reporting for this date */}
                                        {(() => {
                                            const dateKey = new Date(shift.startTime).toLocaleDateString('en-CA');
                                            const avail = person.dailyAvailability?.[dateKey];
                                            if (!avail?.actual_arrival_at && !avail?.actual_departure_at) return null;

                                            return (
                                                <div className="mt-1 pt-2 border-t border-slate-50 flex flex-wrap gap-2">
                                                    {avail.actual_arrival_at && (
                                                        <LiveIndicator
                                                            type="arrival"
                                                            size="sm"
                                                            time={new Date(avail.actual_arrival_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                                            locationName={avail.reported_location_name}
                                                        />
                                                    )}
                                                    {avail.actual_departure_at && (
                                                        <LiveIndicator
                                                            type="departure"
                                                            size="sm"
                                                            time={new Date(avail.actual_departure_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                                            locationName={avail.reported_location_name}
                                                        />
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const renderFutureShifts = () => {
        if (metrics.futureShifts.length === 0) {
            return (
                <div className="bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 py-8 text-center">
                    <p className="font-black text-slate-400 text-sm">אין משמרות עתידיות</p>
                </div>
            );
        }

        const now = new Date();
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        return (
            <div className="space-y-3 pt-1">
                {/* Actions Row */}
                <div className="flex gap-2 mb-2">
                    <button
                        onClick={handleExportToExcel}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100 hover:bg-emerald-100 transition-colors font-black text-xs"
                    >
                        <MicrosoftExcelLogo size={16} weight="bold" />
                        ייצוא לאקסל
                    </button>
                    <button
                        onClick={handleCopyToWhatsapp}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors font-black text-xs shadow-sm shadow-green-200"
                    >
                        <WhatsappLogo size={16} weight="bold" />
                        העתק לוואטסאפ
                    </button>
                </div>

                {metrics.futureShifts.map(shift => {
                    const task = tasks.find(t => t.id === shift.taskId);
                    const shiftStart = new Date(shift.startTime);
                    const duration = (new Date(shift.endTime).getTime() - shiftStart.getTime()) / (1000 * 60 * 60);

                    let accentColor = 'bg-slate-300';
                    let highlightLabel = '';

                    if (shiftStart.toDateString() === now.toDateString()) {
                        accentColor = 'bg-blue-500';
                        highlightLabel = 'היום';
                    } else if (shiftStart.toDateString() === tomorrow.toDateString()) {
                        accentColor = 'bg-purple-500';
                        highlightLabel = 'מחר';
                    } else if (shiftStart < weekFromNow) {
                        accentColor = 'bg-emerald-500';
                        highlightLabel = 'השבוע';
                    }

                    return (
                        <div key={shift.id} className="p-3 rounded-xl border border-slate-100 bg-white shadow-sm group hover:border-blue-100 transition-colors">
                            <div className="flex items-center gap-4">
                                {/* Right: Task Info */}
                                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                    <div className={`w-0.5 h-7 rounded-full shrink-0 ${accentColor}`} />
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                            <h5 className="font-black text-slate-800 text-[11px] leading-tight truncate">{task?.name || 'משימה'}</h5>
                                            {highlightLabel && (
                                                <span className={`text-[7px] font-black px-1.5 py-0.5 rounded text-white uppercase ${accentColor} tracking-tighter`}>
                                                    {highlightLabel}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[9px] text-slate-400 font-bold">
                                            {shiftStart.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'short' })}
                                        </p>
                                    </div>
                                </div>

                                {/* Left: Time & Duration */}
                                <div className="flex items-center gap-4 shrink-0">
                                    <div className="text-right">
                                        <div className="text-[10px] font-black text-slate-500 leading-none">
                                            <span dir="ltr">{shiftStart.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} - {new Date(shift.endTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        <div className="text-[7px] font-black text-slate-300 uppercase tracking-widest mt-0.5">שעות פעילות</div>
                                    </div>

                                    <div className="w-px h-6 bg-slate-100" />

                                    <div className="text-left min-w-[32px]">
                                        <div className="text-base font-black text-slate-800 leading-none">{duration.toFixed(1)}<span className="text-[9px] opacity-40 ml-0.5">ש'</span></div>
                                        <div className="text-[7px] font-black text-slate-300 uppercase tracking-widest mt-0.5">סה"כ</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    const modalTitle = (() => {
        const team = teams.find(t => t.id === person.teamId);
        const colorClass = team ? (team.color?.replace('border-', 'bg-') || 'bg-slate-300') : person.color;

        return (
            <div className="flex items-center gap-4 min-w-0 pr-2">
                <div className="relative shrink-0">
                    <div
                        className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-md border-[3px] border-white ring-1 ring-slate-100 ${colorClass}`}
                    >
                        {getPersonInitials(person.name)}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 bg-green-500 rounded-full border-2 border-white shadow-sm flex items-center justify-center">
                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                    </div>
                </div>

                <div className="min-w-0">
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight leading-none mb-1.5 truncate">
                        {person.name}
                    </h2>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-3 text-xs font-bold text-slate-400">
                            <span className="flex items-center gap-1.5"><Medal size={14} weight="bold" className="text-amber-500" /> {metrics.totalShifts} משמרות</span>
                            <span className="flex items-center gap-1.5"><Clock size={14} weight="bold" className="text-blue-500" /> {metrics.totalHours.toFixed(0)} שעות</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    })();

    const modalHeaderActions = (
        <div className="flex items-center gap-2">
            <button
                onClick={handleExportToExcel}
                className="w-10 h-10 flex items-center justify-center text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors border border-transparent hover:border-emerald-100"
                title="ייצוא משימות עתידיות לאקסל"
            >
                <MicrosoftExcelLogo size={20} weight="bold" />
            </button>
            <button
                onClick={handleCopyToWhatsapp}
                className="w-10 h-10 flex items-center justify-center text-slate-500 hover:bg-slate-50 rounded-full transition-colors border border-transparent hover:border-slate-200"
                title="העתק משימות ללוח"
            >
                <Copy size={20} weight="bold" />
            </button>
        </div>
    );

    return (
        <GenericModal
            isOpen={isOpen}
            onClose={onClose}
            size="xl"
            title={modalTitle}
            headerActions={modalHeaderActions}
        >
            <div className="flex flex-col h-full -mt-2">

                {/* Compact Tabs */}
                <div className="flex gap-1.5 mb-5 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/50 backdrop-blur-sm">
                    {(['overview', 'past', 'future'] as const).map((tab) => {
                        const Icon = tab === 'overview' ? ChartBar : tab === 'past' ? CalendarBlank : Sparkle;
                        const label = tab === 'overview' ? 'סקירה' : tab === 'past' ? 'עבר' : 'עתיד';
                        const isActive = activeTab === tab;
                        return (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-black text-[11px] transition-all duration-300 ${isActive
                                    ? 'bg-white text-indigo-600 shadow-lg shadow-indigo-100/50 border border-indigo-50'
                                    : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
                                    }`}
                            >
                                <Icon size={16} weight={isActive ? 'fill' : 'bold'} />
                                <span>{label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Content Container - Single Scrollbar */}
                <div className="max-h-[65vh] overflow-y-auto custom-scrollbar px-0.5 pb-2">
                    {activeTab === 'overview' && renderOverview()}
                    {activeTab === 'past' && renderPastShifts()}
                    {activeTab === 'future' && renderFutureShifts()}
                </div>

                {/* Enhanced Footer Stats */}
                <div className="mt-6 pt-5 border-t border-slate-100">
                    <div className="grid grid-cols-3 gap-3">
                        <div className="flex flex-col items-center p-3 rounded-2xl bg-white border border-slate-100 shadow-sm group hover:border-indigo-200 hover:shadow-md transition-all duration-300">
                            <div className="flex items-center gap-1.5 mb-2">
                                <span className="p-1 rounded-md bg-indigo-50 text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                                    <Sparkle size={12} weight="fill" />
                                </span>
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 group-hover:text-slate-600 transition-colors">נפוצה ביותר</span>
                            </div>
                            <div className="text-xs font-black text-indigo-900 truncate w-full text-center px-1">
                                {metrics.mostCommonTask}
                            </div>
                        </div>

                        <div className="flex flex-col items-center p-3 rounded-2xl bg-white border border-slate-100 shadow-sm group hover:border-orange-200 hover:shadow-md transition-all duration-300">
                            <div className="flex items-center gap-1.5 mb-2">
                                <span className="p-1 rounded-md bg-orange-50 text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                                    <Fire size={12} weight="fill" />
                                </span>
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 group-hover:text-orange-600 transition-colors">שיא משמרת</span>
                            </div>
                            <div className="text-xs font-black text-slate-800">
                                {metrics.longestShift.toFixed(1)} <span className="text-[10px] opacity-40">ש'</span>
                            </div>
                        </div>

                        <div className="flex flex-col items-center p-3 rounded-2xl bg-white border border-slate-100 shadow-sm group hover:border-blue-200 hover:shadow-md transition-all duration-300">
                            <div className="flex items-center gap-1.5 mb-2">
                                <span className="p-1 rounded-md bg-blue-50 text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                                    <Clock size={12} weight="fill" />
                                </span>
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 group-hover:text-blue-600 transition-colors">ממוצע</span>
                            </div>
                            <div className="text-xs font-black text-slate-800">
                                {metrics.avgShiftDuration.toFixed(1)} <span className="text-[10px] opacity-40">ש'</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </GenericModal>
    );
};
