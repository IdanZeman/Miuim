import React, { useState } from 'react';
import { Person, Team, TeamRotation, Absence } from '@/types';
import { CaretRight as ChevronRight, CaretLeft as ChevronLeft, CalendarBlank as CalendarIcon, ArrowRight, ArrowLeft, House as Home, X, Gear as Settings, User, Users, CaretDown as ChevronDown, ListChecks, Info, Funnel as Filter } from '@phosphor-icons/react';
import { getEffectiveAvailability, getRotationStatusForDate } from '@/utils/attendanceUtils';

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
    unifiedPresence?: import('@/types').DailyPresence[]; // NEW
}

export const GlobalTeamCalendar: React.FC<GlobalTeamCalendarProps> = ({
    teams, people, teamRotations, absences = [], hourlyBlockages = [],
    onManageTeam, onToggleTeamAvailability, onDateClick,
    currentDate, onDateChange,
    viewType = 'grid', onViewTypeChange, organizationName,
    unifiedPresence = []
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
            days.push(<div key={`empty-${i}`} className="min-h-[100px] md:min-h-[120px] bg-slate-50/20 border-b border-r border-slate-100 last:border-r-0" />);
        }

        // Days
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month, d);
            const isToday = new Date().toDateString() === date.toDateString();

            // Filter Data
            const relevantPeople = people.filter(p => (p.isActive !== false) && (!p.teamId || selectedTeamIds.has(p.teamId || 'no-team')));
            let totalPeople = 0;
            let presentPeople = 0;
            relevantPeople.forEach(person => {
                totalPeople++;
                const avail = getEffectiveAvailability(person, date, teamRotations, absences, hourlyBlockages, unifiedPresence);
                if (avail.isAvailable) presentPeople++;
            });

            const percentage = totalPeople > 0 ? Math.round((presentPeople / totalPeople) * 100) : 0;

            // Mobile Heatmap Logic: Background Color based on status
            // Green (>80%), Yellow (50-80%), Red (<50%)
            let bgClass = 'bg-white';
            let dateColorClass = isToday ? 'text-blue-600' : 'text-slate-800';

            if (percentage >= 80) bgClass = 'bg-emerald-50/80';
            else if (percentage >= 50) bgClass = 'bg-amber-50/80';
            else if (totalPeople > 0) bgClass = 'bg-red-50/80';

            // Desktop: Keep stroke/border feel? Or unify? User wants "native mobile app". 
            // We will stick to the "Cell" design.

            days.push(
                <div
                    key={d}
                    onClick={() => onDateClick(date)}
                    className={`
                        min-h-[100px] md:min-h-[140px] 
                        border-b border-r border-slate-100 last:border-r-0 
                        relative p-3 md:p-4
                        transition-all active:scale-[0.98] cursor-pointer 
                        flex flex-col items-center justify-center gap-1
                        ${bgClass}
                    `}
                >
                    {/* Date Number */}
                    <span className={`text-2xl md:text-3xl font-black ${dateColorClass} ${isToday ? 'bg-blue-600 text-white w-9 h-9 md:w-12 md:h-12 flex items-center justify-center rounded-full shadow-lg shadow-blue-200' : ''}`}>
                        {d}
                    </span>

                    {/* Attendance Indicator */}
                    <div className="flex flex-col items-center">
                        <span className={`text-sm md:text-xl font-black ${percentage >= 80 ? 'text-emerald-700' : percentage >= 50 ? 'text-amber-700' : 'text-red-700'}`}>
                            {presentPeople}/{totalPeople}
                        </span>
                        <span className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                            {percentage}% נוכחים
                        </span>
                    </div>
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


