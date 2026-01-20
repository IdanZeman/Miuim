import React from 'react';
import { Users, CaretDown as ChevronDown, Clock, Info, MapPin, WarningCircle as AlertCircle, House as Home } from '@phosphor-icons/react';
import { Person, Team, TeamRotation, Absence, HourlyBlockage, Organization, DailyPresence } from '@/types';
import { getEffectiveAvailability, isPersonPresentAtHour, getComputedAbsenceStatus } from '@/utils/attendanceUtils';
import { getAttendanceVisualProps } from '@/utils/attendanceVisuals';
import { getPersonInitials } from '@/utils/nameUtils';

interface DailyAttendanceViewProps {
    date: Date;
    teams: Team[];
    people: Person[]; // Sorted
    teamRotations: TeamRotation[];
    absences: Absence[];
    hourlyBlockages: HourlyBlockage[];
    companies: Organization[];
    collapsedTeams: Set<string>;
    toggleTeam: (teamId: string) => void;
    onSelectPerson: (person: Person) => void;
    handleCellClick: (e: React.MouseEvent, person: Person, date: Date) => void;
    globalStats: { present: number; total: number };
    teamStats: Record<string, { present: number; total: number }>;
    isViewer: boolean;
    hideAbsenceDetails?: boolean;
    idPrefix?: string;
}

export const DailyAttendanceView: React.FC<DailyAttendanceViewProps> = ({
    date: currentDate,
    teams,
    people: sortedPeople,
    teamRotations,
    absences,
    hourlyBlockages,
    companies,
    collapsedTeams,
    toggleTeam,
    onSelectPerson,
    handleCellClick,
    globalStats,
    teamStats,
    isViewer,
    hideAbsenceDetails,
    idPrefix = ''
}) => {
    return (
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/40 pb-32">
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
                    {teams.map(team => {
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

                                {/* Personnel List Container */}
                                {!collapsedTeams.has(team.id) && (
                                    <div className="bg-white divide-y divide-slate-50 shadow-inner">
                                        {members.map(person => {
                                            const avail = getEffectiveAvailability(person, currentDate, teamRotations, absences, hourlyBlockages);
                                            const dateKey = currentDate.toLocaleDateString('en-CA');
                                            const relevantAbsence = absences.find(a =>
                                                a.person_id === person.id &&
                                                a.start_date <= dateKey &&
                                                a.end_date >= dateKey
                                            );
                                            const isExitRequest = !!relevantAbsence;
                                            const statusConfig = getAttendanceVisualProps(currentDate, person, teamRotations, absences, hourlyBlockages);

                                            return (
                                                <div
                                                    key={person.id}
                                                    id={`${idPrefix}attendance-cell-${person.id}-${dateKey}`}
                                                    onClick={(e) => handleCellClick(e, person, currentDate)}
                                                    className="flex items-center justify-between px-3 md:px-6 py-3 md:py-5 bg-white hover:bg-slate-50/80 active:bg-slate-100 transition-all min-h-[64px] md:min-h-[80px] cursor-pointer group border-b border-slate-50 gap-2 md:gap-4"
                                                    role="button"
                                                    tabIndex={0}
                                                >
                                                    {/* Person Info */}
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

                                                    {/* Visual Connector */}
                                                    <div className="flex-1 mx-2 md:mx-6 h-px border-t border-dashed border-slate-100 transition-all duration-300 group-hover:border-slate-200" />

                                                    {/* Status Pill */}
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
    );
};
