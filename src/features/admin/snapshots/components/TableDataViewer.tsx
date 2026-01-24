import React, { useState } from 'react';
import {
    Clock,
    Eye,
    Calendar,
    Shield,
    Users,
    Package,
    MapPin,
    House,
    CheckCircle as CheckCircleIcon,
    User,
    CheckSquare,
    Square,
    ArrowsClockwise as RestoreIcon,
    DownloadSimple,
    WarningCircle as AlertCircle,
    House as Home,
    Info
} from '@phosphor-icons/react';
import ExcelJS from 'exceljs';
import { useToast } from '../../../../contexts/ToastContext';
import { snapshotService } from '../../../../services/snapshotService';
import { useQueryClient } from '@tanstack/react-query';
import { Modal } from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui/Button';
import { ConfirmationModal } from '../../../../components/ui/ConfirmationModal';
import { useConfirmation } from '../../../../hooks/useConfirmation';
import { mapPersonFromDB, mapAbsenceFromDB, mapRotationFromDB, mapHourlyBlockageFromDB, mapTeamFromDB } from '../../../../services/mappers';
import { populateAttendanceSheet } from '../../../../utils/attendanceExport';
import { getTableLabel, getPersonalId, getProp, safeDate } from '../utils/snapshotUtils';
import { getEffectiveAvailability, getAttendanceDisplayInfo } from '../../../../utils/attendanceUtils';

interface TableDataViewerProps {
    tableName: string;
    data: any[];
    onBack: () => void;
    // Context maps for ID lookups
    peopleMap?: Record<string, any>;
    teamsMap?: Record<string, any>;
    rolesMap?: Record<string, any>;
    tasksMap?: Record<string, any>;
    equipmentMap?: Record<string, any>;
    // Supplementary data for attendance logic
    absences?: any[];
    teamRotations?: any[];
    hourlyBlockages?: any[];
    snapshotDate?: string; // New prop
}

