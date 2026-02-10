import React, { useState, useRef, useEffect } from 'react';
import { Person, Team, TeamRotation, Absence, TaskTemplate } from '@/types';
import { CaretRight as ChevronRight, CaretLeft as ChevronLeft, CaretDown as ChevronDown, CalendarBlank as Calendar, Users, House as Home, MapPin, XCircle, Clock, Info, CheckCircle as CheckCircle2, MagnifyingGlass as Search, WarningCircle as AlertCircle, ChartBar, ListChecks, CheckSquare, X } from '@phosphor-icons/react';
import * as ReactWindow from 'react-window';
// @ts-ignore - handling potential export issues in some environments
const List = (ReactWindow as any).FixedSizeList || (ReactWindow as any).default?.FixedSizeList;
import AutoSizer from '@/components/common/AutoSizer';
import { VirtualRow, VirtualRowData } from './AttendanceTableVirtualRow';
import { getEffectiveAvailability, getRotationStatusForDate, getComputedAbsenceStatus, isPersonPresentAtHour, isStatusPresent, getAttendanceDisplayInfo } from '@/utils/attendanceUtils';
import { getPersonInitials } from '@/utils/nameUtils';
import { StatusEditModal } from './StatusEditModal';
import { LiveIndicator } from '@/components/attendance/LiveIndicator';
import { logger } from '@/services/loggingService';

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
    onUpdateAvailability?: (personId: string, date: string | string[], status: 'base' | 'home' | 'unavailable', customTimes?: { start: string, end: string }, unavailableBlocks?: { id: string, start: string, end: string, reason?: string }[], homeStatusType?: import('@/types').HomeStatusType, actualTimes?: { arrival?: string, departure?: string }) => Promise<void> | void;
    viewMode?: 'daily' | 'monthly';
    className?: string;
    isViewer?: boolean;
    searchTerm?: string;
    showRequiredDetails?: boolean;
    companies?: import('@/types').Organization[];
    hideAbsenceDetails?: boolean;
    defaultArrivalHour?: string;
    defaultDepartureHour?: string;
    showStatistics?: boolean;
    onShowPersonStats?: (person: Person) => void;
    onShowTeamStats?: (team: Team) => void;
    onViewHistory?: (personId: string, date: string) => void;
    externalEditingCell?: { personId: string; dates: string[] } | null;
    onClearExternalEdit?: () => void;
    groupByCompany?: boolean;
    isAttendanceReportingEnabled?: boolean;
    isMultiSelectMode?: boolean;
    setIsMultiSelectMode?: (val: boolean) => void;
    defaultEngineVersion?: import('@/types').Organization['engine_version']; // NEW: Fallback engine version
}

