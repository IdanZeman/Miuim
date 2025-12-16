import React, { useState } from 'react';
import { Person, Team, TeamRotation } from '../types';
import { ChevronRight, ChevronLeft, Calendar as CalendarIcon, ArrowRight, ArrowLeft, Home, X, Settings, User, Users } from 'lucide-react';
import { getEffectiveAvailability, getRotationStatusForDate } from '../utils/attendanceUtils';

interface GlobalTeamCalendarProps {
    teams: Team[];
    people: Person[];
    teamRotations: TeamRotation[];
    onManageTeam?: (teamId: string) => void;
    onToggleTeamAvailability?: (teamId: string, date: Date, isAvailable: boolean) => void;
    onDateClick: (date: Date) => void; // New prop
}

export const GlobalTeamCalendar: React.FC<GlobalTeamCalendarProps> = ({ teams, people, teamRotations, onManageTeam, onToggleTeamAvailability, onDateClick }) => {
    const [currentDate, setCurrentDate] = useState(new Date());

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
    const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay(); // 0 = Sunday

    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    const monthName = currentDate.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });

    const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
    const handleToday = () => setCurrentDate(new Date());

    const renderCalendarDays = () => {
        const days = [];

        // Empty slots
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="min-h-[100px] bg-slate-50/50 border border-slate-100"></div>);
        }

        // Days
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month, d);
            const isToday = new Date().toDateString() === date.toDateString();

            // Calculate aggregate stats
            let totalPeople = 0;
            let presentPeople = 0;

            people.forEach(person => {
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
                    className={`min-h-[100px] border border-slate-100 relative p-2 transition-all hover:bg-blue-50/50 cursor-pointer group flex flex-col justify-between ${isToday ? 'bg-blue-50/30 ring-1 ring-inset ring-blue-200' : 'bg-white'}`}
                >
                    <div className={`flex justify-between items-start mb-1 ${isToday ? 'text-blue-600 font-bold' : 'text-slate-400'}`}>
                        <span className="text-sm">{d}</span>
                        {isToday && <span className="text-[9px] bg-blue-100 px-1.5 py-0.5 rounded-full">היום</span>}
                    </div>

                    <div className="flex flex-col items-center justify-center flex-1 gap-1">
                        <div className={`text-2xl font-bold ${textColor}`}>
                            {presentPeople}
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                            <Users size={10} />
                            מתוך {totalPeople}
                        </div>
                    </div>

                    {/* Mini progress bar */}
                    <div className="w-full h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
                        <div 
                            className={`h-full rounded-full transition-all ${percentage > 80 ? 'bg-green-500' : percentage > 50 ? 'bg-yellow-400' : 'bg-red-400'}`}
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
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white text-slate-800">
                <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <CalendarIcon className="text-blue-600" />
                        מבט חודשי
                    </h2>
                </div>
                <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg border border-slate-100">
                    <button onClick={handlePrevMonth} className="p-1.5 hover:bg-white rounded-md text-slate-600 transition-colors shadow-sm">
                        <ChevronRight size={18} />
                    </button>
                    <span className="text-sm font-bold text-slate-700 w-24 text-center">{monthName}</span>
                    <button onClick={handleNextMonth} className="p-1.5 hover:bg-white rounded-md text-slate-600 transition-colors shadow-sm">
                        <ChevronLeft size={18} />
                    </button>
                    <div className="w-px h-4 bg-slate-200 mx-1"></div>
                    <button onClick={handleToday} className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition-colors">
                        היום
                    </button>
                </div>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-auto bg-slate-50/30">
                <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
                    {weekDays.map(day => (
                        <div key={day} className="py-2 text-center text-xs font-bold text-slate-500 border-r border-slate-100 last:border-0">
                            {day}
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-7 bg-white">
                    {renderCalendarDays()}
                </div>
            </div>
        </div>
    );
};
