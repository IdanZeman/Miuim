import React, { useState, useRef, useEffect } from 'react';
import { Person, Team, TeamRotation, Absence, TaskTemplate } from '@/types';
import { CaretRight as ChevronRight, CaretLeft as ChevronLeft, CaretDown as ChevronDown, CalendarBlank as Calendar, Users, House as Home, MapPin, XCircle, Clock, Info, CheckCircle as CheckCircle2, MagnifyingGlass as Search, WarningCircle as AlertCircle, ChartBar } from '@phosphor-icons/react';
import { getEffectiveAvailability, getRotationStatusForDate, getComputedAbsenceStatus, isPersonPresentAtHour, isStatusPresent } from '@/utils/attendanceUtils';
import { getPersonInitials } from '@/utils/nameUtils';
import { StatusEditModal } from './StatusEditModal';
import { logger } from '@/services/loggingService';

interface AttendanceTableProps {
    teams: Team[];
    people: Person[];
    teamRotations: TeamRotation[];
    absences: Absence[]; // New prop
    hourlyBlockages?: import('@/types').HourlyBlockage[]; // NEW
    tasks?: TaskTemplate[]; // New prop
    currentDate: Date;
    onDateChange: (date: Date) => void;
    onSelectPerson: (person: Person) => void;
    onUpdateAvailability?: (personId: string, date: string | string[], status: 'base' | 'home' | 'unavailable', customTimes?: { start: string, end: string }, unavailableBlocks?: { id: string, start: string, end: string, reason?: string }[], homeStatusType?: import('@/types').HomeStatusType) => void;
    viewMode?: 'daily' | 'monthly'; // New control prop
    className?: string; // Allow parent styling for mobile sheet integration
    isViewer?: boolean; // NEW: Security prop
    searchTerm?: string; // NEW: Controlled search term
    showRequiredDetails?: boolean; // NEW: Toggle required row
    companies?: import('@/types').Organization[]; // NEW: For battalion view
    hideAbsenceDetails?: boolean; // NEW: Security/Privacy prop
    defaultArrivalHour?: string; // Default arrival time for display
    defaultDepartureHour?: string; // Default departure time for display
    showStatistics?: boolean; // NEW: Show base/home totals
    onShowPersonStats?: (person: Person) => void; // NEW: Open stats modal
    onShowTeamStats?: (team: Team) => void; // NEW: Open stats modal
}

