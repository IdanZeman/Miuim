import React, { useState, useMemo } from 'react';
import { Person, Team, Role, Absence, TeamRotation, CustomFieldDefinition, OrganizationSettings, AvailabilitySlot } from '../../types';
import { getEffectiveAvailability, isPersonPresentAtHour } from '../../utils/attendanceUtils';
import { getPersonInitials } from '../../utils/nameUtils';
import {
    Users,
    CaretDown as ChevronDown,
    FileXls as FileSpreadsheet,
    CalendarBlank as Calendar,
    CheckCircle as CheckCircle2,
    XCircle,
    Check,
    MapPin,
    House as Home,
    Clock,
    WarningCircle as AlertCircle,
    Funnel as Filter,
    Eye,
    EyeSlash,
    CaretRight as ChevronRight,
    CaretLeft as ChevronLeft
} from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';
import ExcelJS from 'exceljs';
import { useToast } from '../../contexts/ToastContext';
import { GenericModal } from '../../components/ui/GenericModal';
import { Button } from '../../components/ui/Button';
import { ExportButton } from '../../components/ui/ExportButton';
import { getRotationStatusForDate } from '../../utils/attendanceUtils';

interface DailyAttendanceReportProps {
    people: Person[];
    teams: Team[];
    roles: Role[];
    absences: Absence[];
    teamRotations: TeamRotation[];
    settings: OrganizationSettings | null;
    hourlyBlockages?: any[];
}