export const AttendanceTable: React.FC<AttendanceTableProps> = ({
    teams, people, teamRotations, absences, hourlyBlockages = [], tasks = [], currentDate, onDateChange, onSelectPerson, onUpdateAvailability, onViewHistory, className, viewMode, isViewer = false, searchTerm = '', showRequiredDetails = false, companies = [], hideAbsenceDetails = false,
    defaultArrivalHour = '10:00', defaultDepartureHour = '14:00',
    showStatistics = false, onShowPersonStats, onShowTeamStats,
    externalEditingCell, onClearExternalEdit,
    groupByCompany = false,
    isAttendanceReportingEnabled = true,
    isMultiSelectMode = false,
    setIsMultiSelectMode,
    defaultEngineVersion
}) => {
    const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(() => new Set(teams.map(t => t.id)));
    const [collapsedCompanies, setCollapsedCompanies] = useState<Set<string>>(new Set());
    const [editingCell, setEditingCell] = useState<{ personId: string; dates: string[] } | null>(null);
    const [selection, setSelection] = useState<Record<string, string[]>>({});

    // Unified scroll synchronization ref
    const mainScrollRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const lastLogTime = useRef<number>(0);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const dates = [];
    for (let d = 1; d <= daysInMonth; d++) {
        dates.push(new Date(year, month, d));
    }

    const weekDaysShort = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

    // Dynamic width constants based on responsive breakpoints
    const is2xl = typeof window !== 'undefined' && window.innerWidth >= 1536;
    const isMd = typeof window !== 'undefined' && window.innerWidth >= 768;
    const headerWidth = is2xl ? 208 : 192; // 2xl:w-52 vs w-48
    const statsWidth = showStatistics ? 168 : 0;
    const dayWidth = isMd ? 96 : 80; // md:w-24 vs w-20
    const totalContentWidth = headerWidth + statsWidth + (dates.length * dayWidth);

    useEffect(() => {
        if (externalEditingCell) {
            setEditingCell(externalEditingCell);
            onClearExternalEdit?.();
        }
    }, [externalEditingCell, onClearExternalEdit]);

    const filteredPeople = React.useMemo(() => {
        const activeOnly = people.filter(p => p.isActive !== false);
        if (!searchTerm?.trim()) return activeOnly;
        return activeOnly.filter(p => p.name.includes(searchTerm) || (p.phone && p.phone.includes(searchTerm)));
    }, [people, searchTerm]);

    const sortedPeople = React.useMemo(() => {
        return [...filteredPeople].sort((a, b) => a.name.localeCompare(b.name, 'he'));
    }, [filteredPeople]);

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

    const groupedTeamsByCompany = React.useMemo(() => {
        if (!groupByCompany || !companies || companies.length === 0) return null;
        const groups: { company: import('@/types').Organization; teams: Team[] }[] = [];
        const sortedCompanies = [...companies].sort((a, b) => a.name.localeCompare(b.name, 'he'));
        sortedCompanies.forEach(company => {
            const companyTeams = teams
                .filter(t => t.organization_id === company.id)
                .sort((a, b) => a.name.localeCompare(b.name, 'he'));
            if (companyTeams.length > 0) {
                groups.push({ company, teams: companyTeams });
            }
        });
        const orphanedTeams = teams
            .filter(t => !t.organization_id || !companies.find(c => c.id === t.organization_id))
            .sort((a, b) => a.name.localeCompare(b.name, 'he'));
        if (orphanedTeams.length > 0) {
            groups.push({
                company: { id: 'orphaned', name: 'אחר', organization_id: '', type: 'company' } as any,
                teams: orphanedTeams
            });
        }
        return groups;
    }, [teams, companies, groupByCompany]);

    const toggleCompany = (companyId: string) => {
        setCollapsedCompanies(prev => {
            const next = new Set(prev);
            if (next.has(companyId)) next.delete(companyId);
            else next.add(companyId);
            return next;
        });
    };

    const toggleTeam = (teamId: string) => {
        setCollapsedTeams(prev => {
            const next = new Set(prev);
            if (next.has(teamId)) next.delete(teamId);
            else next.add(teamId);
            return next;
        });
    };

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const isCell = target.closest('[data-testid^="attendance-cell-"]');
            const isActionBar = target.closest('[data-testid="selection-action-bar"]');
            const isModal = target.closest('.fixed.inset-0'); // StatusEditModal usually uses this

            if (!isCell && !isActionBar && !isModal) {
                setSelection({});
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleCellClick = React.useCallback((e: React.MouseEvent, person: Person, date: Date) => {
        if (!onUpdateAvailability) return;
        const dateStr = date.toLocaleDateString('en-CA');
        console.log('[AttendanceTable] handleCellClick:', { personName: person.name, dateStr, dateObj: date.toString() });

        if (isMultiSelectMode || e.ctrlKey || e.metaKey) {
            setSelection(prev => {
                const currentDates = prev[person.id] || [];
                const newDates = currentDates.includes(dateStr)
                    ? currentDates.filter(d => d !== dateStr)
                    : [...currentDates, dateStr];

                const newSelection = { ...prev };
                if (newDates.length > 0) {
                    newSelection[person.id] = newDates;
                } else {
                    delete newSelection[person.id];
                }
                return newSelection;
            });
            return;
        }

        if (e.shiftKey) {
            setSelection(prev => {
                const currentDates = prev[person.id] || [];
                if (currentDates.length > 0) {
                    const lastDateStr = currentDates[currentDates.length - 1];
                    const start = new Date(lastDateStr);
                    const end = new Date(dateStr);
                    const rangeDates: string[] = [];
                    const current = new Date(Math.min(start.getTime(), end.getTime()));
                    const final = new Date(Math.max(start.getTime(), end.getTime()));
                    while (current <= final) {
                        rangeDates.push(current.toLocaleDateString('en-CA'));
                        current.setDate(current.getDate() + 1);
                    }
                    const uniqueDates = Array.from(new Set([...currentDates, ...rangeDates]));
                    return { ...prev, [person.id]: uniqueDates };
                } else {
                    return { ...prev, [person.id]: [dateStr] };
                }
            });
            return;
        }

        if (selection[person.id]?.includes(dateStr)) {
            setEditingCell({ personId: person.id, dates: selection[person.id] });
            setSelection({});
            return;
        }

        setEditingCell({ personId: person.id, dates: [dateStr] });
        setSelection({});
        logger.trace('CLICK', `Opened attendance status editor for ${person.name} on ${dateStr}`, { personId: person.id, date: dateStr });
    }, [onUpdateAvailability, isMultiSelectMode, selection, setSelection, setEditingCell]);

    const handleApplyStatus = async (status: 'base' | 'home', customTimes?: { start: string, end: string }, unavailableBlocks?: { id: string, start: string, end: string, reason?: string }[], homeStatusType?: import('@/types').HomeStatusType, rangeDates?: string[], actualTimes?: { arrival?: string, departure?: string }) => {
        if (!editingCell || !onUpdateAvailability) return;
        const datesToUpdate = rangeDates && rangeDates.length > 0 ? rangeDates : editingCell.dates;
        await onUpdateAvailability(editingCell.personId, datesToUpdate, status, customTimes, unavailableBlocks, homeStatusType, actualTimes);
        setEditingCell(null);
    };

    // Intentionally disabled: avoid auto-scroll/jump when selecting a cell in monthly view.

    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const isToday = new Date().toDateString() === currentDate.toDateString();
        if (!isToday) return;
        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, 60000);
        return () => clearInterval(interval);
    }, [currentDate]);

    const peopleByTeam = React.useMemo(() => {
        const map: Record<string, Person[]> = {};
        sortedPeople.forEach(p => {
            if (!map[p.teamId]) map[p.teamId] = [];
            map[p.teamId].push(p);
        });
        return map;
    }, [sortedPeople]);

    const globalStats = React.useMemo(() => {
        const totalPeople = sortedPeople.length;
        let presentCount = 0;
        const isToday = new Date().toDateString() === currentDate.toDateString();
        const refTime = isToday
            ? `${currentTime.getHours().toString().padStart(2, '0')}:${currentTime.getMinutes().toString().padStart(2, '0')}`
            : '12:00';

        sortedPeople.forEach(p => {
            const engineVersion = companies.find(c => c.id === p.organization_id)?.engine_version || defaultEngineVersion;
            if (isPersonPresentAtHour(p, currentDate, refTime, teamRotations, absences, hourlyBlockages, engineVersion)) {
                presentCount++;
            }
        });
        return { present: presentCount, total: totalPeople };
    }, [sortedPeople, currentDate, teamRotations, absences, hourlyBlockages, currentTime]);

    const presenceMap = React.useMemo(() => {
        const map: Record<string, Record<string, boolean>> = {};

        const absencesByPerson: Record<string, Absence[]> = {};
        absences.forEach(a => {
            if (!absencesByPerson[a.person_id]) absencesByPerson[a.person_id] = [];
            absencesByPerson[a.person_id].push(a);
        });

        const blockagesByPerson: Record<string, any[]> = {};
        hourlyBlockages.forEach(b => {
            if (!blockagesByPerson[b.person_id]) blockagesByPerson[b.person_id] = [];
            blockagesByPerson[b.person_id].push(b);
        });

        const rotationByTeam: Record<string, TeamRotation> = {};
        teamRotations.forEach(r => {
            rotationByTeam[r.team_id] = r;
        });

        sortedPeople.forEach(p => {
            const pAbsences = absencesByPerson[p.id] || [];
            const pBlockages = blockagesByPerson[p.id] || [];
            const pRotation = p.teamId ? [rotationByTeam[p.teamId]].filter(Boolean) : [];

            map[p.id] = {};
            dates.forEach(date => {
                const dateKey = date.toLocaleDateString('en-CA');
                const isToday = new Date().toDateString() === date.toDateString();

                let refTime = '12:00';
                if (isToday) {
                    refTime = `${currentTime.getHours().toString().padStart(2, '0')}:${currentTime.getMinutes().toString().padStart(2, '0')}`;
                }

                const engineVersion = companies.find(c => c.id === p.organization_id)?.engine_version || defaultEngineVersion;
                map[p.id][dateKey] = isPersonPresentAtHour(p, date, refTime, pRotation, pAbsences, pBlockages, engineVersion);
            });
        });

        return map;
    }, [sortedPeople, dates, teamRotations, absences, hourlyBlockages, currentTime]);

    const teamStats = React.useMemo(() => {
        const stats: Record<string, { present: number; total: number }> = {};
        const isToday = new Date().toDateString() === currentDate.toDateString();
        const dateKey = currentDate.toLocaleDateString('en-CA');

        teams.forEach(team => {
            const members = peopleByTeam[team.id] || [];
            let present = 0;
            members.forEach(p => {
                if (isToday) {
                    const refTime = `${currentTime.getHours().toString().padStart(2, '0')}:${currentTime.getMinutes().toString().padStart(2, '0')}`;
                    const engineVersion = companies.find(c => c.id === p.organization_id)?.engine_version || defaultEngineVersion;
                    if (isPersonPresentAtHour(p, currentDate, refTime, teamRotations, absences, hourlyBlockages, engineVersion)) {
                        present++;
                    }
                } else {
                    if (presenceMap[p.id]?.[dateKey]) {
                        present++;
                    }
                }
            });
            stats[team.id] = { present, total: members.length };
        });
        return stats;
    }, [teams, peopleByTeam, currentDate, teamRotations, absences, hourlyBlockages, currentTime, presenceMap]);

    const dailyTeamStats = React.useMemo(() => {
        const stats: Record<string, Record<string, { present: number; total: number }>> = {};
        teams.forEach(team => {
            stats[team.id] = {};
            const members = peopleByTeam[team.id] || [];
            dates.forEach(date => {
                const dateKey = date.toLocaleDateString('en-CA');
                let present = 0;
                members.forEach(p => {
                    if (presenceMap[p.id]?.[dateKey]) {
                        present++;
                    }
                });
                stats[team.id][dateKey] = { present, total: members.length };
            });
        });
        return stats;
    }, [teams, peopleByTeam, dates, presenceMap]);

    const dailyCompanyStats = React.useMemo(() => {
        const stats: Record<string, Record<string, { present: number; total: number }>> = {};
        if (!groupByCompany || !companies) return stats;

        companies.forEach(company => {
            stats[company.id] = {};
            const itemTeams = teams.filter(t => t.organization_id === company.id);
            const members: Person[] = [];
            itemTeams.forEach(t => {
                members.push(...(peopleByTeam[t.id] || []));
            });

            dates.forEach(date => {
                const dateKey = date.toLocaleDateString('en-CA');
                let present = 0;
                members.forEach(p => {
                    if (presenceMap[p.id]?.[dateKey]) {
                        present++;
                    }
                });
                stats[company.id][dateKey] = { present, total: members.length };
            });
        });
        return stats;
    }, [companies, peopleByTeam, teams, dates, groupByCompany, presenceMap]);

    const dailyTotalStats = React.useMemo(() => {
        const stats: Record<string, { present: number; total: number }> = {};
        dates.forEach(date => {
            const dateKey = date.toLocaleDateString('en-CA');
            let present = 0;
            sortedPeople.forEach(p => {
                if (presenceMap[p.id]?.[dateKey]) {
                    present++;
                }
            });
            stats[dateKey] = { present, total: sortedPeople.length };
        });
        return stats;
    }, [dates, sortedPeople, presenceMap]);

    const dailyRequirements = React.useMemo(() => {
        const reqs: Record<string, number> = {};
        dates.forEach(date => {
            const dateKey = date.toLocaleDateString('en-CA');
            let totalRequired = 0;
            const weekDaysEng = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

            tasks.forEach(task => {
                if (task.startDate && new Date(task.startDate) > date) return;
                if (task.endDate && new Date(task.endDate) < date) return;

                task.segments.forEach(segment => {
                    let isActive = false;
                    if (segment.frequency === 'daily') isActive = true;
                    else if (segment.frequency === 'weekly' && segment.daysOfWeek?.includes(weekDaysEng[date.getDay()])) isActive = true;
                    else if (segment.frequency === 'specific_date' && segment.specificDate === dateKey) isActive = true;

                    if (isActive) {
                        totalRequired += segment.requiredPeople;
                    }
                });
            });
            reqs[dateKey] = totalRequired;
        });
        return reqs;
    }, [dates, tasks]);

    const flattenedItems = React.useMemo(() => {
        if (viewMode !== 'monthly' && viewMode !== undefined) return [];

        const items: any[] = [];
        if (groupByCompany && groupedTeamsByCompany) {
            groupedTeamsByCompany.forEach(({ company, teams: companyTeams }) => {
                const isCompanyCollapsed = collapsedCompanies.has(company.id);
                const companyPeople: Person[] = [];
                companyTeams.forEach(t => {
                    companyPeople.push(...(peopleByTeam[t.id] || []));
                });

                if (companyPeople.length === 0) return;
                items.push({ type: 'company-header', id: `company-${company.id}`, company, count: companyPeople.length });

                if (!isCompanyCollapsed) {
                    companyTeams.forEach(team => {
                        const teamPeople = peopleByTeam[team.id] || [];
                        if (teamPeople.length === 0) return;
                        const isTeamCollapsed = collapsedTeams.has(team.id);
                        items.push({ type: 'team-header', id: `team-${team.id}`, team, membersCount: teamPeople.length, stats: teamStats[team.id] });
                        if (!isTeamCollapsed) {
                            teamPeople.forEach(person => {
                                items.push({ type: 'person-row', id: `person-${person.id}`, person, team });
                            });
                        }
                    });
                }
            });
        } else {
            sortedTeams.forEach(team => {
                const teamPeople = peopleByTeam[team.id] || [];
                if (teamPeople.length === 0) return;
                const isTeamCollapsed = collapsedTeams.has(team.id);
                items.push({ type: 'team-header', id: `team-${team.id}`, team, membersCount: teamPeople.length, stats: teamStats[team.id] });
                if (!isTeamCollapsed) {
                    teamPeople.forEach(person => {
                        items.push({ type: 'person-row', id: `person-${person.id}`, person, team });
                    });
                }
            });
        }
        return items;
    }, [groupByCompany, groupedTeamsByCompany, sortedTeams, peopleByTeam, collapsedCompanies, collapsedTeams, teamStats, viewMode]);

    useEffect(() => {
        const attemptScroll = (retryCount = 0) => {
            const container = (viewMode === 'monthly' || !viewMode) ? mainScrollRef.current : scrollContainerRef.current;
            if (container) {
                const today = new Date();
                if (today.getMonth() === month && today.getFullYear() === year) {
                    const scrollPos = (today.getDate() - 1) * dayWidth;
                    const targetScroll = -scrollPos;
                    container.scrollLeft = targetScroll;
                    setTimeout(() => {
                        if (container && Math.abs(container.scrollLeft - targetScroll) > 10 && retryCount < 3) {
                            attemptScroll(retryCount + 1);
                        }
                    }, 50);
                }
            } else if (retryCount < 15) {
                setTimeout(() => attemptScroll(retryCount + 1), 100);
            }
        };
        attemptScroll();
    }, [month, year, viewMode, flattenedItems.length, dayWidth]);

    const getItemSize = (index: number) => {
        const item = flattenedItems[index];
        if (!item) return 80;
        if (item.type === 'company-header' || item.type === 'team-header') return 48;
        return 80;
    };

    const itemData = React.useMemo(() => ({
        items: flattenedItems, dates, currentDate, currentTime, teamRotations, absences, hourlyBlockages, collapsedTeams, toggleTeam, collapsedCompanies, toggleCompany, onSelectPerson, onShowPersonStats, handleCellClick, editingCell, selection, showStatistics, showRequiredDetails, companies, hideAbsenceDetails, defaultArrivalHour, defaultDepartureHour, onShowTeamStats, isViewer, totalContentWidth, headerWidth, statsWidth, dayWidth, dailyTeamStats, dailyCompanyStats, dailyTotalStats, dailyRequirements, sortedPeople, isAttendanceReportingEnabled, defaultEngineVersion
    }), [flattenedItems, dates, currentDate, currentTime, teamRotations, absences, hourlyBlockages, collapsedTeams, collapsedCompanies, editingCell, selection, handleCellClick, isMultiSelectMode, showStatistics, showRequiredDetails, companies, hideAbsenceDetails, defaultArrivalHour, defaultDepartureHour, isViewer, totalContentWidth, headerWidth, statsWidth, dayWidth, dailyTeamStats, dailyCompanyStats, dailyTotalStats, dailyRequirements, sortedPeople, isAttendanceReportingEnabled, defaultEngineVersion]);

    const renderTeamDailyRow = (team: Team, members: Person[]) => {
        return (
            <div key={team.id} className="relative">
                <div onClick={() => toggleTeam(team.id)} className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-2.5 flex items-center justify-between cursor-pointer group transition-all h-[60px]">
                    <div className="flex items-center gap-3">
                        <div className="w-1 h-7 rounded-full" style={{ backgroundColor: team.color?.startsWith('#') ? team.color : '#3b82f6' }} />
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
                </div>
                {!collapsedTeams.has(team.id) && (
                    <div className="bg-white divide-y divide-slate-50 shadow-inner">
                        {members.map((person, index) => {
                            const engineVersion = companies.find(c => c.id === person.organization_id)?.engine_version || defaultEngineVersion;


                            const displayInfo = getAttendanceDisplayInfo(person, currentDate, teamRotations, absences, hourlyBlockages, engineVersion);


                            let statusConfig = { label: 'לא ידוע', bg: 'bg-white text-slate-400 ring-1 ring-slate-100', dot: 'bg-slate-300', icon: Info };
                            if (displayInfo.displayStatus === 'missing_departure') {
                                statusConfig = { label: displayInfo.label, bg: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100/50', dot: 'bg-rose-500', icon: AlertCircle };
                            } else if (displayInfo.displayStatus === 'missing_arrival') {
                                statusConfig = { label: displayInfo.label, bg: 'bg-amber-50 text-amber-800 ring-1 ring-amber-100/50', dot: 'bg-rose-500', icon: AlertCircle };
                            } else if (displayInfo.isBase) {
                                statusConfig = { label: displayInfo.label, bg: displayInfo.displayStatus === 'arrival' || displayInfo.displayStatus === 'single_day' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 ring-0' : displayInfo.displayStatus === 'departure' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20 ring-0' : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100/50', dot: 'bg-white', icon: (displayInfo.displayStatus === 'arrival' || displayInfo.displayStatus === 'single_day') ? MapPin : displayInfo.displayStatus === 'departure' ? MapPin : CheckCircle2 };
                            } else if (displayInfo.displayStatus === 'home') {
                                statusConfig = { label: displayInfo.label, bg: 'bg-red-50 text-red-600 ring-1 ring-red-100', dot: 'bg-red-500', icon: Home };
                            } else if (displayInfo.displayStatus === 'unavailable') {
                                statusConfig = { label: displayInfo.label, bg: 'bg-amber-50 text-amber-700 ring-1 ring-amber-100', dot: 'bg-amber-500', icon: Clock };
                            } else if (displayInfo.displayStatus === 'not_defined') {
                                statusConfig = { label: 'לא הוגדר', bg: 'bg-slate-50 text-slate-400 ring-1 ring-slate-100/50', dot: 'bg-slate-300', icon: Info };
                            }

                            return (
                                <div key={person.id} onClick={(e) => handleCellClick(e, person, currentDate)} className="flex items-center justify-between px-3 md:px-6 py-3 md:py-5 bg-white hover:bg-slate-50/80 active:bg-slate-100 transition-all min-h-[64px] md:min-h-[80px] cursor-pointer group border-b border-slate-50 gap-2 md:gap-4">
                                    <div className="flex items-center gap-2.5 md:gap-4 shrink-0 min-w-0 bg-inherit relative z-10 cursor-pointer" onClick={(e) => { e.stopPropagation(); onSelectPerson(person); }}>
                                        <div className="w-9 h-9 md:w-12 md:h-12 rounded-2xl flex items-center justify-center text-[11px] md:text-sm font-black text-white shadow-lg group-hover:shadow-blue-500/10 group-active:scale-95 transition-all shrink-0" style={{ backgroundColor: team.color?.startsWith('#') ? team.color : '#3b82f6', backgroundImage: `linear-gradient(135deg, ${team.color || '#3b82f6'}, ${team.color || '#3b82f6'}cc)` }}>
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
                                    <div className="flex-1 mx-2 md:mx-6 h-px border-t border-dashed border-slate-100 transition-all duration-300 group-hover:border-slate-200" />
                                    <div className="flex items-center gap-2 md:gap-4 shrink-0 min-w-0 bg-inherit relative z-10">
                                        <div className={`flex items-center gap-1 md:gap-2 px-2.5 py-1.5 md:px-4 md:py-2.5 rounded-xl md:rounded-2xl font-black text-[9px] md:text-xs shrink-0 ${statusConfig.bg} transition-all shadow-sm ring-1 ring-black/5 order-2`}>
                                            <statusConfig.icon size={13} weight="bold" className="shrink-0" />
                                            <span className="whitespace-nowrap tracking-tight">{statusConfig.label}</span>
                                            {displayInfo.hasContinuityWarning && (
                                                <div className="absolute -top-1 -right-1 flex items-center justify-center">
                                                    <div className="w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white animate-pulse" />
                                                </div>
                                            )}
                                        </div>

                                        {isAttendanceReportingEnabled && (displayInfo.actual_arrival_at || displayInfo.actual_departure_at) && (
                                            <div className="flex flex-col items-end gap-1 order-1">
                                                {displayInfo.actual_arrival_at && (
                                                    <LiveIndicator
                                                        type="arrival"
                                                        size="sm"
                                                        time={new Date(displayInfo.actual_arrival_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                                        locationName={displayInfo.reported_location_name}
                                                    />
                                                )}
                                                {displayInfo.actual_departure_at && (
                                                    <LiveIndicator
                                                        type="departure"
                                                        size="sm"
                                                        time={new Date(displayInfo.actual_departure_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                                        locationName={displayInfo.reported_location_name}
                                                    />
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className={`h-full flex flex-col relative ${className || ''}`} dir="rtl" data-component="AttendanceTable">
            {/* Daily View */}
            {(viewMode === 'daily' || !viewMode) && (
                <div className={`flex-1 overflow-y-auto custom-scrollbar bg-slate-50/40 pb-32 ${viewMode === 'daily' ? '' : 'md:hidden'}`} ref={scrollContainerRef}>
                    <div className="max-w-5xl mx-auto bg-white min-h-full shadow-sm border-x border-slate-100">
                        <div className="bg-white p-4.5 m-3 mt-4 rounded-3xl shadow-xl shadow-slate-200/40 border border-slate-100 relative overflow-hidden group">
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
                            <div className="relative z-10 w-full h-2.5 bg-slate-50 rounded-full overflow-hidden border border-slate-100 mb-4 p-0.5 shadow-inner">
                                <div className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-1000 ease-out shadow-sm" style={{ width: `${(globalStats.present / (globalStats.total || 1)) * 100}%` }} />
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
                            {groupByCompany && groupedTeamsByCompany ? (
                                groupedTeamsByCompany.map(({ company, teams: companyTeams }) => {
                                    const isCompCollapsed = collapsedCompanies.has(company.id);
                                    const compPeople = sortedPeople.filter(p => companyTeams.some(t => t.id === p.teamId));
                                    if (compPeople.length === 0) return null;
                                    return (
                                        <div key={company.id} className="mb-4">
                                            <div onClick={() => toggleCompany(company.id)} className="bg-slate-100/80 backdrop-blur-sm px-4 py-3 flex items-center justify-between cursor-pointer border-y border-slate-200">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-sm shadow-sm">{company.name.charAt(0)}</div>
                                                    <div>
                                                        <h3 className="text-sm font-black text-slate-900 leading-none">{company.name}</h3>
                                                        <p className="text-[10px] font-bold text-slate-500 mt-1">{compPeople.length} חיילים ב-{companyTeams.length} צוותים</p>
                                                    </div>
                                                </div>
                                                <div className="w-6 h-6 rounded-full bg-white/50 flex items-center justify-center">
                                                    {isCompCollapsed ? <ChevronLeft size={14} className="text-slate-400" weight="bold" /> : <ChevronDown size={14} className="text-blue-600" weight="bold" />}
                                                </div>
                                            </div>
                                            {!isCompCollapsed && (
                                                <div className="divide-y divide-slate-50">
                                                    {companyTeams.map(team => {
                                                        const members = sortedPeople.filter(p => p.teamId === team.id);
                                                        if (members.length === 0) return null;
                                                        return renderTeamDailyRow(team, members);
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            ) : (
                                sortedTeams.map(team => {
                                    const members = sortedPeople.filter(p => p.teamId === team.id);
                                    if (members.length === 0) return null;
                                    return renderTeamDailyRow(team, members);
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Monthly View (Virtualized Unified Scroll) */}
            {(viewMode === 'monthly' || !viewMode) && (
                <div className={`flex-1 flex-col h-full overflow-hidden animate-fadeIn ${viewMode === 'monthly' ? 'flex' : 'hidden md:flex'}`}>
                    {showStatistics && (
                        <div className="mx-6 mt-6 mb-2 p-4 bg-gradient-to-l from-blue-600 to-indigo-700 rounded-2xl shadow-lg border border-white/10 text-white relative overflow-hidden group shrink-0">
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
                                        <div className="text-xl font-black">{Math.round(people.filter(p => p.isActive !== false).length * 0.85)} <span className="text-xs opacity-60">לוחמים</span></div>
                                    </div>
                                </div>
                                <button onClick={() => onShowTeamStats?.({ id: 'all', name: 'כל הפלוגה', organization_id: '', color: 'bg-slate-500' } as Team)} className="bg-white text-blue-700 px-8 py-3 rounded-xl font-black text-sm hover:bg-blue-50 transition-all shadow-xl active:scale-95 shrink-0">פירוט נוסף</button>
                            </div>
                        </div>
                    )}

                    <div className="flex-1 relative h-full flex flex-col overflow-hidden">
                        <div ref={mainScrollRef} className="flex-1 overflow-auto custom-scrollbar" style={{ width: '100%' }}>
                            <div className="min-w-max flex flex-col">
                                {/* --- MAIN STICKY HEADER BLOCK --- */}
                                <div className="flex flex-col bg-white shrink-0 select-none sticky top-0 z-[200] border-b border-slate-200 shadow-sm">
                                    {/* 1. Main Date Header */}
                                    <div className="flex bg-white relative">
                                        <div className="flex sticky right-0 z-[220] bg-white shrink-0 border-b border-slate-200" style={{ width: headerWidth + statsWidth }}>
                                            <div className="shrink-0 bg-white border-l border-slate-200 flex items-center justify-between px-3 md:px-4 py-3 md:py-4 font-black text-slate-400 text-xs uppercase tracking-widest h-14 md:h-16" style={{ width: headerWidth }}>
                                                <span>שם הלוחם</span>
                                            </div>
                                            {showStatistics && (
                                                <>
                                                    <div className="w-14 shrink-0 bg-white border-l border-slate-200 flex items-center justify-center font-black text-[10px] text-slate-400 uppercase tracking-widest h-14 md:h-16">בסיס</div>
                                                    <div className="w-14 shrink-0 bg-white border-l border-slate-200 flex items-center justify-center font-black text-[10px] text-slate-400 uppercase tracking-widest h-14 md:h-16">בבית</div>
                                                    <div className="w-14 shrink-0 bg-white border-l border-slate-200 flex items-center justify-center font-black text-[10px] text-slate-400 uppercase tracking-widest h-14 md:h-16">יחס</div>
                                                </>
                                            )}
                                        </div>
                                        <div className="flex border-b border-slate-200">
                                            {dates.map((date) => {
                                                const isToday = new Date().toDateString() === date.toDateString();
                                                const isWeekend = date.getDay() === 6;
                                                return (
                                                    <div key={date.toISOString()} className={`shrink-0 flex flex-col items-center justify-center border-l border-slate-100 transition-all relative ${isToday ? 'bg-blue-600 text-white z-10' : isWeekend ? 'bg-slate-50' : 'bg-white'}`} style={{ width: dayWidth, height: window.innerWidth >= 768 ? 64 : 56 }}>
                                                        <span className={`text-[10px] md:text-[11px] font-black uppercase mb-0.5 ${isToday ? 'text-blue-100' : isWeekend ? 'text-slate-500' : 'text-slate-400'}`}>{weekDaysShort[date.getDay()]}</span>
                                                        <span className={`text-lg md:text-xl font-black ${isToday ? 'text-white' : 'text-slate-800'}`}>{date.getDate()}</span>
                                                        {isToday && <div className="absolute top-0 right-0 left-0 h-1 bg-white/30" />}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* 2. Requirements Row */}
                                    {showRequiredDetails && (
                                        <div className="flex bg-white h-12 relative border-b border-slate-200">
                                            <div className="flex sticky right-0 z-[215] bg-white shrink-0" style={{ width: headerWidth + statsWidth }}>
                                                <div className="shrink-0 bg-rose-50 border-l border-rose-100 h-full flex items-center gap-2 px-3 md:px-4" style={{ width: headerWidth }}>
                                                    <AlertCircle size={14} className="text-rose-500" weight="bold" />
                                                    <span className="text-xs md:text-sm font-black text-rose-900 tracking-tight">דרישות למשימות</span>
                                                </div>
                                                {showStatistics && <div className="flex-1 bg-rose-50/50" />}
                                            </div>
                                            <div className="flex h-full">
                                                {dates.map(date => {
                                                    const dateKey = date.toISOString().split('T')[0];
                                                    const required = dailyRequirements[dateKey] || 0;
                                                    const present = dailyTotalStats[dateKey]?.present || 0;
                                                    const diff = present - required;
                                                    const isDeficit = diff < 0;

                                                    return (
                                                        <div key={dateKey} className="shrink-0 flex flex-col items-center justify-center border-l border-slate-100 h-full bg-rose-50/30 text-xs font-bold relative" style={{ width: dayWidth }}>
                                                            <span className="text-rose-700 font-black text-sm">{required}</span>
                                                            {isDeficit && required > 0 && <span className="text-[9px] text-red-500 font-bold bg-red-100 px-1 rounded absolute top-1 right-1">חסר {Math.abs(diff)}</span>}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* 3. Summary Stats Row */}
                                    <div className="flex bg-white h-12 relative">
                                        <div className="flex sticky right-0 z-[210] bg-white shrink-0 shadow-[4px_0_8px_rgba(0,0,0,0.05)]" style={{ width: headerWidth + statsWidth }} onClick={() => onShowTeamStats?.({ id: 'all', name: 'כל הפלוגה' } as Team)}>
                                            <div className="shrink-0 bg-slate-50 border-l border-slate-200 h-full flex items-center gap-2 px-3 md:px-4 cursor-pointer hover:bg-blue-50 transition-colors" style={{ width: headerWidth }}>
                                                <Users size={14} className="text-blue-600" weight="bold" />
                                                <span className="text-sm md:text-base font-black text-slate-900 tracking-tight">סך הכל פלוגה</span>
                                            </div>
                                            {showStatistics && (
                                                <>
                                                    {(() => {
                                                        let totalPresentDays = 0;
                                                        dates.forEach(d => {
                                                            const key = d.toISOString().split('T')[0];
                                                            totalPresentDays += dailyTotalStats[key]?.present || 0;
                                                        });
                                                        const baseAvg = sortedPeople.length > 0 ? totalPresentDays / sortedPeople.length : 0;
                                                        const homeAvg = dates.length - baseAvg;
                                                        const homeAvgNorm = Math.round((homeAvg / dates.length) * 14);
                                                        const baseAvgNorm = 14 - homeAvgNorm;

                                                        return (
                                                            <>
                                                                <div className="w-14 shrink-0 bg-emerald-50 border-l border-emerald-100 h-full flex flex-col items-center justify-center group">
                                                                    <span className="text-xs font-black text-emerald-700">{Math.round(baseAvg)}</span>
                                                                    <ChartBar size={10} className="text-emerald-400 group-hover:text-emerald-600 mt-0.5" weight="bold" />
                                                                </div>
                                                                <div className="w-14 shrink-0 bg-red-50 border-l border-red-100 h-full flex flex-col items-center justify-center group">
                                                                    <span className="text-xs font-black text-red-700">{Math.round(homeAvg)}</span>
                                                                    <ChartBar size={10} className="text-red-300 group-hover:text-red-500 mt-0.5" weight="bold" />
                                                                </div>
                                                                <div className="w-14 shrink-0 bg-blue-50 border-l border-blue-100 h-full flex flex-col items-center justify-center group" dir="ltr">
                                                                    <span className="text-[10px] font-black text-blue-700">{homeAvgNorm}/{baseAvgNorm}</span>
                                                                    <ChartBar size={10} className="text-blue-300 group-hover:text-blue-500 mt-0.5" weight="bold" />
                                                                </div>
                                                            </>
                                                        );
                                                    })()}
                                                </>
                                            )}
                                        </div>
                                        <div className="flex">
                                            {dates.map(date => {
                                                const dateKey = date.toLocaleDateString('en-CA');
                                                const stat = dailyTotalStats[dateKey];
                                                const present = stat?.present || 0;
                                                const total = stat?.total || 1;
                                                const ratio = present / (total || 1);
                                                let colorClass = 'text-red-700 bg-red-100/50';
                                                if (ratio >= 0.8) colorClass = 'text-emerald-700 bg-emerald-100/50';
                                                else if (ratio >= 0.5) colorClass = 'text-amber-700 bg-amber-100/50';

                                                return (
                                                    <div key={date.toISOString()} className={`shrink-0 border-l border-slate-300 h-full flex items-center justify-center font-black text-[13px] ${colorClass}`} style={{ width: dayWidth }} dir="ltr">
                                                        {present} / {total}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                {/* Native List Rendering (No Virtualization for perfect stickiness) */}
                                <div className="flex flex-col">
                                    {flattenedItems.map((item, index) => (
                                        <VirtualRow
                                            key={item.id || index}
                                            index={index}
                                            style={{
                                                height: getItemSize(index),
                                                width: totalContentWidth,
                                                position: 'relative' // Use relative instead of absolute for native flow
                                            }}
                                            {...itemData}
                                            selection={selection}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {editingCell && (
                <StatusEditModal
                    isOpen={!!editingCell}
                    date={editingCell.dates[0]}
                    dates={editingCell.dates}
                    personId={editingCell.personId}
                    personName={people.find(p => p.id === editingCell.personId)?.name}
                    currentAvailability={(() => {
                        const p = people.find(p => p.id === editingCell.personId);
                        return p ? getEffectiveAvailability(p, new Date(editingCell.dates[0]), teamRotations, absences, hourlyBlockages) : undefined;
                    })()}
                    onClose={() => setEditingCell(null)}
                    onApply={async (status, customTimes, unavailableBlocks, homeStatusType, rangeDates, actualTimes) => {
                        // Bulk Apply Logic
                        if (editingCell && Object.keys(selection).length > 0) {
                            // If we came from multi-update mode (selection is not empty)
                            const updates = Object.entries(selection).map(([pId, dates]) => {
                                const p = people.find(person => person.id === pId);
                                if (!p) return Promise.resolve();

                                // Call onUpdateAvailability ONCE per person with ALL their selected dates
                                return onUpdateAvailability(p.id, dates, status, customTimes, unavailableBlocks, homeStatusType, actualTimes);
                            });
                            await Promise.all(updates);
                            setSelection({}); // Clear after apply
                            setEditingCell(null); // Close modal
                        } else {
                            // Standard single-person/range flow
                            await handleApplyStatus(status, customTimes, unavailableBlocks, homeStatusType, rangeDates, actualTimes);
                        }
                    }}
                    onViewHistory={(pId, d) => {
                        setEditingCell(null);
                        onViewHistory?.(pId, d);
                    }}
                    defaultArrivalHour={defaultArrivalHour}
                    defaultDepartureHour={defaultDepartureHour}
                    isAttendanceReportingEnabled={isAttendanceReportingEnabled}
                />
            )}

            {/* Floating Action Bar for Selection */}
            {Object.keys(selection).length > 0 && (
                <div
                    data-testid="selection-action-bar"
                    className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[300] bg-slate-900/90 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-6 duration-300 ring-1 ring-white/10"
                >
                    <div className="flex items-center gap-3 border-l border-white/10 pl-4">
                        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center font-bold text-xs text-white shadow-sm">
                            {Object.values(selection).reduce((acc, dates) => acc + dates.length, 0)}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs font-bold text-white/50 uppercase tracking-wider">משבצות נבחרו</span>
                            <span className="text-sm font-black">
                                {Object.keys(selection).length === 1
                                    ? people.find(p => p.id === Object.keys(selection)[0])?.name
                                    : `${Object.keys(selection).length} לוחמים`}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                // For bulk edit, we just pick the first person to show the modal context,
                                // but we'll override onApply to handle everyone.
                                const firstPersonId = Object.keys(selection)[0];
                                const firstDates = selection[firstPersonId];
                                setEditingCell({ personId: firstPersonId, dates: firstDates });
                                setIsMultiSelectMode(false);
                            }}
                            className="bg-white text-slate-900 hover:bg-slate-100 active:scale-95 transition-all text-xs font-black px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm"
                        >
                            <CheckSquare size={16} weight="bold" />
                            ערוך סטטוס
                        </button>
                        <button
                            onClick={() => {
                                setSelection({});
                            }}
                            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/10 text-white/50 hover:text-white transition-all"
                            title="בטל בחירה"
                        >
                            <X size={18} weight="bold" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
