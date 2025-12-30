
import React, { useState, useRef, useEffect } from 'react';
import { Person, Team, TeamRotation, TaskTemplate, SchedulingConstraint, OrganizationSettings, Shift, DailyPresence, Absence } from '@/types';
import { Calendar, CheckCircle2, XCircle, ChevronRight, ChevronLeft, Search, Settings, CalendarDays, ChevronDown, ArrowLeft, ArrowRight, CheckSquare, ListChecks, X, Wand2, Sparkles, Users, MoreVertical, Download } from 'lucide-react';
import { getEffectiveAvailability } from '@/utils/attendanceUtils';
import { PersonalAttendanceCalendar } from './PersonalAttendanceCalendar';
import { DateNavigator } from '../../components/ui/DateNavigator';
import { GlobalTeamCalendar } from './GlobalTeamCalendar';
import { RotationEditor } from './RotationEditor';
import { PersonalRotationEditor } from './PersonalRotationEditor';
import { logger } from '../../services/loggingService';
import { Modal } from '../../components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { AttendanceRow } from './AttendanceRow';
import { AttendanceTable } from './AttendanceTable';
import { BulkAttendanceModal } from './BulkAttendanceModal';
import { useToast } from '@/contexts/ToastContext';
import { RotaWizardModal } from './RotaWizardModal';
import { PageInfo } from '@/components/ui/PageInfo';
import { useAuth } from '@/features/auth/AuthContext';
import { addHourlyBlockage, updateHourlyBlockage, deleteHourlyBlockage, updateAbsence } from '@/services/api'; // NEW Imports

interface AttendanceManagerProps {
    people: Person[];
    teams: Team[];
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
    people, teams, teamRotations = [],
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

    const handleExport = () => {
        if (isViewer) {
            showToast('אין לך הרשאה לייצא נתונים', 'error');
            return;
        }
        if (viewMode === 'calendar') {
            // Export Month
            const year = viewDate.getFullYear();
            const month = viewDate.getMonth();
            const daysInMonth = new Date(year, month + 1, 0).getDate();

            let csvContent = `דוח נוכחות חודשי - ${viewDate.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })} \n`;
            csvContent += 'תאריך,שם מלא,צוות,סטטוס,שעות,סיבה\n';

            for (let d = 1; d <= daysInMonth; d++) {
                const date = new Date(year, month, d);
                const dateStr = date.toLocaleDateString('he-IL');

                people.forEach(person => {
                    const avail = getEffectiveAvailability(person, date, teamRotations, absences);
                    const teamName = teams.find(t => t.id === person.teamId)?.name || 'ללא צוות';
                    const status = avail.isAvailable ? 'נמצא' : 'בבית';
                    const hours = avail.isAvailable ? `${avail.startHour} - ${avail.endHour} ` : '-';
                    const reason = (avail as any).reason || (avail.source === 'rotation' ? 'סבב' : (avail.source === 'manual' ? 'ידני' : 'כרגיל'));

                    // Safe strings
                    const sName = `"${person.name.replace(/"/g, '""')}"`;
                    const sTeam = `"${teamName.replace(/"/g, '""')}"`;

                    csvContent += `${dateStr},${sName},${sTeam},${status},${hours},${reason}\n`;
                });
            }

            const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `attendance_month_${month + 1}_${year}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            logger.info('EXPORT', 'Exported monthly attendance report', { month: month + 1, year });
        } else {
            // Export Day (Existing logic)
            const dateStr = selectedDate.toLocaleDateString('he-IL');
            let csvContent = `דוח נוכחות ליום ${dateStr}\n`;
            csvContent += 'שם מלא,צוות,סטטוס,שעות,סיבה/מקור\n';

            people.forEach(person => {
                const avail = getPersonAvailability(person);
                const teamName = teams.find(t => t.id === person.teamId)?.name || 'ללא צוות';
                const status = avail.isAvailable ? 'נמצא' : 'לא נמצא';
                const hours = avail.isAvailable ? `${avail.startHour} - ${avail.endHour}` : '-';
                const reason = (avail as any).reason || (avail.source === 'rotation' ? 'סבב' : (avail.source === 'manual' ? 'ידני' : 'כרגיל'));

                // Safe strings
                const sName = `"${person.name.replace(/"/g, '""')}"`;
                const sTeam = `"${teamName.replace(/"/g, '""')}"`;