export const DailyAttendanceReport: React.FC<DailyAttendanceReportProps> = ({
    people,
    teams,
    roles,
    absences,
    teamRotations,
    settings,
    hourlyBlockages = []
}) => {
    const { showToast } = useToast();
    const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(['role', ...settings?.customFieldsSchema?.map(f => `cf_${f.key}`) || []]));
    const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });
    const tableScrollRef = React.useRef<HTMLDivElement>(null);

    // Effect to scroll to today on mount
    React.useEffect(() => {
        if (tableScrollRef.current) {
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];
            const todayCell = tableScrollRef.current.querySelector(`[data-date="${todayStr}"]`);
            if (todayCell) {
                todayCell.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
            }
        }
    }, [currentMonth]);

    // Export State
    const [exportRange, setExportRange] = useState({
        start: new Date().toISOString().split('T')[0],
        end: new Date(new Date().setDate(new Date().getDate() + 14)).toISOString().split('T')[0]
    });
    const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set(['name', 'team', 'role', 'attendance']));

    const customFieldsSchema = settings?.customFieldsSchema || [];

    const toggleTeam = (teamId: string) => {
        const next = new Set(collapsedTeams);
        if (next.has(teamId)) next.delete(teamId);
        else next.add(teamId);
        setCollapsedTeams(next);
    };

    const activePeople = useMemo(() => {
        return people.filter(p => p.isActive !== false && p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [people, searchTerm]);

    const sortedTeams = useMemo(() => {
        return [...teams].sort((a, b) => a.name.localeCompare(b.name, 'he'));
    }, [teams]);

    const dates = useMemo(() => {
        const d = [];
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const lastDay = new Date(year, month + 1, 0).getDate();

        for (let i = 1; i <= lastDay; i++) {
            d.push(new Date(year, month, i));
        }
        return d;
    }, [currentMonth]);

    const weekDaysShort = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

    const handleExport = async () => {
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('דוח נוכחות', { views: [{ rightToLeft: true }] });

            const startDate = new Date(exportRange.start);
            const endDate = new Date(exportRange.end);
            const exportDates: Date[] = [];
            let curr = new Date(startDate);
            while (curr <= endDate) {
                exportDates.push(new Date(curr));
                curr.setDate(curr.getDate() + 1);
            }

            // Columns Definition
            const columns: any[] = [];
            if (selectedFields.has('name')) columns.push({ name: 'שם מלא', width: 20 });
            if (selectedFields.has('team')) columns.push({ name: 'צוות', width: 15 });
            if (selectedFields.has('role')) columns.push({ name: 'תפקיד', width: 15 });
            if (selectedFields.has('phone')) columns.push({ name: 'טלפון', width: 15 });
            if (selectedFields.has('email')) columns.push({ name: 'אימייל', width: 25 });

            customFieldsSchema.forEach(field => {
                if (selectedFields.has(`cf_${field.key}`)) {
                    columns.push({ name: field.label, width: 20 });
                }
            });

            if (selectedFields.has('attendance')) {
                exportDates.forEach(date => {
                    const dateStr = date.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
                    columns.push({ name: dateStr, width: 8 });
                });
            }

            const rows: any[] = [];
            activePeople.forEach(p => {
                const rowData: any[] = [];
                const team = teams.find(t => t.id === p.teamId);
                const roleNames = (p.roleIds || []).map(rid => roles.find(r => r.id === rid)?.name).filter(Boolean).join(', ');

                if (selectedFields.has('name')) rowData.push(p.name);
                if (selectedFields.has('team')) rowData.push(team?.name || '');
                if (selectedFields.has('role')) rowData.push(roleNames);
                if (selectedFields.has('phone')) rowData.push(p.phone || '');
                if (selectedFields.has('email')) rowData.push(p.email || '');

                customFieldsSchema.forEach(field => {
                    if (selectedFields.has(`cf_${field.key}`)) {
                        let val = p.customFields?.[field.key];
                        if (val === undefined || val === null) val = '';
                        else if (field.type === 'boolean') val = val ? 'V' : '';
                        else if (Array.isArray(val)) val = val.join(', ');
                        rowData.push(val);
                    }
                });

                if (selectedFields.has('attendance')) {
                    exportDates.forEach(date => {
                        const avail = getEffectiveAvailability(p, date, teamRotations, absences, hourlyBlockages);
                        rowData.push(avail.status === 'base' || avail.status === 'full' || avail.status === 'arrival' || avail.status === 'departure' ? 'בסיס' : 'בית');
                    });
                }
                rows.push(rowData);
            });

            worksheet.addTable({
                name: 'AttendanceTable',
                ref: 'A1',
                headerRow: true,
                columns: columns.map(c => ({ name: c.name, filterButton: true })),
                rows: rows,
                style: { theme: 'TableStyleMedium2', showRowStripes: true }
            });

            // Widths
            worksheet.columns = columns.map(c => ({ width: c.width }));

            // Coloring attendance cells
            if (selectedFields.has('attendance')) {
                const attendanceStartCol = columns.length - exportDates.length + 1;
                rows.forEach((row, rowIndex) => {
                    exportDates.forEach((_, dateIdx) => {
                        const cell = worksheet.getCell(rowIndex + 2, attendanceStartCol + dateIdx);
                        if (cell.value === 'בסיס') {
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F4EA' } }; // Light Green
                            cell.font = { color: { argb: 'FF137333' }, bold: true };
                        } else if (cell.value === 'בית') {
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE8E6' } }; // Light Red
                            cell.font = { color: { argb: 'FFC5221F' }, bold: true };
                        }
                    });
                });
            }

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `attendance_report_${new Date().toLocaleDateString('en-CA')}.xlsx`;
            link.click();
            URL.revokeObjectURL(url);
            showToast('הקובץ יוצא בהצלחה', 'success');
            setIsExportModalOpen(false);
        } catch (error) {
            console.error('Export failed:', error);
            showToast('שגיאה בייצוא הנתונים', 'error');
        }
    };

    const toggleField = (fieldId: string) => {
        const next = new Set(selectedFields);
        if (next.has(fieldId)) next.delete(fieldId);
        else next.add(fieldId);
        setSelectedFields(next);
    };

    return (
        <div className="flex flex-col gap-6" dir="rtl">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-1.5 rounded-2xl border border-slate-200 w-full md:w-auto">
                    {/* Month Navigation */}
                    <div className="flex items-center gap-1 bg-white rounded-xl border border-slate-200 p-1">
                        <button
                            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                            className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-500 transition-colors"
                        >
                            <ChevronRight size={18} weight="bold" />
                        </button>

                        <div className="px-3 py-1 text-sm font-black text-slate-700 min-w-[120px] text-center">
                            {currentMonth.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })}
                        </div>

                        <button
                            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                            className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-500 transition-colors"
                        >
                            <ChevronLeft size={18} weight="bold" />
                        </button>
                    </div>

                    <button
                        onClick={() => {
                            const now = new Date();
                            setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                        }}
                        className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all"
                    >
                        היום
                    </button>

                    <div className="h-6 w-px bg-slate-200 mx-1 hidden md:block" />

                    <div className="relative flex-1 md:w-64">
                        <input
                            type="text"
                            placeholder="חיפוש חייל..."
                            className="w-full bg-white border border-slate-200 rounded-xl px-10 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    </div>

                    <div className="relative">
                        <button
                            onClick={() => setIsColumnSelectorOpen(!isColumnSelectorOpen)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${isColumnSelectorOpen ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
                        >
                            <Eye size={16} weight="bold" />
                            <span>עמודות</span>
                        </button>

                        <AnimatePresence>
                            {isColumnSelectorOpen && (
                                <>
                                    <div className="fixed inset-0 z-[120]" onClick={() => setIsColumnSelectorOpen(false)} />
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        className="absolute left-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-slate-200 z-[130] p-3"
                                    >
                                        <div className="flex flex-col gap-1">
                                            <ColumnToggle
                                                label="תפקיד"
                                                isVisible={visibleColumns.has('role')}
                                                onClick={() => {
                                                    const next = new Set(visibleColumns);
                                                    if (next.has('role')) next.delete('role');
                                                    else next.add('role');
                                                    setVisibleColumns(next);
                                                }}
                                            />
                                            {customFieldsSchema.map(field => (
                                                <ColumnToggle
                                                    key={field.key}
                                                    label={field.label}
                                                    isVisible={visibleColumns.has(`cf_${field.key}`)}
                                                    onClick={() => {
                                                        const key = `cf_${field.key}`;
                                                        const next = new Set(visibleColumns);
                                                        if (next.has(key)) next.delete(key);
                                                        else next.add(key);
                                                        setVisibleColumns(next);
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <ExportButton
                        onExport={async () => setIsExportModalOpen(true)}
                        iconOnly={true}
                        variant="primary"
                        title="ייצוא לאקסל"
                    />
                </div>
            </div>

            {/* Main Table View - Refined to match AttendanceTable.tsx */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[500px] h-[calc(100vh-350px)]">
                <div className="overflow-auto custom-scrollbar flex-1 relative">
                    <table className="w-full border-collapse text-right min-w-max">
                        <thead>
                            <tr className="sticky top-0 z-[100] bg-white border-b border-slate-200">
                                <th className="w-52 shrink-0 bg-white border-l border-slate-200 sticky right-0 z-[110] px-4 md:px-6 py-4 font-black text-slate-400 text-xs uppercase tracking-widest text-right">החייל</th>
                                {visibleColumns.has('role') && (
                                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest bg-white border-b border-slate-200 min-w-[120px]">תפקיד</th>
                                )}
                                {customFieldsSchema.map(field => visibleColumns.has(`cf_${field.key}`) && (
                                    <th key={field.id} className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest whitespace-nowrap bg-white border-b border-slate-200 min-w-[120px]">
                                        {field.label}
                                    </th>
                                ))}
                                {dates.map(date => {
                                    const isToday = new Date().toDateString() === date.toDateString();
                                    const isWeekend = date.getDay() === 6;
                                    return (
                                        <th
                                            key={date.toISOString()}
                                            data-date={date.toISOString().split('T')[0]}
                                            className={`w-20 md:w-24 h-14 md:h-16 shrink-0 flex flex-col items-center justify-center border-l border-slate-100 transition-all relative ${isToday ? 'bg-blue-600 text-white z-10' : isWeekend ? 'bg-slate-50' : 'bg-white'}`}
                                            style={{ display: 'table-cell' }}
                                        >
                                            <div className="flex flex-col items-center">
                                                <span className={`text-[10px] md:text-[11px] font-black uppercase mb-0.5 ${isToday ? 'text-blue-100' : isWeekend ? 'text-slate-500' : 'text-slate-400'}`}>
                                                    {weekDaysShort[date.getDay()]}
                                                </span>
                                                <span className={`text-lg md:text-xl font-black ${isToday ? 'text-white' : 'text-slate-800'}`}>
                                                    {date.getDate()}
                                                </span>
                                            </div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {sortedTeams.map(team => {
                                const teamMembers = activePeople.filter(p => p.teamId === team.id);
                                if (teamMembers.length === 0) return null;
                                const isCollapsed = collapsedTeams.has(team.id);

                                return (
                                    <React.Fragment key={team.id}>
                                        <tr
                                            onClick={() => toggleTeam(team.id)}
                                            className="sticky z-[90] bg-slate-50 border-b border-slate-200 h-12 cursor-pointer group"
                                            style={{ top: '64px' }}
                                        >
                                            <td className="w-52 shrink-0 bg-slate-100 border-l border-slate-200 sticky right-0 z-[95] px-4">
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className={`transition-transform duration-300 ${isCollapsed ? '' : 'rotate-180'}`}
                                                    >
                                                        <ChevronDown size={12} className="text-slate-600" weight="bold" />
                                                    </div>
                                                    <span className="text-xs md:text-sm font-black text-slate-900 tracking-tight truncate">{team.name}</span>
                                                    <span className="text-[10px] font-bold text-blue-600 pr-2 truncate">
                                                        {teamMembers.length} לוחמים
                                                    </span>
                                                </div>
                                            </td>
                                            <td
                                                colSpan={(visibleColumns.has('role') ? 1 : 0) + customFieldsSchema.filter(f => visibleColumns.has(`cf_${f.key}`)).length + dates.length + 1}
                                                className="bg-slate-50"
                                            />
                                        </tr>

                                        {!isCollapsed && teamMembers.map((person, idx) => {
                                            const roleNames = (person.roleIds || []).map(rid => roles.find(r => r.id === rid)?.name).filter(Boolean).join(', ');

                                            return (
                                                <tr key={person.id} className="group/row hover:bg-blue-50/20 transition-all">
                                                    <td className={`w-52 shrink-0 px-4 md:px-6 py-2.5 md:py-4 border-l border-slate-100 sticky right-0 z-[80] flex items-center gap-3 md:gap-4 cursor-pointer transition-all ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'} group-hover/row:bg-blue-50 group-hover/row:shadow-[4px_0_12px_rgba(0,0,0,0.05)] shadow-[2px_0_5px_rgba(0,0,0,0.02)]`}
                                                        style={{ display: 'table-cell' }}
                                                    >
                                                        <div className="flex items-center gap-3 md:gap-4">
                                                            <div
                                                                className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-black shrink-0 bg-blue-50 text-blue-600 shadow-sm ring-2 ring-white transition-transform group-hover/row:scale-110"
                                                            >
                                                                {getPersonInitials(person.name)}
                                                            </div>
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="text-sm md:text-base font-black text-slate-800 truncate group-hover/row:text-blue-600 transition-colors">
                                                                    {person.name}
                                                                </span>
                                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 truncate">
                                                                    {team.name}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    {visibleColumns.has('role') && (
                                                        <td className="px-6 py-4 border-b border-slate-100">
                                                            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-lg">
                                                                {roleNames || 'לוחם'}
                                                            </span>
                                                        </td>
                                                    )}
                                                    {customFieldsSchema.map(field => {
                                                        if (!visibleColumns.has(`cf_${field.key}`)) return null;
                                                        const val = person.customFields?.[field.key];
                                                        return (
                                                            <td key={field.id} className="px-6 py-4 text-xs font-bold text-slate-600 border-b border-slate-100">
                                                                {field.type === 'boolean' ? (
                                                                    val ? <CheckCircle2 className="text-emerald-500" size={18} weight="bold" /> : <XCircle className="text-slate-200" size={18} weight="bold" />
                                                                ) : Array.isArray(val) ? (
                                                                    val.join(', ')
                                                                ) : val || '-'}
                                                            </td>
                                                        );
                                                    })}
                                                    {dates.map(date => {
                                                        const avail = getEffectiveAvailability(person, date, teamRotations, absences, hourlyBlockages);

                                                        const prevDate = new Date(date);
                                                        prevDate.setDate(date.getDate() - 1);
                                                        const nextDate = new Date(date);
                                                        nextDate.setDate(date.getDate() + 1);

                                                        const prevAvail = getEffectiveAvailability(person, prevDate, teamRotations, absences, hourlyBlockages);
                                                        const nextAvail = getEffectiveAvailability(person, nextDate, teamRotations, absences, hourlyBlockages);

                                                        const isBase = avail.status === 'base' || avail.status === 'full' || avail.status === 'arrival' || avail.status === 'departure';

                                                        let content = null;
                                                        let cellBg = "bg-white";

                                                        if (!isBase) {
                                                            cellBg = "bg-red-50/70";
                                                            content = (
                                                                <div className="flex flex-col items-center justify-center gap-0.5">
                                                                    <Home size={14} className="text-red-300" weight="bold" />
                                                                    <span className="text-[10px] font-black text-red-800">בית</span>
                                                                </div>
                                                            );
                                                        } else {
                                                            const prevWasPartialReturn = prevAvail.status === 'home' && prevAvail.endHour && prevAvail.endHour !== '23:59' && prevAvail.endHour !== '00:00';
                                                            const nextWasPartialDeparture = nextAvail.status === 'home' && nextAvail.startHour && nextAvail.startHour !== '00:00';

                                                            const isArrival = ((!prevAvail.isAvailable || prevAvail.status === 'home') && !prevWasPartialReturn) || (avail.startHour !== '00:00');
                                                            const isDeparture = ((!nextAvail.isAvailable || nextAvail.status === 'home') && !nextWasPartialDeparture) || (avail.endHour !== '23:59');

                                                            cellBg = "bg-emerald-50/60";

                                                            if (isArrival && isDeparture) {
                                                                content = (
                                                                    <div className="flex flex-col items-center justify-center">
                                                                        <span className="text-[10px] font-black text-emerald-800">יום בודד</span>
                                                                        <span className="text-[8px] font-bold text-emerald-600/70">{avail.startHour}-{avail.endHour}</span>
                                                                    </div>
                                                                );
                                                            } else if (isArrival) {
                                                                content = (
                                                                    <div className="flex flex-col items-center justify-center">
                                                                        <MapPin size={12} className="text-emerald-500" weight="bold" />
                                                                        <span className="text-[10px] font-black text-emerald-800">הגעה</span>
                                                                        <span className="text-[8px] font-bold text-emerald-600/70">{avail.startHour}</span>
                                                                    </div>
                                                                );
                                                            } else if (isDeparture) {
                                                                cellBg = "bg-orange-50/60";
                                                                content = (
                                                                    <div className="flex flex-col items-center justify-center">
                                                                        <span className="text-[10px] font-black text-orange-800">יציאה</span>
                                                                        <span className="text-[8px] font-bold text-orange-600/70">{avail.endHour}</span>
                                                                    </div>
                                                                );
                                                            } else {
                                                                content = (
                                                                    <div className="flex flex-col items-center justify-center">
                                                                        <span className="text-[10px] font-black text-emerald-800">בסיס</span>
                                                                    </div>
                                                                );
                                                            }
                                                        }

                                                        return (
                                                            <td
                                                                key={date.toISOString()}
                                                                className={`w-24 shrink-0 border-l border-slate-100 border-b text-center ${cellBg} ${date.toDateString() === new Date().toDateString() ? 'ring-2 ring-blue-500/10 z-10' : ''}`}
                                                                style={{ display: 'table-cell' }}
                                                            >
                                                                <div className="inline-flex items-center justify-center w-full min-h-[50px]">
                                                                    {content}
                                                                </div>
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            );
                                        })}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Export Modal */}
            <GenericModal
                isOpen={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
                title="ייצוא דוח נוכחות לאקסל"
                size="lg"
            >
                <div className="flex flex-col gap-6 p-2">
                    {/* Date Range Selection */}
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-black text-slate-700 flex items-center gap-2">
                                <Calendar size={18} className="text-blue-600" />
                                תאריך התחלה
                            </label>
                            <input
                                type="date"
                                className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500/20"
                                value={exportRange.start}
                                onChange={(e) => setExportRange(prev => ({ ...prev, start: e.target.value }))}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-black text-slate-700 flex items-center gap-2">
                                <Calendar size={18} className="text-blue-600" />
                                תאריך סיום
                            </label>
                            <input
                                type="date"
                                className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500/20"
                                value={exportRange.end}
                                onChange={(e) => setExportRange(prev => ({ ...prev, end: e.target.value }))}
                            />
                        </div>
                    </div>

                    {/* Field Selection */}
                    <div className="flex flex-col gap-4">
                        <h4 className="text-base font-black text-slate-800 flex items-center gap-2">
                            <Filter size={20} className="text-blue-600" />
                            אילו שדות לכלול בדוח?
                        </h4>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            <FieldOption
                                label="שם מלא"
                                selected={selectedFields.has('name')}
                                onClick={() => toggleField('name')}
                            />
                            <FieldOption
                                label="צוות"
                                selected={selectedFields.has('team')}
                                onClick={() => toggleField('team')}
                            />
                            <FieldOption
                                label="תפקיד"
                                selected={selectedFields.has('role')}
                                onClick={() => toggleField('role')}
                            />
                            <FieldOption
                                label="טלפון"
                                selected={selectedFields.has('phone')}
                                onClick={() => toggleField('phone')}
                            />
                            <FieldOption
                                label="אימייל"
                                selected={selectedFields.has('email')}
                                onClick={() => toggleField('email')}
                            />
                            {customFieldsSchema.map(field => (
                                <FieldOption
                                    key={field.key}
                                    label={field.label}
                                    selected={selectedFields.has(`cf_${field.key}`)}
                                    onClick={() => toggleField(`cf_${field.key}`)}
                                />
                            ))}
                            <div className="col-span-full h-px bg-slate-100 my-2" />
                            <FieldOption
                                label="נוכחות (בסיס/בית)"
                                selected={selectedFields.has('attendance')}
                                onClick={() => toggleField('attendance')}
                                color="bg-blue-600 shadow-blue-200"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-slate-100">
                        <Button variant="ghost" onClick={() => setIsExportModalOpen(false)}>ביטול</Button>
                        <Button
                            onClick={handleExport}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[140px]"
                        >
                            הורד קובץ אקסל
                        </Button>
                    </div>
                </div>
            </GenericModal>
        </div>
    );
};

const FieldOption: React.FC<{ label: string; selected: boolean; onClick: () => void, color?: string }> = ({
    label, selected, onClick, color = "bg-emerald-600 shadow-emerald-200"
}) => (
    <button
        onClick={onClick}
        className={`
            flex items-center gap-2 px-3 py-2.5 rounded-xl border font-bold text-xs transition-all text-right
            ${selected
                ? `${color} text-white border-transparent shadow-lg scale-[1.02]`
                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}
        `}
    >
        {selected ? <CheckCircle2 size={16} weight="bold" /> : <div className="w-4 h-4 rounded-full border-2 border-slate-200" />}
        <span className="truncate">{label}</span>
    </button>
);

const ColumnToggle: React.FC<{ label: string; isVisible: boolean; onClick: () => void }> = ({
    label, isVisible, onClick
}) => (
    <button
        onClick={onClick}
        className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${isVisible ? 'bg-blue-50 text-blue-700' : 'text-slate-400 hover:bg-slate-50'}`}
    >
        <span className="truncate max-w-[150px]">{label}</span>
        {isVisible ? <Eye size={14} weight="bold" /> : <EyeSlash size={14} weight="bold" />}
    </button>
);
