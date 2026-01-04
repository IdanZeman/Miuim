import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useBattalionData } from '../../hooks/useBattalionData';
import { Person } from '@/types';
import { CalendarBlank as Calendar, ListChecks, Users, CircleNotch as Loader2, DownloadSimple as Download, MagnifyingGlass as Search, DotsThreeVertical as MoreVertical, X } from '@phosphor-icons/react';
import { ExportButton } from '../../components/ui/ExportButton';
import { DateNavigator } from '../../components/ui/DateNavigator';
import { GlobalTeamCalendar } from '../scheduling/GlobalTeamCalendar';
import { AttendanceTable } from '../scheduling/AttendanceTable';
import { PersonalAttendanceCalendar } from '../scheduling/PersonalAttendanceCalendar';
import { PageInfo } from '@/components/ui/PageInfo';
import { ActionBar } from '@/components/ui/ActionBar';
import { getEffectiveAvailability } from '@/utils/attendanceUtils';
import ExcelJS from 'exceljs';

export const BattalionAttendanceManager: React.FC = () => {
    const { organization } = useAuth();
    const [viewMode, setViewMode] = useState<'calendar' | 'table' | 'day_detail'>('calendar');
    const [calendarViewType, setCalendarViewType] = useState<'grid' | 'table'>('grid');
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [viewDate, setViewDate] = useState(new Date());
    const [searchTerm, setSearchTerm] = useState('');
    const [showMoreActions, setShowMoreActions] = useState(false);
    const [selectedPersonForCalendar, setSelectedPersonForCalendar] = useState<Person | null>(null);

    // Fetch battalion data using the new optimized hook
    const {
        companies = [],
        people = [],
        teams = [],
        teamRotations = [],
        absences = [],
        hourlyBlockages = [],
        presenceSummary = [],
        isLoading
    } = useBattalionData(organization?.battalion_id);

    const handleDateClick = (date: Date) => {
        setSelectedDate(date);
        setViewMode('day_detail');
    };

    const handleExport = async () => {
        try {
            const workbook = new ExcelJS.Workbook();

            if (viewMode === 'calendar' || viewMode === 'table') {
                // --- Monthly Matrix Export (Styled) ---
                const worksheet = workbook.addWorksheet('דוח גדודי מרוכז', { views: [{ rightToLeft: true }] });
                const year = viewDate.getFullYear();
                const month = viewDate.getMonth();
                const daysInMonth = new Date(year, month + 1, 0).getDate();

                // 1. Headers
                const headers = ['שם מלא', 'פלוגה', 'צוות'];
                const dateKeys: string[] = [];
                for (let d = 1; d <= daysInMonth; d++) {
                    const date = new Date(year, month, d);
                    dateKeys.push(date.toLocaleDateString('en-CA'));
                    headers.push(date.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' }));
                }
                headers.push('סיכום (בסיס/בית)');

                const headerRow = worksheet.addRow(headers);
                headerRow.font = { bold: true, size: 12 };
                headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
                headerRow.eachCell((cell) => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
                    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                });

                // 2. Data Rows
                // Sort by Company -> Team -> Name
                const sortedPeople = [...people].sort((a, b) => {
                    const companyA = companies.find(c => c.id === a.organization_id)?.name || '';
                    const companyB = companies.find(c => c.id === b.organization_id)?.name || '';
                    if (companyA !== companyB) return companyA.localeCompare(companyB);
                    const teamA = teams.find(t => t.id === a.teamId)?.name || '';
                    const teamB = teams.find(t => t.id === b.teamId)?.name || '';
                    if (teamA !== teamB) return teamA.localeCompare(teamB);
                    return a.name.localeCompare(b.name);
                });

                sortedPeople.forEach(person => {
                    const companyName = companies.find(c => c.id === person.organization_id)?.name || '-';
                    const teamName = teams.find(t => t.id === person.teamId)?.name || '-';

                    const rowValues = [person.name, companyName, teamName];
                    let baseCount = 0;
                    let homeCount = 0;

                    dateKeys.forEach(dateKey => {
                        const dateObj = new Date(dateKey);
                        // Access effective availability for this person/date from Battalion Data
                        // Note: Battalion data might not have full history for everyone if not fetched.
                        // Assuming getEffectiveAvailability can work with provided data.
                        const avail = getEffectiveAvailability(person, dateObj, teamRotations, absences, hourlyBlockages);

                        let cellText = '';
                        let cellColor = '';
                        let textColor = '';

                        if (avail.status === 'base' || avail.status === 'full') {
                            cellText = 'בבסיס';
                            cellColor = 'FFD1FAE5'; // Green 100
                            textColor = 'FF065F46'; // Green 800
                            baseCount++;
                        } else if (avail.status === 'home') {
                            cellText = 'בית';
                            cellColor = 'FFFEE2E2'; // Red 100
                            textColor = 'FF991B1B'; // Red 800
                            homeCount++;
                        } else if (avail.status === 'unavailable') {
                            cellText = 'אילוץ';
                            cellColor = 'FFFEF3C7'; // Amber 100
                            textColor = 'FF92400E'; // Amber 800
                            homeCount++;
                        } else if (avail.status === 'arrival') {
                            cellText = `הגעה (${avail.startHour || '?'})`;
                            cellColor = 'FFD1FAE5'; // Green 100
                            textColor = 'FF065F46';
                            baseCount++;
                        } else if (avail.status === 'departure') {
                            cellText = `יציאה (${avail.endHour || '?'})`;
                            cellColor = 'FFFEE2E2'; // Red 100 (Count as Home day usually? Or Base? Logic dependent)
                            cellColor = 'FFFEF3C7'; // Amber for transition
                            textColor = 'FF92400E';
                            homeCount++;
                        } else if (avail.status === 'sick') {
                            cellText = 'גימלים';
                            cellColor = 'FFFFE4E6'; // Rose 100
                            textColor = 'FFBE123C'; // Rose 700
                            homeCount++;
                        } else if (avail.status === 'leave') {
                            cellText = 'חופשה';
                            cellColor = 'FFE0E7FF'; // Indigo 100
                            textColor = 'FF3730A3'; // Indigo 700
                            homeCount++;
                        } else {
                            cellText = 'לא הוזן';
                        }

                        // Add absence/exit request info if exists
                        const relevantAbsence = absences.find(a =>
                            a.person_id === person.id &&
                            dateKey >= a.start_date &&
                            dateKey <= a.end_date &&
                            (a.status === 'approved' || a.status === 'pending')
                        );
                        if (relevantAbsence) {
                            const reasonText = relevantAbsence.reason || 'בקשת יציאה';
                            const statusText = relevantAbsence.status === 'pending' ? '(ממתין) ' : '';
                            cellText += ` [${statusText}${reasonText}]`;
                        }

                        rowValues.push(cellText);
                    });

                    rowValues.push(`${baseCount} / ${homeCount}`);
                    const row = worksheet.addRow(rowValues);

                    // Style Cells
                    row.eachCell((cell, colNumber) => {
                        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                        if (colNumber > 3 && colNumber < rowValues.length + 1) { // Date Columns
                            const val = cell.value?.toString() || '';
                            if (val.includes('בית')) {
                                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
                                cell.font = { color: { argb: 'FF991B1B' } };
                            } else if (val.includes('בבסיס') || val.includes('הגעה')) {
                                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
                                cell.font = { color: { argb: 'FF065F46' } };
                            } else if (val.includes('אילוץ') || val.includes('יציאה')) {
                                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
                                cell.font = { color: { argb: 'FF92400E' } };
                            } else if (val.includes('גימלים')) {
                                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE4E6' } };
                                cell.font = { color: { argb: 'FFBE123C' } };
                            } else if (val.includes('חופשה')) {
                                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
                                cell.font = { color: { argb: 'FF3730A3' } };
                            }
                        }
                    });
                });

                worksheet.columns = [
                    { width: 20 }, { width: 15 }, { width: 15 }, // Meta
                    ...dateKeys.map(() => ({ width: 15 })), // Dates
                    { width: 15 } // Summary
                ];

            } else {
                // --- Daily Report (Styled) ---
                const worksheet = workbook.addWorksheet('דוח יומי', { views: [{ rightToLeft: true }] });
                const headers = ['פלוגה', 'שם מלא', 'צוות', 'סטטוס', 'שעות', 'סיבה/הערות'];
                const headerRow = worksheet.addRow(headers);
                headerRow.font = { bold: true };
                headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
                headerRow.eachCell(cell => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
                    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                });

                const dateKey = selectedDate.toLocaleDateString('en-CA');

                // Sort by Company -> Team -> Name
                const sortedPeople = [...people].sort((a, b) => {
                    const companyA = companies.find(c => c.id === a.organization_id)?.name || '';
                    const companyB = companies.find(c => c.id === b.organization_id)?.name || '';
                    if (companyA !== companyB) return companyA.localeCompare(companyB);
                    const teamA = teams.find(t => t.id === a.teamId)?.name || '';
                    const teamB = teams.find(t => t.id === b.teamId)?.name || '';
                    if (teamA !== teamB) return teamA.localeCompare(teamB);
                    return a.name.localeCompare(b.name);
                });

                sortedPeople.forEach(person => {
                    const companyName = companies.find(c => c.id === person.organization_id)?.name || '-';
                    const teamName = teams.find(t => t.id === person.teamId)?.name || '-';
                    const avail = getEffectiveAvailability(person, selectedDate, teamRotations, absences, hourlyBlockages);

                    const isAtBase = avail.status === 'base' || avail.status === 'full' || avail.status === 'arrival' || avail.status === 'departure';

                    let statusLabel = 'לא הוזן';
                    let cellColor = '';
                    let textColor = '';

                    if (isAtBase) {
                        statusLabel = avail.status === 'arrival' ? 'הגעה' : (avail.status === 'departure' ? 'יציאה' : 'בבסיס');
                        cellColor = 'FFD1FAE5'; // Green
                        textColor = 'FF065F46';
                    } else if (avail.status === 'home') {
                        statusLabel = 'בית';
                        cellColor = 'FFFEE2E2'; // Red
                        textColor = 'FF991B1B';
                    } else if (avail.status === 'unavailable') {
                        statusLabel = 'אילוץ';
                        cellColor = 'FFFEF3C7'; // Amber
                        textColor = 'FF92400E';
                    } else if (avail.status === 'sick') {
                        statusLabel = 'גימלים';
                        cellColor = 'FFFFE4E6'; // Rose
                        textColor = 'FFBE123C';
                    } else if (avail.status === 'leave') {
                        statusLabel = 'חופשה';
                        cellColor = 'FFE0E7FF'; // Indigo
                        textColor = 'FF3730A3';
                    }

                    const hours = isAtBase ? `${avail.startHour} - ${avail.endHour}` : '-';

                    let blockReason = (avail as any).reason;
                    if (!blockReason && avail.unavailableBlocks && avail.unavailableBlocks.length > 0) {
                        blockReason = avail.unavailableBlocks.map((b: any) => b.reason).join(', ');
                    }
                    let reason = blockReason || (avail.source === 'rotation' ? 'סבב' : 'ידני');
                    const relevantAbsence = absences.find(a => a.person_id === person.id && dateKey >= a.start_date && dateKey <= a.end_date);
                    if (relevantAbsence) {
                        reason += ` | [${relevantAbsence.status === 'pending' ? '(ממתין) ' : ''}${relevantAbsence.reason || 'בקשת יציאה'}]`;
                    }

                    const row = worksheet.addRow([companyName, person.name, teamName, statusLabel, hours, reason]);

                    // Style Cells
                    row.eachCell((cell, colNumber) => {
                        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                        if (colNumber === 4 && cellColor) { // Status Column
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cellColor } };
                            cell.font = { color: { argb: textColor }, bold: true };
                            cell.alignment = { horizontal: 'center' };
                        }
                    });
                });

                worksheet.columns = [
                    { width: 15 }, // Company
                    { width: 25 }, // Name
                    { width: 15 }, // Team
                    { width: 12 }, // Status
                    { width: 18 }, // Hours
                    { width: 45 }  // Reason
                ];
            }

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `battalion_attendance_${viewMode === 'calendar' ? (viewDate.getMonth() + 1) + '_' + viewDate.getFullYear() : selectedDate.toLocaleDateString('en-CA')}.xlsx`;
            link.click();
            URL.revokeObjectURL(url);

        } catch (error) {
            console.error("Export error:", error);
        }
    };

    const filteredPeople = people.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.phone && p.phone.includes(searchTerm))
    );

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <Loader2 className="animate-spin text-blue-600 mb-4" size={40} />
                <p className="text-slate-500 font-bold">טוען יומן נוכחות גדודי...</p>
            </div>
        );
    }

    if (!organization?.battalion_id) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <Calendar className="text-slate-300 mb-4" size={64} />
                <p className="text-slate-500 font-bold">ארגון זה אינו משויך לגדוד</p>
                <p className="text-slate-400 text-sm">
                    {organization?.is_hq
                        ? 'ארגון HQ חייב להיות משויך לגדוד דרך הגדרות הגדוד'
                        : 'רק ארגוני HQ יכולים לצפות ביומן נוכחות גדודי'
                    }
                </p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-[2rem] shadow-xl md:shadow-portal border border-slate-100 flex flex-col h-[calc(100vh-150px)] md:h-[calc(100vh-100px)] relative overflow-hidden">
            {/* Mobile View */}
            <div className="flex-1 flex flex-col md:hidden relative isolate z-10 overflow-hidden">
                {/* Mobile Header */}
                <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200/50 sticky top-0 z-50 px-3 py-3 flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                        {/* View Mode Selector */}
                        <div className="flex-1 flex items-center p-1 bg-slate-100/80 rounded-xl border border-slate-200/50 h-9">
                            <button
                                onClick={() => setViewMode('calendar')}
                                className={`flex-1 flex items-center justify-center gap-1.5 h-full rounded-lg transition-all duration-300 ${viewMode === 'calendar' ? 'bg-white text-blue-600 shadow-sm font-black' : 'text-slate-500 font-bold'}`}
                            >
                                <Calendar size={14} weight="duotone" />
                                <span className="text-xs">חודשי</span>
                            </button>
                            <button
                                onClick={() => { setViewMode('day_detail'); setSelectedDate(new Date()); }}
                                className={`flex-1 flex items-center justify-center gap-1.5 h-full rounded-lg transition-all duration-300 ${viewMode === 'day_detail' ? 'bg-white text-blue-600 shadow-sm font-black' : 'text-slate-500 font-bold'}`}
                            >
                                <ListChecks size={14} weight="duotone" />
                                <span className="text-xs">יומי</span>
                            </button>
                        </div>
                        <ExportButton
                            onExport={handleExport}
                            iconOnly
                            variant="secondary"
                            size="sm"
                            className="w-9 h-9 rounded-xl"
                            title="ייצוא לאקסל"
                        />
                    </div>

                    {/* Date Navigator */}
                    <div className="bg-slate-50/50 rounded-xl border border-slate-100 p-0.5">
                        <DateNavigator
                            date={viewMode === 'calendar' ? viewDate : selectedDate}
                            onDateChange={(d) => {
                                if (viewMode === 'calendar') setViewDate(d);
                                else setSelectedDate(d);
                            }}
                            mode={viewMode === 'calendar' ? 'month' : 'day'}
                            className="w-full justify-between border-none bg-transparent h-9"
                            showTodayButton={true}
                        />
                    </div>
                </div>

                {/* Mobile Content */}
                <div className="flex-1 overflow-hidden flex flex-col">
                    {viewMode === 'calendar' ? (
                        <div className="h-full flex flex-col">
                            <GlobalTeamCalendar
                                teams={teams}
                                people={people}
                                teamRotations={teamRotations}
                                absences={absences}
                                hourlyBlockages={hourlyBlockages}
                                onDateClick={handleDateClick}
                                currentDate={viewDate}
                                onDateChange={setViewDate}
                                viewType={calendarViewType}
                                onViewTypeChange={setCalendarViewType}
                            />
                        </div>
                    ) : (
                        <div className="h-full flex flex-col">
                            {/* Search Bar */}
                            <div className="px-4 py-3 bg-white/50 backdrop-blur-sm border-b border-slate-100">
                                <div className="relative group">
                                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none transition-colors group-focus-within:text-blue-600 text-slate-400">
                                        <Search size={16} weight="duotone" />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="חיפוש לוחם..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="block w-full h-10 pr-10 pl-4 bg-slate-100/50 border-none rounded-2xl text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500/20 transition-all font-bold text-sm"
                                    />
                                </div>
                            </div>
                            <AttendanceTable
                                teams={teams}
                                people={filteredPeople}
                                teamRotations={teamRotations}
                                absences={absences}
                                hourlyBlockages={hourlyBlockages}
                                currentDate={selectedDate}
                                onDateChange={setSelectedDate}
                                onSelectPerson={(p) => setSelectedPersonForCalendar(p)}
                                className="h-full"
                                isViewer={true}
                                companies={companies}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Desktop View */}
            <div className="hidden md:flex flex-col flex-1 overflow-hidden">
                {/* Desktop Action Bar */}
                <ActionBar
                    searchTerm={viewMode !== 'calendar' ? searchTerm : ''}
                    onSearchChange={setSearchTerm}
                    onExport={handleExport}
                    className="p-4"
                    leftActions={
                        <div className="flex items-center gap-4">
                            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                <Calendar className="text-blue-600" size={24} weight="duotone" />
                                יומן נוכחות גדודי
                                <PageInfo
                                    title="יומן נוכחות גדודי"
                                    description={
                                        <>
                                            <p className="mb-2">מבט מרוכז על נוכחות כל הלוחמים בגדוד.</p>
                                            <ul className="list-disc list-inside space-y-1 mb-2 text-right">
                                                <li><b>תצוגת לוח שנה:</b> מבט חודשי על כל הפלוגות.</li>
                                                <li><b>תצוגת טבלה:</b> טבלה חודשית מפורטת.</li>
                                                <li><b>תצוגת רשימה:</b> פירוט יומי לפי פלוגות.</li>
                                            </ul>
                                            <p className="text-sm bg-blue-50 p-2 rounded text-blue-800">
                                                יומן זה הוא לצפייה בלבד. עריכת נוכחות מתבצעת ברמת הפלוגה.
                                            </p>
                                        </>
                                    }
                                />
                            </h2>

                            <div className="h-6 w-px bg-slate-200 mx-1" />

                            {/* View Mode Selector */}
                            <div className="flex bg-slate-100/80 rounded-xl p-1 border border-slate-200/50">
                                <button
                                    onClick={() => setViewMode('calendar')}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-2 h-7 ${viewMode === 'calendar' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    <Calendar size={14} weight="duotone" />
                                    לוח שנה
                                </button>
                                <button
                                    onClick={() => setViewMode('table')}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-2 h-7 ${viewMode === 'table' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    <ListChecks size={14} weight="duotone" />
                                    טבלה חודשית
                                </button>
                                <button
                                    onClick={() => setViewMode('day_detail')}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-2 h-7 ${viewMode === 'day_detail' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    <Users size={14} weight="duotone" />
                                    רשימה יומית
                                </button>
                            </div>
                        </div>
                    }
                    rightActions={
                        <DateNavigator
                            date={(viewMode === 'calendar' || viewMode === 'table') ? viewDate : selectedDate}
                            onDateChange={(d) => {
                                if (viewMode === 'calendar' || viewMode === 'table') setViewDate(d);
                                else setSelectedDate(d);
                            }}
                            mode={(viewMode === 'calendar' || viewMode === 'table') ? 'month' : 'day'}
                        />
                    }
                />

                {/* Desktop Content */}
                <div className="flex-1 overflow-hidden flex flex-col isolate z-10">
                    {viewMode === 'calendar' ? (
                        <div className="h-full flex flex-col bg-white overflow-hidden">
                            <GlobalTeamCalendar
                                teams={teams}
                                people={people}
                                teamRotations={teamRotations}
                                absences={absences}
                                hourlyBlockages={hourlyBlockages}
                                onDateClick={handleDateClick}
                                currentDate={viewDate}
                                onDateChange={setViewDate}
                                viewType={calendarViewType}
                                onViewTypeChange={setCalendarViewType}
                            />
                        </div>
                    ) : (
                        <div className="h-full flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200">
                            <AttendanceTable
                                teams={teams}
                                people={filteredPeople}
                                teamRotations={teamRotations}
                                absences={absences}
                                hourlyBlockages={hourlyBlockages}
                                currentDate={viewMode === 'table' ? viewDate : selectedDate}
                                onDateChange={viewMode === 'table' ? setViewDate : setSelectedDate}
                                viewMode={viewMode === 'day_detail' ? 'daily' : 'monthly'}
                                onSelectPerson={(p) => setSelectedPersonForCalendar(p)}
                                className="h-full"
                                isViewer={true}
                                companies={companies}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Person Details Modal */}
            {selectedPersonForCalendar && (
                <PersonalAttendanceCalendar
                    person={selectedPersonForCalendar}
                    teamRotations={teamRotations}
                    absences={absences}
                    onClose={() => setSelectedPersonForCalendar(null)}
                    onUpdatePerson={() => { }}
                    isViewer={true}
                />
            )}
        </div>
    );
};
