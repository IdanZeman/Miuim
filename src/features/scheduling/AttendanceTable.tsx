import React, { useState, useRef, useEffect } from 'react';
import { Person, Team, TeamRotation, Absence, TaskTemplate } from '@/types';
import { getEffectiveAvailability, isPersonPresentAtHour } from '@/utils/attendanceUtils';
import { StatusEditModal } from './StatusEditModal';
import { logger } from '@/services/loggingService';
import { FeatureTour } from '@/components/ui/FeatureTour';
import { UndefinedArrivalsWidget } from './UndefinedArrivalsWidget';
import { DailyAttendanceView } from './components/DailyAttendanceView';
import { MonthlyAttendanceTable } from './components/MonthlyAttendanceTable';

interface AttendanceTableProps {
    teams: Team[];
    people: Person[];
    teamRotations: TeamRotation[];
    absences: Absence[];
    hourlyBlockages?: import('@/types').HourlyBlockage[];
    tasks?: TaskTemplate[];
    currentDate: Date;
    onDateChange: (date: Date) => void;
    onSelectPerson: (person: Person) => void;
    onUpdateAvailability?: (personId: string, date: string | string[], status: 'base' | 'home' | 'unavailable', customTimes?: { start: string, end: string }, unavailableBlocks?: { id: string, start: string, end: string, reason?: string }[], homeStatusType?: import('@/types').HomeStatusType) => void;
    viewMode?: 'daily' | 'monthly';
    className?: string; // Allow parent styling for mobile sheet integration
    isViewer?: boolean; // Security prop
    searchTerm?: string;
    showRequiredDetails?: boolean;
    companies?: import('@/types').Organization[];
    hideAbsenceDetails?: boolean; // Security/Privacy prop
    defaultArrivalHour?: string;
    defaultDepartureHour?: string;
    showStatistics?: boolean;
    onShowPersonStats?: (person: Person) => void;
    onShowTeamStats?: (team: Team) => void;
    idPrefix?: string; // Avoid ID collisions
}

