import React from 'react';
import { Person, Team, TeamRotation, Absence, HourlyBlockage } from '@/types';
import { CaretLeft as ChevronLeft, CaretDown as ChevronDown, House as Home, MapPin, ChartBar } from '@phosphor-icons/react';
import { getEffectiveAvailability, getAttendanceDisplayInfo, isStatusPresent } from '@/utils/attendanceUtils';
import { getPersonInitials } from '@/utils/nameUtils';

// Utility for safe date comparison
const isSameDate = (d1: Date, d2: Date) => d1.toDateString() === d2.toDateString();

export interface VirtualRowData {
    items: any[];
    dates: Date[];
    currentDate: Date;
    currentTime: Date;
    teamRotations: TeamRotation[];
    absences: Absence[];
    hourlyBlockages: HourlyBlockage[];
    collapsedTeams: Set<string>;
    toggleTeam: (id: string) => void;
    collapsedCompanies: Set<string>;
    toggleCompany: (id: string) => void;
    onSelectPerson: (p: Person) => void;
    onShowPersonStats: (p: Person) => void;
    handleCellClick: (e: React.MouseEvent, p: Person, d: Date) => void;
    editingCell: { personId: string; dates: string[] } | null;
    selection: { personId: string; dates: string[] } | null;
    showStatistics: boolean;
    showRequiredDetails: boolean;
    companies: import('@/types').Organization[];
    hideAbsenceDetails: boolean;
    defaultArrivalHour: string;
    defaultDepartureHour: string;
    onShowTeamStats: (t: Team) => void;
    isViewer: boolean;
    totalContentWidth: number;
    headerWidth: number;
    statsWidth: number;
    dayWidth: number;
    dailyTeamStats: Record<string, Record<string, { present: number; total: number }>>;
    dailyCompanyStats: Record<string, Record<string, { present: number; total: number }>>;
    dailyTotalStats: Record<string, { present: number; total: number }>;
    dailyRequirements: Record<string, number>;
    sortedPeople: Person[];
}

// Row component for attendance table

