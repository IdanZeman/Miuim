import React, { useState, useRef, useEffect } from 'react';
import { Person, Team, TeamRotation, Absence, TaskTemplate } from '@/types';
import { CaretRight as ChevronRight, CaretLeft as ChevronLeft, CaretDown as ChevronDown, CalendarBlank as Calendar, Users, House as Home, MapPin, XCircle, Clock, Info, CheckCircle as CheckCircle2, MagnifyingGlass as Search, WarningCircle as AlertCircle, ChartBar } from '@phosphor-icons/react';
import * as ReactWindow from 'react-window';

const List = ReactWindow.List || (ReactWindow as any).default?.List;
import type { RowComponentProps } from 'react-window';
import AutoSizer from '@/components/common/AutoSizer';
import { VirtualRow, VirtualRowData } from './AttendanceTableVirtualRow';
import { getEffectiveAvailability, getRotationStatusForDate, getComputedAbsenceStatus, isPersonPresentAtHour, isStatusPresent, getAttendanceDisplayInfo } from '@/utils/attendanceUtils';
import { getPersonInitials } from '@/utils/nameUtils';
import { StatusEditModal } from './StatusEditModal';
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
    onUpdateAvailability?: (personId: string, date: string | string[], status: 'base' | 'home' | 'unavailable', customTimes?: { start: string, end: string }, unavailableBlocks?: { id: string, start: string, end: string, reason?: string }[], homeStatusType?: import('@/types').HomeStatusType) => Promise<void> | void;
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
}

