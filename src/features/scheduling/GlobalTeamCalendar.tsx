import React, { useState } from 'react';
import { Person, Team, TeamRotation, Absence } from '@/types';
import { CaretRight as ChevronRight, CaretLeft as ChevronLeft, CalendarBlank as CalendarIcon, ArrowRight, ArrowLeft, House as Home, X, Gear as Settings, User, Users, CaretDown as ChevronDown, ListChecks, Info, Funnel as Filter } from '@phosphor-icons/react';
import { getEffectiveAvailability, getRotationStatusForDate, isPersonPresentAtHour } from '@/utils/attendanceUtils';

interface GlobalTeamCalendarProps {
    teams: Team[];
    people: Person[];
    teamRotations: TeamRotation[];
    absences?: Absence[]; // NEW
    hourlyBlockages?: import('@/types').HourlyBlockage[]; // NEW
    onManageTeam?: (teamId: string) => void;
    onToggleTeamAvailability?: (teamId: string, date: Date, isAvailable: boolean) => void;
    onDateClick: (date: Date) => void;
    currentDate: Date;
    onDateChange: (date: Date) => void;
    viewType?: 'grid' | 'table';
    onViewTypeChange?: (type: 'grid' | 'table') => void;
    organizationName?: string;
}

export const GlobalTeamCalendar: React.FC<GlobalTeamCalendarProps> = ({
    teams, people, teamRotations, absences = [], hourlyBlockages = [],
    onManageTeam, onToggleTeamAvailability, onDateClick,
    currentDate, onDateChange,
    viewType = 'grid', onViewTypeChange, organizationName
}) => {
    const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set(teams.map(t => t.id)));
    const [showTeamFilter, setShowTeamFilter] = useState(false);
    const [showLegend, setShowLegend] = useState(false);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay(); // 0 = Sunday

    const monthName = currentDate.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });

    const handlePrevMonth = () => onDateChange(new Date(year, month - 1, 1));
    const handleNextMonth = () => onDateChange(new Date(year, month + 1, 1));
    const handleToday = () => onDateChange(new Date());

    const renderCalendarDays = () => {
        const days = [];
        // Empty slots
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="min-h-[75px] md:min-h-[110px] bg-slate-50/20 border-b border-r border-slate-100 last:border-r-0" />);
        }

        // Days
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month, d);
            const isToday = new Date().toDateString() === date.toDateString();

            // Filter Data
            const relevantPeople = people.filter(p => (p.isActive !== false) && (!p.teamId || selectedTeamIds.has(p.teamId || 'no-team')));
            let totalPeople = 0;
            let presentPeople = 0;
            
            // Use consistent time reference for counting present people
            const refTime = isToday
                ? `${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}`
                : '12:00';
            
            relevantPeople.forEach(person => {
                totalPeople++;
                // FIX: Use isPersonPresentAtHour for consistent counting across views
                if (isPersonPresentAtHour(person, date, refTime, teamRotations, absences, hourlyBlockages)) {
                    presentPeople++;
                }
            });

            const percentage = totalPeople > 0 ? Math.round((presentPeople / totalPeople) * 100) : 0;

            // Mobile Heatmap Logic: Background Color based on status
            // Green (>80%), Yellow (50-80%), Red (<50%)
            let bgClass = 'bg-white';
            let borderClass = 'border-slate-200';
            let dateColorClass = isToday ? 'text-white' : 'text-slate-800';

            if (percentage >= 80) bgClass = 'bg-emerald-50/40';
            else if (percentage >= 50) bgClass = 'bg-amber-50/40';
            else if (totalPeople > 0) bgClass = 'bg-rose-50/40';

            days.push(
                <div
                    key={d}
                    onClick={() => onDateClick(date)}
                    className={`
                        min-h-[75px] md:min-h-[120px] 
                        border-b border-r ${borderClass}
                        relative p-1.5 md:p-3
                        transition-all duration-200 hover:bg-slate-50/50 cursor-pointer 
                        flex flex-col items-center justify-center gap-1 md:gap-2
                        group active:scale-95
                        ${bgClass}
                    `}
                >
                    {/* Date Number */}
                    <span className={`
                        text-lg md:text-3xl font-black 
                        flex items-center justify-center 
                        transition-transform group-hover:scale-110
                        ${isToday
                            ? 'bg-blue-600 text-white w-8 h-8 md:w-14 md:h-14 rounded-xl shadow-lg shadow-blue-200'
                            : dateColorClass
                        }
                    `}>
                        {d}
                    </span>

                    {/* Attendance Indicator */}
                    <div className="flex flex-col items-center gap-0">
                        <div className={`
                            flex items-center px-1 md:px-2 py-0.5 rounded-full
                            ${percentage >= 80 ? 'bg-emerald-100 text-emerald-800' :
                                percentage >= 50 ? 'bg-amber-100 text-amber-800' :
                                    'bg-rose-100 text-rose-800'}
                        `}>
                            <div className="flex items-baseline gap-0.5" dir="ltr">
                                <span className="text-[10px] md:text-lg font-black">
                                    {presentPeople}
                                </span>
                                <span className="text-[9px] md:text-base font-bold opacity-40">/</span>
                                <span className="text-[8px] md:text-sm font-bold opacity-80">
                                    {totalPeople}
                                </span>
                            </div>
                        </div>
                        <span className="hidden md:block text-[10px] text-slate-400 font-extrabold uppercase tracking-tighter opacity-70">
                            {percentage}% נוכחים
                        </span>
                    </div>

                    {/* Today Dot Alternative (if not using the big blue box) */}
                    {isToday && !isToday && (
                        <div className="absolute top-2 right-2 w-2 h-2 bg-blue-600 rounded-full shadow-[0_0_8px_rgba(37,99,235,0.6)]" />
                    )}
                </div>
            );
        }
        return days;
    };

    const weekDays = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

    return (
        <div className="flex flex-col h-full animate-fadeIn overflow-hidden">
            {/* Grid Header (Days) */}
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 sticky top-0 z-20">
                {weekDays.map(day => (
                    <div key={day} className="py-2 text-center text-xs font-black text-slate-400 uppercase tracking-wider">
                        {day}
                    </div>
                ))}
            </div>

            {/* Main Calendar Grid */}
            <div className="flex-1 overflow-y-auto bg-white">
                <div className="grid grid-cols-7 auto-rows-fr">
                    {renderCalendarDays()}
                </div>
            </div>
        </div>
    );
};


