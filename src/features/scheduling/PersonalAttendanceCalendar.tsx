import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Person, TeamRotation, Absence, HomeStatusType, HourlyBlockage } from '@/types';
import { CaretRight as ChevronRight, CaretLeft as ChevronLeft, X, ArrowRight, ArrowLeft, House as Home, CalendarBlank as CalendarIcon, Trash as Trash2, Clock, ArrowCounterClockwise as RotateCcw, CheckCircle as CheckCircle2, MapPin, Info, WarningCircle as AlertCircle, Phone, Envelope, WhatsappLogo, Copy, ChartBar } from '@phosphor-icons/react';
import { getEffectiveAvailability, getAttendanceDisplayInfo } from '@/utils/attendanceUtils';
import { GenericModal } from '@/components/ui/GenericModal';
import { Button } from '@/components/ui/Button';
import { PersonalRotationEditor } from './PersonalRotationEditor';
import { logger } from '@/services/loggingService';
import { ExportButton } from '@/components/ui/ExportButton';
import { getPersonInitials } from '@/utils/nameUtils';
import { StatusEditModal } from './StatusEditModal';
import ExcelJS from 'exceljs';

// ... imports

interface PersonalAttendanceCalendarProps {
    person: Person;
    teamRotations: TeamRotation[];
    absences?: Absence[];
    hourlyBlockages?: HourlyBlockage[];
    onClose: () => void;
    onUpdatePerson: (p: Person) => void;
    isViewer?: boolean;
    people?: Person[];
    onShowStats?: (person: Person) => void;
    onViewHistory?: (personId: string, date: string) => void;
}

const formatTime = (time?: string) => time?.slice(0, 5) || '';