export const TableDataViewer: React.FC<TableDataViewerProps> = ({
    tableName,
    data,
    onBack,
    peopleMap,
    teamsMap,
    rolesMap,
    tasksMap,
    equipmentMap,
    absences = [],
    teamRotations = [],
    hourlyBlockages = [],
    snapshotDate
}) => {
    // ... (rest of component state)

    const { showToast } = useToast();
    const queryClient = useQueryClient();
    const { confirm, modalProps } = useConfirmation();
    const [selectedItem, setSelectedItem] = useState<any | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isRestoring, setIsRestoring] = useState(false);
    const [selectedMonthStr, setSelectedMonthStr] = useState<string | null>(null);

    // ... (helper functions toggleSelection etc)

    const toggleSelection = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const togglePersonSelection = (personId: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            const personRecordIds = data
                .filter(item => getProp(item, 'person_id', 'personId') === personId)
                .map(item => item.id);

            const isSelected = personRecordIds.every(id => next.has(id));
            if (isSelected) personRecordIds.forEach(id => next.delete(id));
            else personRecordIds.forEach(id => next.add(id));
            return next;
        });
    };

    const isPersonSelected = (personId: string) => {
        const personRecordIds = data
            .filter(item => getProp(item, 'person_id', 'personId') === personId)
            .map(item => item.id);
        return personRecordIds.length > 0 && personRecordIds.every(id => selectedIds.has(id));
    };




    const handleDownloadTable = async () => {
        try {
            showToast('מכין קובץ להורדה...', 'info');
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'Miuim System';
            workbook.created = new Date();

            const label = getTableLabel(tableName);

            // SPECIAL CASE: Attendance Report Style for daily_presence
            if (tableName === 'daily_presence' || tableName === 'daily_attendance_snapshots' || tableName === 'unified_presence') {
                const worksheet = workbook.addWorksheet('דוח נוכחות', { views: [{ rightToLeft: true }] });

                let sortedDates: string[] = [];

                if (snapshotDate) {
                    const snapDate = new Date(snapshotDate);
                    const targetMonths: string[] = [];

                    // Generate M-1 to M+2 months
                    for (let i = -1; i <= 2; i++) {
                        const d = new Date(snapDate);
                        d.setMonth(snapDate.getMonth() + i);
                        targetMonths.push(d.toISOString().slice(0, 7));
                    }

                    // Generate all days for these months
                    targetMonths.forEach(monthStr => {
                        const [y, m] = monthStr.split('-').map(Number);
                        const daysInMonth = new Date(y, m, 0).getDate();
                        for (let d = 1; d <= daysInMonth; d++) {
                            const dateObj = new Date(y, m - 1, d);
                            // Fix timezone offset for string format
                            const offsetDate = new Date(dateObj.getTime() - (dateObj.getTimezoneOffset() * 60000));
                            sortedDates.push(offsetDate.toISOString().split('T')[0]);
                        }
                    });
                    sortedDates = sortedDates.sort();

                } else {
                    // Fallback to data-driven dates if no snapshot date provided
                    const dateStrings = data.map(p => {
                        const d = getProp(p, 'date', 'start_date', 'startDate', 'day');
                        return typeof d === 'string' ? d.split('T')[0] : (d instanceof Date ? d.toISOString().split('T')[0] : null);
                    }).filter(Boolean) as string[];

                    if (dateStrings.length > 0) {
                        sortedDates = [...new Set(dateStrings)].sort();
                    }
                }

                if (sortedDates.length === 0) {
                    showToast('אין נתונים לייצוא', 'error');
                    return;
                }

                const startDate = new Date(sortedDates[0]);
                const endDate = new Date(sortedDates[sortedDates.length - 1]);

                // Map all data for utility
                const mappedAbsences = (absences || []).map(mapAbsenceFromDB);
                const mappedRotations = (teamRotations || []).map(mapRotationFromDB);
                const mappedBlockages = (hourlyBlockages || []).map(mapHourlyBlockageFromDB);
                const mappedTeams = Object.values(teamsMap || {}).map(mapTeamFromDB);

                // Build people with their cloned/mapped structure and populate dailyAvailability
                // FILTER: Exclude inactive people
                const mappedPeople: any[] = Object.values(peopleMap || {}).map(p => {
                    const mapped = mapPersonFromDB(p);
                    // mapped.dailyAvailability is already populated correctly from p.daily_availability by mapPersonFromDB
                    return mapped;
                }).filter(p => p.isActive !== false);

                if (mappedPeople.length === 0) {
                    showToast('אין אנשים פעילים לייצוא', 'error');
                    return;
                }

                const peopleById = new Map();
                mappedPeople.forEach(p => peopleById.set(p.id, p));

                data.forEach(record => {
                    const personId = getProp(record, 'person_id', 'personId');
                    const dateVal = getProp(record, 'date', 'start_date', 'startDate', 'day');
                    const dateKey = typeof dateVal === 'string' ? dateVal.split('T')[0] : (dateVal instanceof Date ? dateVal.toISOString().split('T')[0] : null);

                    const person = peopleById.get(personId);
                    if (person && dateKey) {
                        const existing = person.dailyAvailability[dateKey];

                        // Same priority logic as Table Grid:
                        // If we already have a manual override from the person snapshot (live data at time of snapshot),
                        // and the current record is just a default/algorithm record (from daily_presence), 
                        // -> KEEP the manual override. Do not overwrite.
                        if (existing?.source === 'manual' && record.source !== 'manual') {
                            return;
                        }

                        person.dailyAvailability[dateKey] = {
                            status: record.status,
                            isAvailable: record.is_available ?? record.isAvailable,
                            startHour: record.start_time || record.startTime || record.startHour,
                            endHour: record.end_time || record.endTime || record.endHour,
                            homeStatusType: record.home_status_type || record.homeStatusType,
                            source: record.source || 'algorithm'
                        };
                    }
                });

                populateAttendanceSheet({
                    worksheet,
                    people: mappedPeople,
                    teams: mappedTeams,
                    absences: mappedAbsences,
                    rotations: mappedRotations,
                    blockages: mappedBlockages,
                    startDate,
                    endDate
                });
            } else {
                // GENERIC TABLE EXPORT
                const worksheet = workbook.addWorksheet(label, { views: [{ rightToLeft: true }] });

                if (data.length > 0) {
                    const headers = Object.keys(data[0]).filter(k => k !== 'id' && k !== 'organization_id');
                    const headerRow = worksheet.addRow(headers.map(h => {
                        if (h === 'name') return 'שם';
                        if (h === 'date') return 'תאריך';
                        if (h === 'person_id' || h === 'personId') return 'מזהה חייל';
                        if (h === 'status') return 'סטטוס';
                        if (h === 'team_id' || h === 'teamId') return 'צוות';
                        return h;
                    }));
                    headerRow.font = { bold: true };
                    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };

                    data.forEach(item => {
                        const rowData = headers.map(h => {
                            const val = item[h];
                            if (h.includes('id') && h !== 'personal_id') {
                                if ((h === 'person_id' || h === 'personId') && peopleMap?.[val]) return peopleMap[val].name;
                                if ((h === 'team_id' || h === 'teamId') && teamsMap?.[val]) return teamsMap[val].name;
                                if ((h === 'role_id' || h === 'roleId') && rolesMap?.[val]) return rolesMap[val].name;
                            }
                            return val;
                        });
                        worksheet.addRow(rowData);
                    });

                    worksheet.columns.forEach(col => col.width = 15);
                }
            }

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${label}_${new Date().toISOString().split('T')[0]}.xlsx`;
            link.click();
            URL.revokeObjectURL(url);
            showToast('הורדה הושלמה', 'success');
        } catch (error) {
            console.error('Download error:', error);
            showToast('שגיאה במהלך ההורדה', 'error');
        }
    };

    const handleRestoreSelected = async () => {
        if (selectedIds.size === 0) return;

        confirm({
            title: 'שחזור רשומות',
            message: `האם אתה בטוח שברצונך לשחזר ${selectedIds.size} רשומות? פעולה זו תעדכן או תוסיף נתונים למערכת הפעילה.`,
            confirmText: 'שחזר',
            type: 'warning',
            onConfirm: async () => {
                try {
                    setIsRestoring(true);
                    const selectedRecords = data.filter(item => selectedIds.has(item.id));
                    await snapshotService.restoreRecords(tableName, selectedRecords);
                    showToast(`שוחזרו בהצלחה ${selectedIds.size} רשומות`, 'success');
                    setSelectedIds(new Set());
                    queryClient.invalidateQueries({ queryKey: ['organizationData'] });
                    queryClient.invalidateQueries({ queryKey: ['battalionPresence'] });
                } catch (error: any) {
                    console.error('Error restoring records:', error);
                    showToast(error.message || 'שגיאה בשחזור הרשומות', 'error');
                } finally {
                    setIsRestoring(false);
                }
            }
        });
    };



    const renderAttendanceGrid = () => {
        // Group by person
        const personAttendance: Record<string, Record<string, any>> = {};
        const datesSet = new Set<string>();

        data.forEach(p => {
            const personId = getProp(p, 'person_id', 'personId');
            if (!personId) return;
            if (!personAttendance[personId]) personAttendance[personId] = {};
            // Normalize to YYYY-MM-DD to avoid timezone issues with snapshot data
            // Some snapshots might store full ISO strings, so we slice safely
            let dateStr = getProp(p, 'date', 'start_date', 'startDate');
            if (dateStr && dateStr.includes('T')) {
                dateStr = dateStr.split('T')[0];
            }
            if (!dateStr) return;

            personAttendance[personId][dateStr] = p;
            datesSet.add(dateStr);
        });

        // 1. Identify Available Months
        // If snapshotDate exists, we STRICTLY show M-1 to M+2.
        // If not, we fall back to data-driven months.
        let availableMonths: string[] = [];

        if (snapshotDate) {
            const snapDate = new Date(snapshotDate);
            // M-1
            const mMinus1 = new Date(snapDate);
            mMinus1.setMonth(snapDate.getMonth() - 1);
            availableMonths.push(mMinus1.toISOString().slice(0, 7));

            // M
            availableMonths.push(snapDate.toISOString().slice(0, 7));

            // M+1
            const mPlus1 = new Date(snapDate);
            mPlus1.setMonth(snapDate.getMonth() + 1);
            availableMonths.push(mPlus1.toISOString().slice(0, 7));

            // M+2
            const mPlus2 = new Date(snapDate);
            mPlus2.setMonth(snapDate.getMonth() + 2);
            availableMonths.push(mPlus2.toISOString().slice(0, 7));
        } else {
            const dateStrings = Array.from(datesSet).sort();
            availableMonths = Array.from(new Set(dateStrings.map(d => d.substring(0, 7))));
        }

        availableMonths.sort().reverse();

        // 2. Determine Current View Month
        // Default to the SNAPSHOT MONTH (M) if available, otherwise latest
        let defaultMonth = availableMonths[0];
        if (snapshotDate) {
            const snapMonth = new Date(snapshotDate).toISOString().slice(0, 7);
            if (availableMonths.includes(snapMonth)) defaultMonth = snapMonth;
        }

        const currentMonthStr = (selectedMonthStr && availableMonths.includes(selectedMonthStr))
            ? selectedMonthStr
            : defaultMonth;

        // Update state if it was null (initial load)
        if (!selectedMonthStr && currentMonthStr) {
            // We can't set state directly in render, but we can rely on currentMonthStr for this render cycle
        }

        // 3. Generate Display Dates for the Selected Month
        let displayDates: string[] = [];
        if (currentMonthStr) {
            const [yearStr, monthStr] = currentMonthStr.split('-');
            const year = parseInt(yearStr);
            const month = parseInt(monthStr) - 1; // JS 0-indexed
            const daysInMonth = new Date(year, month + 1, 0).getDate();

            for (let d = 1; d <= daysInMonth; d++) {
                const dateObj = new Date(year, month, d);
                const offsetDate = new Date(dateObj.getTime() - (dateObj.getTimezoneOffset() * 60000));
                displayDates.push(offsetDate.toISOString().split('T')[0]);
            }
        }

        if (displayDates.length === 0) {
            return (
                <div className="py-12 text-center text-slate-400 font-bold italic bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                    אין נתוני נוכחות להצגה בגרסה זו
                </div>
            );
        }

        return (
            // Use a simpler container that fits within the modal content area
            <div className="border border-slate-100 rounded-2xl bg-white shadow-sm overflow-hidden flex flex-col flex-1 h-full min-h-0">
                {/* Month Selector Toolbar */}
                {availableMonths.length > 0 && (
                    <div className="flex items-center gap-2 p-2 px-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
                        <span className="text-xs font-black text-slate-500 mr-2 whitespace-nowrap">הצג חודש:</span>
                        <div className="flex gap-1 overflow-x-auto no-scrollbar">
                            {availableMonths.map(m => {
                                const [y, mo] = m.split('-');
                                const label = new Date(parseInt(y), parseInt(mo) - 1).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
                                return (
                                    <button
                                        key={m}
                                        onClick={() => setSelectedMonthStr(m)}
                                        className={`px-3 py-1 rounded-lg text-xs font-black transition-colors whitespace-nowrap
                                            ${currentMonthStr === m ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-200'}
                                        `}
                                    >
                                        {label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Legend Toolbar */}
                <div className="flex items-center gap-4 p-2 px-4 border-b border-slate-100 bg-white text-[10px] font-bold text-slate-500 overflow-x-auto shrink-0 sticky top-0 z-10">
                    <span>מקרא:</span>
                    <div className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded flex items-center justify-center bg-emerald-100 text-emerald-700 font-black text-[10px]">ב</span>
                        <span>בבסיס</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded flex items-center justify-center bg-emerald-100 text-emerald-700 font-black text-[10px]">ג</span>
                        <span>הגעה</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded flex items-center justify-center bg-amber-100 text-amber-700 font-black text-[10px]">י</span>
                        <span>יציאה</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded flex items-center justify-center bg-red-100 text-red-700 font-black text-[10px]">ח</span>
                        <span>בבית</span>
                    </div>
                </div>

                <div className="overflow-auto custom-scrollbar flex-1 relative bg-slate-50">
                    <table className="min-w-full text-right border-separate border-spacing-0 relative">
                        <thead className="sticky top-0 z-40">
                            <tr className="bg-slate-50">
                                <th className="p-3 text-xs font-black text-slate-500 sticky right-0 bg-slate-50 z-50 w-40 min-w-[160px] border-l border-b border-slate-100 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">חייל</th>
                                {displayDates.map(date => {
                                    const d = new Date(date);
                                    return (
                                        <th key={date} className="p-2 text-[10px] font-black text-slate-500 border-b border-r border-slate-100 w-10 min-w-[40px] text-center bg-slate-50">
                                            <div className="flex flex-col items-center">
                                                <span className="opacity-50 text-[9px]">
                                                    {d.toLocaleDateString('he-IL', { weekday: 'short' })}
                                                </span>
                                                <span>{d.getDate()}</span>
                                            </div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {Object.keys(peopleMap || {})
                                .filter(id => {
                                    const p = peopleMap[id];
                                    // Check both case conventions to be safe
                                    return p.is_active !== false && p.isActive !== false;
                                })
                                .sort((a, b) => {
                                    const pA = peopleMap[a];
                                    const pB = peopleMap[b];
                                    const tA = teamsMap?.[pA.team_id || pA.teamId]?.name || '';
                                    const tB = teamsMap?.[pB.team_id || pB.teamId]?.name || '';
                                    const teamDiff = tA.localeCompare(tB, 'he');
                                    if (teamDiff !== 0) return teamDiff;
                                    return (pA.name || '').localeCompare(pB.name || '', 'he');
                                })
                                .map((personId, idx) => (
                                    <tr key={personId} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="p-3 text-xs font-bold text-slate-700 sticky right-0 bg-white z-20 border-l border-b border-slate-50 group-hover:bg-slate-50 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => togglePersonSelection(personId)}
                                                    className={`p-1 rounded transition-colors ${isPersonSelected(personId) ? 'text-blue-600' : 'text-slate-300 hover:text-slate-400'}`}
                                                >
                                                    {isPersonSelected(personId) ? <CheckSquare size={16} weight="fill" /> : <Square size={16} />}
                                                </button>
                                                <div className={`w-6 h-6 rounded-md flex items-center justify-center text-white text-[9px] font-black ${peopleMap?.[personId]?.color || 'bg-slate-400'}`}>
                                                    {peopleMap?.[personId]?.name?.slice(0, 1) || '?'}
                                                </div>
                                                <span className="truncate max-w-[100px]">{peopleMap?.[personId]?.name || `חייל (${personId.slice(0, 4)})`}</span>
                                            </div>
                                        </td>
                                        {displayDates.map((date, i) => {
                                            // Construct a minimal Person object for the utility
                                            // Use mapPersonFromDB to handle raw -> camelCase conversion (including daily_availability)
                                            const rawPerson = peopleMap?.[personId] || {};
                                            const personRecord = mapPersonFromDB(rawPerson);

                                            // Gather all availability for this person to pass to utility
                                            const personDailyMap: Record<string, any> = { ...(personRecord.dailyAvailability || {}) };

                                            // Merge with entries from the snapshot table (daily_presence)
                                            // Priority: Manual entries from People table (Live source) usually override daily_presence (Log/Algorithm)
                                            // However, if daily_presence has manual entries specific to history, we respect them.
                                            if (personAttendance[personId]) {
                                                Object.entries(personAttendance[personId]).forEach(([d, record]: [string, any]) => {
                                                    const normalizedDate = d.includes('T') ? d.split('T')[0] : d;
                                                    const existing = personDailyMap[normalizedDate];

                                                    // If we already have a manual entry from 'people' table, and this record is 'algorithm' or 'default', 
                                                    // SKIP overwriting it (preserve the manual override).
                                                    if (existing?.source === 'manual' && record.source !== 'manual') {
                                                        return;
                                                    }

                                                    // Otherwise, verify if we should merge
                                                    personDailyMap[normalizedDate] = {
                                                        status: getProp(record, 'status'),
                                                        isAvailable: getProp(record, 'is_available', 'isAvailable'),
                                                        startHour: getProp(record, 'start_time', 'startTime', 'startHour'),
                                                        endHour: getProp(record, 'end_time', 'endTime', 'endHour'),
                                                        unavailableBlocks: getProp(record, 'unavailable_blocks', 'unavailableBlocks'),
                                                        homeStatusType: getProp(record, 'home_status_type', 'homeStatusType'),
                                                        source: getProp(record, 'source') || 'algorithm'
                                                    };
                                                });
                                            }

                                            const mockPerson = {
                                                ...personRecord,
                                                dailyAvailability: personDailyMap
                                            };

                                            // Call the utility
                                            const cellDateObj = new Date(date);

                                            // We use the imported supplementary data
                                            const displayInfo = getAttendanceDisplayInfo(
                                                mockPerson as any,
                                                cellDateObj,
                                                teamRotations || [],
                                                absences || [],
                                                hourlyBlockages || []
                                            );

                                            // Capture avail early for use in render
                                            const avail = displayInfo.availability;

                                            let content = null;
                                            let cellClass = "bg-white";

                                            if (displayInfo.displayStatus === 'missing_departure') {
                                                cellClass = "bg-emerald-50/40 text-emerald-800 relative overflow-hidden ring-1 ring-emerald-100/50";
                                                content = (
                                                    <div className="flex flex-col items-center justify-center gap-0.5 w-full h-full relative">
                                                        <div className="absolute top-0.5 right-0.5 text-red-500 animate-pulse">
                                                            <AlertCircle size={10} weight="fill" />
                                                        </div>
                                                        <MapPin size={14} className="text-emerald-500/50" weight="bold" />
                                                        <span className="text-[9px] font-black text-emerald-800 scale-90">בסיס</span>
                                                        <span className="text-[7px] font-bold text-rose-600 leading-tight block whitespace-nowrap scale-75 -mt-0.5">
                                                            חסר יציאה
                                                        </span>
                                                    </div>
                                                );
                                            } else if (displayInfo.displayStatus === 'home' || displayInfo.displayStatus === 'unavailable') {
                                                cellClass = "bg-red-50/70 text-red-800 ring-1 ring-red-100/50";
                                                content = (
                                                    <div className="flex flex-col items-center justify-center gap-0.5 w-full h-full">
                                                        <House size={14} className="text-red-300" weight="bold" />
                                                        <span className="text-[9px] font-black scale-90">{displayInfo.displayStatus === 'unavailable' ? 'אילוץ' : 'בית'}</span>
                                                        {displayInfo.label !== 'בית' && displayInfo.label !== 'אילוץ' && (
                                                            <span className="text-[7px] font-bold text-red-500/70 leading-tight scale-75 truncate max-w-full px-0.5">{displayInfo.label}</span>
                                                        )}
                                                    </div>
                                                );
                                            } else if (displayInfo.isBase) {
                                                if (displayInfo.displayStatus === 'single_day') {
                                                    cellClass = "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100/50";
                                                    content = (
                                                        <div className="flex flex-col items-center justify-center gap-0.5 w-full h-full">
                                                            <MapPin size={12} className="text-emerald-500" weight="bold" />
                                                            <span className="text-[9px] font-black scale-90">יום בודד</span>
                                                            <span className="text-[8px] font-bold opacity-70 whitespace-nowrap scale-75">{avail.startHour}-{avail.endHour}</span>
                                                        </div>
                                                    );
                                                } else if (displayInfo.displayStatus === 'arrival') {
                                                    cellClass = "bg-emerald-50/60 text-emerald-800 ring-1 ring-emerald-100/50";
                                                    content = (
                                                        <div className="flex flex-col items-center justify-center gap-0.5 w-full h-full">
                                                            <MapPin size={12} className="text-emerald-500" weight="bold" />
                                                            <span className="text-[9px] font-black scale-90">הגעה</span>
                                                            <span className="text-[8px] font-bold opacity-70 whitespace-nowrap scale-75">{avail.startHour}</span>
                                                        </div>
                                                    );
                                                } else if (displayInfo.displayStatus === 'departure') {
                                                    cellClass = "bg-amber-50/60 text-amber-900 ring-1 ring-amber-100/50";
                                                    content = (
                                                        <div className="flex flex-col items-center justify-center gap-0.5 w-full h-full">
                                                            <MapPin size={12} className="text-amber-500" weight="bold" />
                                                            <span className="text-[9px] font-black scale-90">יציאה</span>
                                                            <span className="text-[8px] font-bold opacity-70 whitespace-nowrap scale-75">{avail.endHour}</span>
                                                        </div>
                                                    );
                                                } else {
                                                    cellClass = "bg-emerald-50/40 text-emerald-800 ring-1 ring-emerald-100/50";
                                                    content = (
                                                        <div className="flex flex-col items-center justify-center gap-0.5 w-full h-full">
                                                            <MapPin size={14} className="text-emerald-500/50" weight="bold" />
                                                            <span className="text-[9px] font-black scale-90">בסיס</span>
                                                            {(avail.unavailableBlocks && avail.unavailableBlocks.length > 0) && (
                                                                <span className="text-[7px] font-bold text-red-600/90 leading-tight block whitespace-nowrap scale-75 -mt-0.5">
                                                                    {avail.unavailableBlocks.length} חסימות
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                }
                                            } else {
                                                content = <span className="text-[10px] text-slate-400">?</span>;
                                            }

                                            // Add Manual Indicator Dot
                                            if (avail.source === 'manual') {
                                                content = (
                                                    <>
                                                        {content}
                                                        <div className="absolute top-1 left-1 w-1.5 h-1.5 rounded-full bg-amber-400 shadow-sm" title="עודכן ידנית" />
                                                    </>
                                                );
                                            }

                                            // Add Manual Indicator Dot
                                            if (avail.source === 'manual') {
                                                content = (
                                                    <>
                                                        {content}
                                                        <div className="absolute top-1 left-1 w-1.5 h-1.5 rounded-full bg-amber-400 shadow-sm" title="עודכן ידנית" />
                                                    </>
                                                );
                                            }

                                            const tooltip = `חייל: ${peopleMap?.[personId]?.name || personId}
תאריך: ${date}
סטטוס: ${displayInfo.label}
${displayInfo.displayStatus === 'missing_departure' ? 'שים לב: לא דווחה יציאה ולמחרת החייל בבית/חופש\n' : ''}שעת כניסה: ${avail.startHour || '00:00'}
שעת יציאה: ${avail.endHour || '23:59'}`;

                                            return (
                                                <td
                                                    key={date}
                                                    title={tooltip}
                                                    className={`p-1 border-r border-b border-slate-50 text-center h-10 w-10 min-w-[40px] cursor-help transition-colors hover:ring-2 hover:ring-blue-400 hover:ring-inset ${cellClass}`}
                                                >
                                                    {content || <div className="w-1 h-1 bg-slate-100 rounded-full mx-auto" />}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const renderItem = (item: any, idx: number) => {
        if (tableName === 'people') {
            return (
                <div
                    key={item.id || idx}
                    className="bg-white border border-slate-100 rounded-xl p-3 flex items-center gap-3 hover:border-blue-300 hover:shadow-md transition-all text-right w-full group relative"
                >
                    <button
                        onClick={() => toggleSelection(item.id)}
                        className={`p-1 rounded transition-colors ${selectedIds.has(item.id) ? 'text-blue-600' : 'text-slate-300 hover:text-slate-400'}`}
                    >
                        {selectedIds.has(item.id) ? <CheckSquare size={18} weight="fill" /> : <Square size={18} />}
                    </button>
                    <div
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                        onClick={() => setSelectedItem(item)}
                    >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm ${item.color || 'bg-slate-400'}`}>
                            {item.name?.slice(0, 2)}
                        </div>
                        <div className="flex flex-col text-right">
                            <div className="font-black text-slate-800 text-sm">{item.name}</div>
                            <div className="text-[10px] text-slate-400 font-bold">
                                {getPersonalId(item)}{getPersonalId(item) ? ' • ' : ''}{teamsMap?.[item.team_id || item.teamId]?.name || 'ללא צוות'}
                            </div>
                        </div>
                        <Eye size={14} className="mr-auto text-slate-200 group-hover:text-blue-400 transition-colors" />
                    </div>
                </div>
            );
        }

        if (tableName === 'teams' || tableName === 'roles' || tableName === 'permission_templates') {
            const isTeam = tableName === 'teams';
            const isPermissionTemplate = tableName === 'permission_templates';
            const colorClass = item.color || (isTeam ? 'border-slate-200' : 'bg-slate-200');

            return (
                <div key={item.id || idx} className={`
                    bg-white border border-slate-100 rounded-xl p-3 flex items-center gap-3 shadow-sm hover:shadow-md transition-all relative overflow-hidden
                    ${isTeam ? `border-r-4 ${colorClass}` : ''}
                `}>
                    <button
                        onClick={() => toggleSelection(item.id)}
                        className={`p-1 rounded transition-colors shrink-0 z-10 ${selectedIds.has(item.id) ? 'text-blue-600' : 'text-slate-300 hover:text-slate-400'}`}
                    >
                        {selectedIds.has(item.id) ? <CheckSquare size={18} weight="fill" /> : <Square size={18} />}
                    </button>
                    {!isTeam && <div className={`absolute top-0 right-0 bottom-0 w-1 ${isPermissionTemplate ? 'bg-indigo-600' : colorClass}`} />}
                    {!isTeam && (
                        <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-white shadow-sm ${isPermissionTemplate ? 'bg-indigo-600' : colorClass}`}>
                            {item.icon ? <Shield size={16} /> : (isPermissionTemplate ? <Shield size={16} /> : item.name?.slice(0, 1))}
                        </div>
                    )}
                    <div className="flex flex-col text-right">
                        <div className="font-black text-slate-800">{item.name}</div>
                        {isTeam && item.memberCount !== undefined && (
                            <span className="text-[10px] text-slate-400 font-bold">{item.memberCount} חברים</span>
                        )}
                    </div>
                </div>
            );
        }

        if (tableName === 'task_templates') {
            return (
                <div
                    key={item.id || idx}
                    className="bg-white border border-slate-100 rounded-xl p-3 flex items-center gap-3 shadow-sm hover:border-blue-300 hover:shadow-md transition-all text-right w-full group"
                >
                    <button
                        onClick={() => toggleSelection(item.id)}
                        className={`p-1 rounded transition-colors ${selectedIds.has(item.id) ? 'text-blue-600' : 'text-slate-300 hover:text-slate-400'}`}
                    >
                        {selectedIds.has(item.id) ? <CheckSquare size={18} weight="fill" /> : <Square size={18} />}
                    </button>
                    <div
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                        onClick={() => setSelectedItem(item)}
                    >
                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 shrink-0 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                            <Package size={20} />
                        </div>
                        <div className="text-right flex-1">
                            <div className="font-black text-slate-800 group-hover:text-blue-600 transition-colors">{item.name}</div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                {item.category || 'כללי'} • רמה {item.difficulty || 1} • {item.segments?.length || 0} סגמנטים
                            </div>
                        </div>
                        <Eye size={14} className="mr-auto text-slate-200 group-hover:text-blue-400 transition-colors" />
                    </div>
                </div>
            );
        }

        if (tableName === 'shifts') {
            const taskId = getProp(item, 'task_id', 'taskId');
            const task = tasksMap?.[taskId];
            const startTime = safeDate(getProp(item, 'start_time', 'startTime'));
            const endTime = safeDate(getProp(item, 'end_time', 'endTime'));
            const assignedIds = getProp(item, 'assigned_person_ids', 'assignedPersonIds') || [];

            return (
                <div key={item.id || idx} className="bg-white border border-slate-100 rounded-xl p-3 flex items-center gap-3 shadow-sm border-r-4 border-r-blue-100">
                    <button
                        onClick={() => toggleSelection(item.id)}
                        className={`p-1 rounded transition-colors shrink-0 ${selectedIds.has(item.id) ? 'text-blue-600' : 'text-slate-300 hover:text-slate-400'}`}
                    >
                        {selectedIds.has(item.id) ? <CheckSquare size={18} weight="fill" /> : <Square size={18} />}
                    </button>
                    <div className="flex flex-col gap-2 flex-1">
                        <div className="flex items-center justify-between">
                            <div className="flex flex-col text-right">
                                <span className="text-[10px] font-black text-blue-600 uppercase tracking-wider">{task?.name || 'משימה כללית'}</span>
                                <span className="text-xs font-black text-slate-800">{startTime ? startTime.toLocaleDateString('he-IL') : 'תאריך לא ידוע'}</span>
                            </div>
                            <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100 text-[10px] font-bold text-slate-400">
                                <Clock size={12} />
                                {startTime?.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) || '--:--'} - {endTime?.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) || '--:--'}
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-1">
                            {assignedIds.map((pid: string) => (
                                <span key={pid} className="px-2 py-0.5 bg-blue-50/50 rounded text-[9px] font-black text-blue-600 border border-blue-100/30">
                                    {peopleMap?.[pid]?.name || pid.slice(0, 4)}
                                </span>
                            ))}
                            {assignedIds.length === 0 && (
                                <span className="text-[10px] text-slate-300 italic">טרם שובצו אנשים</span>
                            )}
                        </div>
                    </div>
                </div>
            );
        }

        if (tableName === 'absences' || tableName === 'hourly_blockages') {
            const isAbsence = tableName === 'absences';
            const personId = getProp(item, 'person_id', 'personId');
            const person = peopleMap?.[personId];
            const colorClass = isAbsence ? 'border-r-red-400' : 'border-r-amber-400';
            const startDate = getProp(item, 'start_date', 'startDate', 'date');
            const endDate = getProp(item, 'end_date', 'endDate', 'date');
            const startTime = getProp(item, 'start_time', 'startTime');
            const endTime = getProp(item, 'end_time', 'endTime');

            return (
                <div key={item.id || idx} className={`bg-white border border-slate-100 rounded-xl p-3 flex items-center gap-3 shadow-sm border-r-4 ${colorClass}`}>
                    <button
                        onClick={() => toggleSelection(item.id)}
                        className={`p-1 rounded transition-colors shrink-0 ${selectedIds.has(item.id) ? 'text-blue-600' : 'text-slate-300 hover:text-slate-400'}`}
                    >
                        {selectedIds.has(item.id) ? <CheckSquare size={18} weight="fill" /> : <Square size={18} />}
                    </button>
                    <div className="flex flex-col gap-2 flex-1">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-[10px] font-black ${person?.color || 'bg-slate-400'}`}>
                                    {(person?.name || item.name)?.slice(0, 2)}
                                </div>
                                <span className="text-xs font-black text-slate-800">{person?.name || item.name || 'חייל לא ידוע'}</span>
                            </div>
                            {isAbsence && (
                                <div className={`px-2 py-0.5 rounded text-[10px] font-black shadow-sm ${item.status === 'approved' ? 'bg-emerald-500 text-white' : 'bg-orange-100 text-orange-700'}`}>
                                    {item.status === 'approved' ? 'מאושר' : 'ממתין'}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 bg-slate-50/50 p-2 rounded-lg border border-slate-50">
                            <div className="flex items-center gap-1.5">
                                <Calendar size={12} className="text-slate-300" />
                                {startDate}{endDate !== startDate ? ` - ${endDate}` : ''}
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Clock size={12} className="text-slate-300" />
                                {startTime} - {endTime}
                            </div>
                        </div>

                        {item.reason && (
                            <div className="text-[10px] text-slate-400 bg-slate-50 p-1.5 rounded-lg border border-slate-50/50 italic">
                                "{item.reason}"
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        if (tableName === 'equipment') {
            const assignedId = getProp(item, 'assigned_to_id', 'assignedToId');
            return (
                <div key={item.id || idx} className="bg-white border border-slate-100 rounded-xl p-3 items-center gap-3 shadow-sm flex group">
                    <button
                        onClick={() => toggleSelection(item.id)}
                        className={`p-1 rounded transition-colors ${selectedIds.has(item.id) ? 'text-blue-600' : 'text-slate-300 hover:text-slate-400'}`}
                    >
                        {selectedIds.has(item.id) ? <CheckSquare size={18} weight="fill" /> : <Square size={18} />}
                    </button>
                    <div className="text-right flex-1">
                        <div className="font-black text-slate-800 text-sm">{item.name}</div>
                        <div className="text-[10px] text-slate-400 font-bold">
                            #{getProp(item, 'serial_number', 'serialNumber') || 'ללא מספר'} • {peopleMap?.[assignedId]?.name || 'לא משויך'}
                        </div>
                    </div>
                    <div className={`text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm ${item.status === 'present' || item.status === 'ok' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                        {item.status === 'present' || item.status === 'ok' ? 'תקין' : 'חסר/תקול'}
                    </div>
                </div>
            );
        }

        if (tableName === 'equipment_daily_checks') {
            const equipId = item.equipment_id || item.equipmentId;
            const equip = equipmentMap?.[equipId];
            const checkedBy = item.checked_by || item.checkedBy;
            const checkDate = item.check_date || item.checkDate;

            return (
                <div key={item.id || idx} className="bg-white border border-slate-100 rounded-xl p-3 flex items-center gap-3 shadow-sm">
                    <button
                        onClick={() => toggleSelection(item.id)}
                        className={`p-1 rounded transition-colors shrink-0 ${selectedIds.has(item.id) ? 'text-blue-600' : 'text-slate-300 hover:text-slate-400'}`}
                    >
                        {selectedIds.has(item.id) ? <CheckSquare size={18} weight="fill" /> : <Square size={18} />}
                    </button>
                    <div className="flex flex-col gap-1.5 flex-1">
                        <div className="flex items-center justify-between">
                            <div className="text-right">
                                <div className="font-black text-slate-800 text-xs">{equip?.type || equip?.name || 'ציוד לא ידוע'}</div>
                                <div className="text-[10px] text-slate-400 font-bold">#{equip?.serial_number || equip?.serialNumber || '---'}</div>
                            </div>
                            <div className={`px-2 py-0.5 rounded text-[10px] font-black ${item.status === 'ok' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                                {item.status === 'ok' ? 'תקין' : 'לא תקין'}
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold border-t border-slate-50 pt-1.5 mt-0.5">
                            <User size={12} className="text-slate-300" />
                            <span>נבדק ע"י: {peopleMap?.[checkedBy]?.name || 'לא ידוע'}</span>
                            <span className="mr-auto opacity-50">{checkDate ? new Date(checkDate).toLocaleDateString('he-IL') : '---'}</span>
                        </div>
                    </div>
                </div>
            );
        }

        // Default generic row
        return (
            <div key={item.id || idx} className="bg-white border border-slate-100 rounded-xl p-3 flex items-center gap-3 shadow-sm transition-all text-right w-full group">
                <button
                    onClick={() => toggleSelection(item.id || `gen-${idx}`)}
                    className={`p-1 rounded transition-colors shrink-0 ${selectedIds.has(item.id || `gen-${idx}`) ? 'text-blue-600' : 'text-slate-300 hover:text-slate-400'}`}
                >
                    {selectedIds.has(item.id || `gen-${idx}`) ? <CheckSquare size={18} weight="fill" /> : <Square size={18} />}
                </button>
                <div className="flex flex-col text-right flex-1 min-w-0">
                    <div className="font-black text-slate-800 text-xs truncate">
                        {item.name || item.label || item.title || (item.id ? `${tableName} (${item.id.slice(0, 8)})` : 'פריט ללא שם')}
                    </div>
                    <div className="text-[9px] font-mono text-slate-400 truncate opacity-60">
                        {JSON.stringify(item).slice(0, 100)}...
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full min-h-0 space-y-4">
            <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <Button variant="outline" onClick={onBack} size="sm" className="bg-white hover:bg-slate-50 border-slate-200">
                        חזרה
                    </Button>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-3">
                            <h3 className="text-lg font-black text-slate-800 leading-tight">{getTableLabel(tableName)}</h3>
                            <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{data.length} רשומות</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleDownloadTable}
                        icon={DownloadSimple}
                        className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-100"
                    >
                        ייצוא לאקסל
                    </Button>

                    {selectedIds.size > 0 && (
                        <Button
                            variant="primary"
                            size="sm"
                            icon={RestoreIcon}
                            onClick={handleRestoreSelected}
                            isLoading={isRestoring}
                            className="bg-orange-600 hover:bg-orange-700 border-orange-600 shadow-md shadow-orange-100 animate-in fade-in slide-in-from-left-4"
                        >
                            שחזר {selectedIds.size} רשומות נבחרות
                        </Button>
                    )}
                </div>
            </div>

            {selectedItem ? (
                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-4 overflow-y-auto custom-scrollbar flex-1">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                        <div className="flex items-center gap-4">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-black ${selectedItem.color || 'bg-slate-400'}`}>
                                {selectedItem.name?.slice(0, 2)}
                            </div>
                            <div>
                                <h4 className="text-lg font-black text-slate-800">{selectedItem.name}</h4>
                                <p className="text-xs text-slate-400 font-bold" dir="ltr">{getPersonalId(selectedItem)}</p>
                            </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedItem(null)} className="text-slate-400 font-bold">X</Button>
                    </div>
                    {/* Item Details Grid */}
                    <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                        <div>
                            <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block mb-1">צוות</span>
                            <span className="text-sm font-bold text-slate-700">{teamsMap?.[getProp(selectedItem, 'team_id', 'teamId')]?.name || 'לא משויך'}</span>
                        </div>
                        <div>
                            <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block mb-1">תפקידים</span>
                            <div className="flex flex-wrap gap-1">
                                {(() => {
                                    const roleIds = getProp(selectedItem, 'role_ids', 'roleIds');
                                    const roleId = getProp(selectedItem, 'role_id', 'roleId');

                                    if (roleIds && roleIds.length > 0) {
                                        return roleIds.map((rid: string) => (
                                            <span key={rid} className="px-2 py-0.5 bg-slate-100 rounded text-xs font-bold text-slate-700">
                                                {rolesMap?.[rid]?.name || rid}
                                            </span>
                                        ));
                                    } else {
                                        return <span className="text-sm font-bold text-slate-700">{rolesMap?.[roleId]?.name || 'לא הוגדר'}</span>;
                                    }
                                })()}
                            </div>
                        </div>
                        <div>
                            <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block mb-1">טלפון</span>
                            <span className="text-sm font-bold text-slate-700" dir="ltr">{selectedItem.phone || 'אין'}</span>
                        </div>
                        <div>
                            <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block mb-1">דוא"ל</span>
                            <span className="text-sm font-bold text-slate-700">{selectedItem.email || 'אין'}</span>
                        </div>
                        <div>
                            <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block mb-1">מפקד</span>
                            <span className={`text-sm font-bold ${getProp(selectedItem, 'is_commander', 'isCommander') ? 'text-blue-600' : 'text-slate-700'}`}>{getProp(selectedItem, 'is_commander', 'isCommander') ? 'כן' : 'לא'}</span>
                        </div>
                        <div>
                            <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block mb-1">סטטוס</span>
                            <span className={`text-sm font-bold ${getProp(selectedItem, 'is_active', 'isActive') === false ? 'text-red-500' : 'text-emerald-500'}`}>{getProp(selectedItem, 'is_active', 'isActive') === false ? 'לא פעיל' : 'פעיל'}</span>
                        </div>
                    </div>

                    {tableName === 'task_templates' && selectedItem.segments && (
                        <div className="mt-6 pt-6 border-t border-slate-100">
                            <h5 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4">סגמנטים ושיבוצים ({selectedItem.segments.length})</h5>
                            <div className="space-y-3">
                                {selectedItem.segments.map((seg: any, sIdx: number) => (
                                    <div key={seg.id || sIdx} className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex items-center justify-between">
                                        <div>
                                            <div className="font-black text-slate-800 text-sm mb-1">{seg.name || `סגמנט ${sIdx + 1}`}</div>
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                                                    <Clock size={12} />
                                                    {seg.startTime} ({seg.durationHours} שעות)
                                                </div>
                                                <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                                                    <Users size={12} />
                                                    {seg.requiredPeople} אנשים
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-1 justify-end max-w-[200px]">
                                            {seg.roleComposition?.map((rc: any, rcIdx: number) => (
                                                <span key={rcIdx} className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-black text-slate-500">
                                                    {rolesMap?.[rc.roleId]?.name || rc.roleId}: {rc.count}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className={`
                    ${(tableName === 'daily_presence' || tableName === 'unified_presence' || tableName === 'daily_attendance_snapshots') ? 'flex flex-col flex-1 min-h-0' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 overflow-y-auto custom-scrollbar'}
                    p-1 flex-1 min-h-0
                `}>
                    {data.length === 0 ? (
                        <div className="col-span-full py-12 text-center text-slate-400 font-bold italic bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">אין נתונים להציג בגרסה זו</div>
                    ) : (
                        (tableName === 'daily_presence' || tableName === 'unified_presence' || tableName === 'daily_attendance_snapshots')
                            ? renderAttendanceGrid()
                            : data.map((item, idx) => renderItem(item, idx))
                    )}
                </div>
            )}
            <ConfirmationModal {...modalProps} />
        </div>
    );
};
