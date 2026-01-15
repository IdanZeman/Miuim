import React, { useState, useEffect } from 'react';
import { Person, TeamRotation, Absence, HomeStatusType } from '@/types';
import { CaretRight as ChevronRight, CaretLeft as ChevronLeft, X, ArrowRight, ArrowLeft, House as Home, CalendarBlank as CalendarIcon, Trash as Trash2, Clock, ArrowCounterClockwise as RotateCcw, CheckCircle as CheckCircle2, MapPin, Info, WarningCircle as AlertCircle } from '@phosphor-icons/react';
import { getEffectiveAvailability } from '@/utils/attendanceUtils';
import { GenericModal } from '@/components/ui/GenericModal';
import { Button } from '@/components/ui/Button';
import { PersonalRotationEditor } from './PersonalRotationEditor';
import { logger } from '@/services/loggingService';
import { ExportButton } from '@/components/ui/ExportButton';
import { getPersonInitials } from '@/utils/nameUtils';
import { StatusEditModal } from './StatusEditModal';
import ExcelJS from 'exceljs';

interface PersonalAttendanceCalendarProps {
    person: Person;
    teamRotations: TeamRotation[];
    absences?: Absence[];
    onClose: () => void;
    onUpdatePerson: (p: Person) => void;
    isViewer?: boolean;
}

const formatTime = (time?: string) => time?.slice(0, 5) || '';

