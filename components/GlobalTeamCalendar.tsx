import React, { useState } from 'react';
import { Person, Team, TeamRotation } from '../types';
import { ChevronRight, ChevronLeft, Calendar as CalendarIcon, ArrowRight, ArrowLeft, Home, X, Settings, User, Users, ChevronDown, ListChecks, Info, Filter } from 'lucide-react';
import { getEffectiveAvailability, getRotationStatusForDate } from '../utils/attendanceUtils';

interface GlobalTeamCalendarProps {
    teams: Team[];
    people: Person[];
    teamRotations: TeamRotation[];
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
    teams, people, teamRotations,
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
            days.push(<div key={`empty-${i}`} className="min-h-[80px] md:min-h-[100px] bg-slate-50/30 border-b border-r border-slate-100 last:border-r-0 transform-gpu" />);
        }

        // Days
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month, d);
            const isToday = new Date().toDateString() === date.toDateString();

            // Filter Data
            const relevantPeople = people.filter(p => !p.teamId || selectedTeamIds.has(p.teamId || 'no-team'));
            let totalPeople = 0;
            let presentPeople = 0;
            relevantPeople.forEach(person => {
                totalPeople++;
                const avail = getEffectiveAvailability(person, date, teamRotations);
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
                        min-h-[80px] md:min-h-[120px] 
                        border-b border-r border-slate-100 last:border-r-0 
                        relative p-2 md:p-3
                        transition-all active:scale-[0.98] cursor-pointer 
                        flex flex-col items-start justify-between
                        ${bgClass}
                    `}
                >
                    {/* Date Number */}
                    <span className={`text-xl md:text-2xl font-bold leading-none ${dateColorClass} ${isToday ? 'bg-blue-100 px-2 py-0.5 rounded-full' : ''}`}>
                        {d}
                    </span>

                    {/* Percentage Indicator - Visible on Mobile too now */}
                    <div className="flex flex-col items-center w-full mt-1 md:mt-2">
                        <span className={`text-xs md:text-lg font-black ${percentage >= 80 ? 'text-emerald-700' : percentage >= 50 ? 'text-amber-700' : 'text-red-700'}`}>
                            {percentage}%
                        </span>
                        <span className="hidden md:inline text-xs text-slate-400 font-medium">
                            {presentPeople}/{totalPeople}
                        </span>
                    </div>

                    {/* Mobile Indicators (Dots/Minimal) */}
                    <div className="md:hidden flex items-center justify-end w-full gap-1 mt-1">
                        {/* Maybe a small dot if there are constraints/notes? */}
                        {/* We use background color as primary indicator. */}
                        {/* Show small People Icon if full? No, too cluttered. */}
                    </div>
                </div>
            );
        }
        return days;
    };

    const weekDays = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

    return (
        <div className="bg-white md:rounded-2xl shadow-sm border md:border-slate-200 overflow-hidden flex flex-col h-full animate-fadeIn min-h-[500px]">
            {/* Native-Like Action Bar */}
            <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 px-3 py-3 flex items-center justify-between shadow-sm gap-2">

                {/* Right: View Toggles (RTL Start) */}
                <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 px-1">
                    {onViewTypeChange && (
                        <>
                            <button
                                onClick={() => onViewTypeChange('grid')}
                                className={`p-1.5 rounded-md transition-all flex items-center justify-center ${viewType === 'grid' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                title="תצוגת יומן"
                            >
                                <CalendarIcon size={18} />
                            </button>
                            <div className="w-px h-4 bg-slate-200 mx-0.5"></div>
                            <button
                                onClick={() => onViewTypeChange('table')}
                                className={`p-1.5 rounded-md transition-all flex items-center justify-center ${viewType === 'table' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                title="תצוגת רשימה"
                            >
                                <ListChecks size={18} />
                            </button>
                        </>
                    )}
                </div>

                {/* Center: Month/Year Dropdowns */}
                <div className="flex items-center justify-center flex-1 md:flex-none gap-2">
                    <div className="flex items-center gap-0.5 bg-slate-50 rounded-lg px-2 py-1 border border-transparent hover:border-slate-200 transition-colors">
                        {/* Month Select */}
                        <div className="relative group">
                            <select
                                value={month}
                                onChange={(e) => onDateChange(new Date(year, parseInt(e.target.value), 1))}
                                className="appearance-none bg-transparent font-black text-slate-800 text-sm md:text-xl text-center pr-4 pl-1 focus:outline-none cursor-pointer w-full"
                                style={{ direction: 'rtl' }}
                            >
                                {Array.from({ length: 12 }, (_, i) => (
                                    <option key={i} value={i}>
                                        {new Date(2000, i, 1).toLocaleDateString('he-IL', { month: 'long' })}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown size={12} className="absolute top-1/2 left-0 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>

                        <span className="text-slate-300">|</span>

                        {/* Year Select */}
                        <div className="relative group">
                            <select
                                value={year}
                                onChange={(e) => onDateChange(new Date(parseInt(e.target.value), month, 1))}
                                className="appearance-none bg-transparent font-black text-slate-800 text-sm md:text-xl text-center pr-4 pl-1 focus:outline-none cursor-pointer"
                                style={{ direction: 'rtl' }}
                            >
                                {Array.from({ length: 10 }, (_, i) => year - 5 + i).map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                            <ChevronDown size={12} className="absolute top-1/2 left-0 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                    </div>
                </div>

                {/* Left: Filters & Toggle & Info (RTL End) */}
                <div className="flex items-center gap-1 md:gap-2">
                    {/* Team Filter Icon */}
                    <div className="relative">
                        <button
                            onClick={() => setShowTeamFilter(!showTeamFilter)}
                            className={`p-2 rounded-full transition-colors ${showTeamFilter || selectedTeamIds.size !== teams.length ? 'bg-blue-100 text-blue-600 relative' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >
                            <Filter size={18} />
                            {selectedTeamIds.size !== teams.length && (
                                <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                            )}
                        </button>
                        {/* Mobile & Desktop Popup for Filter */}
                        {showTeamFilter && (
                            <div className="absolute top-full left-0 md:right-0 mt-3 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 z-[100] overflow-hidden animate-in zoom-in-95 origin-top-left md:origin-top-right">
                                <div className="p-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                                    <span className="text-xs font-black text-slate-500 uppercase">סינון צוותים</span>
                                    <button onClick={() => setSelectedTeamIds(selectedTeamIds.size === teams.length ? new Set() : new Set(teams.map(t => t.id)))} className="text-xs font-bold text-blue-600">
                                        {selectedTeamIds.size === teams.length ? 'נקה' : 'בחר הכל'}
                                    </button>
                                </div>
                                <div className="max-h-60 overflow-y-auto p-2 space-y-1">
                                    {teams.map(t => (
                                        <label key={t.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer">
                                            <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-blue-600" checked={selectedTeamIds.has(t.id)} onChange={() => {
                                                const next = new Set(selectedTeamIds);
                                                if (next.has(t.id)) next.delete(t.id); else next.add(t.id);
                                                setSelectedTeamIds(next);
                                            }} />
                                            <span className="text-sm font-medium text-slate-800">{t.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>



                    {/* Info Legend */}
                    <div className="relative">
                        <button onClick={() => setShowLegend(!showLegend)} className="p-2 text-slate-400 hover:text-blue-600 rounded-full hover:bg-blue-50 transition-colors">
                            <Info size={18} />
                        </button>
                        {showLegend && (
                            <div className="absolute top-full left-0 mt-3 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 z-[100] p-4 animate-in zoom-in-95 origin-top-left">
                                <h4 className="text-sm font-black text-slate-800 mb-3">מקרא נוכחות</h4>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-4 h-4 rounded-full bg-emerald-100 border border-emerald-200 shadow-sm" />
                                        <span className="text-sm text-slate-600">80%+ (נוכחות מלאה)</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-4 h-4 rounded-full bg-amber-100 border border-amber-200 shadow-sm" />
                                        <span className="text-sm text-slate-600">50%-80% (נוכחות חלקית)</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-4 h-4 rounded-full bg-red-100 border border-red-200 shadow-sm" />
                                        <span className="text-sm text-slate-600">מתחת ל-50% (נוכחות דלילה)</span>
                                    </div>
                                </div>
                                <button onClick={() => setShowLegend(false)} className="w-full mt-4 py-2 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-200">סגור</button>
                            </div>
                        )}
                    </div>


                </div>
            </div>

            {/* Grid Header (Days) */}
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 sticky top-[60px] z-20 shadow-sm">
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