export const AttendanceTable: React.FC<AttendanceTableProps> = ({
    teams, people, teamRotations, absences, hourlyBlockages = [], tasks = [], currentDate, onDateChange, onSelectPerson, onUpdateAvailability, className, viewMode, isViewer = false, searchTerm = '', showRequiredDetails = false, companies = [], hideAbsenceDetails = false,
    defaultArrivalHour = '10:00', defaultDepartureHour = '14:00',
    showStatistics = false, onShowPersonStats, onShowTeamStats,
    idPrefix = ''
}) => {
    const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(() => new Set(teams.map(t => t.id)));
    // State for the modal (editing mode) - now supports multiple dates
    const [editingCell, setEditingCell] = useState<{ personId: string; dates: string[] } | null>(null);
    // State for visual selection (before modal opens)
    const [selection, setSelection] = useState<{ personId: string; dates: string[] } | null>(null);

    const scrollContainerRef = useRef<HTMLDivElement>(null); // Kept for legacy ref passing if needed, though mostly moved to components

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

    const toggleTeam = (teamId: string) => {
        setCollapsedTeams(prev => {
            const next = new Set(prev);
            if (next.has(teamId)) next.delete(teamId);
            else next.add(teamId);
            return next;
        });
    };

    const dates = React.useMemo(() => {
        const dts = [];
        for (let d = 1; d <= daysInMonth; d++) {
            dts.push(new Date(year, month, d));
        }
        return dts;
    }, [year, month, daysInMonth]);

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

    const handleApplyStatus = (status: 'base' | 'home', customTimes?: { start: string, end: string }, unavailableBlocks?: { id: string, start: string, end: string, reason?: string }[], homeStatusType?: import('@/types').HomeStatusType) => {
        if (!editingCell || !onUpdateAvailability) return;
        // Map 'unavailable' status (legacy) to 'home' or maintain compatibility if needed, 
        // but typically the modal now controls 'base' vs 'home'.
        onUpdateAvailability(editingCell.personId, editingCell.dates, status, customTimes, unavailableBlocks, homeStatusType);
        setEditingCell(null);
    };

    // State for auto-refreshing stats
    const [currentTime, setCurrentTime] = useState(new Date());

    // Import FeatureTour types if needed, but we use component directly
    // Feature Tour State
    const [tourSteps, setTourSteps] = useState<import('@/components/ui/FeatureTour').TourStep[]>([]);

    // Detect undefined arrival issues (ALL of them)
    const undefinedArrivalIssues = React.useMemo(() => {
        const issues: { person: Person, date: Date, targetId: string }[] = [];

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (const person of sortedPeople) {
            for (const date of dates) {
                // Filter: From today onwards
                if (date < today) continue;

                const avail = getEffectiveAvailability(person, date, teamRotations, absences, hourlyBlockages);

                // Check for ANY undefined status (Missing Report / Missing Arrival / Missing Departure)
                let isIssue = false;

                if (avail.status === 'undefined') {
                    isIssue = true;
                } else if (avail.status === 'base' || avail.status === 'full' || avail.status === 'arrival' || avail.status === 'departure') {
                    // Context checks
                    const prevDate = new Date(date); prevDate.setDate(date.getDate() - 1);
                    const nextDate = new Date(date); nextDate.setDate(date.getDate() + 1);

                    const prevAvail = getEffectiveAvailability(person, prevDate, teamRotations, absences, hourlyBlockages);
                    const nextAvail = getEffectiveAvailability(person, nextDate, teamRotations, absences, hourlyBlockages);

                    const isArrival = (!prevAvail.isAvailable || prevAvail.status === 'home') || (avail.startHour !== '00:00');
                    const isDeparture = (!nextAvail.isAvailable || nextAvail.status === 'home') || (avail.endHour !== '23:59');

                    const isMissingArrival = isArrival && avail.startHour === '00:00';
                    const isMissingDeparture = isDeparture && avail.endHour === '23:59' && avail.status !== 'departure'; // 'departure' status usually implies specific time, but 'base'/'full' might default to 23:59

                    if (isMissingArrival || isMissingDeparture) {
                        isIssue = true;
                    }
                }

                if (isIssue) {
                    const dateKey = date.toLocaleDateString('en-CA');
                    const targetId = `#${idPrefix}attendance-cell-${person.id}-${dateKey}`;
                    issues.push({ person, date, targetId });
                }
            }
        }
        return issues;
    }, [sortedPeople, dates, teamRotations, absences, hourlyBlockages, idPrefix]);

    // Detect undefined arrival for Tour (Use the memoized list)
    useEffect(() => {
        // v9 to force show again for user & fix selector issues
        const tourId = 'attendance_undefined_arrival_v9';

        const isCompleted = localStorage.getItem(`tour_completed_${tourId}`);

        if (isCompleted) return;

        // Avoid running on both instances if both are in DOM
        const isMobileView = window.innerWidth < 1024; // Match MD breakpoint or similar
        const isInstanceMobile = idPrefix === 'mobile-';
        if (isMobileView !== isInstanceMobile) {
            return;
        }

        // Only run on Monthly view (approx > 7 days to be safe, usually 28-31)
        if (dates.length < 7) {
            return;
        }

        // Reduced delay for "immediate" feel while ensuring render
        const timer = setTimeout(() => {

            if (undefinedArrivalIssues.length > 0) {
                const firstIssue = undefinedArrivalIssues[0];
                const teamId = firstIssue.person.teamId;

                // Ensure team is expanded
                if (collapsedTeams.has(teamId)) {
                    toggleTeam(teamId);
                    return;
                }

                const targetSelector = firstIssue.targetId;
                const el = document.querySelector(targetSelector) as HTMLElement;


                // Ignore if element is not visible (hidden in mobile/desktop container)
                if (el && el.offsetParent === null) {
                    return;
                }

                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                    setTourSteps([
                        {
                            targetId: targetSelector,
                            title: 'הגדרת שעת הגעה',
                            content: 'שים לב! יום זה מסומן כיום הגעה (חזרה מהבית) אך לא הוזנה שעה. לחץ על המשבצת כדי לעדכן מתי החייל חוזר.',
                            position: 'top'
                        },
                        {
                            targetId: `#${idPrefix}undefined-arrivals-widget`,
                            title: 'ריכוז חריגות',
                            content: 'כל החריגות מרכזות עבורך כאן בוידג\'ט הצף. ניתן ללחוץ עליו כדי לראות את הרשימה המלאה ולנווט במהירות לכל בעיה.',
                            position: 'right'
                        }
                    ]);
                }
            }
        }, 800);

        return () => clearTimeout(timer);
    }, [undefinedArrivalIssues, dates.length, collapsedTeams, idPrefix]);

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
            {/* --- DAILY AGENDA VIEW --- */}
            {(viewMode === 'daily' || !viewMode) && (
                <div className={`flex-1 h-full flex ${viewMode === 'daily' ? '' : 'md:hidden'}`}>
                    <DailyAttendanceView
                        date={currentDate}
                        teams={sortedTeams}
                        people={sortedPeople}
                        teamRotations={teamRotations}
                        absences={absences}
                        hourlyBlockages={hourlyBlockages}
                        companies={companies}
                        collapsedTeams={collapsedTeams}
                        toggleTeam={toggleTeam}
                        onSelectPerson={onSelectPerson}
                        handleCellClick={handleCellClick}
                        globalStats={globalStats}
                        teamStats={teamStats}
                        isViewer={isViewer}
                        hideAbsenceDetails={hideAbsenceDetails}
                        idPrefix={idPrefix}
                    />
                </div>
            )}

            {/* --- MONTHLY TABLE VIEW --- */}
            {(viewMode === 'monthly' || !viewMode) && (
                <div className={`flex-1 flex-col h-full overflow-hidden ${viewMode === 'monthly' ? 'flex' : 'hidden md:flex'}`}>
                    <MonthlyAttendanceTable
                        dates={dates}
                        people={sortedPeople}
                        teams={sortedTeams}
                        teamRotations={teamRotations}
                        absences={absences}
                        hourlyBlockages={hourlyBlockages}
                        tasks={tasks}
                        companies={companies}
                        collapsedTeams={collapsedTeams}
                        toggleTeam={toggleTeam}
                        onSelectPerson={onSelectPerson}
                        handleCellClick={handleCellClick}
                        selection={selection}
                        editingCell={editingCell}
                        showStatistics={showStatistics}
                        showRequiredDetails={showRequiredDetails}
                        onShowTeamStats={onShowTeamStats || (() => { })}
                        onShowPersonStats={onShowPersonStats || (() => { })}
                        isViewer={isViewer}
                        hideAbsenceDetails={hideAbsenceDetails}
                        defaultDepartureHour={defaultDepartureHour}
                        currentTime={currentTime}
                        idPrefix={idPrefix}
                    />
                </div>
            )}

            {
                editingCell && (() => {
                    const person = people.find(p => p.id === editingCell.personId);
                    if (!person) return null;

                    const firstDate = new Date(editingCell.dates[0]); // Ensure date object
                    const availability = getEffectiveAvailability(person, firstDate, teamRotations, absences, hourlyBlockages);

                    // Context for Boundary Days (Arrival/Departure) - Only meaningful if single date
                    const prevDate = new Date(firstDate);
                    prevDate.setDate(prevDate.getDate() - 1);
                    const prevAvailability = getEffectiveAvailability(person, prevDate, teamRotations, absences, hourlyBlockages);

                    const nextDate = new Date(firstDate);
                    nextDate.setDate(nextDate.getDate() + 1);
                    const nextAvailability = getEffectiveAvailability(person, nextDate, teamRotations, absences, hourlyBlockages);

                    return (
                        <StatusEditModal
                            isOpen={!!editingCell}
                            date={editingCell.dates[0]}
                            dates={editingCell.dates}
                            personName={person.name}
                            currentAvailability={availability}
                            prevAvailability={prevAvailability}
                            nextAvailability={nextAvailability}
                            onClose={() => setEditingCell(null)}
                            onApply={handleApplyStatus}
                            defaultArrivalHour={defaultArrivalHour}
                            defaultDepartureHour={defaultDepartureHour}
                        />
                    );
                })()
            }

            <FeatureTour
                steps={tourSteps}
                tourId="attendance_undefined_arrival_v9"
            />

            <UndefinedArrivalsWidget
                issues={undefinedArrivalIssues}
                idPrefix={idPrefix}
                onIssueClick={(issue) => {
                    const issueDateStr = issue.date.toLocaleDateString('en-CA');
                    const contentDateStr = currentDate.toLocaleDateString('en-CA');
                    const teamId = issue.person.teamId;

                    const performScroll = () => {
                        setTimeout(() => {
                            const el = document.querySelector(issue.targetId);
                            if (el) {
                                el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                                // Add a temporary highlight effect
                                el.classList.add('ring-4', 'ring-amber-400', 'z-50');
                                setTimeout(() => el.classList.remove('ring-4', 'ring-amber-400', 'z-50'), 2000);
                            }
                        }, 300); // Wait for expansion/render
                    };

                    // 1. Ensure Team is Expanded
                    if (teamId && collapsedTeams.has(teamId)) {
                        toggleTeam(teamId);
                    }

                    // 2. Handle Date Change if needed
                    if (issueDateStr !== contentDateStr) {
                        onDateChange(issue.date);
                        performScroll();
                    } else {
                        performScroll();
                    }
                }}
            />
        </div>
    );
};
