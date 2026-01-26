import React, { CSSProperties } from 'react';
import { Person, Team, TeamRotation, Absence, TaskTemplate, HourlyBlockage } from '@/types';
import { CaretRight as ChevronRight, CaretLeft as ChevronLeft, CaretDown as ChevronDown, CalendarBlank as Calendar, Users, House as Home, MapPin, XCircle, Clock, Info, CheckCircle as CheckCircle2, MagnifyingGlass as Search, WarningCircle as AlertCircle, ChartBar } from '@phosphor-icons/react';
// import { ListChildComponentProps } from 'react-window';
import { getEffectiveAvailability, getAttendanceDisplayInfo, isPersonPresentAtHour } from '@/utils/attendanceUtils';
import { getPersonInitials } from '@/utils/nameUtils';

// Utility for safe date comparison
const isSameDate = (d1: Date, d2: Date) => d1.toDateString() === d2.toDateString();

export interface VirtualRowData {
    items: any[]; // The flattened list
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
    dailyTeamStats: Record<string, Record<string, { present: number; total: number }>>;
    dailyCompanyStats: Record<string, Record<string, { present: number; total: number }>>;
}

const areEqual = (prevProps: any, nextProps: any) => {
    return (
        prevProps.index === nextProps.index &&
        prevProps.style === nextProps.style &&
        prevProps.items === nextProps.items &&
        prevProps.editingCell === nextProps.editingCell &&
        prevProps.selection === nextProps.selection &&
        prevProps.collapsedTeams === nextProps.collapsedTeams &&
        prevProps.collapsedCompanies === nextProps.collapsedCompanies &&
        prevProps.totalContentWidth === nextProps.totalContentWidth &&
        prevProps.dailyTeamStats === nextProps.dailyTeamStats &&
        prevProps.dailyCompanyStats === nextProps.dailyCompanyStats
    );
};

import type { RowComponentProps } from 'react-window';