export const AttendanceTable: React.FC<AttendanceTableProps> = ({
    teams, people, teamRotations, absences, hourlyBlockages = [], tasks = [], currentDate, onDateChange, onSelectPerson, onUpdateAvailability, className, viewMode, isViewer = false, searchTerm = '', showRequiredDetails = false, companies = [], hideAbsenceDetails = false,
    defaultArrivalHour = '10:00', defaultDepartureHour = '14:00',
    showStatistics = false, onShowPersonStats, onShowTeamStats
}) => {
    const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(() => new Set(teams.map(t => t.id)));
    // State for the modal (editing mode) - now supports multiple dates
    const [editingCell, setEditingCell] = useState<{ personId: string; dates: string[] } | null>(null);
    // State for visual selection (before modal opens)
    const [selection, setSelection] = useState<{ personId: string; dates: string[] } | null>(null);

    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Filter people by search term
    const filteredPeople = React.useMemo(() => {
        const activeOnly = people.filter(p => p.isActive !== false);
        if (!searchTerm?.trim()) return activeOnly;
        return activeOnly.filter(p => p.name.includes(searchTerm) || (p.phone && p.phone.includes(searchTerm)));
    }, [people, searchTerm]);

    // Enforce strict name sorting to prevent reordering on updates
    const sortedPeople = React.useMemo(() => {
        return [...filteredPeople].sort((a, b) => a.name.localeCompare(b.name, 'he'));
    }, [filteredPeople]);

    // Group and sort teams by company if provided, then by name
    const sortedTeams = React.useMemo(() => {
        const teamList = [...teams];
        if (companies && companies.length > 0) {
            return teamList.sort((a, b) => {
                const companyA = companies.find(c => c.id === a.organization_id)?.name || '';
                const companyB = companies.find(c => c.id === b.organization_id)?.name || '';
                const companyComp = companyA.localeCompare(companyB, 'he');
                if (companyComp !== 0) return companyComp;
                return a.name.localeCompare(b.name, 'he');
            });
        }
        return teamList.sort((a, b) => a.name.localeCompare(b.name, 'he'));
    }, [teams, companies]);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthName = currentDate.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });

    const handlePrevMonth = () => onDateChange(new Date(year, month - 1, 1));
    const handleNextMonth = () => onDateChange(new Date(year, month + 1, 1));
    const handleToday = () => onDateChange(new Date());

    const toggleTeam = (teamId: string) => {
        setCollapsedTeams(prev => {
            const next = new Set(prev);
            if (next.has(teamId)) next.delete(teamId);
            else next.add(teamId);
            return next;
        });
    };

    const dates = [];
    for (let d = 1; d <= daysInMonth; d++) {
        dates.push(new Date(year, month, d));
    }

    const weekDaysShort = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
    const weekDaysEnglish = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    // Clear selection when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            // Check if clicked element is part of a cell
            const isCell = target.closest('[data-testid^="attendance-cell-"]');
            if (!isCell) {
                setSelection(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleCellClick = (e: React.MouseEvent, person: Person, date: Date) => {
        if (!onUpdateAvailability) return;

        const dateStr = date.toLocaleDateString('en-CA');

        // 1. Handle Selection Logic (Ctrl/Cmd/Shift)
        if (e.ctrlKey || e.metaKey) {
            // Toggle selection
            setSelection(prev => {
                if (prev && prev.personId === person.id) {
                    const newDates = prev.dates.includes(dateStr)
                        ? prev.dates.filter(d => d !== dateStr)
                        : [...prev.dates, dateStr];
                    return newDates.length > 0 ? { personId: person.id, dates: newDates } : null;
                }
                return { personId: person.id, dates: [dateStr] };
            });
            return;
        }

        if (e.shiftKey) {
            if (selection && selection.personId === person.id && selection.dates.length > 0) {
                // Range Selection
                const lastDateStr = selection.dates[selection.dates.length - 1];
                const start = new Date(lastDateStr);
                const end = new Date(dateStr);
                const rangeDates: string[] = [];

                // Generate range
                const current = new Date(Math.min(start.getTime(), end.getTime()));
                const final = new Date(Math.max(start.getTime(), end.getTime()));

                while (current <= final) {
                    rangeDates.push(current.toLocaleDateString('en-CA'));
                    current.setDate(current.getDate() + 1);
                }

                // Merge with existing
                const uniqueDates = Array.from(new Set([...selection.dates, ...rangeDates]));
                setSelection({ personId: person.id, dates: uniqueDates });
            } else {
                setSelection({ personId: person.id, dates: [dateStr] });
            }
            return;
        }

        // 2. Handle Normal Click (Open Modal)
        // If clicking on a selected cell group, open modal for that group
        if (selection && selection.personId === person.id && selection.dates.includes(dateStr)) {
            setEditingCell({
                personId: person.id,
                dates: selection.dates
            });
            setSelection(null); // Clear selection after opening modal
            logger.info('CLICK', `Opened bulk editor for ${person.name}`, { personId: person.id, count: selection.dates.length });
            return;
        }

        // Normal single cell click - Clear triggers or open single? 
        // If I Click a non-selected cell, I select just that cell and open modal immediately (old behavior).
        setEditingCell({
            personId: person.id,
            dates: [dateStr]
        });
        setSelection(null); // Clear any unrelated selection
        logger.info('CLICK', `Opened attendance status editor for ${person.name} on ${dateStr}`, { personId: person.id, date: dateStr });
    };

    const handleApplyStatus = (status: 'base' | 'home', customTimes?: { start: string, end: string }, unavailableBlocks?: { id: string, start: string, end: string, reason?: string }[], homeStatusType?: import('@/types').HomeStatusType, rangeDates?: string[]) => {
        if (!editingCell || !onUpdateAvailability) return;
        // Map 'unavailable' status (legacy) to 'home' or maintain compatibility if needed, 
        // but typically the modal now controls 'base' vs 'home'.
        const datesToUpdate = rangeDates && rangeDates.length > 0 ? rangeDates : editingCell.dates;
        onUpdateAvailability(editingCell.personId, datesToUpdate, status, customTimes, unavailableBlocks, homeStatusType);
        setEditingCell(null);
    };

    // Auto-scroll to current day on mount
    useEffect(() => {
        if (scrollContainerRef.current) {
            const today = new Date();
            if (today.getMonth() === month && today.getFullYear() === year) {
                const dayWidth = 96; // Matches w-24 (24 * 4px = 96px)
                const scrollPos = (today.getDate() - 1) * dayWidth;

                // Use requestAnimationFrame to ensure layout is ready
                requestAnimationFrame(() => {
                    if (scrollContainerRef.current) {
                        scrollContainerRef.current.scrollLeft = -scrollPos; // RTL scroll adjustment
                    }
                });
            }
        }
    }, [month, year, viewMode]);

    // State for auto-refreshing stats
    const [currentTime, setCurrentTime] = useState(new Date());

    // Auto-refresh every minute to keep headcount dynamic
    useEffect(() => {
        const isToday = new Date().toDateString() === currentDate.toDateString();
        if (!isToday) return;

        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, 60000);
        return () => clearInterval(interval);
    }, [currentDate]);

    // Global Stats Calculation
    const globalStats = React.useMemo(() => {
        const totalPeople = sortedPeople.length;
        let presentCount = 0;
        const isToday = new Date().toDateString() === currentDate.toDateString();
        const refTime = isToday
            ? `${currentTime.getHours().toString().padStart(2, '0')}:${currentTime.getMinutes().toString().padStart(2, '0')}`
            : '12:00'; // Default to noon for non-today views unless we want more granularity

        sortedPeople.forEach(p => {
            const avail = getEffectiveAvailability(p, currentDate, teamRotations, absences, hourlyBlockages);
            if (isPersonPresentAtHour(p, currentDate, refTime, teamRotations, absences, hourlyBlockages)) {
                presentCount++;
            }
        });
        return { present: presentCount, total: totalPeople };
    }, [sortedPeople, currentDate, teamRotations, absences, hourlyBlockages, currentTime]);

    // Team Stats Calculation (for Daily view)
    const teamStats = React.useMemo(() => {
        const stats: Record<string, { present: number; total: number }> = {};
        const isToday = new Date().toDateString() === currentDate.toDateString();
        const refTime = isToday
            ? `${currentTime.getHours().toString().padStart(2, '0')}:${currentTime.getMinutes().toString().padStart(2, '0')}`
            : '12:00';

        teams.forEach(team => {
            const members = sortedPeople.filter(p => p.teamId === team.id);
            let present = 0;
            members.forEach(p => {
                const avail = getEffectiveAvailability(p, currentDate, teamRotations, absences, hourlyBlockages);
                if (isPersonPresentAtHour(p, currentDate, refTime, teamRotations, absences, hourlyBlockages)) {
                    present++;
                }
            });
            stats[team.id] = { present, total: members.length };
        });
        return stats;
    }, [teams, sortedPeople, currentDate, teamRotations, absences, hourlyBlockages, currentTime]);

    return (
        <div className="h-full flex flex-col relative" dir="rtl">
            {/* --- DAILY AGENDA VIEW (Mobile default, Desktop optional) --- */}
            {(viewMode === 'daily' || !viewMode) && (
                <div
                    className={`flex-1 overflow-y-auto custom-scrollbar bg-slate-50/40 pb-32 ${viewMode === 'daily' ? '' : 'md:hidden'}`}
                >
                    <div className="max-w-5xl mx-auto bg-white min-h-full shadow-sm border-x border-slate-100">
                        {/* Global Summary Card - Daily View (Light Premium Style) */}
                        <div className="bg-white p-4.5 m-3 mt-4 rounded-3xl shadow-xl shadow-slate-200/40 border border-slate-100 relative overflow-hidden group">
                            {/* Subtle Background Decoration */}
                            <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-50/50 rounded-full blur-3xl" />

                            <div className="flex items-center justify-between mb-4 relative z-10">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center border border-blue-100 shadow-sm transition-transform group-hover:scale-110">
                                        <Users size={22} className="text-blue-600" weight="bold" />
                                    </div>
                                    <div>
                                        <h3 className="text-slate-900 font-black text-base tracking-tight">סיכום נוכחות יומי</h3>
                                        <p className="text-slate-400 text-[9px] font-bold uppercase tracking-widest mt-0.5">נתונים מעודכנים</p>
                                    </div>
                                </div>
                                <div className="text-left flex items-baseline gap-1" dir="ltr">
                                    <span className="text-3xl font-bold text-slate-900">{globalStats.present}</span>
                                    <span className="text-base font-black text-slate-300">/ {globalStats.total}</span>
                                </div>
                            </div>

                            {/* Progress Bar - Improved Light Style */}
                            <div className="relative z-10 w-full h-2.5 bg-slate-50 rounded-full overflow-hidden border border-slate-100 mb-4 p-0.5 shadow-inner">
                                <div
                                    className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-1000 ease-out shadow-sm"
                                    style={{ width: `${(globalStats.present / (globalStats.total || 1)) * 100}%` }}
                                />
                            </div>

                            <div className="flex items-center justify-between relative z-10">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                    <span className="text-xs font-bold text-slate-500">אחוז התייצבות:</span>
                                </div>
                                <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">
                                    {Math.round((globalStats.present / (globalStats.total || 1)) * 100)}%
                                </span>
                            </div>
                        </div>

                        <div className="flex flex-col">
                            {sortedTeams.map(team => {
                                const members = sortedPeople.filter(p => p.teamId === team.id);
                                if (members.length === 0) return null;

                                return (
                                    <div key={team.id} className="relative">
                                        {/* Premium Team Header - Sticky with Visual Depth */}
                                        <div
                                            onClick={() => toggleTeam(team.id)}
                                            className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-2.5 flex items-center justify-between cursor-pointer group transition-all h-[60px]"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="w-1 h-7 rounded-full"
                                                    style={{ backgroundColor: team.color?.startsWith('#') ? team.color : '#3b82f6' }}
                                                />
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="text-base font-black text-slate-900 tracking-tight leading-none">{team.name}</h3>
                                                        {companies.length > 0 && (
                                                            <span className="px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-600 text-[9px] font-black border border-blue-100/50">
                                                                {companies.find(c => c.id === team.organization_id)?.name}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{members.length} לוחמים</span>
                                                        <div className="w-1 h-1 rounded-full bg-slate-200" />
                                                        <span className={`text-[10px] font-black uppercase tracking-widest ${teamStats[team.id]?.present === teamStats[team.id]?.total ? 'text-emerald-500' : 'text-blue-500'}`} dir="ltr">
                                                            {teamStats[team.id]?.present} / {teamStats[team.id]?.total} נוכחים
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className={`w-7 h-7 rounded-full bg-slate-50 group-hover:bg-slate-100 flex items-center justify-center transition-all duration-300 ${collapsedTeams.has(team.id) ? 'rotate-0' : 'rotate-180'}`}>
                                                <ChevronDown size={16} className="text-slate-400 group-hover:text-slate-600" weight="bold" />
                                            </div>
                                        </div>

                                        {/* Personnel List Container - Separate DIV as requested */}
                                        {!collapsedTeams.has(team.id) && (
                                            <div className="bg-white divide-y divide-slate-50 shadow-inner">
                                                {members.map(person => {
                                                    const avail = getEffectiveAvailability(person, currentDate, teamRotations, absences, hourlyBlockages);
                                                    const dateKey = currentDate.toLocaleDateString('en-CA');

                                                    // Check for official absences
                                                    const relevantAbsence = absences.find(a =>
                                                        a.person_id === person.id &&
                                                        a.start_date <= dateKey &&
                                                        a.end_date >= dateKey
                                                    );
                                                    const isExitRequest = !!relevantAbsence;

                                                    // Status Pill UI Logic
                                                    let statusConfig = {
                                                        label: 'לא ידוע',
                                                        bg: 'bg-white text-slate-400 ring-1 ring-slate-100',
                                                        dot: 'bg-slate-300',
                                                        icon: Info
                                                    };

                                                    if (avail.status === 'base' || avail.status === 'full' || avail.status === 'arrival' || avail.status === 'departure') {
                                                        const prevDate = new Date(currentDate);
                                                        prevDate.setDate(currentDate.getDate() - 1);
                                                        const nextDate = new Date(currentDate);
                                                        nextDate.setDate(currentDate.getDate() + 1);

                                                        const prevAvail = getEffectiveAvailability(person, prevDate, teamRotations, absences, hourlyBlockages);
                                                        const nextAvail = getEffectiveAvailability(person, nextDate, teamRotations, absences, hourlyBlockages);

                                                        const isArrival = (!prevAvail.isAvailable || prevAvail.status === 'home') || (avail.startHour !== '00:00');
                                                        const isDeparture = (!nextAvail.isAvailable || nextAvail.status === 'home') || (avail.endHour !== '23:59');
                                                        const isSingleDay = isArrival && isDeparture;

                                                        statusConfig = {
                                                            label: isSingleDay ? 'יום בודד' : isArrival ? 'הגעה' : isDeparture ? 'יציאה' : 'בבסיס',
                                                            bg: isArrival || isSingleDay ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 ring-0' : isDeparture ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20 ring-0' : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100/50',
                                                            dot: 'bg-white',
                                                            icon: isArrival ? MapPin : isDeparture ? MapPin : CheckCircle2
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
                                                            bg: 'bg-red-50 text-red-600 ring-1 ring-red-100',
                                                            dot: 'bg-red-500',
                                                            icon: Home
                                                        };
                                                    } else if (avail.status === 'unavailable') {
                                                        statusConfig = {
                                                            label: 'אילוץ',
                                                            bg: 'bg-amber-50 text-amber-700 ring-1 ring-amber-100',
                                                            dot: 'bg-amber-500',
                                                            icon: Clock
                                                        };
                                                    }

                                                    return (
                                                        <div
                                                            key={person.id}
                                                            onClick={(e) => handleCellClick(e, person, currentDate)}
                                                            className="flex items-center justify-between px-3 md:px-6 py-3 md:py-5 bg-white hover:bg-slate-50/80 active:bg-slate-100 transition-all min-h-[64px] md:min-h-[80px] cursor-pointer group border-b border-slate-50 gap-2 md:gap-4"
                                                            role="button"
                                                            tabIndex={0}
                                                        >
                                                            {/* Right: Person Info (Visually Right in RTL) */}
                                                            <div
                                                                className="flex items-center gap-2.5 md:gap-4 shrink-0 min-w-0 bg-inherit relative z-10 cursor-pointer"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onSelectPerson(person);
                                                                }}
                                                            >
                                                                <div
                                                                    className="w-9 h-9 md:w-12 md:h-12 rounded-2xl flex items-center justify-center text-[11px] md:text-sm font-black text-white shadow-lg group-hover:shadow-blue-500/10 group-active:scale-95 transition-all shrink-0"
                                                                    style={{
                                                                        backgroundColor: team.color?.startsWith('#') ? team.color : '#3b82f6',
                                                                        backgroundImage: `linear-gradient(135deg, ${team.color || '#3b82f6'}, ${team.color || '#3b82f6'}cc)`
                                                                    }}
                                                                >
                                                                    {getPersonInitials(person.name)}
                                                                </div>
                                                                <div className="flex flex-col min-w-0">
                                                                    <span className="text-xs md:text-base font-black text-slate-900 leading-tight group-hover:text-blue-600 transition-colors uppercase tracking-tight truncate">{person.name}</span>
                                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                                        <div className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-slate-300 group-hover:bg-blue-300 transition-colors shrink-0" />
                                                                        <span className="text-[9px] md:text-[11px] text-slate-400 font-bold uppercase tracking-widest truncate">לוחם</span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Visual Connector - GUIDES THE EYE */}
                                                            <div className="flex-1 mx-2 md:mx-6 h-px border-t border-dashed border-slate-100 transition-all duration-300 group-hover:border-slate-200" />

                                                            {/* Status Pill UI Logic moved above for easier reading, but let's add testid to the results */}
                                                            <div className="flex items-center gap-2 md:gap-3 shrink-0 min-w-0 bg-inherit relative z-10" data-testid={`attendance-table__person-status-container-${person.id}`}>
                                                                {isExitRequest && !hideAbsenceDetails ? (
                                                                    <span
                                                                        title={relevantAbsence?.reason}
                                                                        className="text-[10px] md:text-[11px] font-black text-red-600 bg-red-50 px-1.5 py-0.5 md:px-2 md:py-1 rounded-lg border border-red-100 animate-pulse truncate max-w-[70px] xs:max-w-[100px] sm:max-w-[180px] shrink-0"
                                                                    >
                                                                        {isViewer ? 'היעדרות' : (
                                                                            <>
                                                                                {relevantAbsence?.status === 'rejected' && <span className="text-[10px] opacity-70 ml-1">(נדחה)</span>}
                                                                                {relevantAbsence?.reason || 'בקשת יציאה'}
                                                                            </>
                                                                        )}
                                                                    </span>
                                                                ) : (() => {
                                                                    const displayBlocks = (avail.unavailableBlocks || []).filter(b =>
                                                                        !(b.start?.slice(0, 5) === '00:00' && (b.end?.slice(0, 5) === '23:59' || b.end?.slice(0, 5) === '00:00'))
                                                                    );
                                                                    if (displayBlocks.length === 0) return null;
                                                                    return (
                                                                        <div className="flex items-center gap-1 bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-100 shrink-0">
                                                                            <Clock size={10} weight="bold" />
                                                                            <span className="text-[10px] font-black leading-none">
                                                                                {displayBlocks.length === 1
                                                                                    ? `${displayBlocks[0].start.slice(0, 5)}-${displayBlocks[0].end.slice(0, 5)}`
                                                                                    : `${displayBlocks.length} חסימות`
                                                                                }
                                                                            </span>
                                                                        </div>
                                                                    );
                                                                })()}

                                                                <div
                                                                    className={`
                                                                        flex items-center gap-1 md:gap-2 px-2.5 py-1.5 md:px-4 md:py-2.5 rounded-xl md:rounded-2xl font-black text-[9px] md:text-xs shrink-0
                                                                        ${statusConfig.bg} transition-all shadow-sm ring-1 ring-black/5
                                                                    `}
                                                                >
                                                                    <statusConfig.icon size={13} weight="bold" className="shrink-0" />
                                                                    <span className="whitespace-nowrap tracking-tight">{statusConfig.label}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* --- MONTHLY TABLE VIEW (Desktop default) --- */}
            {
                (viewMode === 'monthly' || !viewMode) && (
                    <div className={`flex-1 flex-col h-full overflow-hidden animate-fadeIn ${viewMode === 'monthly' ? 'flex' : 'hidden md:flex'}`}>
                        {showStatistics && (
                            <div className="mx-6 mt-6 mb-2 p-4 bg-gradient-to-l from-blue-600 to-indigo-700 rounded-2xl shadow-lg border border-white/10 text-white relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32 blur-3xl opacity-50" />
                                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/20 shadow-sm transition-transform group-hover:scale-105">
                                            <ChartBar size={24} weight="bold" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black leading-none mb-1">דוחות וסטטיסטיקה</h3>
                                            <p className="text-white/70 text-[10px] font-black uppercase tracking-wider">ניתוח נוכחות, חריגות וסבבי יציאות</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-8 md:px-6 md:border-r border-white/10 shrink-0">
                                        <div className="text-center">
                                            <span className="block text-[9px] font-black text-white/50 uppercase tracking-widest mb-1">נוכחות ממוצעת</span>
                                            <div className="text-xl font-black">
                                                {Math.round(people.filter(p => p.isActive !== false).length * 0.85)} <span className="text-xs opacity-60">לוחמים</span>
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => onShowTeamStats?.({ id: 'all', name: 'כל הפלוגה', organization_id: '', color: 'bg-slate-500' })}
                                        className="bg-white text-blue-700 px-8 py-3 rounded-xl font-black text-sm hover:bg-blue-50 transition-all shadow-xl active:scale-95 shrink-0"
                                    >
                                        לתחקור מלא ודוחות
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Table Area (Desktop Only) */}
                        <div
                            className="flex-1 overflow-auto bg-slate-50/10 relative custom-scrollbar h-full"
                            ref={scrollContainerRef}
                        >
                            <div className="min-w-max">
                                {/* Floating Header (Dates) */}
                                <div className="flex sticky top-0 z-[90] bg-white">
                                    <div className="w-52 shrink-0 bg-white border-b border-l border-slate-200 sticky right-0 z-[100] flex items-center px-4 md:px-6 py-3 md:py-4 font-black text-slate-400 text-xs uppercase tracking-widest">
                                        שם הלוחם
                                    </div>

                                    {showStatistics && (
                                        <>
                                            <div className="w-14 shrink-0 bg-white border-b border-l border-slate-200 sticky right-52 z-[100] flex items-center justify-center font-black text-[10px] text-slate-400 uppercase tracking-widest">
                                                בסיס
                                            </div>
                                            <div className="w-14 shrink-0 bg-white border-b border-l border-slate-200 sticky right-[264px] z-[100] flex items-center justify-center font-black text-[10px] text-slate-400 uppercase tracking-widest">
                                                בית
                                            </div>
                                            <div className="w-14 shrink-0 bg-white border-b border-l border-slate-200 sticky right-[320px] z-[100] flex items-center justify-center font-black text-[10px] text-slate-400 uppercase tracking-widest">
                                                יחס
                                            </div>
                                        </>
                                    )}
                                    <div className="flex bg-white border-b border-slate-200">
                                        {dates.map((date) => {
                                            const isToday = new Date().toDateString() === date.toDateString();
                                            const isWeekend = date.getDay() === 6; // Saturday
                                            return (
                                                <div
                                                    key={date.toISOString()}
                                                    className={`w-20 md:w-24 h-14 md:h-16 shrink-0 flex flex-col items-center justify-center border-l border-slate-100 transition-all relative ${isToday ? 'bg-blue-600 text-white z-10' : isWeekend ? 'bg-slate-50' : 'bg-white'}`}
                                                >
                                                    <span className={`text-[10px] md:text-[11px] font-black uppercase mb-0.5 ${isToday ? 'text-blue-100' : isWeekend ? 'text-slate-500' : 'text-slate-400'}`}>
                                                        {weekDaysShort[date.getDay()]}
                                                    </span>
                                                    <span className={`text-lg md:text-xl font-black ${isToday ? 'text-white' : 'text-slate-800'}`}>
                                                        {date.getDate()}
                                                    </span>
                                                    {isToday && <div className="absolute top-0 right-0 left-0 h-1 bg-white/30" />}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Summary Row (Required Manpower) - Optional */}
                                {showRequiredDetails && (
                                    <div className="flex sticky z-[85] top-[64px] bg-white backdrop-blur-md h-12 border-b border-slate-200 shadow-sm">
                                        <div className="w-52 shrink-0 bg-rose-50 border-l border-rose-100 h-full flex items-center gap-2 sticky right-0 z-[90] px-4 md:px-6">
                                            <AlertCircle size={14} className="text-rose-500" weight="bold" />
                                            <span className="text-xs md:text-sm font-black text-rose-900 tracking-tight">נדרשים למשימות</span>
                                        </div>
                                        {showStatistics && (
                                            <>
                                                <div className="w-14 shrink-0 bg-rose-50 border-b border-l border-rose-100 h-full flex items-center justify-center sticky right-52 z-[90]" />
                                                <div className="w-14 shrink-0 bg-rose-50 border-b border-l border-rose-100 h-full flex items-center justify-center sticky right-[264px] z-[90]" />
                                                <div className="w-14 shrink-0 bg-rose-50 border-b border-l border-rose-100 h-full flex items-center justify-center sticky right-[320px] z-[90]" />
                                            </>
                                        )}
                                        <div className="flex h-full">
                                            {dates.map(date => {
                                                const dateKey = date.toISOString().split('T')[0];

                                                // Calculate total required people for this date from tasks
                                                let totalRequired = 0;
                                                tasks.forEach(task => {
                                                    // Check task validity dates
                                                    if (task.startDate && new Date(task.startDate) > date) return;
                                                    if (task.endDate && new Date(task.endDate) < date) return;

                                                    task.segments.forEach(segment => {
                                                        let isActive = false;
                                                        if (segment.frequency === 'daily') isActive = true;
                                                        else if (segment.frequency === 'weekly' && segment.daysOfWeek?.includes(weekDaysEnglish[date.getDay()])) isActive = true;
                                                        else if (segment.frequency === 'specific_date' && segment.specificDate === dateKey) isActive = true;

                                                        if (isActive) {
                                                            totalRequired += segment.requiredPeople;
                                                        }
                                                    });
                                                });

                                                // Calculate present people to compare
                                                let present = 0;
                                                const isThisDayToday = new Date().toDateString() === date.toDateString();
                                                const refTime = isThisDayToday
                                                    ? `${currentTime.getHours().toString().padStart(2, '0')}:${currentTime.getMinutes().toString().padStart(2, '0')}`
                                                    : '12:00';

                                                sortedPeople.forEach(p => {
                                                    if (isPersonPresentAtHour(p, date, refTime, teamRotations, absences, hourlyBlockages)) {
                                                        present++;
                                                    }
                                                });

                                                const diff = present - totalRequired;
                                                const isDeficit = diff < 0;

                                                return (
                                                    <div
                                                        key={dateKey}
                                                        className={`w-24 shrink-0 flex flex-col items-center justify-center border-l border-slate-100 h-full bg-rose-50/30 text-xs font-bold relative`}
                                                    >
                                                        <span className="text-rose-700 font-black text-sm">{totalRequired}</span>
                                                        {isDeficit && <span className="text-[9px] text-red-500 font-bold bg-red-100 px-1 rounded absolute top-1 right-1">חסר {Math.abs(diff)}</span>}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="flex-1 bg-white h-full" />
                                    </div>
                                )}

                                {/* Summary Row (Global Stats) */}
                                <div className={`flex sticky z-[85] ${showRequiredDetails ? 'top-[112px]' : 'top-[64px]'} bg-white backdrop-blur-md h-12`}>
                                    <div
                                        onClick={() => onShowTeamStats && onShowTeamStats({ id: 'all', name: 'כל הפלוגה' } as Team)}
                                        className="w-52 shrink-0 bg-slate-50 border-b border-l border-slate-200 h-full flex items-center gap-2 sticky right-0 z-[90] px-4 md:px-6 cursor-pointer hover:bg-blue-50 transition-colors"
                                    >
                                        <Users size={14} className="text-blue-600" weight="bold" />
                                        <span className="text-[13px] md:text-sm font-black text-slate-900 tracking-tight">סך הכל פלוגה</span>
                                    </div>

                                    {showStatistics && (() => {
                                        let baseTotal = 0;
                                        let homeTotal = 0;
                                        sortedPeople.forEach(p => {
                                            dates.forEach(d => {
                                                const isDToday = new Date().toDateString() === d.toDateString();
                                                const refT = isDToday
                                                    ? `${currentTime.getHours().toString().padStart(2, '0')}:${currentTime.getMinutes().toString().padStart(2, '0')}`
                                                    : '12:00';

                                                if (isPersonPresentAtHour(p, d, refT, teamRotations, absences, hourlyBlockages)) {
                                                    baseTotal++;
                                                } else {
                                                    homeTotal++;
                                                }
                                            });
                                        });
                                        const baseAvg = sortedPeople.length > 0 ? baseTotal / sortedPeople.length : 0;
                                        const homeAvg = sortedPeople.length > 0 ? homeTotal / sortedPeople.length : 0;
                                        const homeAvgNorm = Math.round((homeAvg / dates.length) * 14);
                                        const baseAvgNorm = 14 - homeAvgNorm;
                                        return (
                                            <>
                                                <div
                                                    className="w-14 shrink-0 bg-emerald-50 border-b border-l border-emerald-100 h-full flex flex-col items-center justify-center sticky right-52 z-[90] cursor-pointer hover:bg-emerald-100 transition-colors group"
                                                    onClick={() => onShowTeamStats?.({ id: 'all', name: 'כל הפלוגה', organization_id: '', color: 'bg-slate-500' })}
                                                    title="לחץ לסטטיסטיקה מלאה"
                                                >
                                                    <span className="text-xs font-black text-emerald-700 leading-none">{Math.round(baseAvg)}</span>
                                                    <ChartBar size={10} className="text-emerald-400 group-hover:text-emerald-600 mt-0.5" weight="bold" />
                                                </div>
                                                <div
                                                    className="w-14 shrink-0 bg-red-50 border-b border-l border-red-100 h-full flex flex-col items-center justify-center sticky right-[264px] z-[90] cursor-pointer hover:bg-red-100 transition-colors group"
                                                    onClick={() => onShowTeamStats?.({ id: 'all', name: 'כל הפלוגה', organization_id: '', color: 'bg-slate-500' })}
                                                    title="לחץ לסטטיסטיקה מלאה"
                                                >
                                                    <span className="text-xs font-black text-red-700 leading-none">{Math.round(homeAvg)}</span>
                                                    <ChartBar size={10} className="text-red-300 group-hover:text-red-500 mt-0.5" weight="bold" />
                                                </div>
                                                <div
                                                    className="w-14 shrink-0 bg-blue-50 border-b border-l border-blue-100 h-full flex flex-col items-center justify-center sticky right-[320px] z-[90] cursor-pointer hover:bg-blue-100 transition-colors group"
                                                    dir="ltr"
                                                    onClick={() => onShowTeamStats?.({ id: 'all', name: 'כל הפלוגה', organization_id: '', color: 'bg-slate-500' })}
                                                    title="לחץ לסטטיסטיקה מלאה"
                                                >
                                                    <span className="text-[10px] font-black text-blue-700 leading-none">{homeAvgNorm} / {baseAvgNorm}</span>
                                                    <ChartBar size={10} className="text-blue-300 group-hover:text-blue-500 mt-0.5" weight="bold" />
                                                </div>
                                            </>
                                        );
                                    })()}
                                    <div className="flex h-full">
                                        {dates.map(date => {
                                            const dateKey = date.toISOString().split('T')[0];
                                            const isThisDayToday = new Date().toDateString() === date.toDateString();
                                            const refTime = isThisDayToday
                                                ? `${currentTime.getHours().toString().padStart(2, '0')}:${currentTime.getMinutes().toString().padStart(2, '0')}`
                                                : '12:00';

                                            let present = 0;
                                            sortedPeople.forEach(p => {
                                                if (isPersonPresentAtHour(p, date, refTime, teamRotations, absences, hourlyBlockages)) {
                                                    present++;
                                                }
                                            });
                                            const total = sortedPeople.length;
                                            return (
                                                <div
                                                    key={dateKey}
                                                    className={`w-24 shrink-0 flex items-center justify-center border-l border-slate-300 text-[13px] font-black border-b h-full
                                                        ${(total > 0 ? present / total : 0) >= 0.8 ? 'text-emerald-700 bg-emerald-100/50' : (total > 0 ? present / total : 0) >= 0.5 ? 'text-amber-700 bg-amber-100/50' : 'text-red-700 bg-red-100/50'}
                                                    `}
                                                    dir="ltr"
                                                >
                                                    {present} / {total}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="flex-1 bg-slate-100/50 border-b border-slate-300 h-full" />
                                </div>

                                {sortedTeams.map(team => {
                                    const teamPeople = sortedPeople.filter(p => p.teamId === team.id);
                                    if (teamPeople.length === 0) return null;
                                    const isCollapsed = collapsedTeams.has(team.id);

                                    return (
                                        <div key={team.id} className="relative">
                                            {/* Team Header Row */}
                                            <div
                                                onClick={() => toggleTeam(team.id)}
                                                className={`flex sticky z-[75] ${showRequiredDetails ? 'top-[160px]' : 'top-[112px]'} group cursor-pointer bg-white h-12`}
                                            >
                                                {/* Sticky Name Part */}
                                                <div className="w-52 shrink-0 bg-slate-100 border-b border-l border-slate-200 h-full flex flex-col justify-center gap-0.5 sticky right-0 z-[80] px-4">
                                                    <div className="flex items-center gap-1.5">
                                                        <div className={`transition-transform duration-300 ${isCollapsed ? 'rotate-0' : 'rotate-180'}`}>
                                                            <ChevronDown size={12} className="text-slate-600" weight="bold" />
                                                        </div>
                                                        <span className="text-xs md:text-sm font-black text-slate-900 tracking-tight truncate">{team.name}</span>
                                                    </div>
                                                    {companies.length > 0 && (
                                                        <span className="text-[9px] font-bold text-blue-600 pr-4 truncate">
                                                            {companies.find(c => c.id === team.organization_id)?.name}
                                                        </span>
                                                    )}
                                                </div>

                                                {showStatistics && (() => {
                                                    let baseTotal = 0;
                                                    let homeTotal = 0;
                                                    teamPeople.forEach(p => {
                                                        dates.forEach(d => {
                                                            const isDToday = new Date().toDateString() === d.toDateString();
                                                            const refT = isDToday
                                                                ? `${currentTime.getHours().toString().padStart(2, '0')}:${currentTime.getMinutes().toString().padStart(2, '0')}`
                                                                : '12:00';

                                                            if (isPersonPresentAtHour(p, d, refT, teamRotations, absences, hourlyBlockages)) {
                                                                baseTotal++;
                                                            } else {
                                                                homeTotal++;
                                                            }
                                                        });
                                                    });
                                                    const baseAvg = teamPeople.length > 0 ? baseTotal / teamPeople.length : 0;
                                                    const homeAvg = teamPeople.length > 0 ? homeTotal / teamPeople.length : 0;
                                                    const homeAvgNorm = Math.round((homeAvg / dates.length) * 14);
                                                    const baseAvgNorm = 14 - homeAvgNorm;
                                                    return (
                                                        <>
                                                            <div className="w-14 shrink-0 bg-slate-50 border-b border-l border-slate-200 h-full flex items-center justify-center sticky right-52 z-[80] cursor-pointer hover:bg-blue-50" onClick={(e) => { e.stopPropagation(); onShowTeamStats?.(team); }}>
                                                                <span className="text-xs font-black text-emerald-600">{Math.round(baseAvg)}</span>
                                                            </div>
                                                            <div className="w-14 shrink-0 bg-slate-50 border-b border-l border-slate-200 h-full flex items-center justify-center sticky right-[264px] z-[80] cursor-pointer hover:bg-blue-50" onClick={(e) => { e.stopPropagation(); onShowTeamStats?.(team); }}>
                                                                <span className="text-xs font-black text-red-600">{Math.round(homeAvg)}</span>
                                                            </div>
                                                            <div className="w-14 shrink-0 bg-slate-50 border-b border-l border-slate-200 h-full flex items-center justify-center sticky right-[320px] z-[80] cursor-pointer hover:bg-blue-50" onClick={(e) => { e.stopPropagation(); onShowTeamStats?.(team); }} dir="ltr">
                                                                <span className="text-[9px] font-black text-blue-500">{homeAvgNorm} / {baseAvgNorm}</span>
                                                            </div>
                                                        </>
                                                    );
                                                })()}
                                                {/* Per-Day Team Stats View */}
                                                <div className="flex bg-white h-full">
                                                    {dates.map(date => {
                                                        const dateKey = date.toISOString().split('T')[0];
                                                        const isThisDayToday = new Date().toDateString() === date.toDateString();
                                                        const refTime = isThisDayToday
                                                            ? `${currentTime.getHours().toString().padStart(2, '0')}:${currentTime.getMinutes().toString().padStart(2, '0')}`
                                                            : '12:00';

                                                        const presentCount = teamPeople.filter(p =>
                                                            isPersonPresentAtHour(p, date, refTime, teamRotations, absences, hourlyBlockages)
                                                        ).length;
                                                        const present = presentCount;
                                                        const total = teamPeople.length;
                                                        const isFull = present === total;
                                                        const isEmpty = present === 0;

                                                        return (
                                                            <div
                                                                key={dateKey}
                                                                className={`w-24 shrink-0 flex items-center justify-center border-l border-slate-200 text-[11px] font-black border-b h-full
                                                                    ${isFull ? 'text-emerald-700 bg-emerald-50/30' : isEmpty ? 'text-slate-400' : 'text-amber-700 bg-amber-50/30'}
                                                                `}
                                                                dir="ltr"
                                                            >
                                                                {present} / {total}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                {/* Background extension for the rest of the row */}
                                                <div className="flex-1 bg-slate-50 border-b border-slate-200 h-full" />
                                            </div>

                                            {/* Team Members List Container - Separate DIV as requested */}
                                            {!isCollapsed && (
                                                <div className="divide-y divide-slate-100 bg-white">
                                                    {teamPeople.map((person, idx) => (
                                                        <div key={person.id} className="flex group/row hover:bg-blue-50/20 transition-all">
                                                            {/* Person Info Sticky Cell */}
                                                            <div
                                                                onClick={() => onSelectPerson(person)}
                                                                className={`w-52 shrink-0 px-4 md:px-6 py-2.5 md:py-4 border-l border-slate-100 sticky right-0 z-[60] flex items-center gap-3 md:gap-4 cursor-pointer transition-all ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'} group-hover/row:bg-blue-50 group-hover/row:shadow-[4px_0_12px_rgba(0,0,0,0.05)] shadow-[2px_0_5px_rgba(0,0,0,0.02)]`}
                                                            >
                                                                <div
                                                                    className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-black shrink-0 text-white shadow-md ring-2 ring-white transition-transform group-hover/row:scale-110"
                                                                    style={{
                                                                        backgroundColor: team.color?.startsWith('#') ? team.color : '#3b82f6',
                                                                        backgroundImage: `linear-gradient(135deg, ${team.color || '#3b82f6'}, ${team.color || '#3b82f6'}cc)`
                                                                    }}
                                                                >
                                                                    {getPersonInitials(person.name)}
                                                                </div>
                                                                <div className="flex flex-col min-w-0">
                                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                                        <span className="text-base font-black text-slate-800 truncate group-hover/row:text-blue-600 transition-colors">
                                                                            {person.name}
                                                                        </span>
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                onShowPersonStats?.(person);
                                                                            }}
                                                                            className="p-1 hover:bg-blue-100 rounded-lg text-blue-500 transition-colors shrink-0"
                                                                            title="לחץ לנתוני חייל"
                                                                        >
                                                                            <ChartBar size={14} weight="bold" />
                                                                        </button>
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                                        <span className="text-[11px] text-slate-400 font-bold truncate tracking-wide">
                                                                            {person.roleId ? team.name : 'לוחם'}
                                                                        </span>
                                                                        {companies.length > 0 && (
                                                                            <>
                                                                                <div className="w-1 h-1 rounded-full bg-slate-300" />
                                                                                <span className="text-[11px] text-blue-500 font-black truncate">
                                                                                    {companies.find(c => c.id === person.organization_id)?.name}
                                                                                </span>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {showStatistics && (() => {
                                                                let baseDays = 0;
                                                                let homeDays = 0;
                                                                dates.forEach(d => {
                                                                    const isDToday = new Date().toDateString() === d.toDateString();
                                                                    const refT = isDToday
                                                                        ? `${currentTime.getHours().toString().padStart(2, '0')}:${currentTime.getMinutes().toString().padStart(2, '0')}`
                                                                        : '12:00';

                                                                    if (isPersonPresentAtHour(person, d, refT, teamRotations, absences, hourlyBlockages)) {
                                                                        baseDays++;
                                                                    } else {
                                                                        homeDays++;
                                                                    }
                                                                });

                                                                const homeNorm = Math.round((homeDays / dates.length) * 14);
                                                                const baseNorm = 14 - homeNorm;

                                                                return (
                                                                    <>
                                                                        <div className={`w-14 shrink-0 px-2 py-4 border-l border-slate-100 sticky right-52 z-[60] flex items-center justify-center font-black text-sm text-emerald-600 cursor-pointer hover:bg-emerald-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`} onClick={() => onShowPersonStats?.(person)}>
                                                                            {baseDays}
                                                                        </div>
                                                                        <div className={`w-14 shrink-0 px-2 py-4 border-l border-slate-100 sticky right-[264px] z-[60] flex items-center justify-center font-black text-sm text-red-600 cursor-pointer hover:bg-red-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`} onClick={() => onShowPersonStats?.(person)}>
                                                                            {homeDays}
                                                                        </div>
                                                                        <div className={`w-14 shrink-0 px-2 py-4 border-l border-slate-100 sticky right-[320px] z-[60] flex items-center justify-center font-black text-[11px] text-blue-500 cursor-pointer hover:bg-blue-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`} onClick={() => onShowPersonStats?.(person)} dir="ltr">
                                                                            {homeNorm} / {baseNorm}
                                                                        </div>
                                                                    </>
                                                                );
                                                            })()}

                                                            {/* Attendance Grid Cells */}
                                                            <div className="flex min-w-max">
                                                                {dates.map((date, dateIdx) => {
                                                                    const avail = getEffectiveAvailability(person, date, teamRotations, absences, hourlyBlockages);
                                                                    const dateStr = date.toLocaleDateString('en-CA');

                                                                    const isToday = new Date().toDateString() === date.toDateString();
                                                                    const isSelected = (editingCell?.personId === person.id && editingCell?.dates.includes(dateStr)) ||
                                                                        (selection?.personId === person.id && selection?.dates.includes(dateStr));

                                                                    // Roster Wizard Style Logic
                                                                    const prevDate = new Date(date);
                                                                    prevDate.setDate(date.getDate() - 1);
                                                                    const nextDate = new Date(date);
                                                                    nextDate.setDate(date.getDate() + 1);

                                                                    const prevAvail = getEffectiveAvailability(person, prevDate, teamRotations, absences, hourlyBlockages);
                                                                    const nextAvail = getEffectiveAvailability(person, nextDate, teamRotations, absences, hourlyBlockages);

                                                                    let content = null;
                                                                    let cellBg = "bg-white";
                                                                    let themeColor = "bg-slate-200";

                                                                    const dateKey = date.toLocaleDateString('en-CA');

                                                                    // Check Absences Table (Official Requests)
                                                                    const relevantAbsence = absences.find(a =>
                                                                        a.person_id === person.id &&
                                                                        a.start_date <= dateKey &&
                                                                        a.end_date >= dateKey
                                                                    );
                                                                    const isExitRequest = !!relevantAbsence;

                                                                    // Show Text if there is a matching Absence Record
                                                                    // A request is "Unapproved" only if it is explicitly NOT approved/partially_approved
                                                                    const absenceStatus = relevantAbsence ? getComputedAbsenceStatus(person, relevantAbsence).status : 'pending';
                                                                    const isApproved = absenceStatus === 'approved' || absenceStatus === 'partially_approved';
                                                                    const isUnapprovedExit = isExitRequest && !isApproved;

                                                                    const constraintText = (isExitRequest && !hideAbsenceDetails) ? (
                                                                        <span
                                                                            data-testid="exit-request-label"
                                                                            title={relevantAbsence?.reason}
                                                                            className={`text-[9px] font-bold -mt-0.5 whitespace-nowrap scale-90 flex items-center gap-1 truncate max-w-[80px] ${isUnapprovedExit ? 'text-red-600' : 'text-slate-500'}`}
                                                                        >
                                                                            {absenceStatus === 'rejected' && <span className="opacity-60 text-[8px]">(נדחה)</span>}
                                                                            {absenceStatus === 'pending' && <span className="opacity-60 text-[8px]">(ממתין)</span>}
                                                                            {isViewer ? 'היעדרות' : (relevantAbsence?.reason || 'בקשת יציאה')}
                                                                        </span>
                                                                    ) : null;

                                                                    // Red Dots: Show only if there are blocks AND it isn't an Exit Request day
                                                                    const showRedDots = !isExitRequest && (avail.unavailableBlocks?.length || 0) > 0;
                                                                    const displayBlocks = avail.unavailableBlocks || [];

                                                                    // ----------------------------------------------------
                                                                    // VIEW LOGIC: VISUAL DEPARTURE INFERENCE
                                                                    // If Current is Home, but Previous was Base/Full -> Render as Departure
                                                                    // ----------------------------------------------------
                                                                    const isFirstDayHome = (prevAvail.status === 'base' || prevAvail.status === 'full' || prevAvail.status === 'arrival') && avail.status === 'home';
                                                                    const isLastDayHome = (nextAvail.status === 'base' || nextAvail.status === 'full' || nextAvail.status === 'departure') && avail.status === 'home';

                                                                    if (avail.status === 'home' || avail.status === 'unavailable' || !avail.isAvailable) {
                                                                        cellBg = "bg-red-50/70 text-red-800";
                                                                        themeColor = "bg-red-400";
                                                                        const isConstraint = avail.status === 'unavailable';

                                                                        // Get home status type label
                                                                        const homeStatusLabels: Record<string, string> = {
                                                                            'leave_shamp': 'חופשה בשמפ',
                                                                            'gimel': 'ג\'',
                                                                            'absent': 'נפקד',
                                                                            'organization_days': 'ימי התארגנות',
                                                                            'not_in_shamp': 'לא בשמ"פ'
                                                                        };
                                                                        const homeTypeLabel = avail.homeStatusType ? homeStatusLabels[avail.homeStatusType] : undefined;
                                                                        // Show default 'חופשה בשמפ' for home status without explicit type
                                                                        const displayHomeType = !isConstraint && avail.status === 'home'
                                                                            ? (homeTypeLabel || 'חופשה בשמפ')
                                                                            : undefined;

                                                                        content = (
                                                                            <div className="flex flex-col items-center justify-center gap-0.5">
                                                                                <Home size={14} className="text-red-300" weight="bold" />
                                                                                <span className="text-[10px] font-black">{isConstraint ? 'אילוץ' : 'בית'}</span>
                                                                                {displayHomeType && (
                                                                                    <span className="text-[8px] font-bold text-red-500/70 leading-tight">{displayHomeType}</span>
                                                                                )}
                                                                                {constraintText}
                                                                            </div>
                                                                        );
                                                                    } else {
                                                                        // Available (Base)
                                                                        const prevWasPartialReturn = prevAvail.status === 'home' && prevAvail.endHour && prevAvail.endHour !== '23:59' && prevAvail.endHour !== '00:00';
                                                                        const nextWasPartialDeparture = nextAvail.status === 'home' && nextAvail.startHour && nextAvail.startHour !== '00:00';

                                                                        const isArrival = ((!prevAvail.isAvailable || prevAvail.status === 'home') && !prevWasPartialReturn) || (avail.startHour !== '00:00');
                                                                        const isDeparture = ((!nextAvail.isAvailable || nextAvail.status === 'home') && !nextWasPartialDeparture) || (avail.endHour !== '23:59');

                                                                        if (isArrival && isDeparture) {
                                                                            cellBg = "bg-emerald-50 text-emerald-800";
                                                                            themeColor = "bg-emerald-500";
                                                                            content = (
                                                                                <div className="flex flex-col items-center justify-center relative w-full h-full">
                                                                                    {isUnapprovedExit && (
                                                                                        <div className="absolute top-1 left-1.5 text-red-500 animate-pulse">
                                                                                            <AlertCircle size={10} weight="fill" />
                                                                                        </div>
                                                                                    )}
                                                                                    <span className={`text-[10px] font-black ${isUnapprovedExit ? "text-red-700" : ""}`}>יום בודד</span>
                                                                                    <span className="text-[9px] font-bold opacity-70">{avail.startHour === '00:00' ? defaultArrivalHour : avail.startHour}-{avail.endHour === '23:59' ? defaultDepartureHour : avail.endHour}</span>
                                                                                    {constraintText}
                                                                                </div>
                                                                            );
                                                                        } else if (isArrival) {
                                                                            cellBg = "bg-emerald-50/60 text-emerald-800";
                                                                            themeColor = "bg-emerald-500";
                                                                            content = (
                                                                                <div className="flex flex-col items-center justify-center relative w-full h-full">
                                                                                    {isUnapprovedExit && (
                                                                                        <div className="absolute top-1 left-1.5 text-red-500 animate-pulse">
                                                                                            <AlertCircle size={10} weight="fill" />
                                                                                        </div>
                                                                                    )}
                                                                                    <MapPin size={12} className={isUnapprovedExit ? "text-red-500" : "text-emerald-500"} weight="bold" />
                                                                                    <span className={`text-[10px] font-black ${isUnapprovedExit ? "text-red-700" : ""}`}>הגעה</span>
                                                                                    <span className="text-[9px] font-bold opacity-70 whitespace-nowrap scale-90">{avail.startHour === '00:00' ? defaultArrivalHour : avail.startHour}</span>
                                                                                    {constraintText}
                                                                                </div>
                                                                            );
                                                                        } else if (isDeparture && avail.endHour !== '23:59') {
                                                                            // Only show Departure context if specific time is set
                                                                            cellBg = "bg-amber-50/60 text-amber-900";
                                                                            themeColor = "bg-amber-500";
                                                                            content = (
                                                                                <div className="flex flex-col items-center justify-center relative w-full h-full">
                                                                                    {isUnapprovedExit && (
                                                                                        <div className="absolute top-1 left-1.5 text-red-500 animate-pulse">
                                                                                            <AlertCircle size={10} weight="fill" />
                                                                                        </div>
                                                                                    )}
                                                                                    <MapPin size={12} className={isUnapprovedExit ? "text-red-500" : "text-amber-500"} weight="bold" />
                                                                                    <span className={`text-[10px] font-black ${isUnapprovedExit ? "text-red-700" : ""}`}>יציאה</span>
                                                                                    <span className="text-[9px] font-bold opacity-70 whitespace-nowrap scale-90">{avail.endHour === '23:59' ? defaultDepartureHour : avail.endHour}</span>
                                                                                    {constraintText}
                                                                                </div>
                                                                            );
                                                                        } else {
                                                                            cellBg = "bg-emerald-50/40 text-emerald-800";
                                                                            themeColor = "bg-emerald-500";
                                                                            content = (
                                                                                <div className="flex flex-col items-center justify-center gap-0.5 relative w-full h-full">
                                                                                    {isUnapprovedExit && !hideAbsenceDetails && (
                                                                                        <div className="absolute top-1 left-1.5 text-red-500 animate-pulse">
                                                                                            <AlertCircle size={10} weight="fill" />
                                                                                        </div>
                                                                                    )}
                                                                                    <MapPin size={14} className={isUnapprovedExit && !hideAbsenceDetails ? "text-red-500" : "text-emerald-500/50"} weight="bold" />
                                                                                    <span className={`text-[10px] font-black ${isUnapprovedExit && !hideAbsenceDetails ? "text-red-700" : ""}`}>בסיס</span>
                                                                                    {(avail.unavailableBlocks && avail.unavailableBlocks.length > 0) && (
                                                                                        <span className="text-[9px] font-bold text-red-600/90 leading-tight block whitespace-nowrap scale-90 -mt-0.5">
                                                                                            {avail.unavailableBlocks.length > 1
                                                                                                ? `${avail.unavailableBlocks.length} חסימות`
                                                                                                : `${avail.unavailableBlocks[0].start}-${avail.unavailableBlocks[0].end}`
                                                                                            }
                                                                                        </span>
                                                                                    )}
                                                                                    {isUnapprovedExit && !hideAbsenceDetails && (
                                                                                        <span className="text-[8px] font-bold text-red-500/60 leading-tight">לא אושר</span>
                                                                                    )}
                                                                                </div>
                                                                            );
                                                                        }
                                                                    }

                                                                    return (
                                                                        <div
                                                                            key={date.toISOString()}
                                                                            data-testid={`attendance-cell-${person.id}-${dateKey}`}
                                                                            className={`w-24 h-20 shrink-0 border-l border-slate-100 flex flex-col items-center justify-center cursor-pointer transition-all relative group/cell 
                                                                        ${cellBg} 
                                                                        ${isSelected ? 'z-30 ring-4 ring-blue-500 shadow-2xl scale-110 rounded-lg bg-white' : 'hover:z-10 hover:shadow-lg hover:bg-white'} 
                                                                        ${isToday ? 'ring-inset shadow-[inset_0_0_0_2px_rgba(59,130,246,0.5)]' : ''}
                                                                    `}
                                                                            title={avail.unavailableBlocks?.map(b => `${b.start}-${b.end} ${b.reason || ''}`).join('\n')}
                                                                            onClick={(e) => handleCellClick(e, person, date)}

                                                                        >
                                                                            {content}

                                                                            {/* Unavailable Blocks Indicators - Red Dots (Hidden if Exit Request) */}
                                                                            {showRedDots && (
                                                                                <div
                                                                                    data-testid="hourly-blockage-indicator"
                                                                                    className="absolute top-1 right-1 z-10 flex gap-0.5"
                                                                                >
                                                                                    {displayBlocks.slice(0, 3).map((_, i) => (
                                                                                        <div key={i} className="w-1.5 h-1.5 rounded-full bg-red-500 ring-1 ring-white shadow-sm" aria-hidden="true" />
                                                                                    ))}
                                                                                    {displayBlocks.length > 3 && (
                                                                                        <div className="w-1.5 h-1.5 rounded-full bg-red-300 ring-1 ring-white shadow-sm" />
                                                                                    )}
                                                                                </div>
                                                                            )}

                                                                            {/* Status indicator bar at bottom */}
                                                                            <div className={`absolute bottom-0 left-0 right-0 h-1 ${themeColor} opacity-20 group-hover/cell:opacity-100 transition-opacity`} />

                                                                            {/* Is Manual/Algorithm dot */}
                                                                            {(avail.source === 'manual' || avail.source === 'algorithm') && (
                                                                                <div className={`absolute top-1.5 ${isUnapprovedExit ? 'left-5' : 'left-1.5'} w-1.5 h-1.5 rounded-full ${avail.source === 'manual' ? 'bg-amber-400' : 'bg-blue-400'}`} />
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Footer Summary - STICKY FIXED */}
                        <div className="sticky bottom-0 z-50 p-2 md:p-3 bg-white border-t border-slate-200 flex items-center justify-center gap-3 md:gap-6 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] flex-wrap">
                            <div className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" />
                                <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap">נמצא בבסיס</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-red-400/40 shadow-sm" />
                                <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap">נמצא בבית</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm" />
                                <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap">יציאה</span>
                            </div>
                            <div className="w-px h-3 bg-slate-200 hidden md:block" />
                            <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-amber-400 shadow-sm" />
                                <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap">שינוי ידני</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <AlertCircle size={10} className="text-red-500" weight="fill" />
                                <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap">חסימה בלו"ז</span>
                            </div>
                        </div>
                    </div>
                )
            }

            {
                editingCell && (() => {
                    const person = people.find(p => p.id === editingCell.personId);
                    const firstDate = editingCell.dates[0];
                    const availability = person ? getEffectiveAvailability(person, new Date(firstDate), teamRotations, absences, hourlyBlockages) : undefined;

                    return (
                        <StatusEditModal
                            isOpen={!!editingCell}
                            date={firstDate}
                            dates={editingCell.dates}
                            personName={person?.name}
                            currentAvailability={availability}
                            onClose={() => setEditingCell(null)}
                            onApply={handleApplyStatus}
                            defaultArrivalHour={defaultArrivalHour}
                            defaultDepartureHour={defaultDepartureHour}
                        />
                    );
                })()
            }
        </div>
    );
};
