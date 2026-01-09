
import React, { useState, useRef, useEffect } from 'react';
import ExcelJS from 'exceljs';
import { Person, Team, Role, TeamRotation, TaskTemplate, SchedulingConstraint, OrganizationSettings, Shift, DailyPresence, Absence } from '@/types';
import { CalendarBlank as Calendar, CheckCircle as CheckCircle2, XCircle, CaretRight as ChevronRight, CaretLeft as ChevronLeft, MagnifyingGlass as Search, Gear as Settings, Calendar as CalendarDays, CaretDown as ChevronDown, ArrowLeft, ArrowRight, CheckSquare, ListChecks, X, MagicWand as Wand2, Sparkle as Sparkles, Users, DotsThreeVertical as MoreVertical, DownloadSimple as Download } from '@phosphor-icons/react';
import { getEffectiveAvailability } from '@/utils/attendanceUtils';
import { PersonalAttendanceCalendar } from './PersonalAttendanceCalendar';
import { DateNavigator } from '../../components/ui/DateNavigator';
import { GlobalTeamCalendar } from './GlobalTeamCalendar';
import { RotationEditor } from './RotationEditor';
import { PersonalRotationEditor } from './PersonalRotationEditor';
import { logger } from '../../services/loggingService';
import { AttendanceTable } from './AttendanceTable';
import { BulkAttendanceModal } from './BulkAttendanceModal';
import { useToast } from '@/contexts/ToastContext';
import { RotaWizardModal } from './RotaWizardModal';
import { PageInfo } from '@/components/ui/PageInfo';
import { useAuth } from '@/features/auth/AuthContext';
import { addHourlyBlockage, updateHourlyBlockage, deleteHourlyBlockage, updateAbsence } from '@/services/api'; // NEW Imports
import { ExportButton } from '../../components/ui/ExportButton';


interface AttendanceManagerProps {
    people: Person[];
    teams: Team[];
    roles: Role[];
    teamRotations?: TeamRotation[];
    tasks?: TaskTemplate[]; // NEW
    constraints?: SchedulingConstraint[]; // NEW
    absences?: Absence[]; // NEW
    hourlyBlockages?: import('@/types').HourlyBlockage[]; // NEW
    settings?: OrganizationSettings | null; // NEW
    onUpdatePerson: (p: Person) => void;
    onUpdatePeople?: (people: Person[]) => void;
    onAddRotation?: (r: TeamRotation) => void;
    onUpdateRotation?: (r: TeamRotation) => void;
    onDeleteRotation?: (id: string) => void;
    onAddShifts?: (shifts: Shift[]) => void; // NEW
    isViewer?: boolean;
    initialOpenRotaWizard?: boolean;
    onDidConsumeInitialAction?: () => void;
    onRefresh?: () => void; // NEW
}

