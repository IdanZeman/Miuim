import React, { useState } from 'react';
import { Person, Team, TeamRotation } from '../types';
import { ChevronRight, ChevronLeft, Calendar as CalendarIcon, ArrowRight, ArrowLeft, Home, X, Settings, User, Users, ChevronDown } from 'lucide-react';
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
}

export const GlobalTeamCalendar: React.FC<GlobalTeamCalendarProps> = ({
    teams, people, teamRotations,
    onManageTeam, onToggleTeamAvailability, onDateClick,
    currentDate, onDateChange
}) => {
    const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set(teams.map(t => t.id)));
    const [showTeamFilter, setShowTeamFilter] = useState(false);
    // const [currentDate, setCurrentDate] = useState(new Date()); // Removed

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
    const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay(); // 0 = Sunday

    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    const monthName = currentDate.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });

    const handlePrevMonth = () => onDateChange(new Date(year, month - 1, 1));
    const handleNextMonth = () => onDateChange(new Date(year, month + 1, 1));
    const handleToday = () => onDateChange(new Date());

    const renderCalendarDays = () => {
        const days = [];

        // Empty slots
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="min-h-[60px] md:min-h-[100px] bg-slate-50/50 border border-slate-100"></div>);
        }

        // Days
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month, d);
            const isToday = new Date().toDateString() === date.toDateString();

            // Filter people based on selected teams
            const relevantPeople = people.filter(p => !p.teamId || selectedTeamIds.has(p.teamId || 'no-team'));

            let totalPeople = 0;
            let presentPeople = 0;

            relevantPeople.forEach(person => {
                totalPeople++;
                const avail = getEffectiveAvailability(person, date, teamRotations);
                if (avail.isAvailable) {
                    presentPeople++;
                }
            });

            const percentage = totalPeople > 0 ? Math.round((presentPeople / totalPeople) * 100) : 0;

            // Color coding based on percentage
            let statusColor = 'bg-slate-50';
            let textColor = 'text-slate-500';
            if (percentage > 80) { statusColor = 'bg-green-50'; textColor = 'text-green-700'; }
            else if (percentage > 50) { statusColor = 'bg-yellow-50'; textColor = 'text-yellow-700'; }
            else if (percentage > 0) { statusColor = 'bg-red-50'; textColor = 'text-red-700'; }

            days.push(
                <div
                    key={d}
                    onClick={() => onDateClick(date)}
                    className={`min-h-[60px] md:min-h-[110px] border border-slate-100 relative p-1 md:p-2 transition-all hover:shadow-inner cursor-pointer group flex flex-col justify-between ${isToday ? 'bg-blue-50/10 ring-1 ring-inset ring-blue-200' : 'bg-white'}`}
                >
                    <div className={`flex justify-between items-start mb-0.5 ${isToday ? 'text-blue-600 font-bold' : 'text-slate-400'}`}>
                        <span className="text-xs md:text-sm">{d}</span>
                        {isToday && <span className="text-[8px] md:text-[9px] bg-blue-500 text-white px-1.5 md:px-2 py-0.5 rounded-full shadow-sm">היום</span>}
                    </div>

                    <div className="flex flex-col items-center justify-center flex-1 py-1">
                        <div className={`text-sm md:text-xl font-black mb-0.5 ${percentage > 80 ? 'text-green-600' : percentage > 50 ? 'text-orange-500' : 'text-red-500'}`}>
                            {percentage}%
                        </div>
                        <div className="text-[9px] md:text-[11px] text-slate-400 font-semibold flex items-center gap-1 opacity-80">
                            <Users size={12} className="text-slate-300" />
                            <span>{presentPeople}/{totalPeople}</span>
                        </div>
                    </div>

                    {/* Progress indicator */}
                    <div className="w-full h-1 bg-slate-50 rounded-full mt-auto relative overflow-hidden">
                        <div
                            className={`h-full transition-all duration-700 ease-out shadow-[0_0_8px_rgba(0,0,0,0.1)] ${percentage > 80 ? 'bg-green-500' :
                                percentage > 50 ? 'bg-gradient-to-r from-orange-400 to-orange-500' :
                                    'bg-gradient-to-r from-red-400 to-red-500'
                                }`}
                            style={{ width: `${percentage}%` }}
                        ></div>
                    </div>
                </div>
            );
        }
        return days;
    };

    const weekDays = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full animate-fadeIn">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between bg-white text-slate-800 gap-4">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                            <CalendarIcon size={20} />
                        </div>
                        <h2 className="text-xl font-bold">מבט חודשי</h2>
                    </div>

                    <div className="h-8 w-px bg-slate-100 hidden md:block" />

                    {/* Team Filter */}
                    <div className="relative">
                        <button
                            onClick={() => setShowTeamFilter(!showTeamFilter)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-bold transition-all ${showTeamFilter ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}
                        >
                            <Users size={16} />
                            <span>סנן צוותים ({selectedTeamIds.size})</span>
                            <ChevronDown size={14} className={`transition-transform ${showTeamFilter ? 'rotate-180' : ''}`} />
                        </button>

                        {showTeamFilter && (
                            <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 z-50 p-2 animate-in zoom-in-95 fade-in duration-200">
                                <div className="p-2 flex items-center justify-between border-b border-slate-50 mb-1">
                                    <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">בחר צוותים</span>
                                    <button
                                        onClick={() => {
                                            if (selectedTeamIds.size === teams.length) setSelectedTeamIds(new Set());
                                            else setSelectedTeamIds(new Set(teams.map(t => t.id)));
                                        }}
                                        className="text-[10px] font-bold text-blue-600 hover:underline"
                                    >
                                        {selectedTeamIds.size === teams.length ? 'נקה הכל' : 'בחר הכל'}
                                    </button>
                                </div>
                                <div className="max-h-48 overflow-y-auto py-1">
                                    {teams.map(team => (
                                        <label key={team.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors group">
                                            <input
                                                type="checkbox"
                                                checked={selectedTeamIds.has(team.id)}
                                                onChange={() => {
                                                    const next = new Set(selectedTeamIds);
                                                    if (next.has(team.id)) next.delete(team.id);
                                                    else next.add(team.id);
                                                    setSelectedTeamIds(next);
                                                }}
                                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                                            />
                                            <span className="text-sm font-medium text-slate-700 group-hover:text-blue-700">{team.name}</span>
                                        </label>
                                    ))}
                                    {/* Option for No Team if any? */}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg border border-slate-100 w-full md:w-auto overflow-x-auto justify-between group">
                    <button onClick={handlePrevMonth} className="p-1.5 hover:bg-white rounded-md text-slate-600 transition-all shadow-sm active:scale-95">
                        <ChevronRight size={18} />
                    </button>
                    <span className="text-sm font-black text-slate-700 px-4 min-w-[120px] text-center">{monthName}</span>
                    <button onClick={handleNextMonth} className="p-1.5 hover:bg-white rounded-md text-slate-600 transition-all shadow-sm active:scale-95">
                        <ChevronLeft size={18} />
                    </button>
                    <div className="w-px h-5 bg-slate-200 mx-1"></div>
                    <button onClick={handleToday} className="text-xs font-black text-blue-600 hover:bg-white px-3 py-1.5 rounded-md transition-all shadow-sm hover:shadow-md">
                        היום
                    </button>
                </div>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-auto bg-slate-50/30">
                <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
                    {weekDays.map(day => (
                        <div key={day} className="py-2 text-center text-[10px] md:text-xs font-bold text-slate-500 border-r border-slate-100 last:border-0">
                            <span className="hidden md:inline">{day}</span>
                            <span className="md:hidden">{day[0]}</span>
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-7 bg-white">
                    {renderCalendarDays()}
                </div>
            </div>

            {/* Color Legend (מקרא צבעים) */}
            <div className="p-4 bg-white border-t border-slate-100 flex flex-wrap items-center justify-center gap-6">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                    <span className="text-xs font-bold text-slate-600">נוכחות גבוהה (80%+)</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.4)]" />
                    <span className="text-xs font-bold text-slate-600">נוכחות בינונית (50%+)</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.4)]" />
                    <span className="text-xs font-bold text-slate-600">נוכחות נמוכה (מתחת ל-50%)</span>
                </div>
                <div className="h-4 w-px bg-slate-200 mx-2 hidden md:block" />
                <div className="flex items-center gap-2">
                    <Users size={14} className="text-slate-400" />
                    <span className="text-[10px] text-slate-400 font-medium">מספר הלוחמים ביחידה / סה"כ בצוותים שנבחרו</span>
                </div>
            </div>
        </div>
    );
};