export const PersonalAttendanceCalendar: React.FC<PersonalAttendanceCalendarProps> = ({ person: initialPerson, teamRotations, absences = [], onClose, onUpdatePerson, isViewer = false }) => {
    const [person, setPerson] = useState(initialPerson);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [editingDate, setEditingDate] = useState<Date | null>(null);
    const [showRotationSettings, setShowRotationSettings] = useState(false);

    // Sync with prop updates
    useEffect(() => {
        setPerson(initialPerson);
    }, [initialPerson]);

    const handleSaveRotation = (rotationSettings: any) => {
        const updatedPerson = {
            ...person,
            personalRotation: rotationSettings
        };
        setPerson(updatedPerson);
        onUpdatePerson(updatedPerson);
        logger.info('UPDATE', `Updated personal rotation for ${person.name}`, {
            personId: person.id,
            rotation: rotationSettings,
            category: 'attendance'
        });
        setShowRotationSettings(false);
    };

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
    const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay(); // 0 = Sunday

    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    const monthName = currentDate.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });

    const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

    // Helper to calculate availability including personal rotation
    const getDisplayAvailability = (date: Date) => {
        return getEffectiveAvailability(person, date, teamRotations, absences);
    };

    const handleSaveStatus = (
        mainStatus: 'base' | 'home',
        customTimes?: { start: string, end: string },
        unavailableBlocks?: { id: string, start: string, end: string, reason?: string }[],
        homeStatusType?: HomeStatusType
    ) => {
        if (!editingDate) return;

        const dateKey = editingDate.toLocaleDateString('en-CA');

        let newData: any = {
            source: 'manual',
            unavailableBlocks // Save blocks
        };

        if (mainStatus === 'home') {
            newData.isAvailable = false;
            newData.status = 'home';
            newData.homeStatusType = homeStatusType;
            // Clear times for home
            newData.startHour = '00:00';
            newData.endHour = '23:59';
        } else {
            newData.isAvailable = true;
            // Handle times
            if (customTimes) {
                newData.startHour = customTimes.start;
                newData.endHour = customTimes.end;
            } else {
                newData.startHour = '00:00';
                newData.endHour = '23:59';
            }
        }

        const updatedPerson = {
            ...person,
            dailyAvailability: {
                ...(person.dailyAvailability || {}),
                [dateKey]: newData
            }
        };

        setPerson(updatedPerson);
        onUpdatePerson(updatedPerson);

        logger.info('UPDATE', `Updated status for ${person.name} on ${dateKey}`, {
            personId: person.id,
            date: dateKey,
            status: mainStatus,
            ...newData,
            category: 'attendance'
        });

        setEditingDate(null);
    };

    // Helper helper to avoid duplicating logic in render & export
    const getVisualProps = (date: Date) => {
        const avail = getDisplayAvailability(date);

        // Fetch prev/next for logic
        const prevDate = new Date(date); prevDate.setDate(date.getDate() - 1);
        const nextDate = new Date(date); nextDate.setDate(date.getDate() + 1);
        const prevAvail = getDisplayAvailability(prevDate);
        const nextAvail = getDisplayAvailability(nextDate);

        // Defaults
        let statusConfig = {
            label: '',
            bg: 'bg-white',
            text: 'text-slate-400',
            fillColor: 'FFFFFFFF', // ARGB White
            textColor: 'FF94A3B8' // ARGB Slate-400
        };

        if (avail.status === 'base' || avail.status === 'full' || avail.status === 'arrival' || avail.status === 'departure') {

            const isArrival = (!prevAvail.isAvailable || prevAvail.status === 'home') || (avail.startHour !== '00:00');
            const isDeparture = (!nextAvail.isAvailable || nextAvail.status === 'home') || (avail.endHour !== '23:59');
            const isSingleDay = isArrival && isDeparture;

            statusConfig = {
                label: isSingleDay ? 'יום בודד' : isArrival ? 'הגעה' : isDeparture ? 'יציאה' : 'בבסיס',
                bg: isArrival || isSingleDay ? 'bg-emerald-50' : isDeparture ? 'bg-amber-50' : 'bg-emerald-50',
                text: isArrival || isSingleDay ? 'text-emerald-700' : isDeparture ? 'text-amber-700' : 'text-emerald-700',
                fillColor: isArrival || isSingleDay ? 'FFECFDF5' : isDeparture ? 'FFFFFBEB' : 'FFECFDF5',
                textColor: isArrival || isSingleDay ? 'FF047857' : isDeparture ? 'FFB45309' : 'FF047857'
            };

            if (avail.startHour !== '00:00' || avail.endHour !== '23:59') {
                if (isSingleDay || (!isArrival && !isDeparture)) {
                    statusConfig.label += ` ${avail.startHour}-${avail.endHour}`;
                } else if (isArrival && avail.startHour !== '00:00') {
                    statusConfig.label += ` ${avail.startHour}`;
                } else if (isDeparture && avail.endHour !== '23:59') {
                    statusConfig.label += ` ${avail.endHour}`;
                }
            }
        } else if (avail.status === 'home') {
            // Get home status type label
            const homeStatusLabels: Record<string, string> = {
                'leave_shamp': 'חופשה בשמפ',
                'gimel': 'ג\'',
                'absent': 'נפקד',
                'organization_days': 'ימי התארגנות',
                'not_in_shamp': 'לא בשמ"פ'
            };
            const homeTypeLabel = avail.homeStatusType ? homeStatusLabels[avail.homeStatusType] : 'חופשה בשמפ';

            statusConfig = {
                label: homeTypeLabel,
                bg: 'bg-red-50',
                text: 'text-red-600',
                fillColor: 'FFF5F5F5',
                textColor: 'FFEF4444'
            };
        } else if (avail.status === 'unavailable') {
            statusConfig = {
                label: 'אילוץ',
                bg: 'bg-amber-50',
                text: 'text-amber-700',
                fillColor: 'FFFFFBEB',
                textColor: 'FFB45309'
            };
        }

        return statusConfig;
    };

    const handleExportExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(`${monthName}`);

        worksheet.views = [{ rightToLeft: true }];

        // Headers
        const headers = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
        const headerRow = worksheet.addRow(headers);
        headerRow.font = { bold: true, size: 12, color: { argb: 'FF475569' } };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

        // Grid Generation
        let currentRow = worksheet.addRow([]);
        currentRow.height = 80; // Taller rows for visual card effect

        // Skip empty days at start
        for (let i = 0; i < firstDay; i++) {
            currentRow.getCell(i + 1).value = '';
        }

        let currentColumn = firstDay + 1;

        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month, d);
            const currentProps = getVisualProps(date);

            const cell = currentRow.getCell(currentColumn);

            // Content: Day number + Status text
            cell.value = `${d}\n${currentProps.label}`;
            cell.alignment = { wrapText: true, horizontal: 'center', vertical: 'top' };

            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: currentProps.fillColor } };
            cell.font = { bold: true, color: { argb: currentProps.textColor } };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

            if (currentColumn === 7) {
                currentRow = worksheet.addRow([]);
                currentRow.height = 80;
                currentColumn = 1;
            } else {
                currentColumn++;
            }
        }

        // Buffer & Download
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `attendance_${person.name}_${month + 1}_${year}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // --- UNIFIED RENDERING LOGIC ---
    const renderCalendarDays = () => {
        const days = [];

        // Empty slots for start of month
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="h-28 bg-slate-50 border border-slate-100"></div>);
        }

        // Days
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month, d);
            const isToday = new Date().toDateString() === date.toDateString();
            const avail = getDisplayAvailability(date);
            const isManual = avail.source === 'manual';
            const statusConfig = getVisualProps(date);

            // Icon selection based on bg
            let Icon = Info;
            if (statusConfig.bg.includes('emerald')) Icon = CheckCircle2;
            if (statusConfig.bg.includes('amber')) {
                if (statusConfig.label === 'אילוץ') Icon = Clock;
                else Icon = MapPin;
            }
            if (statusConfig.bg.includes('red')) Icon = Home;
            // Override specifcs
            if (statusConfig.label === 'הגעה' || statusConfig.label === 'יציאה') Icon = MapPin;


            days.push(
                <div
                    key={d}
                    onClick={() => !isViewer && setEditingDate(date)}
                    className={`h-28 border border-slate-100 relative p-1.5 transition-all group ${isViewer ? '' : 'hover:brightness-95 cursor-pointer'} ${statusConfig.bg} ${isToday ? 'ring-2 ring-inset ring-blue-500 z-10' : ''}`}
                    title={isViewer ? "" : "לחץ לעריכת נוכחות"}
                >
                    <span className={`absolute top-1.5 right-2 text-xs font-black z-20 ${isToday ? 'text-blue-600 bg-white/80 px-1.5 rounded-full shadow-sm' : statusConfig.text.replace('text-', 'text-opacity-60 text-')}`}>
                        {d}
                    </span>
                    {isManual && (
                        <span className="absolute top-2 left-2 w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse shadow-sm z-20" title="שינוי ידני"></span>
                    )}

                    <div className="mt-6 h-full pointer-events-none flex flex-col items-center justify-center gap-1">
                        {statusConfig.label && (
                            <div className={`
                                flex flex-col items-center gap-1 text-center font-black leading-tight
                                ${statusConfig.text}
                            `}>
                                <Icon size={20} weight={statusConfig.bg.includes('500') ? "fill" : "duotone"} className="mb-0.5 opacity-90" />
                                <span className="text-[11px] px-1">{statusConfig.label}</span>
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        return days;
    };

    const modalTitle = (
        <div className="flex items-center gap-3 pr-2 text-right">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-sm ${person.color} text-sm shrink-0`}>
                {getPersonInitials(person.name)}
            </div>
            <div className="flex flex-col gap-0.5">
                <h2 className="text-xl md:text-2xl font-black text-slate-800 leading-tight">{person.name}</h2>
                <div className="flex items-center gap-2 text-xs md:text-sm text-slate-500 font-bold uppercase tracking-wider">
                    <CalendarIcon size={14} className="text-slate-400" weight="duotone" />
                    <span>לוח נוכחות אישי</span>
                </div>
            </div>
        </div>
    );

    const modalHeaderActions = (
        <div className="flex items-center gap-2">
            <ExportButton
                onExport={handleExportExcel}
                iconOnly
                className="w-10 h-10 rounded-full"
                title="ייצוא נתוני נוכחות"
            />
            {!isViewer && (
                <button
                    onClick={() => setShowRotationSettings(true)}
                    className="w-10 h-10 flex items-center justify-center text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                    title="הגדרת סבב אישי"
                >
                    <RotateCcw size={20} weight="duotone" />
                </button>
            )}
        </div>
    );

    const modalFooter = (() => {
        let daysOnBase = 0;
        let daysAtHome = 0;
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month, d);
            const avail = getDisplayAvailability(date);
            const status = (avail as any).status;

            if (!avail.isAvailable) {
                daysAtHome++;
            } else if (status === 'departure') {
                daysAtHome++; // Departure counts as Home
            } else {
                daysOnBase++; // Arrival, Base, Full
            }
        }
        return (
            <div className="flex items-center justify-between w-full">
                <div className="flex gap-6 items-center">
                    <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        <span className="text-sm font-bold text-slate-600">בבסיס: <span className="text-emerald-700">{daysOnBase} ימים</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                        <span className="text-sm font-bold text-slate-600">בבית: <span className="text-slate-800">{daysAtHome} ימים</span></span>
                    </div>
                </div>
                <div className="text-[10px] md:text-xs text-slate-400 font-bold italic">
                    * יום יציאה נספר כיום בבית
                </div>
            </div>
        );
    })();

    return (
        <GenericModal
            isOpen={true}
            onClose={onClose}
            title={modalTitle}
            headerActions={modalHeaderActions}
            footer={modalFooter}
            size="2xl"
        >
            {/* Calendar Controls */}
            <div className="flex items-center justify-between mb-4 bg-slate-50 p-2 rounded-xl border border-slate-100">
                <Button onClick={handlePrevMonth} variant="ghost" size="icon" icon={ChevronRight} />
                <h3 className="text-lg font-black text-slate-800 tracking-tight">{monthName}</h3>
                <Button onClick={handleNextMonth} variant="ghost" size="icon" icon={ChevronLeft} />
            </div>

            {/* Calendar Grid */}
            <div className="flex-1 overflow-hidden border border-slate-200 rounded-2xl bg-white shadow-sm flex flex-col">
                <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/50">
                    {['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'].map(day => (
                        <div key={day} className="py-2.5 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            {day}
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-7 flex-1">
                    {renderCalendarDays()}
                </div>
            </div>


            {/* Rotation Settings Modal */}
            {
                showRotationSettings && (
                    <PersonalRotationEditor
                        person={person}
                        isOpen={true}
                        onClose={() => setShowRotationSettings(false)}
                        onSave={handleSaveRotation}
                    />
                )
            }

            {/* Status Edit Modal - Unified */}
            {editingDate && (
                <StatusEditModal
                    isOpen={true}
                    onClose={() => setEditingDate(null)}
                    onApply={handleSaveStatus}
                    personName={person.name}
                    date={editingDate.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}
                    currentAvailability={getDisplayAvailability(editingDate)}
                    defaultArrivalHour="10:00"
                    defaultDepartureHour="14:00"
                />
            )}
        </GenericModal >
    );
};
