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
    DownloadSimple, WhatsappLogo, Copy
} from '@phosphor-icons/react';
import { getPersonInitials } from '../../utils/nameUtils';

interface ShiftHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    person: Person;
    shifts: Shift[];
    tasks: TaskTemplate[];
    roles: Role[];
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

        const pastShifts = personShifts.filter(s => new Date(s.endTime) < now && new Date(s.startTime) >= thirtyDaysAgo);
        const futureShifts = personShifts.filter(s => new Date(s.startTime) >= now && new Date(s.startTime) <= thirtyDaysFromNow);

        let totalHours = 0;
        let nightHours = 0;
        let totalLoad = 0;
        let longestShift = 0;
        const taskCounts: Record<string, number> = {};

        personShifts.forEach(shift => {
            const task = tasks.find(t => t.id === shift.taskId);
            if (!task) return;

            const duration = (new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) / (1000 * 60 * 60);
            totalHours += duration;
            totalLoad += duration * task.difficulty;
            longestShift = Math.max(longestShift, duration);

            // Count tasks
            taskCounts[task.name] = (taskCounts[task.name] || 0) + 1;

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

        // Weekly breakdown (last 4 weeks)
        const weeklyData = [];
        for (let i = 3; i >= 0; i--) {
            const weekStart = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
            const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
            const weekShifts = personShifts.filter(s => {
                const start = new Date(s.startTime);
                return start >= weekStart && start < weekEnd;
            });
            weeklyData.push({
                week: `ש' ${4 - i}`,
                shifts: weekShifts.length
            });
        }

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
            weeklyData,
            hoursVsAvg,
            shiftsVsAvg,
            loadVsAvg
        };
    }, [person, shifts, tasks, teamAverages, nightShiftStart, nightShiftEnd]);

    const handleExportToExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('משימות עתידיות', { views: [{ rightToLeft: true }] });

        worksheet.columns = [
            { header: 'תאריך', key: 'date', width: 15 },
            { header: 'יום', key: 'day', width: 10 },
            { header: 'שעות', key: 'time', width: 15 },
            { header: 'משימה', key: 'task', width: 25 },
            { header: 'משך (שעות)', key: 'duration', width: 12 },
        ];

        // Style header row
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        headerRow.alignment = { horizontal: 'center' };

        metrics.futureShifts.forEach(shift => {
            const task = tasks.find(t => t.id === shift.taskId);
            const start = new Date(shift.startTime);
            const end = new Date(shift.endTime);
            const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

            worksheet.addRow({
                date: start.toLocaleDateString('he-IL'),
                day: start.toLocaleDateString('he-IL', { weekday: 'long' }),
                time: `${start.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`,
                task: task?.name || 'משימה',
                duration: duration.toFixed(1)
            });
        });

        // Center all rows
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber > 1) {
                row.alignment = { horizontal: 'center' };
            }
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `משימות_עתידיות_${person.name}_${new Date().toLocaleDateString('he-IL').replace(/\./g, '_')}.xlsx`;
        link.click();
        URL.revokeObjectURL(url);
        showToast('הקובץ נוצר וירד בהצלחה', 'success');
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
            const end = new Date(shift.endTime);
            const dateStr = start.toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric' });
            const sStart = start.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
            const sEnd = end.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
            const isCrossDay = start.getDate() !== end.getDate();
            const timeStr = `\u202A${sStart} - ${sEnd}\u202C${isCrossDay ? ' (יום למחרת)' : ''}`;

            message += `📅 *${dateStr}* | 🕒 ${timeStr}\n📌 *${task?.name || 'משימה'}*\n\n`;
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
                    <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-700 p-3.5 rounded-2xl shadow-lg shadow-blue-500/10 text-white">
                        <div className="relative z-10">
                            <div className="text-[9px] font-black uppercase tracking-widest opacity-70 mb-0.5">סה"כ שעות עבודה</div>
                            <div className="text-2xl font-black flex items-baseline gap-1">
                                {metrics.totalHours.toFixed(0)}
                                <span className="text-[10px] opacity-60 font-bold tracking-tighter">ש'</span>
                            </div>
                            <div className={`mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[9px] font-bold border border-white/20 backdrop-blur-md ${metrics.hoursVsAvg >= 0 ? 'bg-white/10 text-white' : 'bg-red-500/20 text-red-100'}`}>
                                {metrics.hoursVsAvg >= 0 ? <TrendUp size={8} weight="bold" /> : <TrendDown size={8} weight="bold" />}
                                {Math.abs(metrics.hoursVsAvg).toFixed(1)}% {metrics.hoursVsAvg >= 0 ? 'מעל' : 'מתחת'} הממוצע
                            </div>
                        </div>
                    </div>

                    <div className="relative overflow-hidden bg-gradient-to-br from-blue-700 to-blue-900 p-3.5 rounded-2xl shadow-lg shadow-blue-500/10 text-white">
                        <div className="relative z-10">
                            <div className="text-[9px] font-black uppercase tracking-widest opacity-70 mb-0.5">ניקוד עומס מצטבר</div>
                            <div className="text-2xl font-black flex items-baseline gap-1">
                                {metrics.totalLoad.toFixed(0)}
                                <span className="text-[10px] opacity-60 font-bold tracking-tighter">PT</span>
                            </div>
                            <div className={`mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[9px] font-bold border border-white/20 backdrop-blur-md ${metrics.loadVsAvg >= 0 ? 'bg-white/10 text-white' : 'bg-red-500/20 text-red-100'}`}>
                                {metrics.loadVsAvg >= 0 ? <TrendUp size={8} weight="bold" /> : <TrendDown size={8} weight="bold" />}
                                {Math.abs(metrics.loadVsAvg).toFixed(1)}% {metrics.loadVsAvg >= 0 ? 'מעל' : 'מתחת'} הממוצע
                            </div>
                        </div>
                    </div>
                </div>

                {/* Secondary Metrics */}
                <div className="grid grid-cols-3 gap-2.5">
                    <div className="bg-slate-50 border border-slate-200/50 p-2.5 rounded-xl text-center">
                        <div className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-0.5">שעות לילה</div>
                        <div className="text-base font-black text-slate-800">{metrics.nightHours} <span className="text-[8px] opacity-40">ש'</span></div>
                    </div>
                    <div className="bg-slate-50 border border-slate-200/50 p-2.5 rounded-xl text-center">
                        <div className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-0.5">משמרות</div>
                        <div className="text-base font-black text-slate-800">{metrics.totalShifts}</div>
                    </div>
                    <div className="bg-slate-50 border border-slate-200/50 p-2.5 rounded-xl text-center">
                        <div className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-0.5">ממוצע</div>
                        <div className="text-base font-black text-slate-800">{metrics.avgShiftDuration.toFixed(1)} <span className="text-[8px] opacity-40">ש'</span></div>
                    </div>
                </div>

                {/* Weekly Chart */}
                <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-1.5">
                            <div className="w-1 h-3 bg-blue-500 rounded-full" />
                            <h4 className="text-xs font-black text-slate-800">ביצועים שבועיים</h4>
                        </div>
                        <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
                            4 שבועות אחרונים
                        </div>
                    </div>

                    <div className="flex items-end justify-between gap-3 h-20">
                        {metrics.weeklyData.map((week, idx) => {
                            const maxShifts = Math.max(...metrics.weeklyData.map(w => w.shifts), 1);
                            const percentage = (week.shifts / maxShifts) * 100;
                            return (
                                <div key={idx} className="flex-1 flex flex-col items-center group/bar">
                                    <div className="relative w-full flex-1 flex flex-col justify-end items-center px-1">
                                        <div
                                            className="relative w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-md shadow-sm transition-all duration-300"
                                            style={{ height: `${Math.max(percentage, 5)}%` }}
                                        />
                                    </div>
                                    <div className="mt-1.5 text-[8px] font-black text-slate-400 uppercase">
                                        {week.week}
                                    </div>
                                </div>
                            );
                        })}
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
                                    <div key={shift.id} className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
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
                        <DownloadSimple size={16} weight="bold" />
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

    const modalTitle = (
        <div className="flex items-center gap-4 min-w-0 pr-2">
            <div className="relative shrink-0">
                <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-slate-800 text-2xl font-black shadow-md border-[3px] border-white ring-1 ring-slate-100"
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
                <div className="absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 bg-green-500 rounded-full border-2 border-white shadow-sm flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                </div>
            </div>

            <div className="min-w-0">
                <h2 className="text-2xl font-black text-slate-800 tracking-tight leading-none mb-1.5 truncate">
                    {person.name}
                </h2>
                <div className="flex items-center gap-2">
                    <span className="bg-blue-50 text-blue-600 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border border-blue-100/50">
                        פרופיל חייל
                    </span>
                    <div className="flex items-center gap-3 text-xs font-bold text-slate-400">
                        <span className="flex items-center gap-1.5"><Medal size={14} weight="bold" className="text-amber-500" /> {metrics.totalShifts} משמרות</span>
                        <span className="flex items-center gap-1.5"><Clock size={14} weight="bold" className="text-blue-500" /> {metrics.totalHours.toFixed(0)} שעות</span>
                    </div>
                </div>
            </div>
        </div>
    );

    const modalHeaderActions = (
        <div className="flex items-center gap-2">
            <button
                onClick={handleExportToExcel}
                className="w-10 h-10 flex items-center justify-center text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors border border-transparent hover:border-emerald-100"
                title="ייצוא משימות עתידיות לאקסל"
            >
                <DownloadSimple size={20} weight="bold" />
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
                <div className="flex gap-1 mb-4 bg-slate-50 p-1 rounded-xl border border-slate-100">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg font-black text-[10px] transition-all ${activeTab === 'overview'
                            ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50'
                            : 'text-slate-500 hover:text-slate-800'
                            }`}
                    >
                        <ChartBar size={14} weight={activeTab === 'overview' ? 'fill' : 'bold'} />
                        סקירה
                    </button>
                    <button
                        onClick={() => setActiveTab('past')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg font-black text-[10px] transition-all ${activeTab === 'past'
                            ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50'
                            : 'text-slate-500 hover:text-slate-800'
                            }`}
                    >
                        <CalendarBlank size={14} weight={activeTab === 'past' ? 'fill' : 'bold'} />
                        עבר
                    </button>
                    <button
                        onClick={() => setActiveTab('future')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg font-black text-[10px] transition-all ${activeTab === 'future'
                            ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50'
                            : 'text-slate-500 hover:text-slate-800'
                            }`}
                    >
                        <Sparkle size={14} weight={activeTab === 'future' ? 'fill' : 'bold'} />
                        עתיד
                    </button>
                </div>

                {/* Content Container */}
                <div className="max-h-[50vh] overflow-y-auto custom-scrollbar px-0.5">
                    {activeTab === 'overview' && renderOverview()}
                    {activeTab === 'past' && renderPastShifts()}
                    {activeTab === 'future' && renderFutureShifts()}
                </div>

                {/* Compact Footer Stats */}
                <div className="mt-4 pt-3 border-t border-slate-50">
                    <div className="grid grid-cols-3 gap-2">
                        <div className="text-center">
                            <div className="text-[7px] font-black uppercase tracking-widest text-slate-300 mb-1">משימה נפוצה</div>
                            <div className="text-[9px] font-black text-slate-500 bg-slate-50 py-0.5 px-1.5 rounded-md border border-slate-100 truncate mx-auto max-w-[80px]">
                                {metrics.mostCommonTask}
                            </div>
                        </div>
                        <div className="text-center border-x border-slate-50">
                            <div className="text-[7px] font-black uppercase tracking-widest text-slate-300 mb-1">שיא משמרת</div>
                            <div className="text-[9px] font-black text-slate-500 bg-slate-50 py-0.5 px-1.5 rounded-md">
                                {metrics.longestShift.toFixed(1)} ש'
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="text-[7px] font-black uppercase tracking-widest text-slate-300 mb-1">ממוצע</div>
                            <div className="text-[9px] font-black text-slate-500 bg-slate-50 py-0.5 px-1.5 rounded-md">
                                {metrics.avgShiftDuration.toFixed(1)} ש'
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </GenericModal>
    );
};
