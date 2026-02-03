import React, { useState, useMemo } from 'react';
import ExcelJS from 'exceljs';
import { GenericModal } from '../../components/ui/GenericModal';
import { Button } from '../../components/ui/Button';
import { DatePicker } from '../../components/ui/DatePicker';
import { Shift, Person, TaskTemplate, Team, Role } from '../../types';
import { DownloadSimple as Download, Check, Funnel, MicrosoftExcelLogo } from '@phosphor-icons/react';
import { ExportButton } from '../../components/ui/ExportButton';
import { useToast } from '../../contexts/ToastContext';
import { logger } from '../../services/loggingService';
import { MultiSelect } from '../../components/ui/MultiSelect';

interface MissionReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    shifts: Shift[];
    people: Person[];
    tasks: TaskTemplate[];
    teams: Team[];
    roles: Role[];
    nightShiftStart?: string;
    nightShiftEnd?: string;
}

export const MissionReportModal: React.FC<MissionReportModalProps> = ({
    isOpen,
    onClose,
    shifts,
    people,
    tasks,
    teams,
    roles,
    nightShiftStart = "22:00",
    nightShiftEnd = "06:00"
}) => {
    const { showToast } = useToast();
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    // Filters
    const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
    const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
    const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);

    const activePeople = useMemo(() => people.filter(p => p.isActive !== false), [people]);

    const filteredPeople = useMemo(() => {
        let result = activePeople;
        if (selectedTeamIds.length > 0) {
            result = result.filter(p => p.teamId && selectedTeamIds.includes(p.teamId));
        }
        if (selectedPersonIds.length > 0) {
            result = result.filter(p => selectedPersonIds.includes(p.id));
        }
        return result;
    }, [activePeople, selectedTeamIds, selectedPersonIds]);

    const handleExport = async () => {
        try {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);

            if (end < start) {
                showToast('תאריך סיום חייב להיות אחרי תאריך התחלה', 'error');
                return;
            }

            // 1. Filter Shifts
            const pertinentShifts = shifts.filter(s => {
                // Exclude cancelled shifts
                if (s.isCancelled) return false;
                const sDate = new Date(s.startTime);
                if (sDate < start || sDate > end) return false;
                if (selectedTaskIds.length > 0 && !selectedTaskIds.includes(s.taskId)) return false;
                return true;
            });

            // 2. Prepare Data per Person
            const reportData = filteredPeople.map(person => {
                const personShifts = pertinentShifts.filter(s => s.assignedPersonIds.includes(person.id));
                // Sort by time
                personShifts.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

                let totalHours = 0;
                let dayHours = 0;
                let nightHours = 0;
                let totalShifts = personShifts.length;
                let restTimes: number[] = [];
                let lastEndTime: number | null = null;

                // Night Shift Calculation Helpers
                const nStartHour = parseInt(nightShiftStart.split(':')[0]);
                const nEndHour = parseInt(nightShiftEnd.split(':')[0]);

                personShifts.forEach(shift => {
                    const sTime = new Date(shift.startTime);
                    const eTime = new Date(shift.endTime);
                    const duration = (eTime.getTime() - sTime.getTime()) / (1000 * 60 * 60);

                    totalHours += duration;

                    // Rest time calc
                    if (lastEndTime !== null) {
                        const gap = (sTime.getTime() - lastEndTime) / (1000 * 60 * 60);
                        if (gap > 0) restTimes.push(gap);
                    }
                    lastEndTime = eTime.getTime();

                    // Day/Night logic (simplified iteration)
                    let current = new Date(sTime);
                    let localDay = 0;
                    let localNight = 0;

                    let tempCurrent = new Date(sTime);
                    while (tempCurrent < eTime) {
                        const h = tempCurrent.getHours();
                        const isNight = nStartHour > nEndHour
                            ? (h >= nStartHour || h < nEndHour)
                            : (h >= nStartHour && h < nEndHour);

                        if (isNight) localNight++;
                        else localDay++;

                        tempCurrent.setHours(tempCurrent.getHours() + 1);
                    }
                    nightHours += localNight;
                    dayHours += (duration - localNight);
                });

                // Fix if Day < 0 due to approximation
                if (dayHours < 0) dayHours = 0;

                const avgRest = restTimes.length > 0 ? restTimes.reduce((a, b) => a + b, 0) / restTimes.length : 0;
                const minRest = restTimes.length > 0 ? Math.min(...restTimes) : 0;
                const maxRest = restTimes.length > 0 ? Math.max(...restTimes) : 0;

                return {
                    person,
                    totalHours,
                    dayHours,
                    nightHours,
                    totalShifts,
                    avgRest,
                    minRest,
                    maxRest,
                    shifts: personShifts
                };
            }).filter(d => d.totalShifts > 0);

            if (reportData.length === 0) {
                showToast('לא נמצאו נתונים להפקת דוח', 'warning');
                return;
            }

            // 3. Generate Excel
            const workbook = new ExcelJS.Workbook();
            // workbook.views = [{ rightToLeft: true }]; // workbook view doesn't support RTL, only worksheet view

            // --- SUMMARY SHEET ---
            const summarySheet = workbook.addWorksheet('סיכום נתונים', { views: [{ rightToLeft: true }] });
            const summaryHeaders = [
                'שם',
                'צוות',
                'סה"כ משמרות',
                'סה"כ שעות',
                'שעות יום',
                'שעות לילה',
                'זמן מנוחה ממוצע',
                'זמן מנוחה מינימלי',
                'זמן מנוחה מקסימלי',
                'פירוט משמרות'
            ];

            const headerRow = summarySheet.addRow(summaryHeaders);
            headerRow.eachCell(cell => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D3748' } };
                cell.alignment = { horizontal: 'center' };
            });

            reportData.forEach(d => {
                const teamName = teams.find(t => t.id === d.person.teamId)?.name || '-';

                const shiftDetails = d.shifts.map(s => {
                    const taskName = tasks.find(t => t.id === s.taskId)?.name || 'לא ידוע';
                    const sDate = new Date(s.startTime);
                    const eDate = new Date(s.endTime);
                    const dateStr = sDate.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
                    const timeStr = `${sDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}-${eDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`;
                    return `${taskName} | ${dateStr} | ${timeStr}`;
                }).join('\n');

                const row = summarySheet.addRow([
                    d.person.name,
                    teamName,
                    d.totalShifts,
                    parseFloat(d.totalHours.toFixed(2)),
                    parseFloat(d.dayHours.toFixed(2)),
                    parseFloat(d.nightHours.toFixed(2)),
                    parseFloat(d.avgRest.toFixed(2)),
                    parseFloat(d.minRest.toFixed(2)),
                    parseFloat(d.maxRest.toFixed(2)),
                    shiftDetails
                ]);

                row.eachCell((c, colNumber) => {
                    if (colNumber === 10) { // Shift Details column
                        c.alignment = { wrapText: true, vertical: 'top', horizontal: 'right' };
                    } else {
                        c.alignment = { horizontal: 'center', vertical: 'top' };
                    }
                });
            });
            summarySheet.columns.forEach(c => c.width = 15);
            summarySheet.getColumn(1).width = 25; // Name
            summarySheet.getColumn(10).width = 50; // Shift Details

            // --- DETAILS SHEET ---
            const detailsSheet = workbook.addWorksheet('פירוט משמרות', { views: [{ rightToLeft: true }] });
            const detailHeaders = [
                'תאריך',
                'יום',
                'שעות',
                'משך (שעות)',
                'שם חייל',
                'משימה',
                'סוג (יום/לילה)',
                'הערות'
            ];

            const dHeaderRow = detailsSheet.addRow(detailHeaders);
            dHeaderRow.eachCell(cell => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } };
                cell.alignment = { horizontal: 'center' };
            });

            reportData.forEach(d => {
                d.shifts.forEach(s => {
                    const sDate = new Date(s.startTime);
                    const eDate = new Date(s.endTime);
                    const duration = (eDate.getTime() - sDate.getTime()) / (1000 * 60 * 60);
                    const taskName = tasks.find(t => t.id === s.taskId)?.name || 'לא ידוע';
                    const timeRange = `${sDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} - ${eDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`;
                    const dayName = sDate.toLocaleDateString('he-IL', { weekday: 'long' });

                    const nStart = parseInt(nightShiftStart.split(':')[0]);
                    const h = sDate.getHours();
                    const isNightStart = (h >= nStart || h < parseInt(nightShiftEnd.split(':')[0]));
                    const typeTag = isNightStart ? 'לילה' : 'יום';

                    detailsSheet.addRow([
                        sDate.toLocaleDateString('he-IL'),
                        dayName,
                        timeRange,
                        parseFloat(duration.toFixed(2)),
                        d.person.name,
                        taskName,
                        typeTag,
                        ''
                    ]);
                });
            });
            detailsSheet.columns.forEach(c => c.width = 15);
            detailsSheet.getColumn(5).width = 20; // Name
            detailsSheet.getColumn(6).width = 25; // Task

            // Export
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `mission_report_${startDate}_${endDate}.xlsx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            showToast('דוח הופק בהצלחה', 'success');
            onClose();

        } catch (error) {
            console.error('Report generation error:', error);
            showToast('שגיאה בהפקת הדוח', 'error');
        }
    };

    const modalTitle = (
        <div className="flex flex-col gap-0.5">
            <h3 className="text-xl font-black text-slate-800 leading-tight flex items-center gap-2">
                <MicrosoftExcelLogo className="text-emerald-600" size={24} weight="bold" />
                <span>דוח משימות וביצועים</span>
            </h3>
            <div className="flex items-center gap-2 text-xs text-slate-500 font-bold uppercase tracking-wider">
                <Download size={12} className="text-blue-500" weight="bold" />
                <span>ניתוח נתונים וייצוא לאקסל</span>
            </div>
        </div>
    );

    return (
        <GenericModal
            isOpen={isOpen}
            onClose={onClose}
            title={modalTitle}
            size="md"
            footer={
                <div className="flex gap-3 w-full">
                    <Button variant="ghost" onClick={onClose} className="flex-1">ביטול</Button>
                    <ExportButton onExport={handleExport} className="flex-1" variant="premium" />
                </div>
            }
        >
            <div className="flex flex-col gap-6 py-2">
                {/* Date Selection */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-3">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-1 h-4 bg-blue-500 rounded-full"></div>
                        <span className="text-xs font-black text-slate-700 uppercase tracking-tight">טווח תאריכים</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <DatePicker label="מתאריך" value={startDate} onChange={setStartDate} />
                        <DatePicker label="עד תאריך" value={endDate} onChange={setEndDate} />
                    </div>
                </div>

                {/* Filters */}
                <div className="space-y-4">
                    {/* Tasks */}
                    <div>
                        <div className="flex justify-between items-center mb-2 px-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">סינון משימות</label>
                            {selectedTaskIds.length > 0 &&
                                <button onClick={() => setSelectedTaskIds([])} className="text-[10px] text-blue-600 font-bold hover:underline">נקה</button>
                            }
                        </div>
                        <MultiSelect
                            options={tasks.map(t => ({ label: t.name, value: t.id }))}
                            value={selectedTaskIds}
                            onChange={setSelectedTaskIds}
                            placeholder="בחר משימות (הכל)"
                        />
                    </div>

                    {/* Teams */}
                    <div>
                        <div className="flex justify-between items-center mb-2 px-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">סינון לפי צוותים</label>
                            {selectedTeamIds.length > 0 &&
                                <button onClick={() => setSelectedTeamIds([])} className="text-[10px] text-blue-600 font-bold hover:underline">נקה</button>
                            }
                        </div>
                        <MultiSelect
                            options={teams.map(t => ({ label: t.name, value: t.id }))}
                            value={selectedTeamIds}
                            onChange={setSelectedTeamIds}
                            placeholder="בחר צוותים (הכל)"
                        />
                    </div>
                </div>

                {/* Summary Pre-calculation */}
                <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                    <div className="flex items-center gap-2 text-blue-700 text-xs font-bold">
                        <Check size={14} weight="bold" />
                        <span>ייצא נתונים עבור {filteredPeople.length} חיילים שנבחרו</span>
                    </div>
                </div>
            </div>
        </GenericModal>
    );
};