// Simplified interface for native rendering
export const VirtualRow: React.FC<VirtualRowData & { index: number; style?: React.CSSProperties }> = (props) => {
    const { index, style, ...data } = props;
    const { items, dates, currentDate, currentTime, teamRotations, absences, hourlyBlockages, collapsedTeams, toggleTeam, collapsedCompanies, toggleCompany, onSelectPerson, onShowPersonStats, handleCellClick, editingCell, selection, showStatistics, showRequiredDetails, companies, hideAbsenceDetails, defaultArrivalHour, defaultDepartureHour, onShowTeamStats, isViewer, totalContentWidth, headerWidth, statsWidth, dayWidth, dailyTeamStats, dailyCompanyStats, dailyTotalStats, dailyRequirements, sortedPeople } = data;

    const item = items[index];
    if (!item) return null;

    const adjustedStyle = {
        ...style,
        width: totalContentWidth,
        left: 'auto',
        right: 0
    };

    // Shared identity sticky block style
    const stickyBlockStyle: React.CSSProperties = {
        width: headerWidth + statsWidth,
        position: 'sticky',
        right: 0,
        flexShrink: 0,
        display: 'flex',
        height: '100%',
        backgroundColor: 'inherit'
    };

    // --- COMPANY HEADER ---
    if (item.type === 'company-header') {
        const { company, count } = item;
        const isCollapsed = collapsedCompanies.has(company.id);
        return (
            <div style={adjustedStyle} className="flex bg-white group/row border-b border-slate-200 z-[82]">
                <div style={{ ...stickyBlockStyle, zIndex: 85 }} onClick={() => toggleCompany(company.id)} className="cursor-pointer">
                    <div className="shrink-0 border-l border-slate-200 h-full flex items-center gap-3 px-4 bg-slate-100" style={{ width: headerWidth }}>
                        <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-sm">
                            {company.name.charAt(0)}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-base font-black text-slate-900 leading-none">{company.name}</span>
                            <span className="text-[9px] font-bold text-slate-500 mt-0.5">{count} חיילים</span>
                        </div>
                        <div className="mr-auto">
                            {isCollapsed ? <ChevronLeft size={14} className="text-slate-400" weight="bold" /> : <ChevronDown size={14} className="text-blue-600" weight="bold" />}
                        </div>
                    </div>
                    {showStatistics && <div className="flex-1 bg-slate-100/50" />}
                </div>

                <div className="flex h-full">
                    {dates.map(date => {
                        const dateKey = date.toLocaleDateString('en-CA');
                        const stat = dailyCompanyStats[company.id]?.[dateKey];
                        return (
                            <div key={date.toISOString()} className="shrink-0 border-l border-slate-200 h-full bg-slate-50/10 flex items-center justify-center" style={{ width: dayWidth }}>
                                {stat && (
                                    <div className="flex flex-col items-center">
                                        <span className={`text-[10px] font-black ${stat.present === stat.total ? 'text-emerald-600' : 'text-blue-600'}`}>
                                            {stat.present}/{stat.total}
                                        </span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    // --- TEAM HEADER ---
    if (item.type === 'team-header') {
        const { team, membersCount } = item;
        const isCollapsed = collapsedTeams.has(team.id);

        let totalPresentDays = 0;
        let totalPersonDays = 0;
        dates.forEach(d => {
            const k = d.toLocaleDateString('en-CA');
            const s = dailyTeamStats[team.id]?.[k];
            if (s) {
                totalPresentDays += s.present;
                totalPersonDays += s.total;
            } else {
                totalPersonDays += membersCount;
            }
        });
        const homeDaysCount = totalPersonDays - totalPresentDays;
        const avgPresent = membersCount > 0 ? totalPresentDays / membersCount : 0;
        const avgHome = membersCount > 0 ? homeDaysCount / membersCount : 0;
        const homeAvgNorm = Math.round((avgHome / dates.length) * 14);
        const baseAvgNorm = 14 - homeAvgNorm;

        return (
            <div style={adjustedStyle} className="flex bg-white group/row border-b border-slate-200 z-[75]">
                <div style={{ ...stickyBlockStyle, zIndex: 80 }} onClick={() => toggleTeam(team.id)} className="cursor-pointer">
                    <div className="shrink-0 bg-slate-50 border-l border-slate-200 h-full flex flex-col justify-center gap-0.5 px-3 md:px-4" style={{ width: headerWidth }}>
                        <div className="flex items-center justify-between w-full">
                            <span className="text-[13px] 2xl:text-base font-black text-slate-900 tracking-tight truncate">{team.name}</span>
                            {isCollapsed ? <ChevronLeft size={12} className="text-slate-400" weight="bold" /> : <ChevronDown size={12} className="text-blue-600" weight="bold" />}
                        </div>
                        {companies.length > 0 && (
                            <span className="text-[9px] font-bold text-blue-600 pr-4 truncate">
                                {companies.find((c: any) => c.id === team.organization_id)?.name}
                            </span>
                        )}
                    </div>
                    {showStatistics && (
                        <>
                            <div className="w-14 shrink-0 bg-emerald-50/80 border-l border-emerald-200 h-full flex items-center justify-center hover:bg-emerald-100 transition-colors" onClick={(e) => { e.stopPropagation(); onShowTeamStats?.(team); }}>
                                <span className="text-xs font-black text-emerald-700 leading-none">{Math.round(avgPresent)}</span>
                            </div>
                            <div className="w-14 shrink-0 bg-red-50/80 border-l border-red-200 h-full flex items-center justify-center hover:bg-red-100 transition-colors" onClick={(e) => { e.stopPropagation(); onShowTeamStats?.(team); }}>
                                <span className="text-xs font-black text-red-700 leading-none">{Math.round(avgHome)}</span>
                            </div>
                            <div className="w-14 shrink-0 bg-blue-50/80 border-l border-blue-200 h-full flex items-center justify-center hover:bg-blue-100 transition-colors" onClick={(e) => { e.stopPropagation(); onShowTeamStats?.(team); }} dir="ltr">
                                <span className="text-[10px] font-black text-blue-700 leading-none">{homeAvgNorm}/{baseAvgNorm}</span>
                            </div>
                        </>
                    )}
                </div>

                <div className="flex">
                    {dates.map(date => {
                        const dateKey = date.toLocaleDateString('en-CA');
                        const stat = dailyTeamStats[team.id]?.[dateKey];
                        return (
                            <div key={date.toISOString()} className={`shrink-0 flex items-center justify-center border-l border-slate-200 text-[11px] font-black h-full ${stat?.present === stat?.total ? 'text-emerald-500' : 'text-blue-500'}`} style={{ width: dayWidth }} dir="ltr">
                                {stat ? `${stat.present}/${stat.total}` : '-'}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    // --- PERSON ROW ---
    if (item.type === 'person-row') {
        const { person, team } = item;
        const idx = index;

        let presentDays = 0;
        const totalDays = dates.length;
        dates.forEach(date => {
            const avail = getEffectiveAvailability(person, date, teamRotations, absences, hourlyBlockages);
            if (avail.status === 'base') presentDays++;
        });
        const homeDaysCount = totalDays - presentDays;
        const homeNorm = Math.round((homeDaysCount / totalDays) * 14);
        const baseNorm = 14 - homeNorm;

        return (
            <div style={adjustedStyle} className={`flex group/row border-b border-slate-100 transition-all z-[1] ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                <div style={{ ...stickyBlockStyle, zIndex: 60 }} onClick={() => onSelectPerson(person)} className="cursor-pointer">
                    <div className="shrink-0 px-3 md:px-4 py-2.5 md:py-4 border-l border-slate-100 bg-inherit flex items-center gap-3 md:gap-4 group-hover/row:bg-blue-50 group-hover/row:shadow-[4px_0_12px_rgba(0,0,0,0.05)] transition-all" style={{ width: headerWidth }}>
                        <div className="w-7 h-7 2xl:w-9 2xl:h-9 rounded-full flex items-center justify-center text-xs font-black shrink-0 text-white shadow-md" style={{ backgroundColor: team.color?.startsWith('#') ? team.color : '#3b82f6' }}>
                            {getPersonInitials(person.name)}
                        </div>
                        <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-xs md:text-sm font-black text-slate-800 truncate group-hover/row:text-blue-600">{person.name}</span>
                                <button onClick={(e) => { e.stopPropagation(); onShowPersonStats?.(person); }} className="p-1 hover:bg-blue-100 rounded-lg text-blue-500"><ChartBar size={14} weight="bold" /></button>
                            </div>
                            <span className="text-[11px] text-slate-400 font-bold truncate">{person.roleId ? team.name : 'לוחם'}</span>
                        </div>
                    </div>
                    {showStatistics && (
                        <>
                            <div className="w-14 shrink-0 px-2 py-4 border-l border-slate-100 flex items-center justify-center font-black text-sm text-emerald-600 bg-inherit" onClick={(e) => { e.stopPropagation(); onShowPersonStats?.(person); }}>
                                {presentDays}
                            </div>
                            <div className="w-14 shrink-0 px-2 py-4 border-l border-slate-100 flex items-center justify-center font-black text-sm text-red-600 bg-inherit" onClick={(e) => { e.stopPropagation(); onShowPersonStats?.(person); }}>
                                {homeDaysCount}
                            </div>
                            <div className="w-14 shrink-0 px-2 py-4 border-l border-slate-100 flex items-center justify-center font-black text-[11px] text-blue-500 bg-inherit" onClick={(e) => { e.stopPropagation(); onShowPersonStats?.(person); }} dir="ltr">
                                {homeNorm}/{baseNorm}
                            </div>
                        </>
                    )}
                </div>

                <div className="flex">
                    {dates.map((date) => {
                        const avail = getEffectiveAvailability(person, date, teamRotations, absences, hourlyBlockages);
                        const dateStr = date.toLocaleDateString('en-CA');
                        const isToday = isSameDate(new Date(), date);
                        const isSelected = (editingCell?.personId === person.id && editingCell?.dates.includes(dateStr)) || (selection?.personId === person.id && selection?.dates.includes(dateStr));
                        const displayInfo = getAttendanceDisplayInfo(person, date, teamRotations, absences, hourlyBlockages);

                        let cellBg = "bg-white";
                        let themeColor = "bg-slate-200";
                        let content = null;

                        if (avail.status === 'home' || avail.status === 'unavailable' || !avail.isAvailable) {
                            cellBg = "bg-red-50/70 text-red-800";
                            themeColor = "bg-red-400";
                            content = (
                                <div className="flex flex-col items-center justify-center gap-0.5">
                                    <Home size={14} className="text-red-300" weight="bold" />
                                    <span className="text-[10px] font-black">{avail.status === 'unavailable' ? 'אילוץ' : 'בית'}</span>
                                </div>
                            );
                        } else {
                            if (displayInfo.displayStatus === 'missing_departure' || displayInfo.displayStatus === 'missing_arrival') {
                                cellBg = displayInfo.displayStatus === 'missing_departure' ? "bg-emerald-50/40 text-emerald-800" : "bg-amber-50 text-amber-900";
                                themeColor = displayInfo.displayStatus === 'missing_departure' ? "bg-emerald-500" : "bg-amber-500";
                                content = (
                                    <div className="flex flex-col items-center justify-center gap-0.5">
                                        <MapPin size={12} className="opacity-50" />
                                        <span className="text-[9px] font-bold text-rose-600 scale-90">חסר נתון</span>
                                    </div>
                                );
                            } else {
                                cellBg = "bg-emerald-50/40 text-emerald-800";
                                themeColor = "bg-emerald-500";
                                content = (
                                    <div className="flex flex-col items-center justify-center gap-0.5">
                                        <MapPin size={14} className="text-emerald-500/50" weight="bold" />
                                        <span className="text-[10px] font-black">בסיס</span>
                                    </div>
                                );
                            }
                        }

                        return (
                            <div
                                key={date.toISOString()}
                                className={`h-20 shrink-0 border-l border-slate-100 flex flex-col items-center justify-center cursor-pointer transition-all relative group/cell ${cellBg} ${isSelected ? 'z-30 ring-4 ring-blue-500 scale-110 rounded-lg bg-white' : 'hover:z-10 hover:shadow-lg hover:bg-white'} ${isToday ? 'ring-inset shadow-[inset_0_0_0_2px_rgba(59,130,246,0.5)]' : ''}`}
                                style={{ width: dayWidth }}
                                onClick={(e) => handleCellClick(e, person, date)}
                            >
                                {content}
                                <div className={`absolute bottom-0 left-0 right-0 h-1 ${themeColor} opacity-20 group-hover/cell:opacity-100 transition-opacity`} />
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    return null;
};