export const AttendanceTable: React.FC<AttendanceTableProps> = ({
    teams, people, teamRotations, absences, hourlyBlockages = [], tasks = [], currentDate, onDateChange, onSelectPerson, onUpdateAvailability, onViewHistory, className, viewMode, isViewer = false, searchTerm = '', showRequiredDetails = false, companies = [], hideAbsenceDetails = false,
    defaultArrivalHour = '10:00', defaultDepartureHour = '14:00',
    showStatistics = false, onShowPersonStats, onShowTeamStats,
    externalEditingCell, onClearExternalEdit,
    groupByCompany = false
}) => {
    const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(() => new Set(teams.map(t => t.id)));
    const [collapsedCompanies, setCollapsedCompanies] = useState<Set<string>>(new Set());
    const [editingCell, setEditingCell] = useState<{ personId: string; dates: string[] } | null>(null);
    const [selection, setSelection] = useState<{ personId: string; dates: string[] } | null>(null);

    // Header synchronization refs
    const headerRef = useRef<HTMLDivElement>(null);
    const listOuterRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (externalEditingCell) {
            setEditingCell(externalEditingCell);
            onClearExternalEdit?.();
        }
    }, [externalEditingCell, onClearExternalEdit]);

    const scrollContainerRef = useRef<HTMLDivElement>(null);

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

    const dates = [];
    for (let d = 1; d <= daysInMonth; d++) {
        dates.push(new Date(year, month, d));
    }

    const weekDaysShort = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
    const weekDaysEnglish = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
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

        if (e.ctrlKey || e.metaKey) {
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
                const lastDateStr = selection.dates[selection.dates.length - 1];
                const start = new Date(lastDateStr);
                const end = new Date(dateStr);
                const rangeDates: string[] = [];
                const current = new Date(Math.min(start.getTime(), end.getTime()));
                const final = new Date(Math.max(start.getTime(), end.getTime()));
                while (current <= final) {
                    rangeDates.push(current.toLocaleDateString('en-CA'));
                    current.setDate(current.getDate() + 1);
                }
                const uniqueDates = Array.from(new Set([...selection.dates, ...rangeDates]));
                setSelection({ personId: person.id, dates: uniqueDates });
            } else {
                setSelection({ personId: person.id, dates: [dateStr] });
            }
            return;
        }

        if (selection && selection.personId === person.id && selection.dates.includes(dateStr)) {
            setEditingCell({ personId: person.id, dates: selection.dates });
            setSelection(null);
            logger.info('CLICK', `Opened bulk editor for ${person.name}`, { personId: person.id, count: selection.dates.length });
            return;
        }

        setEditingCell({ personId: person.id, dates: [dateStr] });
        setSelection(null);
        logger.info('CLICK', `Opened attendance status editor for ${person.name} on ${dateStr}`, { personId: person.id, date: dateStr });
    };

    const handleApplyStatus = async (status: 'base' | 'home', customTimes?: { start: string, end: string }, unavailableBlocks?: { id: string, start: string, end: string, reason?: string }[], homeStatusType?: import('@/types').HomeStatusType, rangeDates?: string[]) => {
        if (!editingCell || !onUpdateAvailability) return;
        const datesToUpdate = rangeDates && rangeDates.length > 0 ? rangeDates : editingCell.dates;
        await onUpdateAvailability(editingCell.personId, datesToUpdate, status, customTimes, unavailableBlocks, homeStatusType);
        setEditingCell(null);
    };

    const scrollToDate = (dateStr: string) => {
        if (!listOuterRef.current) return;
        const container = viewMode === 'monthly' ? listOuterRef.current : scrollContainerRef.current;
        if (!container) return;

        const date = new Date(dateStr);
        if (date.getMonth() !== month || date.getFullYear() !== year) return;

        const dayWidth = 96;
        const scrollPos = (date.getDate() - 1) * dayWidth;
        container.scrollLeft = -scrollPos;
    };

    useEffect(() => {
        if (editingCell && editingCell.dates.length > 0) {
            scrollToDate(editingCell.dates[0]);
        }
    }, [editingCell]);

    // Auto-scroll logic adapted for both views
    useEffect(() => {
        const container = viewMode === 'monthly' ? listOuterRef.current : scrollContainerRef.current;
        if (container) {
            const today = new Date();
            if (today.getMonth() === month && today.getFullYear() === year) {
                const dayWidth = 96;
                const scrollPos = (today.getDate() - 1) * dayWidth;
                requestAnimationFrame(() => {
                    if (container) container.scrollLeft = -scrollPos;
                });
            }
        }
    }, [month, year, viewMode]);

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
            if (isPersonPresentAtHour(p, currentDate, refTime, teamRotations, absences, hourlyBlockages)) {
                presentCount++;
            }
        });
        return { present: presentCount, total: totalPeople };
    }, [sortedPeople, currentDate, teamRotations, absences, hourlyBlockages, currentTime]);

    const presenceMap = React.useMemo(() => {
        const map: Record<string, Record<string, boolean>> = {};

        // Optimized indexing for O(1) lookups inside the loops
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

        // Pre-indexed rotations
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
                const dateKey = date.toISOString().split('T')[0]; // Faster than toLocaleDateString
                map[p.id][dateKey] = isPersonPresentAtHour(p, date, '12:00', pRotation, pAbsences, pBlockages);
            });
        });
        return map;
    }, [sortedPeople, dates, teamRotations, absences, hourlyBlockages]);

    const teamStats = React.useMemo(() => {
        const stats: Record<string, { present: number; total: number }> = {};
        const isToday = new Date().toDateString() === currentDate.toDateString();
        const dateKey = currentDate.toISOString().split('T')[0];

        teams.forEach(team => {
            const members = peopleByTeam[team.id] || [];
            let present = 0;
            members.forEach(p => {
                if (isToday) {
                    const refTime = `${currentTime.getHours().toString().padStart(2, '0')}:${currentTime.getMinutes().toString().padStart(2, '0')}`;
                    if (isPersonPresentAtHour(p, currentDate, refTime, teamRotations, absences, hourlyBlockages)) {
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
                const dateKey = date.toISOString().split('T')[0];
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
                const dateKey = date.toISOString().split('T')[0];
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


    // Flatten logic for Virtualization
    const flattenedItems = React.useMemo(() => {
        if (viewMode !== 'monthly' && viewMode !== undefined) return [];

        const items: any[] = [];
        if (groupByCompany && groupedTeamsByCompany) {
            groupedTeamsByCompany.forEach(({ company, teams: companyTeams }) => {
                const isCompanyCollapsed = collapsedCompanies.has(company.id);
                // Get all people in this company by summing up their teams
                const companyPeople: Person[] = [];
                companyTeams.forEach(t => {
                    const teamMembers = peopleByTeam[t.id] || [];
                    companyPeople.push(...teamMembers);
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

    const getItemSize = (index: number) => {
        const item = flattenedItems[index];
        if (!item) return 80;
        if (item.type === 'company-header') return 48;
        if (item.type === 'team-header') return 48;
        return 80;
    };

    const headerWidth = 208;
    const statsWidth = showStatistics ? 168 : 0;
    const dayWidth = 96;
    const totalContentWidth = headerWidth + statsWidth + (dates.length * dayWidth);

    const itemData = React.useMemo(() => ({
        items: flattenedItems, dates, currentDate, currentTime, teamRotations, absences, hourlyBlockages, collapsedTeams, toggleTeam, collapsedCompanies, toggleCompany, onSelectPerson, onShowPersonStats, handleCellClick, editingCell, selection, showStatistics, showRequiredDetails, companies, hideAbsenceDetails, defaultArrivalHour, defaultDepartureHour, onShowTeamStats, isViewer, totalContentWidth, dailyTeamStats, dailyCompanyStats
    }), [flattenedItems, dates, currentDate, currentTime, teamRotations, absences, hourlyBlockages, collapsedTeams, collapsedCompanies, editingCell, selection, showStatistics, showRequiredDetails, companies, hideAbsenceDetails, defaultArrivalHour, defaultDepartureHour, isViewer, totalContentWidth, dailyTeamStats, dailyCompanyStats]);

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
                        {members.map(person => {
                            const displayInfo = getAttendanceDisplayInfo(person, currentDate, teamRotations, absences, hourlyBlockages);
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
                                    <div className="flex items-center gap-2 md:gap-3 shrink-0 min-w-0 bg-inherit relative z-10">
                                        <div className={`flex items-center gap-1 md:gap-2 px-2.5 py-1.5 md:px-4 md:py-2.5 rounded-xl md:rounded-2xl font-black text-[9px] md:text-xs shrink-0 ${statusConfig.bg} transition-all shadow-sm ring-1 ring-black/5`}>
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
    };

    return (
        <div className={`h-full flex flex-col relative ${className || ''}`} dir="rtl">
            {/* Daily View (Mobile default, Desktop optional) */}
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
                                    const isCompanyCollapsed = collapsedCompanies.has(company.id);
                                    const companyPeople = sortedPeople.filter(p => companyTeams.some(t => t.id === p.teamId));
                                    if (companyPeople.length === 0) return null;
                                    return (
                                        <div key={company.id} className="mb-4">
                                            <div onClick={() => toggleCompany(company.id)} className="bg-slate-100/80 backdrop-blur-sm px-4 py-3 flex items-center justify-between cursor-pointer border-y border-slate-200">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-sm shadow-sm">{company.name.charAt(0)}</div>
                                                    <div>
                                                        <h3 className="text-sm font-black text-slate-900 leading-none">{company.name}</h3>
                                                        <p className="text-[10px] font-bold text-slate-500 mt-1">{companyPeople.length} חיילים ב-{companyTeams.length} צוותים</p>
                                                    </div>
                                                </div>
                                                <div className="w-6 h-6 rounded-full bg-white/50 flex items-center justify-center">
                                                    {isCompanyCollapsed ? <ChevronLeft size={14} className="text-slate-400" weight="bold" /> : <ChevronDown size={14} className="text-blue-600" weight="bold" />}
                                                </div>
                                            </div>
                                            {!isCompanyCollapsed && (
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

            {/* Monthly View (Virtualized) */}
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
                                <button onClick={() => onShowTeamStats?.({ id: 'all', name: 'כל הפלוגה', organization_id: '', color: 'bg-slate-500' })} className="bg-white text-blue-700 px-8 py-3 rounded-xl font-black text-sm hover:bg-blue-50 transition-all shadow-xl active:scale-95 shrink-0">ltחקור מלא ודוחות</button>
                            </div>
                        </div>
                    )}

                    <div className="flex-1 relative h-full flex flex-col">
                        <div ref={headerRef} className="flex overflow-hidden bg-white border-b border-slate-200 shrink-0 select-none items-end" style={{ width: '100%' }}>
                            <div className="w-48 2xl:w-52 shrink-0 bg-white border-l border-slate-200 sticky right-0 z-[100] flex items-center px-3 md:px-4 py-3 md:py-4 font-black text-slate-400 text-xs uppercase tracking-widest h-14 md:h-16">שם הלוחם</div>
                            {showStatistics && (
                                <>
                                    <div className="w-14 shrink-0 bg-white border-l border-slate-200 flex items-center justify-center font-black text-[10px] text-slate-400 uppercase tracking-widest h-14 md:h-16">בסיס</div>
                                    <div className="w-14 shrink-0 bg-white border-l border-slate-200 flex items-center justify-center font-black text-[10px] text-slate-400 uppercase tracking-widest h-14 md:h-16">בית</div>
                                    <div className="w-14 shrink-0 bg-white border-l border-slate-200 flex items-center justify-center font-black text-[10px] text-slate-400 uppercase tracking-widest h-14 md:h-16">יחס</div>
                                </>
                            )}
                            <div className="flex">
                                {dates.map((date) => {
                                    const isToday = new Date().toDateString() === date.toDateString();
                                    const isWeekend = date.getDay() === 6;
                                    return (
                                        <div key={date.toISOString()} className={`w-20 md:w-24 h-14 md:h-16 shrink-0 flex flex-col items-center justify-center border-l border-slate-100 transition-all relative ${isToday ? 'bg-blue-600 text-white z-10' : isWeekend ? 'bg-slate-50' : 'bg-white'}`}>
                                            <span className={`text-[10px] md:text-[11px] font-black uppercase mb-0.5 ${isToday ? 'text-blue-100' : isWeekend ? 'text-slate-500' : 'text-slate-400'}`}>{weekDaysShort[date.getDay()]}</span>
                                            <span className={`text-lg md:text-xl font-black ${isToday ? 'text-white' : 'text-slate-800'}`}>{date.getDate()}</span>
                                            {isToday && <div className="absolute top-0 right-0 left-0 h-1 bg-white/30" />}
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="w-4" />
                        </div>

                        <div className="flex-1 relative overflow-hidden">
                            <AutoSizer>
                                {({ height, width }) => {
                                    const totalContentWidth = 208 + (dates.length * 96);
                                    return (
                                        <List
                                            height={height}
                                            width={width}
                                            rowCount={flattenedItems.length}
                                            rowHeight={getItemSize}
                                            rowComponent={VirtualRow}
                                            rowProps={itemData}
                                            listRef={listOuterRef}
                                            onScroll={(e: React.UIEvent<HTMLElement>) => {
                                                if (headerRef.current) {
                                                    headerRef.current.scrollLeft = e.currentTarget.scrollLeft;
                                                }
                                            }}
                                            className="custom-scrollbar"
                                            style={{
                                                overflowX: 'auto',
                                                overflowY: 'auto'
                                            }}
                                        >
                                            {/* This spacer forces horizontal scrollbar in the list context */}
                                            <div style={{ width: totalContentWidth, height: 1, pointerEvents: 'none', position: 'absolute', top: 0, right: 0 }} />
                                        </List>
                                    )
                                }}
                            </AutoSizer>
                        </div>
                    </div>
                </div>
            )}

            {editingCell && (() => {
                const person = people.find(p => p.id === editingCell.personId);
                const firstDate = editingCell.dates[0];
                const availability = person ? getEffectiveAvailability(person, new Date(firstDate), teamRotations, absences, hourlyBlockages) : undefined;

                return (
                    <StatusEditModal
                        isOpen={!!editingCell}
                        date={firstDate}
                        dates={editingCell.dates}
                        personId={editingCell.personId}
                        personName={person?.name}
                        currentAvailability={availability}
                        onClose={() => setEditingCell(null)}
                        onApply={handleApplyStatus}
                        onViewHistory={(pId, d) => {
                            setEditingCell(null);
                            onViewHistory?.(pId, d);
                        }}
                        defaultArrivalHour={defaultArrivalHour}
                        defaultDepartureHour={defaultDepartureHour}
                    />
                );
            })()}
        </div>
    );
};