export const PersonalAttendanceCalendar: React.FC<PersonalAttendanceCalendarProps> = ({
    person: initialPerson, teamRotations, absences = [], hourlyBlockages = [],
    onClose, onUpdatePerson, isViewer = false, people = [], onShowStats, onViewHistory
}) => {
    const [person, setPerson] = useState(initialPerson);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [editingDate, setEditingDate] = useState<Date | null>(null);
    const [showRotationSettings, setShowRotationSettings] = useState(false);
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | null }>({
        message: '',
        type: null
    });

    const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification({ message: '', type: null }), 3000);
    };

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
        return getEffectiveAvailability(person, date, teamRotations, absences, hourlyBlockages);
    };

    const handleSaveStatus = (
        mainStatus: 'base' | 'home',
        customTimes?: { start: string, end: string },
        unavailableBlocks?: { id: string, start: string, end: string, reason?: string }[],
        homeStatusType?: HomeStatusType,
        rangeDates?: string[]
    ) => {
        const targetDates = (rangeDates && rangeDates.length > 0)
            ? rangeDates
            : (editingDate ? [editingDate.toLocaleDateString('en-CA')] : []);

        if (targetDates.length === 0) return;

        const newAvailabilityMap = { ...(person.dailyAvailability || {}) };

        targetDates.forEach(dateKey => {
            let newData: any = {
                source: 'manual',
                unavailableBlocks: unavailableBlocks ? unavailableBlocks.map(b => ({ ...b, id: crypto.randomUUID() })) : [] // Clone blocks with new IDs to be safe
            };

            if (mainStatus === 'home') {
                newData.isAvailable = false;
                newData.status = 'home';
                newData.homeStatusType = homeStatusType;
                newData.startHour = '00:00';
                newData.endHour = '23:59';
            } else {
                newData.isAvailable = true;
                if (customTimes) {
                    newData.startHour = customTimes.start;
                    newData.endHour = customTimes.end;
                } else {
                    newData.startHour = '00:00';
                    newData.endHour = '23:59';
                }
            }
            newAvailabilityMap[dateKey] = newData;
        });

        const updatedPerson = {
            ...person,
            dailyAvailability: newAvailabilityMap
        };

        setPerson(updatedPerson);
        onUpdatePerson(updatedPerson);

        logger.info('UPDATE', `Updated status for ${person.name} on ${targetDates.length} days`, {
            personId: person.id,
            dates: targetDates,
            status: mainStatus,
            category: 'attendance'
        });

        setEditingDate(null);
    };



    const generateAttendanceSummary = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const daysInMonth = getDaysInMonth(year, month);
        const monthName = currentDate.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });

        let message = `*לו"ז נוכחות - ${person.name}* 🗓️\n`;
        message += `*חודש:* ${monthName}\n\n`;
        message += `*לו"ז יציאות:* \n`;

        let currentBlock: any = null;
        const blocks: any[] = [];

        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month, d);
            // Use visual props to ensure text matches "what the user sees"
            const displayInfo = getAttendanceDisplayInfo(person, date, teamRotations, absences, hourlyBlockages);
            const statusId = displayInfo.label; // Group by the exact visual label

            if (!currentBlock || currentBlock.statusId !== statusId) {
                if (currentBlock) {
                    currentBlock.endDate = new Date(year, month, d - 1);
                    blocks.push(currentBlock);
                }
                currentBlock = {
                    statusId,
                    label: displayInfo.label,
                    startDate: new Date(year, month, d),
                };
            }
        }
        if (currentBlock) {
            currentBlock.endDate = new Date(year, month, daysInMonth);
            blocks.push(currentBlock);
        }

        blocks.forEach(block => {
            const startStr = `${block.startDate.getDate()}.${month + 1}`;
            const endStr = `${block.endDate.getDate()}.${month + 1}`;
            const range = startStr === endStr ? startStr : `${startStr} - ${endStr}`;

            let emoji = '🏠'; // Default to home
            const l = block.label;

            if (l.includes('בבסיס')) emoji = '✅';
            else if (l.includes('הגעה')) emoji = '➡️';
            else if (l.includes('יציאה')) emoji = '⬅️';
            else if (l.includes('יום בודד')) emoji = '✅';
            else if (l.includes('אילוץ')) emoji = '❌';

            // Bold the status text
            message += `• ${range}: *${block.label}* ${emoji}\n`;
        });

        // Add Hourly Blockages section
        const allBlockages: any[] = [];
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month, d);
            const avail = getDisplayAvailability(date);
            if (avail.unavailableBlocks && avail.unavailableBlocks.length > 0) {
                allBlockages.push({ date, blocks: avail.unavailableBlocks });
            }
        }

        if (allBlockages.length > 0) {
            message += `\n*חסימות ואילוצים:* 📌\n`;
            allBlockages.forEach(item => {
                const dateStr = `${item.date.getDate()}.${month + 1}`;
                item.blocks.forEach((b: any) => {
                    const isFullDay = b.start?.slice(0, 5) === '00:00' && b.end?.slice(0, 5) === '23:59';
                    const timeStr = isFullDay ? '' : ` (${b.start.slice(0, 5)}-${b.end.slice(0, 5)})`;

                    let reasonText = b.reason;
                    if (reasonText === 'Absence') reasonText = '';
                    if (b.type === 'exit_request') reasonText = 'בקשת יציאה';

                    if (reasonText || !isFullDay) {
                        message += `• ${dateStr}:${timeStr}${reasonText ? ` *${reasonText}*` : ''}\n`;
                    }
                });
            });
        }

        return message;
    };

    function handleCopyToClipboard() {
        const message = generateAttendanceSummary();
        navigator.clipboard.writeText(message).then(() => {
            showNotification('הלו"ז הועתק לקליפבורד! ✅');
        }).catch(err => {
            console.error('Failed to copy: ', err);
            showNotification('שגיאה בהעתקה לקליפבורד', 'error');
        });
    }

    function handleExportWhatsApp() {
        if (!person.phone) {
            alert('אין מספר טלפון מוזן ללוחם זה');
            return;
        }

        const message = generateAttendanceSummary();
        const encodedMessage = encodeURIComponent(message);

        let cleanPhone = person.phone.replace(/\D/g, '');
        if (cleanPhone.startsWith('0')) {
            cleanPhone = '972' + cleanPhone.substring(1).replace(/^0+/, '');
        }

        const whatsappUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMessage}`;
        window.open(whatsappUrl, '_blank');
    }

    async function handleExportExcel() {
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
            const displayInfo = getAttendanceDisplayInfo(person, date, teamRotations, absences, hourlyBlockages);

            const cell = currentRow.getCell(currentColumn);

            // Fetch colors based on status (simple mapping for Excel)
            const getExcelColors = (status: string) => {
                if (status === 'base' || status === 'full' || status === 'arrival' || status === 'departure' || status === 'single_day') return { fill: 'FFECFDF5', text: 'FF047857' };
                if (status === 'home') return { fill: 'FFFEE2E2', text: 'FF991B1B' };
                if (status === 'unavailable') return { fill: 'FFFFFBEB', text: 'FFB45309' };
                return { fill: 'FFFFFFFF', text: 'FF94A3B8' };
            };
            const colors = getExcelColors(displayInfo.displayStatus);

            // Content: Day number + Status text
            cell.value = `${d}\n${displayInfo.label}`;
            cell.alignment = { wrapText: true, horizontal: 'center', vertical: 'top' };

            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.fill } };
            cell.font = { bold: true, color: { argb: colors.text } };
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
    }

    // --- UNIFIED RENDERING LOGIC ---
    const renderCalendarDays = () => {
        const days = [];

        // Empty slots for start of month
        for (let i = 0; i < firstDay; i++) {
            const isSaturday = (i % 7) === 6;
            days.push(<div key={`empty-${i}`} className={`h-16 md:h-20 border-r border-slate-100 relative ${isSaturday ? 'bg-indigo-50/40 border-l border-l-indigo-100/50' : 'bg-slate-50'}`}></div>);
        }

        // Days
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month, d);
            const isToday = new Date().toDateString() === date.toDateString();
            const displayInfo = getAttendanceDisplayInfo(person, date, teamRotations, absences, hourlyBlockages);
            const avail = displayInfo.availability;
            const isManual = avail.source === 'manual';

            // Status Pill UI Logic (Matching AttendanceTable)
            let statusConfig = {
                label: displayInfo.label,
                bg: 'bg-white',
                text: 'text-slate-400',
                dot: 'bg-slate-300',
                icon: Info
            };

            if (displayInfo.displayStatus === 'missing_departure') {
                statusConfig = {
                    ...statusConfig,
                    bg: 'bg-emerald-50',
                    text: 'text-emerald-800',
                    dot: 'bg-rose-500',
                    icon: AlertCircle
                };
            } else if (displayInfo.displayStatus === 'missing_arrival') {
                statusConfig = {
                    ...statusConfig,
                    bg: 'bg-amber-50',
                    text: 'text-amber-800',
                    dot: 'bg-rose-500',
                    icon: AlertCircle
                };
            } else if (displayInfo.isBase) {
                const isSpecial = displayInfo.displayStatus === 'arrival' || displayInfo.displayStatus === 'single_day' || displayInfo.displayStatus === 'departure';
                statusConfig = {
                    ...statusConfig,
                    bg: isSpecial ? (displayInfo.displayStatus === 'departure' ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-emerald-50',
                    text: isSpecial ? 'text-white' : 'text-emerald-700',
                    dot: 'bg-white',
                    icon: (displayInfo.displayStatus === 'arrival' || displayInfo.displayStatus === 'single_day' || displayInfo.displayStatus === 'departure') ? MapPin : CheckCircle2
                };
            } else if (displayInfo.displayStatus === 'home') {
                statusConfig = {
                    ...statusConfig,
                    bg: 'bg-red-50',
                    text: 'text-red-600',
                    dot: 'bg-red-500',
                    icon: Home
                };
            } else if (displayInfo.displayStatus === 'unavailable') {
                statusConfig = {
                    ...statusConfig,
                    bg: 'bg-amber-50',
                    text: 'text-amber-700',
                    dot: 'bg-amber-500',
                    icon: Clock
                };
            }

            const isSaturday = date.getDay() === 6;
            const Icon = statusConfig.icon;

            days.push(
                <div
                    key={d}
                    onClick={() => !isViewer && setEditingDate(date)}
                    className={`h-16 md:h-20 border-r border-slate-100 relative p-1 transition-all group ${isViewer ? '' : 'hover:brightness-95 cursor-pointer'} ${statusConfig.bg} ${isToday ? 'ring-2 ring-inset ring-blue-500 z-10' : ''} ${isSaturday ? (statusConfig.bg === 'bg-white' ? 'bg-indigo-50/40' : 'brightness-[0.97]') : ''} ${isSaturday ? 'border-l border-l-indigo-100/50' : ''}`}
                    title={isViewer ? "" : "לחץ לעריכת נוכחות"}
                >
                    <span className={`absolute top-1 right-1.5 text-[10px] font-black z-20 ${isToday ? 'text-blue-600 bg-white/80 px-1 rounded-full shadow-sm' : statusConfig.text.replace('text-', 'text-opacity-60 text-')} ${isSaturday && !isToday ? 'text-indigo-600/80' : ''}`}>
                        {d}
                    </span>
                    {isManual && (
                        <span className="absolute top-1 left-1 w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse shadow-sm z-20" title="שינוי ידני"></span>
                    )}
                    {(avail.unavailableBlocks && avail.unavailableBlocks.length > 0) && (
                        <span className={`absolute top-1.5 ${isManual ? 'left-3.5' : 'left-1.5'} w-1 h-1 bg-red-500 rounded-full shadow-sm z-20`} title="ישנם אילוצים ביום זה"></span>
                    )}

                    <div className="mt-3.5 h-full pointer-events-none flex flex-col items-center justify-center gap-0.5">
                        <div className={`
                            flex flex-col items-center gap-0 text-center font-black leading-tight
                            ${statusConfig.text}
                        `}>
                            <Icon size={14} weight={statusConfig.bg.includes('500') ? "fill" : "bold"} className="mb-0.5 opacity-80" />
                            <span className="text-[9px] px-1 whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                                {statusConfig.label}
                            </span>
                            {displayInfo.displayStatus === 'missing_departure' && (
                                <span className="text-[7.5px] font-bold text-rose-600 leading-none">חסר יציאה</span>
                            )}
                            {displayInfo.displayStatus === 'missing_arrival' && (
                                <span className="text-[7.5px] font-bold text-rose-600 leading-none">חסר הגעה</span>
                            )}
                        </div>

                        {/* Blockages / Constraints Display */}
                        {avail.unavailableBlocks && avail.unavailableBlocks.length > 0 && (
                            <div className="flex flex-col items-center gap-0 mt-0.5 z-20">
                                {avail.unavailableBlocks
                                    .filter(b => !(b.start?.slice(0, 5) === '00:00' && (b.end?.slice(0, 5) === '23:59' || b.end?.slice(0, 5) === '00:00')))
                                    .slice(0, 1)
                                    .map((block, idx) => (
                                        <div key={idx} className="flex items-center gap-0.5 text-[7.5px] font-bold bg-white/40 px-1 rounded shadow-sm border border-black/5" title={block.reason}>
                                            <span>{block.start.slice(0, 5)}-{block.end.slice(0, 5)}</span>
                                        </div>
                                    ))}
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        return days;
    };

    const modalTitle = (
        <div className="flex items-center gap-2 pr-1 text-right">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold shadow-sm ${person.color} text-sm shrink-0`}>
                {getPersonInitials(person.name)}
            </div>
            <div className="flex flex-col gap-0">
                <h2 className="text-lg font-black text-slate-800 leading-tight">{person.name}</h2>
                <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold tracking-wider flex-wrap">
                    <div className="flex items-center gap-1.5">
                        <CalendarIcon size={14} className="text-slate-400" weight="bold" />
                        <span>לוח נוכחות אישי</span>
                    </div>
                    {(person.phone || person.email) && (
                        <div className="hidden md:flex items-center gap-2 text-slate-300 mx-1">|</div>
                    )}
                    {person.phone && (
                        <a href={`tel:${person.phone}`} className="flex items-center gap-1.5 text-slate-500 hover:text-blue-600 transition-colors" title="התקשר">
                            <Phone size={14} weight="bold" className="text-slate-400" />
                            <span>{person.phone}</span>
                        </a>
                    )}
                    {person.email && (
                        <a href={`mailto:${person.email}`} className="flex items-center gap-1.5 text-slate-500 hover:text-blue-600 transition-colors lowercase">
                            <Envelope size={14} weight="bold" className="text-slate-400" />
                            <span title={person.email}>{person.email}</span>
                        </a>
                    )}
                </div>
            </div>
        </div>
    );

    const modalHeaderActions = (
        <div className="flex items-center gap-1 md:gap-2">
            {/* Integrated Navigation */}
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5 ml-2 border border-slate-200">
                <button onClick={handlePrevMonth} className="p-1 hover:bg-white hover:shadow-sm rounded-md transition-all text-slate-600">
                    <ChevronRight size={18} weight="bold" />
                </button>
                <span className="px-2 text-xs font-black text-slate-700 min-w-[70px] text-center">{monthName}</span>
                <button onClick={handleNextMonth} className="p-1 hover:bg-white hover:shadow-sm rounded-md transition-all text-slate-600">
                    <ChevronLeft size={18} weight="bold" />
                </button>
            </div>

            <ExportButton
                onExport={handleExportExcel}
                iconOnly
                variant="ghost"
                className="w-8 h-8 md:w-10 md:h-10 rounded-full"
                title="ייצוא לאקסל"
            />
            <button
                onClick={handleCopyToClipboard}
                className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center text-slate-500 hover:bg-slate-50 rounded-full transition-colors"
                title="העתק לו&quot;ז"
            >
                <Copy size={18} weight="bold" />
            </button>
            {person.phone && (
                <button
                    onClick={handleExportWhatsApp}
                    className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors"
                    title="ייצוא לווטסאפ"
                >
                    <WhatsappLogo size={22} weight="bold" />
                </button>
            )}
            {onShowStats && (
                <button
                    onClick={() => onShowStats(person)}
                    className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                    title="סטטיסטיקה אישית"
                >
                    <ChartBar size={20} weight="bold" />
                </button>
            )}
            {!isViewer && (
                <button
                    onClick={() => setShowRotationSettings(true)}
                    className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                    title="הגדרת סבב אישי"
                >
                    <RotateCcw size={18} weight="bold" />
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
            <div className="flex flex-col gap-2 w-full">
                <div className="flex items-center justify-between w-full">
                    <div className="flex gap-6 items-center flex-wrap">
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
                <div className="flex items-center gap-4 pt-2 border-t border-slate-100 flex-wrap">
                    <span className="text-xs font-black text-slate-400">מקרא:</span>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-amber-400" />
                        <span className="text-xs font-bold text-slate-500">שינוי ידני</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        <span className="text-xs font-bold text-slate-500">אילוץ / חסימה</span>
                    </div>
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
            compact={true}
            className="max-h-[90vh]"
        >
            {/* Custom Notification */}
            <AnimatePresence>
                {notification.type && (
                    <motion.div
                        initial={{ opacity: 0, y: -20, x: '-50%' }}
                        animate={{ opacity: 1, y: 10, x: '-50%' }}
                        exit={{ opacity: 0, scale: 0.95, x: '-50%' }}
                        className={`
                            fixed top-4 left-1/2 z-[100] px-4 py-2 rounded-full shadow-lg border font-bold text-sm
                            flex items-center gap-2
                            ${notification.type === 'success'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100 shadow-emerald-100/50'
                                : 'bg-red-50 text-red-700 border-red-100 shadow-red-100/50'
                            }
                        `}
                    >
                        {notification.type === 'success' ? <CheckCircle2 size={18} weight="fill" /> : <AlertCircle size={18} weight="fill" />}
                        <span>{notification.message}</span>
                    </motion.div>
                )}
            </AnimatePresence>
            {/* Calendar Controls Removed - Integrated into Header */}
            {/* <div className="flex items-center justify-between mb-4 bg-slate-50 p-2 rounded-xl border border-slate-100">
                <Button onClick={handlePrevMonth} variant="ghost" size="icon" icon={ChevronRight} />
                <h3 className="text-lg font-black text-slate-800 tracking-tight">{monthName}</h3>
                <Button onClick={handleNextMonth} variant="ghost" size="icon" icon={ChevronLeft} />
            </div> */}

            {/* Calendar Grid */}
            <div className="flex-1 overflow-hidden border border-slate-200 rounded-2xl bg-white shadow-sm flex flex-col">
                <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/50">
                    {['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'].map((day, idx) => (
                        <div key={day} className={`py-2.5 text-center text-[10px] font-black uppercase tracking-widest ${idx === 6 ? 'text-indigo-700 bg-indigo-100/50 border-l border-l-indigo-200/50 ring-1 ring-inset ring-indigo-200/30' : 'text-slate-400'}`}>
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
                    personId={person.id}
                    personName={person.name}
                    date={editingDate.toLocaleDateString('en-CA')} // Use ISO format for consistent filter matching
                    currentAvailability={getDisplayAvailability(editingDate)}
                    onViewHistory={(pId, d) => {
                        setEditingDate(null);
                        onViewHistory?.(pId, d);
                    }}
                    defaultArrivalHour="10:00"
                    defaultDepartureHour="14:00"
                />
            )}
        </GenericModal >
    );
};
