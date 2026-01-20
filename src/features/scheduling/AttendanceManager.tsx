
import React, { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import ExcelJS from 'exceljs';
import { Person, Team, Role, TeamRotation, TaskTemplate, SchedulingConstraint, OrganizationSettings, Shift, DailyPresence, Absence } from '@/types';
import { CalendarBlank as Calendar, CheckCircle as CheckCircle2, XCircle, CaretRight as ChevronRight, CaretLeft as ChevronLeft, MagnifyingGlass as Search, Gear as Settings, Calendar as CalendarDays, CaretDown as ChevronDown, ArrowLeft, ArrowRight, CheckSquare, ListChecks, X, MagicWand as Wand2, Sparkle as Sparkles, Users, DotsThreeVertical as MoreVertical, DownloadSimple as Download, ChartBar } from '@phosphor-icons/react';
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
import { AttendanceStatsModal } from './AttendanceStatsModal';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';
import { GenericModal } from '../../components/ui/GenericModal';
import { Button } from '../../components/ui/Button';
import { PageInfo } from '@/components/ui/PageInfo';
import { useAuth } from '@/features/auth/AuthContext';
import { addHourlyBlockage, updateHourlyBlockage, deleteHourlyBlockage, updateAbsence } from '@/services/api';
import { ExportButton } from '../../components/ui/ExportButton';
import { ActionBar } from '@/components/ui/ActionBar';


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
    shifts?: Shift[]; // NEW
    isViewer?: boolean;
    initialOpenRotaWizard?: boolean;
    onDidConsumeInitialAction?: () => void;
    onRefresh?: () => void; // NEW
}