export const AttendanceManager: React.FC<AttendanceManagerProps> = ({
    people, teams, roles, teamRotations = [],
    tasks = [], constraints = [], absences = [], hourlyBlockages = [], settings = null,
    onUpdatePerson, onUpdatePeople,
    onAddRotation, onUpdateRotation, onDeleteRotation, onAddShifts,
    isViewer = false, initialOpenRotaWizard = false, onDidConsumeInitialAction, onRefresh
}) => {
    const activePeople = people.filter(p => p.isActive !== false);
    const { profile } = useAuth();
    const { showToast } = useToast();
    const [viewMode, setViewMode] = useState<'calendar' | 'table' | 'day_detail'>('calendar');
    const [calendarViewType, setCalendarViewType] = useState<'grid' | 'table'>('grid'); // NEW: sub-view for calendar
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [viewDate, setViewDate] = useState(new Date()); // Lifted state for calendar view
    const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(() => new Set(teams.map(t => t.id)));
    const [searchTerm, setSearchTerm] = useState('');
    const [showRotationSettings, setShowRotationSettings] = useState<string | null>(null);
    const [selectedPersonForCalendar, setSelectedPersonForCalendar] = useState<Person | null>(null);
    const [editingPersonalRotation, setEditingPersonalRotation] = useState<Person | null>(null);
    const dateInputRef = useRef<HTMLInputElement>(null);

    // Bulk Mode State
    const [isBulkMode, setIsBulkMode] = useState(false);
    const [showRequiredDetails, setShowRequiredDetails] = useState(false); // New State
    const [selectedPersonIds, setSelectedPersonIds] = useState<Set<string>>(new Set());
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [showRotaWizard, setShowRotaWizard] = useState(initialOpenRotaWizard); // Initialize from prop
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const [showMoreActions, setShowMoreActions] = useState(false);

    useEffect(() => {
        if (initialOpenRotaWizard && onDidConsumeInitialAction) {
            onDidConsumeInitialAction();
        }
    }, [initialOpenRotaWizard, onDidConsumeInitialAction]);

    const getPersonAvailability = (person: Person) => {
        return getEffectiveAvailability(person, selectedDate, teamRotations, absences, hourlyBlockages);
    };

    const toggleTeamCollapse = (teamId: string) => {
        setCollapsedTeams(prev => {
            const next = new Set(prev);
            if (next.has(teamId)) next.delete(teamId);
            else next.add(teamId);
            return next;
        });
    };

    // ... (rest of code) ...


    const dateKey = selectedDate.toLocaleDateString('en-CA');

    const handleTogglePresence = (person: Person) => {
        if (isViewer) return;
        const currentData = getPersonAvailability(person);

        const newIsAvailable = !currentData.isAvailable;
        let newData = {
            isAvailable: newIsAvailable,
            startHour: '00:00',
            endHour: '23:59',
            source: 'manual'
        };

        if (!newIsAvailable) {
            newData.startHour = '00:00';
            newData.endHour = '00:00';
        }

        const updatedPerson = {
            ...person,
            dailyAvailability: {
                ...person.dailyAvailability,
                [dateKey]: newData
            }
        };
        onUpdatePerson(updatedPerson);
    };

    const handleTimeChange = (person: Person, field: 'startHour' | 'endHour', value: string) => {
        if (isViewer) return;
        const currentData = getPersonAvailability(person);

        const updatedPerson = {
            ...person,
            dailyAvailability: {
                ...person.dailyAvailability,
                [dateKey]: {
                    ...currentData,
                    isAvailable: true,
                    [field]: value,
                    source: 'manual'
                }
            }
        };
        onUpdatePerson(updatedPerson);
    };

    const filteredPeople = activePeople.filter(p => p.name.includes(searchTerm) || (p.phone && p.phone.includes(searchTerm)));

    let peopleByTeam = teams.map(team => ({
        team,
        members: filteredPeople
            .filter(p => p.teamId === team.id)
            .sort((a, b) => {
                // Stable sort by name only
                return a.name.localeCompare(b.name);
            })
    }));

    const noTeamMembers = filteredPeople.filter(p => !p.teamId || !teams.find(t => t.id === p.teamId));
    if (noTeamMembers.length > 0) {
        peopleByTeam.push({
            team: { id: 'no-team', name: 'ללא צוות', color: 'border-slate-300' },
            members: noTeamMembers
        });
    }

    peopleByTeam.sort((a, b) => b.members.length - a.members.length);

    const handleDateClick = (date: Date) => {
        setSelectedDate(date);
        setViewMode('day_detail');
    };

    const handleBackToCalendar = () => {
        setViewMode('calendar');
        setIsBulkMode(false);
        setSelectedPersonIds(new Set());
    };

    // Bulk Actions
    const handleToggleSelectPerson = (id: string) => {
        const next = new Set(selectedPersonIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedPersonIds(next);
    };

    const handleSelectAll = () => {
        if (selectedPersonIds.size === filteredPeople.length) {
            setSelectedPersonIds(new Set());
        } else {
            setSelectedPersonIds(new Set(filteredPeople.map(p => p.id)));
        }
    };

    const handleBulkApply = (data: { startDate: string; endDate: string; isAvailable: boolean; startHour: string; endHour: string; reason?: string }) => {
        if (!onUpdatePeople) return;

        const peopleToUpdate: Person[] = [];
        const start = new Date(data.startDate);
        const end = new Date(data.endDate);

        activePeople.forEach(person => {
            if (selectedPersonIds.has(person.id)) {
                let updatedPerson = { ...person };
                let current = new Date(start);

                while (current <= end) {
                    const key = current.toLocaleDateString('en-CA');
                    updatedPerson.dailyAvailability = {
                        ...updatedPerson.dailyAvailability,
                        [key]: {
                            isAvailable: data.isAvailable,
                            status: data.isAvailable ? 'base' : 'home', // Infer status for bulk operations
                            startHour: data.startHour,
                            endHour: data.endHour,
                            source: 'manual'
                        }
                    };
                    current.setDate(current.getDate() + 1);
                }
                peopleToUpdate.push(updatedPerson);
            }
        });

        onUpdatePeople(peopleToUpdate);
        showToast(`${peopleToUpdate.length} לוחמים עודכנו בהצלחה`, 'success');
        setIsBulkMode(false);
        setSelectedPersonIds(new Set());
    };

    const handleQuickBulkUpdate = (isAvailable: boolean) => {
        const dateStr = selectedDate.toLocaleDateString('en-CA');
        handleBulkApply({
            startDate: dateStr,
            endDate: dateStr,
            isAvailable,
            startHour: isAvailable ? '00:00' : '00:00',
            endHour: isAvailable ? '23:59' : '00:00'
        });
    };

    const handleUpdatePersonalRotation = (rotationSettings: any) => {
        if (!editingPersonalRotation) return;
        const updatedPerson = {
            ...editingPersonalRotation,
            personalRotation: rotationSettings
        };
        onUpdatePerson(updatedPerson);
        setEditingPersonalRotation(null);
        showToast('הגדרות סבב אישי עודכנו', 'success');
    };

    const handleUpdateAvailability = async (personId: string, date: string, status: 'base' | 'home' | 'unavailable', customTimes?: { start: string, end: string }, newUnavailableBlocks?: { id: string, start: string, end: string, reason?: string, type?: string }[]) => {
        if (isViewer) return;

        const person = people.find(p => p.id === personId);
        if (!person) return;
        const currentData = person.dailyAvailability?.[date] || {
            isAvailable: true,
            startHour: '00:00',
            endHour: '23:59',
            source: 'manual',
            unavailableBlocks: []
        };

        // 1. Sync Hourly Blockages (NEW TABLE)
        if (newUnavailableBlocks) {
            // Fetch existing blocks for this person/date to diff
            // Note: We already have 'hourlyBlockages' from props (all org blocks).
            // We can filter from there instead of strict DB fetch if we trust props are fresh enough.
            // But for safety on write, let's trust the props or just do upsert.

            const dateKey = new Date(date).toISOString().split('T')[0]; // Ensure 'YYYY-MM-DD'
            const existingBlocks = hourlyBlockages.filter(b => b.person_id === personId && b.date === dateKey);
            const incomingBlocks = newUnavailableBlocks.filter(b => b.type !== 'absence'); // Only manual blocks

            const promises: Promise<any>[] = [];

            // A. DELETE blocks that are no longer present
            const incomingIds = incomingBlocks.map(b => b.id);
            const toDelete = existingBlocks.filter(b => !incomingIds.includes(b.id));
            toDelete.forEach(b => promises.push(deleteHourlyBlockage(b.id)));

            // B. UPSERT (Add or Update) incoming
            for (const mb of incomingBlocks) {
                const existing = existingBlocks.find(b => b.id === mb.id);
                // Check if changed
                if (!existing || existing.start_time !== mb.start || existing.end_time !== mb.end || existing.reason !== mb.reason) {
                    if (existing) {
                        promises.push(updateHourlyBlockage({
                            id: mb.id, // Use existing ID if matched (though UUID from modal might match DB)
                            person_id: personId,
                            organization_id: profile.organization_id,
                            date: dateKey,
                            start_time: mb.start,
                            end_time: mb.end,
                            reason: mb.reason || ''
                        }));
                    } else {
                        // New
                        promises.push(addHourlyBlockage({
                            person_id: personId,
                            organization_id: profile.organization_id, // Fix
                            date: dateKey,
                            start_time: mb.start,
                            end_time: mb.end,
                            reason: mb.reason || ''
                        }));
                    }
                }
            }

            if (promises.length > 0) {
                try {
                    await Promise.all(promises);
                    logger.info('UPDATE', `Updated ${promises.length} hourly blocks for ${person.name}`, { personId, date: dateKey, count: promises.length });
                    if (onRefresh) onRefresh();
                } catch (err) {
                    logger.error('ERROR', 'Failed to sync blocks', err);
                    showToast('שגיאה בשמירת חסימות', 'error');
                }
            }
        }

        // 2. NEW: Conflict Resolution - Auto-Reject Approved Absences if Manual Override is 'base'
        if (status === 'base') {
            const dateKey = new Date(date).toISOString().split('T')[0];
            const conflictingAbsence = absences.find(a =>
                a.person_id === personId &&
                a.status === 'approved' &&
                dateKey >= a.start_date &&
                dateKey <= a.end_date
            );

            if (conflictingAbsence) {
                // Auto-Reject the absence
                try {
                    await updateAbsence({ ...conflictingAbsence, status: 'rejected' });
                    logger.info('UPDATE', `Auto-rejected conflicting absence for ${person.name}`, {
                        personId,
                        absenceId: conflictingAbsence.id,
                        date: dateKey,
                        action: 'conflict_resolution'
                    });
                    showToast('היעדרות מאושרת לחפיפה זו בוטלה (נדחתה) עקב שינוי ידני לבסיס', 'info');
                    // Note: We don't need to manually update state here because onRefresh() or onUpdateAbsence (if we had it) would handle it.
                    // But AttendanceManager receives absences as props, so we rely on the parent to refresh or the onRefresh callback.
                } catch (e) {
                    logger.error('ERROR', "Failed to auto-reject absence", e);
                    console.error(e);
                }
            }
        }

        // 2. Update Daily Presence (Status & Hours)
        // We set unavailableBlocks to [] because we migrated them to the new table!
        // This effectively 'cleans' the json field for this record.
        let newData: any = {
            ...currentData,
            source: 'manual',
            status: status,
            unavailableBlocks: []
        };

        logger.info('UPDATE', `Manually updated attendance status for ${person.name} to ${status}`, {
            personId,
            date,
            oldStatus: currentData.status,
            newStatus: status,
            category: 'attendance'
        });

        if (status === 'base') {
            newData.isAvailable = true;
            if (customTimes) {
                newData.startHour = customTimes.start;
                newData.endHour = customTimes.end;
            } else {
                newData.startHour = '00:00';
                newData.endHour = '23:59';
            }
        } else if (status === 'home') {
            newData.isAvailable = false;
            newData.startHour = '00:00';
            newData.endHour = '00:00';
        } else if (status === 'unavailable') {
            newData.isAvailable = false;
            newData.startHour = '00:00';
            newData.endHour = '00:00';
            newData.reason = 'אילוץ / לא זמין';
        }

        const updatedPerson = {
            ...person,
            dailyAvailability: {
                ...person.dailyAvailability,
                [date]: newData
            }
        };

        onUpdatePerson(updatedPerson);
        showToast('הסטטוס עודכן בהצלחה', 'success');
    };

    const handleExport = async () => {
        if (isViewer) {
            showToast('אין לך הרשאה לייצא נתונים', 'error');
            return;
        }

        try {
            const workbook = new ExcelJS.Workbook();
            let fileName = '';

            if (viewMode === 'calendar' || viewMode === 'table') {
                const worksheet = workbook.addWorksheet('דוח חודשי', { views: [{ rightToLeft: true }] });
                const year = viewDate.getFullYear();
                const month = viewDate.getMonth();
                const daysInMonth = new Date(year, month + 1, 0).getDate();

                const headers = ['תאריך', 'שם מלא', 'צוות', 'סטטוס', 'שעות', 'סיבה/הערות'];
                const headerRow = worksheet.addRow(headers);
                headerRow.font = { bold: true };
                headerRow.eachCell(cell => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
                    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                });

                for (let d = 1; d <= daysInMonth; d++) {
                    const date = new Date(year, month, d);
                    const dateStr = date.toLocaleDateString('he-IL');
                    const dateKey = date.toLocaleDateString('en-CA');

                    people.forEach(person => {
                        const avail = getEffectiveAvailability(person, date, teamRotations, absences, hourlyBlockages);
                        const teamName = teams.find(t => t.id === person.teamId)?.name || 'ללא צוות';

                        const relevantAbsence = absences.find(a =>
                            a.person_id === person.id &&
                            dateKey >= a.start_date &&
                            dateKey <= a.end_date
                        );

                        const isAtBase = avail.status === 'base' || avail.status === 'arrival' || avail.status === 'departure' || avail.status === 'full';
                        const statusLabel = isAtBase ? 'בבסיס' : (avail.status === 'home' ? 'בית' : 'אילוץ');
                        const hours = isAtBase ? `${avail.startHour} - ${avail.endHour}` : '-';

                        let reason = (avail as any).reason || (avail.source === 'rotation' ? 'סבב' : (avail.source === 'manual' ? 'ידני' : 'רגיל'));

                        if (relevantAbsence) {
                            const statusDesc = relevantAbsence.status === 'approved' ? 'מאושר' : (relevantAbsence.status === 'pending' ? 'ממתין' : 'נדחה');
                            const absenceReason = relevantAbsence.reason || 'בקשת יציאה';
                            reason = `${reason} | היעדרות (${statusDesc}): ${absenceReason}`;
                        }

                        const row = worksheet.addRow([dateStr, person.name, teamName, statusLabel, hours, reason]);

                        const statusCell = row.getCell(4);
                        if (statusLabel === 'בית') {
                            statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
                            statusCell.font = { color: { argb: 'FF991B1B' } };
                        } else if (statusLabel === 'בבסיס') {
                            statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
                            statusCell.font = { color: { argb: 'FF065F46' } };
                        } else if (statusLabel === 'אילוץ') {
                            statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
                            statusCell.font = { color: { argb: 'FF92400E' } };
                        }
                    });
                }
                worksheet.columns = [{ width: 12 }, { width: 20 }, { width: 15 }, { width: 12 }, { width: 15 }, { width: 40 }];
                fileName = `attendance_month_${month + 1}_${year}.xlsx`;
            } else {
                const worksheet = workbook.addWorksheet('דוח יומי', { views: [{ rightToLeft: true }] });
                const headers = ['שם מלא', 'צוות', 'סטטוס', 'שעות', 'סיבה/הערות'];
                const headerRow = worksheet.addRow(headers);
                headerRow.font = { bold: true };
                headerRow.eachCell(cell => cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } });

                const dateKey = selectedDate.toLocaleDateString('en-CA');
                people.forEach(person => {
                    const avail = getPersonAvailability(person);
                    const teamName = teams.find(t => t.id === person.teamId)?.name || 'ללא צוות';
                    const relevantAbsence = absences.find(a => a.person_id === person.id && dateKey >= a.start_date && dateKey <= a.end_date);
                    const isAtBase = avail.status === 'base' || avail.status === 'arrival' || avail.status === 'departure' || avail.status === 'full';
                    const statusLabel = isAtBase ? 'בבסיס' : (avail.status === 'home' ? 'בית' : 'אילוץ');
                    const hours = isAtBase ? `${avail.startHour} - ${avail.endHour}` : '-';
                    let reason = (avail as any).reason || (avail.source === 'rotation' ? 'סבב' : (avail.source === 'manual' ? 'ידני' : 'רגיל'));
                    if (relevantAbsence) {
                        const statusDesc = relevantAbsence.status === 'approved' ? 'מאושר' : (relevantAbsence.status === 'pending' ? 'ממתין' : 'נדחה');
                        reason = `${reason} | היעדרות (${statusDesc}): ${relevantAbsence.reason || 'בקשת יציאה'}`;
                    }
                    const row = worksheet.addRow([person.name, teamName, statusLabel, hours, reason]);
                    const statusCell = row.getCell(3);
                    if (statusLabel === 'בית') statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
                    else if (statusLabel === 'בבסיס') statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
                });
                worksheet.columns = [{ width: 20 }, { width: 15 }, { width: 12 }, { width: 15 }, { width: 40 }];
                fileName = `attendance_${selectedDate.toLocaleDateString('en-CA')}.xlsx`;
            }

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            link.click();
            URL.revokeObjectURL(url);
            showToast('הקובץ יוצא בהצלחה', 'success');
            logger.info('EXPORT', `Exported attendance report: ${fileName}`);
        } catch (error) {
            console.error("Export error:", error);
            showToast('שגיאה בתהליך הייצוא', 'error');
        }
    };

    return (
        <div className="bg-white rounded-[2rem] shadow-xl md:shadow-portal border border-slate-100 flex flex-col h-[calc(100dvh-80px)] md:h-[calc(100vh-100px)] relative overflow-hidden">
            {/* --- GREEN HEADER (Mobile & Desktop Unified or Mobile Only?) --- */}

            {/* --- UNIFIED MOBILE CONTAINER --- */}
            <div className={`
                flex-1 flex flex-col md:hidden
                relative isolate z-10 overflow-hidden
            `}>
                {/* Mobile Header - Premium Design */}
                <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200/50 sticky top-0 z-50 px-3 py-3 flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                        {/* Compact Segmented Control */}
                        <div className="flex-1 flex items-center p-1 bg-slate-100/80 rounded-xl border border-slate-200/50 h-9">
                            <button
                                onClick={() => setViewMode('calendar')}
                                className={`flex-1 flex items-center justify-center gap-1.5 h-full rounded-lg transition-all duration-300 ${viewMode === 'calendar' ? 'bg-white text-blue-600 shadow-sm font-black' : 'text-slate-500 font-bold'}`}
                            >
                                <CalendarDays size={14} weight="duotone" />
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

                        {!isViewer && (
                            <button
                                onClick={() => setShowRotaWizard(true)}
                                className="w-9 h-9 flex items-center justify-center bg-blue-50 text-blue-600 rounded-xl border border-blue-100 active:scale-95 transition-all shrink-0"
                                title="מחולל סבבים"
                            >
                                <Sparkles size={18} weight="duotone" />
                            </button>
                        )}
                        <ExportButton
                            onExport={async () => { await handleExport(); }}
                            iconOnly
                            variant="secondary"
                            size="sm"
                            className="w-9 h-9 rounded-xl"
                            title="ייצוא נתוני נוכחות"
                        />
                    </div>

                    {/* Date Navigator - Optimized for Mobile */}
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

                {/* Content Render (Mobile) */}
                <div className="flex-1 overflow-hidden flex flex-col">
                    {viewMode === 'calendar' ? (
                        <div className="h-full flex flex-col">
                            <GlobalTeamCalendar
                                teams={teams}
                                people={people}
                                teamRotations={teamRotations}
                                absences={absences}
                                hourlyBlockages={hourlyBlockages}
                                onManageTeam={(teamId) => setShowRotationSettings(teamId)}
                                onDateClick={handleDateClick}
                                currentDate={viewDate}
                                onDateChange={setViewDate}
                                viewType={calendarViewType}
                                onViewTypeChange={setCalendarViewType}
                                organizationName={(settings as any)?.organization_name}
                            />
                        </div>
                    ) : (
                        <div className="h-full flex flex-col">
                            {/* Search Bar - Premium Mobile Design */}
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
                                onSelectPerson={(p) => {
                                    if (isBulkMode) handleToggleSelectPerson(p.id);
                                    else setSelectedPersonForCalendar(p);
                                }}
                                onUpdateAvailability={handleUpdateAvailability}
                                className="h-full"
                                isViewer={isViewer}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* --- DESKTOP VIEW CONTAINER --- */}
            <div className="hidden md:flex flex-col flex-1 overflow-hidden">
                {/* Desktop Header */}
                <div className="bg-white/50 backdrop-blur-sm border-b border-slate-100 p-4 justify-between items-center shrink-0 z-20 relative flex gap-4">
                    <div className="flex items-center gap-4">
                        <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                            <Calendar className="text-blue-600" size={24} weight="duotone" />
                            יומן נוכחות
                            <PageInfo
                                title="יומן נוכחות"
                                description={
                                    <>
                                        <p className="mb-2">כאן ניתן לראות ולנהל את זמינות הלוחמים.</p>
                                        <ul className="list-disc list-inside space-y-1 mb-2 text-right">
                                            <li><b>תצוגת לוח שנה:</b> מבט חודשי גלובלי על הסבבים והנוכחות.</li>
                                            <li><b>תצוגת רשימה:</b> ניהול מפורט של זמינות לכל לוחם ברמה היומית.</li>
                                            <li><b>סבבים:</b> הגדרת סבבי יציאות (11/3, חצאים וכו') לניהול מהיר.</li>
                                        </ul>
                                        <p className="text-sm bg-blue-50 p-2 rounded text-blue-800">
                                            הנתונים כאן משפיעים ישירות על יכולת השיבוץ של המערכת.
                                        </p>
                                    </>
                                }
                            />
                        </h2>

                        <div className="h-6 w-px bg-slate-200 mx-2" />

                        <div className="flex bg-slate-100/80 rounded-xl p-1 border border-slate-200/50">
                            <button
                                onClick={() => setViewMode('calendar')}
                                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-2 h-7 ${viewMode === 'calendar' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <CalendarDays size={14} weight="duotone" />
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

                    <div className="flex items-center gap-2">
                        {/* Expandable Search */}
                        {viewMode !== 'calendar' && (
                            <div className={`relative transition-all duration-300 ease-in-out ${isSearchExpanded || searchTerm ? 'w-48' : 'w-9'}`}>
                                {isSearchExpanded || searchTerm ? (
                                    <div className="relative w-full">
                                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} weight="duotone" />
                                        <input
                                            autoFocus
                                            type="text"
                                            placeholder="חיפוש..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            onBlur={() => { if (!searchTerm) setIsSearchExpanded(false); }}
                                            className="w-full h-9 pr-9 pl-8 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all shadow-sm placeholder:font-medium"
                                        />
                                        <button
                                            onClick={() => { setSearchTerm(''); setIsSearchExpanded(false); }}
                                            className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                                        >
                                            <X size={12} weight="bold" />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setIsSearchExpanded(true)}
                                        className="w-9 h-9 flex items-center justify-center bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-500 transition-colors"
                                    >
                                        <Search size={16} weight="duotone" />
                                    </button>
                                )}
                            </div>
                        )}

                        <DateNavigator
                            date={(viewMode === 'calendar' || viewMode === 'table') ? viewDate : selectedDate}
                            onDateChange={(d) => {
                                if (viewMode === 'calendar' || viewMode === 'table') setViewDate(d);
                                else setSelectedDate(d);
                            }}
                            mode={(viewMode === 'calendar' || viewMode === 'table') ? 'month' : 'day'}
                        />

                        {(profile?.permissions?.canManageRotaWizard || profile?.is_super_admin) && (
                            <button
                                onClick={() => setShowRotaWizard(true)}
                                data-testid="open-rota-wizard-btn"
                                className="h-9 px-4 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 border border-amber-100"
                            >
                                <Sparkles size={14} weight="duotone" />
                                <span className="hidden xl:inline">מחולל סבבים</span>
                            </button>
                        )}

                        <ExportButton
                            onExport={handleExport}
                            iconOnly
                            className="h-9 w-9 rounded-xl hidden md:inline-flex"
                            title="ייצוא לאקסל"
                        />


                        {/* More Actions Menu */}
                        <div className={`relative ${(viewMode === 'table') ? 'flex' : 'md:hidden flex'}`}>
                            <button
                                onClick={() => setShowMoreActions(!showMoreActions)}
                                className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors border ${showMoreActions ? 'bg-slate-100 border-slate-300 text-slate-800' : 'bg-white border-transparent hover:bg-slate-50 text-slate-500'}`}
                            >
                                <MoreVertical size={18} weight="bold" />
                            </button>

                            {showMoreActions && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowMoreActions(false)} />
                                    <div className="absolute left-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-100 z-50 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-top-left">
                                        {viewMode === 'table' && (
                                            <button
                                                onClick={() => { setShowRequiredDetails(!showRequiredDetails); setShowMoreActions(false); }}
                                                className="w-full text-right px-4 py-2.5 text-xs font-bold hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                                            >
                                                <ListChecks size={14} className="text-slate-400" weight="duotone" />
                                                {showRequiredDetails ? 'הסתר דרישות כוח אדם' : 'הצג דרישות כוח אדם'}
                                            </button>
                                        )}

                                        <div className="md:hidden">
                                            <ExportButton
                                                onExport={async () => { await handleExport(); setShowMoreActions(false); }}
                                                variant="ghost"
                                                className="w-full justify-start h-10 px-4 rounded-none border-0 text-slate-700 hover:bg-slate-50"
                                                label="ייצוא נתוני נוכחות"
                                            />
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                    </div>
                </div>


                <div className="flex-1 overflow-hidden flex flex-col isolate z-10">
                    {/* Content Render (Desktop) */}
                    {viewMode === 'calendar' ? (
                        <div className="h-full flex flex-col bg-white overflow-hidden">
                            <GlobalTeamCalendar
                                teams={teams}
                                people={people}
                                teamRotations={teamRotations}
                                absences={absences}
                                hourlyBlockages={hourlyBlockages}
                                onManageTeam={(teamId) => setShowRotationSettings(teamId)}
                                onDateClick={handleDateClick}
                                currentDate={viewDate}
                                onDateChange={setViewDate}
                                viewType={calendarViewType}
                                onViewTypeChange={setCalendarViewType}
                                organizationName={(settings as any)?.organization_name}
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
                                onSelectPerson={(p) => {
                                    if (isBulkMode) handleToggleSelectPerson(p.id);
                                    else setSelectedPersonForCalendar(p);
                                }}
                                onUpdateAvailability={isViewer ? undefined : handleUpdateAvailability}
                                className="h-full"
                                isViewer={isViewer}
                                showRequiredDetails={showRequiredDetails}
                                tasks={tasks}
                            />
                        </div>
                    )}
                </div>
            </div>
            {/* Modals & Overlays (Outside sheet flow or global) */}
            {
                showRotationSettings && (() => {
                    const team = teams.find(t => t.id === showRotationSettings);
                    if (!team) return null;
                    return (
                        <RotationEditor
                            team={team}
                            existing={teamRotations.find(r => r.team_id === team.id)}
                            onClose={() => setShowRotationSettings(null)}
                            onAddRotation={onAddRotation}
                            onUpdateRotation={onUpdateRotation}
                            onDeleteRotation={onDeleteRotation}
                        />
                    );
                })()
            }

            {
                selectedPersonForCalendar && !isBulkMode && (
                    <PersonalAttendanceCalendar
                        person={selectedPersonForCalendar}
                        teamRotations={teamRotations}
                        absences={absences}
                        onClose={() => setSelectedPersonForCalendar(null)}
                        onUpdatePerson={onUpdatePerson}
                        isViewer={isViewer}
                    />
                )
            }

            {
                editingPersonalRotation && !isBulkMode && (
                    <PersonalRotationEditor
                        person={editingPersonalRotation}
                        isOpen={true}
                        onClose={() => setEditingPersonalRotation(null)}
                        onSave={handleUpdatePersonalRotation}
                    />
                )
            }

            <BulkAttendanceModal
                isOpen={showBulkModal}
                onClose={() => setShowBulkModal(false)}
                onApply={handleBulkApply}
                selectedCount={selectedPersonIds.size}
            />

            {
                showRotaWizard && (
                    <RotaWizardModal
                        isOpen={showRotaWizard}
                        onClose={() => setShowRotaWizard(false)}
                        people={activePeople}
                        teams={teams}
                        roles={roles}
                        tasks={tasks}
                        constraints={constraints}
                        absences={absences}
                        settings={settings}
                        teamRotations={teamRotations}
                        hourlyBlockages={hourlyBlockages}
                        onSaveRoster={(roster: DailyPresence[]) => { }}
                    />
                )
            }


        </div >
    );
};