export const VirtualRow = React.memo(({
    index, style,
    items, dates, currentDate, currentTime, teamRotations, absences, hourlyBlockages,
    collapsedTeams, toggleTeam, collapsedCompanies, toggleCompany,
    onSelectPerson, onShowPersonStats, handleCellClick,
    editingCell, selection, showStatistics, showRequiredDetails,
    companies, hideAbsenceDetails, defaultArrivalHour, defaultDepartureHour,
    onShowTeamStats, isViewer, totalContentWidth, dailyTeamStats, dailyCompanyStats
}: RowComponentProps<VirtualRowData>) => {

    const item = items[index];
    const adjustedStyle = {
        ...style,
        width: totalContentWidth,
        left: 'auto',
        right: 0
    };

    // --- COMPANY HEADER ---
    if (item.type === 'company-header') {
        const { company, count } = item;
        const isCollapsed = collapsedCompanies.has(company.id);

        return (
            <div style={adjustedStyle} className="isolate z-[82]">
                <div
                    onClick={() => toggleCompany(company.id)}
                    className={`flex sticky z-[82] right-0 left-0 w-full min-w-max ${showRequiredDetails ? 'top-[112px]' : 'top-[64px]'} bg-slate-100/90 backdrop-blur-md h-12 cursor-pointer border-y border-slate-200 group`}
                >
                    <div className="w-48 2xl:w-52 shrink-0 border-l border-slate-200 h-full flex items-center gap-3 sticky right-0 z-[84] px-4 bg-inherit">
                        <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-sm">
                            {company.name.charAt(0)}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-black text-slate-900 leading-none">{company.name}</span>
                            <span className="text-[9px] font-bold text-slate-500 mt-0.5">{count} חיילים</span>
                        </div>
                        <div className="mr-auto">
                            {isCollapsed ? (
                                <ChevronLeft size={14} className="text-slate-400" weight="bold" />
                            ) : (
                                <ChevronDown size={14} className="text-blue-600" weight="bold" />
                            )}
                        </div>
                    </div>

                    <div className="flex h-full">
                        {dates.map(date => {
                            const dateKey = date.toLocaleDateString('en-CA');
                            const stat = dailyCompanyStats[company.id]?.[dateKey];
                            return (
                                <div key={date.toISOString()} className="w-20 md:w-24 shrink-0 border-l border-slate-200 h-full bg-slate-50/30 flex items-center justify-center">
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
                    <div className="flex-1 bg-slate-50/30 h-full" />
                </div>
            </div>
        );
    }

    // --- TEAM HEADER ---
    if (item.type === 'team-header') {
        const { team, membersCount, stats } = item;
        const isCollapsed = collapsedTeams.has(team.id);

        return (
            <div style={adjustedStyle} className="isolate z-[75]">
                <div
                    onClick={() => toggleTeam(team.id)}
                    className={`flex sticky right-0 left-0 w-full min-w-max ${showRequiredDetails ? 'top-[160px]' : 'top-[112px]'} group cursor-pointer bg-white h-12`}
                >
                    {/* Sticky Name Part */}
                    <div className="w-48 2xl:w-52 shrink-0 bg-slate-100 border-b border-l border-slate-200 h-full flex flex-col justify-center gap-0.5 sticky right-0 z-[80] px-3 md:px-4">
                        <div className="flex items-center justify-between w-full">
                            <span className="text-[10px] 2xl:text-sm font-black text-slate-900 tracking-tight truncate">{team.name}</span>
                            {isCollapsed ? (
                                <ChevronLeft size={12} className="text-slate-400" weight="bold" />
                            ) : (
                                <ChevronDown size={12} className="text-blue-600" weight="bold" />
                            )}
                        </div>
                        {companies.length > 0 && (
                            <span className="text-[9px] font-bold text-blue-600 pr-4 truncate">
                                {companies.find((c: any) => c.id === team.organization_id)?.name}
                            </span>
                        )}
                    </div>

                    {showStatistics && (() => {
                        const baseAvg = stats?.present || 0;
                        return (
                            <>
                                <div className="w-14 shrink-0 bg-slate-50 border-b border-l border-slate-200 h-full flex items-center justify-center sticky right-52 z-[80] cursor-pointer hover:bg-blue-50" onClick={(e) => { e.stopPropagation(); onShowTeamStats?.(team); }}>
                                    <span className="text-xs font-black text-emerald-600">-</span>
                                </div>
                                <div className="w-14 shrink-0 bg-slate-50 border-b border-l border-slate-200 h-full flex items-center justify-center sticky right-[264px] z-[80] cursor-pointer hover:bg-blue-50" onClick={(e) => { e.stopPropagation(); onShowTeamStats?.(team); }}>
                                    <span className="text-xs font-black text-red-600">-</span>
                                </div>
                                <div className="w-14 shrink-0 bg-slate-50 border-b border-l border-slate-200 h-full flex items-center justify-center sticky right-[320px] z-[80] cursor-pointer hover:bg-blue-50" onClick={(e) => { e.stopPropagation(); onShowTeamStats?.(team); }} dir="ltr">
                                    <span className="text-[9px] font-black text-blue-500"></span>
                                </div>
                            </>
                        );
                    })()}

                    {/* Per-Day Team Stats View */}
                    <div className="flex bg-white h-full">
                        {dates.map(date => {
                            const dateKey = date.toLocaleDateString('en-CA');
                            const stat = dailyTeamStats[team.id]?.[dateKey];
                            return (
                                <div
                                    key={date.toISOString()}
                                    className={`w-20 md:w-24 shrink-0 flex items-center justify-center border-l border-slate-200 text-[11px] font-black border-b h-full ${stat?.present === stat?.total ? 'text-emerald-500' : 'text-blue-500'}`}
                                    dir="ltr"
                                >
                                    {stat ? `${stat.present}/${stat.total}` : '-'}
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex-1 bg-slate-50 border-b border-slate-200 h-full" />
                </div>
            </div>
        );
    }

    // --- PERSON ROW ---
    if (item.type === 'person-row') {
        const { person, team } = item;
        const idx = index; // or use some other way to determine stripe?

        return (
            <div style={adjustedStyle} className="flex group/row hover:bg-blue-50/20 transition-all min-w-max isolate z-[1]">
                {/* Person Info Sticky Cell */}
                <div
                    onClick={() => onSelectPerson(person)}
                    className={`w-48 2xl:w-52 shrink-0 px-3 md:px-4 py-2.5 md:py-4 border-l border-slate-100 sticky right-0 z-[60] flex items-center gap-3 md:gap-4 cursor-pointer transition-all ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'} group-hover/row:bg-blue-50 group-hover/row:shadow-[4px_0_12px_rgba(0,0,0,0.05)] shadow-[2px_0_5px_rgba(0,0,0,0.02)] border-b`}
                >
                    <div
                        className="w-7 h-7 2xl:w-9 2xl:h-9 rounded-full flex items-center justify-center text-xs font-black shrink-0 text-white shadow-md ring-2 ring-white transition-transform group-hover/row:scale-110"
                        style={{
                            backgroundColor: team.color?.startsWith('#') ? team.color : '#3b82f6',
                            backgroundImage: `linear-gradient(135deg, ${team.color || '#3b82f6'}, ${team.color || '#3b82f6'}cc)`
                        }}
                    >
                        {getPersonInitials(person.name)}
                    </div>
                    <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-xs md:text-sm font-black text-slate-800 truncate group-hover/row:text-blue-600 transition-colors">
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
                                        {companies.find((c: any) => c.id === person.organization_id)?.name}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {showStatistics && (
                    <>
                        <div className={`w-14 shrink-0 px-2 py-4 border-l border-slate-100 sticky right-52 z-[60] flex items-center justify-center font-black text-sm text-emerald-600 cursor-pointer hover:bg-emerald-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'} border-b`} onClick={() => onShowPersonStats?.(person)}>
                            -
                        </div>
                        <div className={`w-14 shrink-0 px-2 py-4 border-l border-slate-100 sticky right-[264px] z-[60] flex items-center justify-center font-black text-sm text-red-600 cursor-pointer hover:bg-red-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'} border-b`} onClick={() => onShowPersonStats?.(person)}>
                            -
                        </div>
                        <div className={`w-14 shrink-0 px-2 py-4 border-l border-slate-100 sticky right-[320px] z-[60] flex items-center justify-center font-black text-[11px] text-blue-500 cursor-pointer hover:bg-blue-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'} border-b`} onClick={() => onShowPersonStats?.(person)} dir="ltr">
                            -
                        </div>
                    </>
                )}

                {/* Attendance Grid Cells */}
                <div className="flex min-w-max">
                    {dates.map((date, dateIdx) => {
                        const avail = getEffectiveAvailability(person, date, teamRotations, absences, hourlyBlockages);
                        const dateStr = date.toLocaleDateString('en-CA');

                        const isToday = isSameDate(new Date(), date);
                        const isSelected = (editingCell?.personId === person.id && editingCell?.dates.includes(dateStr)) ||
                            (selection?.personId === person.id && selection?.dates.includes(dateStr));

                        // Roster Wizard Style Logic (Simplified for brevity but should match original)
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
                        const isUnapprovedExit = isExitRequest && relevantAbsence?.status !== 'approved' && relevantAbsence?.status !== 'partially_approved';

                        const constraintText = (isExitRequest && !hideAbsenceDetails) ? (
                            <span
                                data-testid="exit-request-label"
                                title={relevantAbsence?.reason}
                                className={`text-[9px] font-bold -mt-0.5 whitespace-nowrap scale-90 flex items-center gap-1 truncate max-w-[80px] ${isUnapprovedExit ? 'text-red-600' : 'text-slate-500'}`}
                            >
                                {relevantAbsence?.status === 'rejected' && <span className="opacity-60 text-[8px]">(נדחה)</span>}
                                {relevantAbsence?.status === 'pending' && <span className="opacity-60 text-[8px]">(ממתין)</span>}
                                {isViewer ? 'היעדרות' : (relevantAbsence?.reason || 'בקשת יציאה')}
                            </span>
                        ) : null;

                        const showRedDots = !isExitRequest && (avail.unavailableBlocks?.length || 0) > 0;
                        const displayBlocks = avail.unavailableBlocks || [];

                        // View Logic
                        if (avail.status === 'home' || avail.status === 'unavailable' || !avail.isAvailable) {
                            cellBg = "bg-red-50/70 text-red-800";
                            themeColor = "bg-red-400";
                            const isConstraint = avail.status === 'unavailable';
                            const homeStatusLabels: Record<string, string> = {
                                'leave_shamp': 'חופשה בשמפ',
                                'gimel': 'ג\'',
                                'absent': 'נפקד',
                                'organization_days': 'ימי התארגנות',
                                'not_in_shamp': 'לא בשמ"פ'
                            };
                            const homeTypeLabel = avail.homeStatusType ? homeStatusLabels[avail.homeStatusType] : undefined;
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
                            const displayInfo = getAttendanceDisplayInfo(person, date, teamRotations, absences, hourlyBlockages);
                            const isArrival = displayInfo.isArrival;
                            const isDeparture = displayInfo.isDeparture;
                            const isMissingDeparture = displayInfo.displayStatus === 'missing_departure';
                            const isMissingArrival = displayInfo.displayStatus === 'missing_arrival';

                            if (isMissingDeparture) {
                                cellBg = "bg-emerald-50/40 text-emerald-800";
                                themeColor = "bg-emerald-500";
                                content = (
                                    <div className="flex flex-col items-center justify-center relative w-full h-full p-1 gap-0.5">
                                        {isUnapprovedExit && <div className="absolute top-1 left-1.5 text-red-500 animate-pulse"><AlertCircle size={10} weight="fill" /></div>}
                                        <MapPin size={14} className="text-emerald-500/50" weight="bold" />
                                        <span className="text-[10px] font-black text-emerald-800">{isArrival ? 'הגעה' : 'בסיס'}</span>
                                        <span className="text-[9px] font-bold text-rose-600 leading-tight block whitespace-nowrap scale-90">חסר שעת יציאה</span>
                                        <span className="text-[9px] font-bold opacity-70 whitespace-nowrap scale-90 mt-auto pb-1">{avail.startHour === '00:00' ? '' : avail.startHour}</span>
                                        {constraintText}
                                    </div>
                                );
                            } else if (isMissingArrival) {
                                cellBg = "bg-amber-50 text-amber-900";
                                themeColor = "bg-amber-500";
                                content = (
                                    <div className="flex flex-col items-center justify-center relative w-full h-full">
                                        {isUnapprovedExit && <div className="absolute top-1 left-1.5 text-red-500 animate-pulse"><AlertCircle size={10} weight="fill" /></div>}
                                        <MapPin size={12} className={isUnapprovedExit ? "text-red-500" : "text-amber-500"} weight="bold" />
                                        <span className={`text-[10px] font-black ${isUnapprovedExit ? "text-red-700" : ""}`}>יציאה</span>
                                        <span className="text-[9px] font-bold text-rose-600 leading-tight block whitespace-nowrap scale-90">חסר שעת הגעה</span>
                                        <span className="text-[9px] font-bold opacity-70 whitespace-nowrap scale-90">{avail.endHour === '23:59' ? defaultDepartureHour : avail.endHour}</span>
                                        {constraintText}
                                    </div>
                                );
                            } else if (isArrival && isDeparture) {
                                cellBg = "bg-emerald-50 text-emerald-800";
                                themeColor = "bg-emerald-500";
                                content = (
                                    <div className="flex flex-col items-center justify-center relative w-full h-full">
                                        {isUnapprovedExit && <div className="absolute top-1 left-1.5 text-red-500 animate-pulse"><AlertCircle size={10} weight="fill" /></div>}
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
                                        {isUnapprovedExit && <div className="absolute top-1 left-1.5 text-red-500 animate-pulse"><AlertCircle size={10} weight="fill" /></div>}
                                        <MapPin size={12} className={isUnapprovedExit ? "text-red-500" : "text-emerald-500"} weight="bold" />
                                        <span className={`text-[10px] font-black ${isUnapprovedExit ? "text-red-700" : ""}`}>הגעה</span>
                                        <span className="text-[9px] font-bold opacity-70 whitespace-nowrap scale-90">{avail.startHour === '00:00' ? defaultArrivalHour : avail.startHour}</span>
                                        {constraintText}
                                    </div>
                                );
                            } else if (isDeparture && avail.endHour !== '23:59') {
                                cellBg = "bg-amber-50/60 text-amber-900";
                                themeColor = "bg-amber-500";
                                content = (
                                    <div className="flex flex-col items-center justify-center relative w-full h-full">
                                        {isUnapprovedExit && <div className="absolute top-1 left-1.5 text-red-500 animate-pulse"><AlertCircle size={10} weight="fill" /></div>}
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
                                        {isUnapprovedExit && !hideAbsenceDetails && <div className="absolute top-1 left-1.5 text-red-500 animate-pulse"><AlertCircle size={10} weight="fill" /></div>}
                                        <MapPin size={14} className={isUnapprovedExit && !hideAbsenceDetails ? "text-red-500" : "text-emerald-500/50"} weight="bold" />
                                        <span className={`text-[10px] font-black ${isUnapprovedExit && !hideAbsenceDetails ? "text-red-700" : ""}`}>בסיס</span>
                                        {(avail.unavailableBlocks && avail.unavailableBlocks.length > 0) && (
                                            <span className="text-[9px] font-bold text-red-600/90 leading-tight block whitespace-nowrap scale-90 -mt-0.5">
                                                {avail.unavailableBlocks.length > 1 ? `${avail.unavailableBlocks.length} חסימות` : `${avail.unavailableBlocks[0].start}-${avail.unavailableBlocks[0].end}`}
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
                                className={`w-20 md:w-24 h-20 shrink-0 border-l border-slate-100 flex flex-col items-center justify-center cursor-pointer transition-all relative group/cell 
                                    ${cellBg} 
                                    ${isSelected ? 'z-30 ring-4 ring-blue-500 shadow-2xl scale-110 rounded-lg bg-white' : 'hover:z-10 hover:shadow-lg hover:bg-white'} 
                                    ${isToday ? 'ring-inset shadow-[inset_0_0_0_2px_rgba(59,130,246,0.5)]' : ''}
                                `}
                                onClick={(e) => handleCellClick(e, person, date)}
                            >
                                {content}
                                {/* Red Dots */}
                                {showRedDots && (
                                    <div className="absolute top-1 right-1 z-10 flex gap-0.5">
                                        {displayBlocks.slice(0, 3).map((_, i) => (
                                            <div key={i} className="w-1.5 h-1.5 rounded-full bg-red-500 ring-1 ring-white shadow-sm" aria-hidden="true" />
                                        ))}
                                    </div>
                                )}
                                {/* Status Bottom Bar */}
                                <div className={`absolute bottom-0 left-0 right-0 h-1 ${themeColor} opacity-20 group-hover/cell:opacity-100 transition-opacity`} />

                                {/* Manual/Algo Indicator */}
                                {(avail.source === 'manual' || avail.source === 'algorithm') && (
                                    <div className={`absolute top-1.5 ${isUnapprovedExit ? 'left-5' : 'left-1.5'} w-1.5 h-1.5 rounded-full ${avail.source === 'manual' ? 'bg-amber-400' : 'bg-blue-400'}`} />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    return null;
}, areEqual);