                csvContent += `${sName},${sTeam},${status},${hours},${reason}\n`;
            });

            const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `attendance_${selectedDate.toLocaleDateString('en-CA')}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            logger.info('EXPORT', 'Exported daily attendance report', { date: selectedDate.toLocaleDateString('en-CA') });
        }
    };

    return (
        <div className="bg-white rounded-[2rem] shadow-xl md:shadow-portal border border-slate-100 flex flex-col h-[calc(100vh-150px)] md:h-[calc(100vh-100px)] relative overflow-hidden">
            {/* --- GREEN HEADER (Mobile & Desktop Unified or Mobile Only?) --- */}

            {/* --- UNIFIED MOBILE CONTAINER --- */}
            <div className={`
                flex-1 flex flex-col md:hidden
                relative isolate z-10 overflow-hidden
            `}>
                {/* Mobile Header - Premium Design */}
                <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200/50 sticky top-0 z-50 px-4 pt-4 pb-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex flex-col">
                            <h1 className="text-xl font-black text-slate-900 tracking-tight">יומן נוכחות</h1>
                            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest leading-none mt-0.5">ניהול זמינות</span>
                        </div>

                        <div className="flex items-center gap-2">
                            {!isViewer && (
                                <button
                                    onClick={() => setShowRotaWizard(true)}
                                    className="w-12 h-12 flex items-center justify-center bg-blue-50 text-blue-600 rounded-2xl border border-blue-100 shadow-sm active:scale-90 transition-all"
                                    title="מחולל סבבים"
                                >
                                    <Sparkles size={22} strokeWidth={2.5} />
                                </button>
                            )}
                            <button
                                onClick={handleExport}
                                className="w-12 h-12 flex items-center justify-center bg-slate-50 text-slate-600 rounded-2xl border border-slate-100 shadow-sm active:scale-90 transition-all"
                            >
                                <Download size={22} />
                            </button>
                        </div>
                    </div>

                    {/* Premium Segmented Control */}
                    <div className="flex items-center p-1.5 bg-slate-100/80 rounded-2xl border border-slate-200/50 mb-4 h-14"> {/* Rule 1: 48px+ height */}
                        <button
                            onClick={() => setViewMode('calendar')}
                            className={`flex-1 flex items-center justify-center gap-2 h-full rounded-xl transition-all duration-300 ${viewMode === 'calendar' ? 'bg-white text-blue-600 shadow-sm font-black' : 'text-slate-500 font-bold'}`}
                        >
                            <CalendarDays size={18} strokeWidth={viewMode === 'calendar' ? 2.5 : 2} />
                            <span className="text-sm">חודשי</span>
                        </button>
                        <button
                            onClick={() => { setViewMode('day_detail'); setSelectedDate(new Date()); }}
                            className={`flex-1 flex items-center justify-center gap-2 h-full rounded-xl transition-all duration-300 ${viewMode === 'day_detail' ? 'bg-white text-blue-600 shadow-sm font-black' : 'text-slate-500 font-bold'}`}
                        >
                            <ListChecks size={18} strokeWidth={viewMode === 'day_detail' ? 2.5 : 2} />
                            <span className="text-sm">יומי</span>
                        </button>
                    </div>

                    {/* Date Navigator - Optimized for Mobile */}
                    <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-1">
                        <DateNavigator
                            date={viewMode === 'calendar' ? viewDate : selectedDate}
                            onDateChange={(d) => {
                                if (viewMode === 'calendar') setViewDate(d);
                                else setSelectedDate(d);
                            }}
                            mode={viewMode === 'calendar' ? 'month' : 'day'}
                            className="w-full justify-between border-none bg-transparent h-12"
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
                            <div className="px-4 py-4 bg-white/50 backdrop-blur-sm border-b border-slate-100">
                                <div className="relative group">
                                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none transition-colors group-focus-within:text-blue-600 text-slate-400">
                                        <Search size={18} strokeWidth={2.5} />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="חיפוש לוחם..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="block w-full h-14 pr-12 pl-4 bg-slate-100/50 border-none rounded-[1.25rem] text-slate-900 placeholder-slate-400 focus:ring-4 focus:ring-blue-500/10 transition-all font-bold text-base"
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
                {/* Desktop Header (Preserved) */}
                <div className="bg-white shadow-sm border-b border-slate-200 p-4 justify-between items-center shrink-0 z-20 relative flex">
                    <div className="flex items-center gap-4">
                        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            <Calendar className="text-idf-green" />
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
                        <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200">
                            <button
                                onClick={() => setViewMode('calendar')}
                                className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'calendar' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <CalendarDays size={16} />
                                לוח שנה
                            </button>
                            <button
                                onClick={() => setViewMode('table')}
                                className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'table' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <ListChecks size={16} />
                                טבלה חודשית
                            </button>
                            <button
                                onClick={() => setViewMode('day_detail')}
                                className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'day_detail' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <Users size={16} />
                                רשימה יומית
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Expandable Search */}
                        {viewMode !== 'calendar' && (
                            <div className={`relative transition-all duration-300 ease-in-out ${isSearchExpanded || searchTerm ? 'w-32' : 'w-9'}`}>
                                {isSearchExpanded || searchTerm ? (
                                    <div className="relative w-full">
                                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                        <input
                                            autoFocus
                                            type="text"
                                            placeholder="חיפוש..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            onBlur={() => { if (!searchTerm) setIsSearchExpanded(false); }}
                                            className="w-full pr-9 pl-8 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
                                        />
                                        <button
                                            onClick={() => { setSearchTerm(''); setIsSearchExpanded(false); }}
                                            className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setIsSearchExpanded(true)}
                                        className="w-9 h-9 flex items-center justify-center bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-500 transition-colors"
                                    >
                                        <Search size={16} />
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Grouped Date Controls with "Today" button */}
                        <DateNavigator
                            date={(viewMode === 'calendar' || viewMode === 'table') ? viewDate : selectedDate}
                            onDateChange={(d) => {
                                if (viewMode === 'calendar' || viewMode === 'table') setViewDate(d);
                                else setSelectedDate(d);
                            }}
                            mode={(viewMode === 'calendar' || viewMode === 'table') ? 'month' : 'day'}
                        />
                    </div>

                    {(profile?.permissions?.canManageRotaWizard || profile?.is_super_admin) && (
                        <button
                            onClick={() => setShowRotaWizard(true)}
                            data-testid="open-rota-wizard-btn"
                            className="px-3 py-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 border border-amber-100"
                        >
                            <Sparkles size={16} />
                            מחולל סבבים
                        </button>
                    )}
                    {/* More Actions Menu */}
                    <div className="relative">
                        <button
                            onClick={() => setShowMoreActions(!showMoreActions)}
                            className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors border ${showMoreActions ? 'bg-slate-100 border-slate-300 text-slate-800' : 'bg-white border-transparent hover:bg-slate-50 text-slate-500'}`}
                        >
                            <MoreVertical size={18} />
                        </button>

                        {showMoreActions && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setShowMoreActions(false)} />
                                <div className="absolute left-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-100 z-50 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-top-left">
                                    <button
                                        onClick={() => { setShowRequiredDetails(!showRequiredDetails); setShowMoreActions(false); }}
                                        className="w-full text-right px-4 py-2.5 text-sm font-medium hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                                    >
                                        <ListChecks size={16} className="text-slate-400" />
                                        {showRequiredDetails ? 'הסתר דרישות כוח אדם' : 'הצג דרישות כוח אדם'}
                                    </button>
                                    <button
                                        onClick={() => { handleExport(); setShowMoreActions(false); }}
                                        className="w-full text-right px-4 py-2.5 text-sm font-medium hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                                    >
                                        <Download size={16} className="text-slate-400" />
                                        ייצוא לאקסל
                                    </button>
                                </div>
                            </>
                        )}
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
                                currentDate={selectedDate}
                                onDateChange={setSelectedDate}
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