export const AttendanceManager: React.FC<AttendanceManagerProps> = ({
    people, teams, roles, teamRotations = [],
    tasks = [], constraints = [], absences = [], hourlyBlockages = [], settings = null,
    shifts = [],
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
    const containerRef = useRef<HTMLDivElement>(null);

    // Bulk Mode State
    const [isBulkMode, setIsBulkMode] = useState(false);
    const [showRequiredDetails, setShowRequiredDetails] = useState(false); // New State
    const [selectedPersonIds, setSelectedPersonIds] = useState<Set<string>>(new Set());
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [showRotaWizard, setShowRotaWizard] = useState(initialOpenRotaWizard); // Initialize from prop
    const [showStatistics, setShowStatistics] = useState(false);
    const [statsEntity, setStatsEntity] = useState<{ person?: Person, team?: Team } | null>(null);
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const [showMoreActions, setShowMoreActions] = useState(false);
    const [confirmationState, setConfirmationState] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        confirmText?: string;
        type?: 'warning' | 'danger' | 'info';
    }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    // Export Modal State
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportStartDate, setExportStartDate] = useState('');
    const [exportEndDate, setExportEndDate] = useState('');

    const queryClient = useQueryClient();

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

    const handleUpdateAvailability = async (personId: string, dateOrDates: string | string[], status: 'base' | 'home' | 'unavailable', customTimes?: { start: string, end: string }, newUnavailableBlocks?: { id: string, start: string, end: string, reason?: string, type?: string }[], homeStatusType?: import('@/types').HomeStatusType, forceConfirm = false) => {
        if (isViewer) return;

        const person = people.find(p => p.id === personId);
        if (!person) return;

        const dates = Array.isArray(dateOrDates) ? dateOrDates : [dateOrDates];

        // NEW: Check for conflicts if changing to home/unavailable
        if (!forceConfirm && (status === 'home' || status === 'unavailable')) {
            const conflictingShifts = shifts.filter(s => {
                if (!s.assignedPersonIds.includes(personId) || s.isCancelled) return false;

                const shiftStart = new Date(s.startTime);
                const shiftEnd = new Date(s.endTime);

                return dates.some(dateStr => {
                    const dayStart = new Date(dateStr);
                    dayStart.setHours(0, 0, 0, 0);
                    const dayEnd = new Date(dateStr);
                    dayEnd.setHours(24, 0, 0, 0);

                    return shiftStart < dayEnd && shiftEnd > dayStart;
                });
            });

            if (conflictingShifts.length > 0) {
                const shiftDescriptions = conflictingShifts.map(s => {
                    const task = tasks.find(t => t.id === s.taskId);
                    const time = `${s.startTime.split('T')[1].slice(0, 5)} - ${s.endTime.split('T')[1].slice(0, 5)}`;
                    return `${task?.name || 'משימה'} (${time}) בתאריך ${s.startTime.split('T')[0]}`;
                }).join('\n');

                setConfirmationState({
                    isOpen: true,
                    title: 'נמצאו שיבוצים פעילים',
                    message: `שים לב, לחייל ${person.name} ישנם שיבוצים פעילים בתאריכים שנבחרו:\n\n${shiftDescriptions}\n\nהאם אתה בטוח שברצונך לשנות את הסטטוס ל"בית"? (יהיה עלייך להחליף אותו ידנית בלוח השיבוצים)`,
                    confirmText: 'כן, שנה סטטוס',
                    type: 'warning',
                    onConfirm: () => {
                        setConfirmationState(prev => ({ ...prev, isOpen: false }));
                        handleUpdateAvailability(personId, dateOrDates, status, customTimes, newUnavailableBlocks, homeStatusType, true);
                    }
                });
                return;
            }
        }

        let updatedAvailability = { ...person.dailyAvailability };

        const blockAddPromises: Promise<any>[] = [];
        const blockUpdatePromises: Promise<any>[] = [];
        const blockDeleteIds: string[] = [];
        const otherPromises: Promise<any>[] = [];

        for (const date of dates) {
            const currentData = updatedAvailability[date] || {
                isAvailable: true,
                startHour: '00:00',
                endHour: '23:59',
                source: 'manual',
                unavailableBlocks: []
            };

            // 1. Sync Hourly Blockages (NEW TABLE)
            if (newUnavailableBlocks) {
                const dateKey = new Date(date).toISOString().split('T')[0]; // Ensure 'YYYY-MM-DD'
                const existingBlocks = hourlyBlockages.filter(b => b.person_id === personId && b.date === dateKey);
                const incomingBlocks = newUnavailableBlocks.filter(b => b.type !== 'absence'); // Only manual blocks

                // A. DELETE blocks that are no longer present
                const incomingIds = incomingBlocks.map(b => b.id);
                const toDelete = existingBlocks.filter(b => !incomingIds.includes(b.id));
                toDelete.forEach(b => {
                    blockDeleteIds.push(b.id);
                    otherPromises.push(deleteHourlyBlockage(b.id));
                });

                // B. UPSERT (Add or Update) incoming
                for (const mb of incomingBlocks) {
                    const existing = existingBlocks.find(b => b.id === mb.id);
                    // Check if changed
                    if (!existing || existing.start_time !== mb.start || existing.end_time !== mb.end || existing.reason !== mb.reason) {
                        if (existing) {
                            blockUpdatePromises.push(updateHourlyBlockage({
                                id: mb.id, // Use existing ID if matched
                                person_id: personId,
                                organization_id: profile.organization_id,
                                date: dateKey,
                                start_time: mb.start,
                                end_time: mb.end,
                                reason: mb.reason || ''
                            }));
                        } else {
                            // New
                            blockAddPromises.push(addHourlyBlockage({
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
            }

            // 2. Conflict Resolution - Auto-Reject Approved Absences
            if (status === 'base') {
                const dateKey = new Date(date).toISOString().split('T')[0];
                const conflictingAbsence = absences.find(a =>
                    a.person_id === personId &&
                    a.status === 'approved' &&
                    dateKey >= a.start_date &&
                    dateKey <= a.end_date
                );

                if (conflictingAbsence) {
                    try {
                        otherPromises.push(updateAbsence({ ...conflictingAbsence, status: 'rejected' }));
                        logger.info('UPDATE', `Auto-rejected conflicting absence for ${person.name}`, {
                            personId,
                            absenceId: conflictingAbsence.id,
                            date: dateKey,
                            action: 'conflict_resolution'
                        });
                        showToast('היעדרות מאושרת לחפיפה זו בוטלה (נדחתה) עקב שינוי ידני לבסיס', 'info');
                    } catch (e) {
                        // Error logging moved to catch block of Promise.all
                    }
                }
            }

            // 3. Prepare New Data
            let newData: any = {
                ...currentData,
                source: 'manual',
                status: status,
                unavailableBlocks: [] // Cleared as they are now in a separate table
            };

            if (status === 'base') {
                newData.isAvailable = true;
                if (customTimes) {
                    newData.startHour = customTimes.start;
                    newData.endHour = customTimes.end;
                } else {
                    newData.startHour = '00:00';
                    newData.endHour = '23:59';
                }
                newData.homeStatusType = undefined;
            } else if (status === 'home') {
                newData.isAvailable = false;
                newData.startHour = '00:00';
                newData.endHour = '00:00';
                newData.homeStatusType = homeStatusType;
            } else if (status === 'unavailable') {
                newData.isAvailable = false;
                newData.startHour = '00:00';
                newData.endHour = '00:00';
                newData.reason = 'אילוץ / לא זמין';
                newData.homeStatusType = undefined;
            }

            updatedAvailability[date] = newData;
        }

        // Execute side effects (DB updates)
        if (blockAddPromises.length > 0 || blockUpdatePromises.length > 0 || otherPromises.length > 0) {
            try {
                const [addedBlocks, updatedBlocks] = await Promise.all([
                    Promise.all(blockAddPromises),
                    Promise.all(blockUpdatePromises),
                    Promise.all(otherPromises)
                ]);

                // Manually update cache to reflect block changes immediately
                const queryKey = ['organizationData', profile.organization_id, profile.id];
                queryClient.setQueriesData({ queryKey }, (old: any) => {
                    if (!old || !old.hourlyBlockages) return old;

                    let newBlockages = [...old.hourlyBlockages];

                    // 1. Remove deleted
                    if (blockDeleteIds.length > 0) {
                        newBlockages = newBlockages.filter(b => !blockDeleteIds.includes(b.id));
                    }

                    // 2. Update existing
                    updatedBlocks.forEach((b: any) => {
                        if (b) newBlockages = newBlockages.map(exist => exist.id === b.id ? b : exist);
                    });

                    // 3. Add new
                    addedBlocks.forEach((b: any) => {
                        if (b && !newBlockages.find(exist => exist.id === b.id)) {
                            newBlockages.push(b);
                        }
                    });

                    return { ...old, hourlyBlockages: newBlockages };
                });

                if (onRefresh) onRefresh();
            } catch (err) {
                logger.error('ERROR', 'Failed to sync blocks/absences', err);
                showToast('שגיאה בשמירת נתונים נלווים', 'error');
            }
        }

        const updatedPerson = {
            ...person,
            dailyAvailability: updatedAvailability,
            lastManualStatus: {
                status: status === 'unavailable' ? 'home' : status,
                homeStatusType: status === 'home' ? homeStatusType : undefined,
                date: dates[dates.length - 1] // Last date in range
            }
        };

        const logDate = dates.length > 1 ? `${dates[0]} - ${dates[dates.length - 1]} (${dates.length} days)` : dates[0];
        logger.info('UPDATE', `Manually updated attendance status for ${person.name} to ${status}`, {
            personId,
            date: logDate,
            newStatus: status,
            category: 'attendance'
        });

        onUpdatePerson(updatedPerson);
        showToast(dates.length > 1 ? `${dates.length} ימים עודכנו בהצלחה` : 'הסטטוס עודכן בהצלחה', 'success');
    };

    const handleOpenExportModal = () => {
        if (isViewer) {
            showToast('אין לך הרשאה לייצא נתונים', 'error');
            return;
        }

        // Default dates based on view mode
        if (viewMode === 'day_detail') {
            const dateStr = selectedDate.toLocaleDateString('en-CA');
            setExportStartDate(dateStr);
            setExportEndDate(dateStr);
        } else {
            const year = viewDate.getFullYear();
            const month = viewDate.getMonth();
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);

            setExportStartDate(firstDay.toLocaleDateString('en-CA'));
            setExportEndDate(lastDay.toLocaleDateString('en-CA'));
        }
        setShowExportModal(true);
    };

    const handleExport = async () => {
        if (isViewer) return; // Should be blocked by UI but double check

        // Ensure dates are valid
        if (!exportStartDate || !exportEndDate) {
            showToast('נא לבחור טווח תאריכים תקין', 'error');
            return;
        }

        const start = new Date(exportStartDate);
        const end = new Date(exportEndDate);

        if (start > end) {
            showToast('תאריך התחלה לא יכול להיות אחרי תאריך סיום', 'error');
            return;
        }

        try {
            const workbook = new ExcelJS.Workbook();
            let fileName = '';

            // Calculate days difference
            const diffTime = Math.abs(end.getTime() - start.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

            if (viewMode === 'calendar' || viewMode === 'table') {
                const worksheet = workbook.addWorksheet('דוח נוכחות', { views: [{ rightToLeft: true }] });


                // Home status type labels
                const homeStatusLabels: Record<string, string> = {
                    'leave_shamp': 'חופשה בשמפ',
                    'gimel': 'ג\'',
                    'absent': 'נפקד',
                    'organization_days': 'ימי התארגנות',
                    'not_in_shamp': 'לא בשמ"פ'
                };

                // Build headers: Name, Team, then all dates
                const headers = ['שם מלא', 'צוות'];
                for (let i = 0; i < diffDays; i++) {
                    const date = new Date(start);
                    date.setDate(start.getDate() + i);
                    const dayName = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'][date.getDay()];
                    headers.push(`${date.getDate()}.${date.getMonth() + 1}\n${dayName}`);
                }

                const headerRow = worksheet.addRow(headers);
                headerRow.font = { bold: true };
                headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                headerRow.height = 30;
                headerRow.eachCell(cell => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                });

                // Add rows for each person
                const activePeople = people.filter(p => p.isActive !== false);
                activePeople.forEach(person => {
                    const teamName = teams.find(t => t.id === person.teamId)?.name || 'ללא צוות';
                    const rowData: any[] = [person.name, teamName];

                    // Add cell for each day
                    for (let i = 0; i < diffDays; i++) {
                        const date = new Date(start);
                        date.setDate(start.getDate() + i);
                        const dateKey = date.toLocaleDateString('en-CA');
                        const avail = getEffectiveAvailability(person, date, teamRotations, absences, hourlyBlockages);

                        const relevantAbsence = absences.find(a =>
                            a.person_id === person.id &&
                            dateKey >= a.start_date &&
                            dateKey <= a.end_date
                        );

                        let cellText = '';
                        if (avail.status === 'base' || avail.status === 'full') {
                            cellText = 'בבסיס';
                        } else if (avail.status === 'arrival') {
                            cellText = `הגעה\n${avail.startHour}`;
                        } else if (avail.status === 'departure') {
                            cellText = `יציאה\n${avail.endHour}`;
                        } else if (avail.status === 'home') {
                            const homeType = avail.homeStatusType ? homeStatusLabels[avail.homeStatusType] : 'חופשה בשמפ';
                            cellText = `בית - ${homeType}`;

                            if (relevantAbsence) {
                                const statusDesc = relevantAbsence.status === 'approved' ? '✓' :
                                    (relevantAbsence.status === 'pending' ? '⏳' : '✗');
                                cellText += `\n${statusDesc} ${relevantAbsence.reason || 'בקשה'}`;
                            }
                        } else {
                            cellText = 'אילוץ';
                        }

                        rowData.push(cellText);
                    }

                    const row = worksheet.addRow(rowData);
                    row.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                    row.height = 40;

                    // Style cells
                    for (let i = 0; i < diffDays; i++) {
                        const date = new Date(start);
                        date.setDate(start.getDate() + i);
                        const cell = row.getCell(i + 3); // +1 index, +2 for name/team
                        const avail = getEffectiveAvailability(person, date, teamRotations, absences, hourlyBlockages);

                        cell.border = {
                            top: { style: 'thin' },
                            left: { style: 'thin' },
                            bottom: { style: 'thin' },
                            right: { style: 'thin' }
                        };

                        if (avail.status === 'home') {
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
                            cell.font = { color: { argb: 'FF991B1B' }, size: 9 };
                        } else if (avail.status === 'base' || avail.status === 'full') {
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
                            cell.font = { color: { argb: 'FF065F46' }, size: 9 };
                        } else if (avail.status === 'arrival' || avail.status === 'departure') {
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
                            cell.font = { color: { argb: 'FF92400E' }, size: 9 };
                        } else {
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
                            cell.font = { color: { argb: 'FF6B7280' }, size: 9 };
                        }
                    }
                });

                // Set column widths
                worksheet.getColumn(1).width = 20;
                worksheet.getColumn(2).width = 15;
                for (let i = 0; i < diffDays; i++) {
                    worksheet.getColumn(i + 3).width = 12;
                }
                fileName = `attendance_report_${exportStartDate}_to_${exportEndDate}.xlsx`;
            } else {
                const worksheet = workbook.addWorksheet('דוח יומי', { views: [{ rightToLeft: true }] });
                const customFields = settings?.customFieldsSchema || [];
                const columns = [
                    { name: 'תאריך', filterButton: true },
                    { name: 'שם מלא', filterButton: true },
                    { name: 'צוות', filterButton: true },
                    { name: 'תפקידים', filterButton: true },
                    ...customFields.map(cf => ({ name: cf.label, filterButton: true })),
                    { name: 'סטטוס נוכחות', filterButton: true },
                    { name: 'פירוט/שעות', filterButton: true },
                    { name: 'סיבה/הערות', filterButton: true }
                ];

                const allRows: any[] = [];

                for (let i = 0; i < diffDays; i++) {
                    const currentDate = new Date(start);
                    currentDate.setDate(start.getDate() + i);
                    const dateKey = currentDate.toLocaleDateString('en-CA');
                    const displayDate = currentDate.toLocaleDateString('he-IL');

                    const dailyRows = people.filter(p => p.isActive !== false && p.name.includes(searchTerm)).map(p => {
                        const teamName = teams.find(t => t.id === p.teamId)?.name || 'ללא צוות';

                        // Get roles as a comma-separated string
                        const personRoleIds = p.roleIds || [p.roleId];
                        const personRolesStr = personRoleIds
                            .map(id => roles.find(r => r.id === id)?.name)
                            .filter(Boolean)
                            .join(', ');

                        // Get custom fields values
                        const customFieldValues = customFields.map(cf => {
                            const val = p.customFields?.[cf.key];
                            if (cf.type === 'boolean') return val ? 'V' : '';
                            if (Array.isArray(val)) return val.join(', ');
                            return val || '';
                        });

                        // USE currentDate instead of selectedDate
                        const avail = getEffectiveAvailability(p, currentDate, teamRotations, absences, hourlyBlockages);
                        const isAvailable = avail.isAvailable;

                        // Detailed status mapping
                        let statusLabel = 'נוכח';
                        let detailLabel = '';
                        let reasonLabel = '';

                        if (isAvailable) {
                            if (avail.status === 'arrival' || (avail.startHour && avail.startHour !== '00:00')) {
                                statusLabel = `הגעה (${avail.startHour || '00:00'})`;
                            } else if (avail.status === 'departure' || (avail.endHour && avail.endHour !== '23:59')) {
                                statusLabel = `יציאה (${avail.endHour || '23:59'})`;
                            } else {
                                statusLabel = 'נוכח';
                            }
                        } else {
                            statusLabel = 'חופשה בשמ"פ';
                            if (avail.homeStatusType) {
                                const statusMap: Record<string, string> = {
                                    'gimel': "ג'",
                                    'leave_shamp': 'חופשה בשמ"פ',
                                    'not_in_shamp': 'לא בשמ"פ',
                                    'absent': 'נפקד',
                                    'organization_days': 'התארגנות'
                                };
                                statusLabel = statusMap[avail.homeStatusType] || 'חופשה בשמ"פ';
                            }
                        }

                        if (avail.startHour || avail.endHour) {
                            const arrival = avail.startHour || '00:00';
                            const departure = avail.endHour || '23:59';
                            detailLabel = `${arrival} - ${departure}`;
                        }

                        // Find active absence or blockage for reasons and hours
                        const activeAbsence = absences.find(a =>
                            a.person_id === p.id &&
                            a.start_date <= dateKey &&
                            a.end_date >= dateKey &&
                            a.status === 'approved'
                        );

                        if (activeAbsence) {
                            const absStart = activeAbsence.start_time || '00:00';
                            const absEnd = activeAbsence.end_time || '23:59';
                            const absHours = (absStart !== '00:00' || absEnd !== '23:59') ? ` (${absStart}-${absEnd})` : '';

                            reasonLabel = activeAbsence.reason || 'היעדרות מאושרת';
                            if (absHours) {
                                if (detailLabel) detailLabel += ` | היעדרות: ${absStart}-${absEnd}`;
                                else detailLabel = `${absStart}-${absEnd}`;
                            }
                        } else {
                            const personBlockages = (hourlyBlockages || []).filter(b =>
                                b.person_id === p.id &&
                                b.date === dateKey
                            );

                            if (personBlockages.length > 0) {
                                const blockTimes = personBlockages.map(b => `${b.start_time}-${b.end_time}`).join(', ');
                                const blockReasons = personBlockages.map(b => b.reason).filter(Boolean).join(', ');

                                if (detailLabel) detailLabel += ` | חסימות: ${blockTimes}`;
                                else detailLabel = blockTimes;

                                reasonLabel = blockReasons || 'חסימה שעתית';
                            }
                        }

                        return [
                            displayDate, // Use loop date
                            p.name,
                            teamName,
                            personRolesStr,
                            ...customFieldValues,
                            statusLabel,
                            detailLabel,
                            reasonLabel
                        ];
                    });
                    allRows.push(...dailyRows);
                }

                const rows = allRows; // Use aggregated rows

                worksheet.addTable({
                    name: 'DailyAttendanceTable',
                    ref: 'A1',
                    headerRow: true,
                    columns: columns,
                    rows: rows,
                    style: { theme: 'TableStyleMedium2', showRowStripes: true }
                });

                // Status coloring
                worksheet.eachRow((row, rowNumber) => {
                    if (rowNumber === 1) return;
                    const statusCell = row.getCell(columns.length - 2); // Status column index
                    const statusVal = statusCell.value?.toString() || '';
                    if (statusVal.includes('בית') || statusVal === "ג'" || statusVal === 'נפקד' || statusVal.includes('שמ"פ')) {
                        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
                        statusCell.font = { color: { argb: 'FF991B1B' }, bold: true };
                    } else if (statusVal.startsWith('יציאה')) {
                        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
                        statusCell.font = { color: { argb: 'FF92400E' }, bold: true };
                    } else if (statusVal === 'נוכח' || statusVal.startsWith('הגעה')) {
                        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
                        statusCell.font = { color: { argb: 'FF065F46' }, bold: true };
                    }
                });

                // Column widths
                const colWidths = [15, 25, 20, 25, ...customFields.map(() => 15), 15, 15, 30];
                worksheet.columns = colWidths.map(w => ({ width: w }));
                fileName = `attendance_report_${exportStartDate}_to_${exportEndDate}.xlsx`;
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
        <div ref={containerRef} className="bg-white rounded-[2rem] shadow-xl md:shadow-portal border border-slate-100 flex flex-col h-[calc(100dvh-70px)] md:h-[calc(100vh-90px)] relative overflow-hidden">
            {/* --- GREEN HEADER (Mobile & Desktop Unified or Mobile Only?) --- */}

            {/* --- UNIFIED MOBILE CONTAINER --- */}
            <div className={`
                flex-1 flex flex-col md:hidden
                relative isolate z-10 overflow-hidden
            `}>
                {/* Mobile Header - Premium Design */}
                <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200/50 sticky top-0 z-50 px-3 py-2.5 flex flex-col gap-2.5">
                    <div className="flex items-center gap-2">
                        {/* Compact Segmented Control */}
                        <div className="flex-1 flex items-center p-1 bg-slate-100/80 rounded-xl border border-slate-200/50 h-8.5">
                            <button
                                onClick={() => setViewMode('calendar')}
                                className={`flex-1 flex items-center justify-center gap-1.5 h-full rounded-lg transition-all duration-300 ${viewMode === 'calendar' ? 'bg-white text-blue-600 shadow-sm font-black' : 'text-slate-500 font-bold'}`}
                            >
                                <CalendarDays size={13} weight="bold" />
                                <span className="text-[11px]">חודשי</span>
                            </button>
                            <button
                                onClick={() => { setViewMode('day_detail'); setSelectedDate(new Date()); }}
                                className={`flex-1 flex items-center justify-center gap-1.5 h-full rounded-lg transition-all duration-300 ${viewMode === 'day_detail' ? 'bg-white text-blue-600 shadow-sm font-black' : 'text-slate-500 font-bold'}`}
                            >
                                <ListChecks size={13} weight="bold" />
                                <span className="text-[11px]">יומי</span>
                            </button>
                        </div>

                        {!isViewer && (
                            <button
                                onClick={() => setShowRotaWizard(true)}
                                className="w-8.5 h-8.5 flex items-center justify-center bg-blue-50 text-blue-600 rounded-xl border border-blue-100 active:scale-95 transition-all shrink-0"
                                title="מחולל סבבים"
                            >
                                <Sparkles size={16} weight="bold" />
                            </button>
                        )}
                        <ExportButton
                            onExport={async () => handleOpenExportModal()}
                            iconOnly
                            variant="secondary"
                            size="sm"
                            className="w-8.5 h-8.5 rounded-xl"
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
                            className="w-full justify-between border-none bg-transparent h-8.5"
                            showTodayButton={true}
                            maxDate={isViewer ? (() => {
                                const days = settings?.viewer_schedule_days || 7;
                                const d = new Date();
                                d.setHours(0, 0, 0, 0);
                                d.setDate(d.getDate() + (days - 1));
                                return d;
                            })() : undefined}
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
                            <div className="px-3 py-2.5 bg-white/50 backdrop-blur-sm border-b border-slate-100">
                                <div className="relative group">
                                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none transition-colors group-focus-within:text-blue-600 text-slate-400">
                                        <Search size={16} weight="bold" />
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
                <ActionBar
                    searchTerm={viewMode !== 'calendar' ? searchTerm : ''}
                    onSearchChange={setSearchTerm}
                    isSearchHidden={viewMode === 'calendar'}
                    isSearchExpanded={isSearchExpanded}
                    onSearchExpandedChange={setIsSearchExpanded}
                    onExport={async () => handleOpenExportModal()}
                    className="p-4"
                    leftActions={
                        <div className="flex items-center gap-4">
                            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                <Calendar className="text-blue-600" size={24} weight="bold" />
                                <span className={isSearchExpanded ? 'hidden lg:inline' : 'inline'}>יומן נוכחות</span>
                                <PageInfo
                                    title="יומן נוכחות"
                                    description={
                                        <>
                                            <p className="mb-2">כאן ניתן לראות ולנהל את זמינות הלוחמים.</p>
                                            <ul className="list-disc list-inside space-y-1 mb-2 text-right">
                                                <li><b>תצוגת לוח שנה:</b> מבט חודשי גלובלי על הסבבים והנוכחות.</li>
                                                <li><b>תצוגת רשימה (טבלה):</b> ניהול מפורט של זמינות.
                                                    <ul className="list-inside list-disc mr-4 text-slate-600 mt-1 space-y-0.5">
                                                        <li>לחיצה רגילה לעריכת יום בודד.</li>
                                                        <li><b>Ctrl + לחיצה:</b> לבחירת מספר ימים בודדים.</li>
                                                        <li><b>Shift + לחיצה:</b> לבחירת טווח תאריכים.</li>
                                                    </ul>
                                                </li>
                                                <li><b>רשימה יומית:</b> פירוט מלא של הנוכחים והנעדרים ליום ספציפי.</li>
                                                <li><b>סבבים:</b> הגדרת סבבי יציאות (11/3, חצאים וכו') לניהול מהיר.</li>
                                            </ul>
                                            <p className="text-sm bg-blue-50 p-2 rounded text-blue-800">
                                                הנתונים כאן משפיעים ישירות על יכולת השיבוץ של המערכת.
                                            </p>
                                        </>
                                    }
                                />
                            </h2>
                        </div>
                    }
                    centerActions={
                        <div className="bg-slate-100/80 p-1 rounded-[15px] flex items-center gap-1 shadow-inner border border-slate-200/50">
                            {[
                                { id: 'calendar', label: 'לוח שנה', icon: CalendarDays },
                                { id: 'table', label: 'טבלה חודשית', icon: ListChecks },
                                { id: 'day_detail', label: 'רשימה יומית', icon: Users }
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setViewMode(tab.id as any)}
                                    className={`px-3 lg:px-5 py-2 rounded-xl text-xs font-black transition-all duration-300 flex items-center gap-2 ${viewMode === tab.id
                                        ? 'bg-white text-blue-600 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                    title={tab.label}
                                >
                                    <tab.icon size={16} weight="bold" />
                                    <span className={(isSearchExpanded || searchTerm) ? 'hidden' : 'inline'}>{tab.label}</span>
                                </button>
                            ))}
                        </div>
                    }
                    rightActions={
                        <div className="flex items-center gap-2">
                            <DateNavigator
                                date={(viewMode === 'calendar' || viewMode === 'table') ? viewDate : selectedDate}
                                onDateChange={(d) => {
                                    if (viewMode === 'calendar' || viewMode === 'table') setViewDate(d);
                                    else setSelectedDate(d);
                                }}
                                mode={(viewMode === 'calendar' || viewMode === 'table') ? 'month' : 'day'}
                                maxDate={isViewer ? (() => {
                                    const days = settings?.viewer_schedule_days || 7;
                                    const d = new Date();
                                    d.setHours(0, 0, 0, 0);
                                    d.setDate(d.getDate() + (days - 1));
                                    return d;
                                })() : undefined}
                            />

                            <div className="flex items-center gap-2">
                                {viewMode === 'table' && (
                                    <>
                                        <button
                                            onClick={() => setShowStatistics(!showStatistics)}
                                            className={`h-10 px-3 flex items-center justify-center gap-2 rounded-xl transition-all border shadow-sm ${showStatistics ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-100'}`}
                                            title={showStatistics ? 'הסתר סטטיסטיקה' : 'הצג סטטיסטיקה'}
                                        >
                                            <ChartBar size={18} weight="bold" />
                                            <span className="text-xs font-black">סטטיסטיקה</span>
                                        </button>
                                        <button
                                            onClick={() => setShowRequiredDetails(!showRequiredDetails)}
                                            className={`h-10 w-10 flex items-center justify-center rounded-xl transition-all border shadow-sm ${showRequiredDetails ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-100/50 border-slate-200 text-slate-500 hover:bg-white hover:text-blue-600'}`}
                                            title={showRequiredDetails ? 'הסתר דרישות כוח אדם' : 'הצג דרישות כוח אדם'}
                                        >
                                            <ListChecks size={20} weight="bold" />
                                        </button>
                                    </>
                                )}

                                {(profile?.permissions?.canManageRotaWizard || profile?.is_super_admin) && (
                                    <button
                                        onClick={() => setShowRotaWizard(true)}
                                        data-testid="open-rota-wizard-btn"
                                        className="h-10 w-10 flex items-center justify-center bg-slate-100/50 text-slate-500 hover:bg-white hover:text-blue-600 rounded-xl transition-all border border-slate-200 shadow-sm transition-all group"
                                        title="מחולל סבבים"
                                    >
                                        <Sparkles size={18} weight="bold" className="group-hover:text-blue-600 transition-colors" />
                                    </button>
                                )}
                            </div>
                        </div>
                    }
                />

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
                                showStatistics={showStatistics}
                                onShowPersonStats={(p) => setStatsEntity({ person: p })}
                                onShowTeamStats={(t) => setStatsEntity({ team: t })}
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
                        hourlyBlockages={hourlyBlockages}
                        onClose={() => setSelectedPersonForCalendar(null)}
                        onUpdatePerson={onUpdatePerson}
                        isViewer={isViewer}
                        people={activePeople}
                        onShowStats={(p) => setStatsEntity({ person: p })}
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

            {
                statsEntity && (
                    <AttendanceStatsModal
                        person={statsEntity.person}
                        team={statsEntity.team}
                        people={activePeople}
                        teams={teams}
                        teamRotations={teamRotations}
                        absences={absences}
                        hourlyBlockages={hourlyBlockages}
                        dates={(() => {
                            const year = viewDate.getFullYear();
                            const month = viewDate.getMonth();
                            const daysInMonth = new Date(year, month + 1, 0).getDate();
                            const dates = [];
                            for (let d = 1; d <= daysInMonth; d++) {
                                dates.push(new Date(year, month, d));
                            }
                            return dates;
                        })()}
                        onClose={() => setStatsEntity(null)}
                    />
                )
            }

            {/* Confirmation Modal for Availability Conflicts */}
            <ConfirmationModal
                isOpen={confirmationState.isOpen}
                title={confirmationState.title}
                message={confirmationState.message}
                onConfirm={confirmationState.onConfirm}
                onCancel={() => setConfirmationState(prev => ({ ...prev, isOpen: false }))}
                confirmText={confirmationState.confirmText}
                cancelText="ביטול"
                type={confirmationState.type}
            />

            {/* Export Date Range Modal */}
            <GenericModal
                isOpen={showExportModal}
                onClose={() => setShowExportModal(false)}
                title="ייצוא נתוני נוכחות"
                size="sm"
                footer={
                    <div className="flex gap-2 justify-end">
                        <Button
                            variant="secondary"
                            onClick={() => setShowExportModal(false)}
                        >
                            ביטול
                        </Button>
                        <Button
                            onClick={() => {
                                handleExport();
                                setShowExportModal(false);
                            }}
                            disabled={!exportStartDate || !exportEndDate}
                        >
                            <Download className="ml-2" />
                            ייצוא לאקסל
                        </Button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <p className="text-slate-600">
                        אנא בחר את טווח התאריכים עבורו תרצה להפיק את הדוח.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-bold text-slate-700">מתאריך</label>
                            <input
                                type="date"
                                className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                                value={exportStartDate}
                                onChange={(e) => setExportStartDate(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-bold text-slate-700">עד תאריך</label>
                            <input
                                type="date"
                                className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                                value={exportEndDate}
                                onChange={(e) => setExportEndDate(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </GenericModal>
        </div>
    );
};
