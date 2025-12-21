import React, { useState } from 'react';
import { Person, Team, TeamRotation } from '../types';
import { ChevronRight, ChevronLeft, ChevronDown, Calendar, Users, Home } from 'lucide-react';
import { getEffectiveAvailability } from '../utils/attendanceUtils';

interface AttendanceTableProps {
    teams: Team[];
    people: Person[];
    teamRotations: TeamRotation[];
    currentDate: Date;
    onDateChange: (date: Date) => void;
    onSelectPerson: (person: Person) => void; // NEW
}

export const AttendanceTable: React.FC<AttendanceTableProps> = ({
    teams, people, teamRotations, currentDate, onDateChange, onSelectPerson
}) => {
    const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(new Set());

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthName = currentDate.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });

    const handlePrevMonth = () => onDateChange(new Date(year, month - 1, 1));
    const handleNextMonth = () => onDateChange(new Date(year, month + 1, 1));
    const handleToday = () => onDateChange(new Date());

    const toggleTeam = (teamId: string) => {
        setCollapsedTeams(prev => {
            const next = new Set(prev);
            if (next.has(teamId)) next.delete(teamId);
            else next.add(teamId);
            return next;
        });
    };

    // Calculate dates array
    const dates = [];
    for (let d = 1; d <= daysInMonth; d++) {
        dates.push(new Date(year, month, d));
    }

    const weekDaysShort = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full animate-fadeIn transition-all">
            {/* Header Controls */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white text-slate-800 shrink-0">
                <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Calendar className="text-indigo-600" />
                        טבלת נוכחות מפורטת
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
                </div>
            </div>

            {/* Table Container */}
            <div className="flex-1 overflow-auto bg-slate-50/30 relative">
                {/* Table Header */}
                <div className="flex sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm min-w-max">
                    {/* Sticky Corner - Name Column Header */}
                    <div className="sticky right-0 w-48 shrink-0 p-3 bg-slate-50 border-l border-slate-200 font-bold text-slate-700 text-sm flex items-center z-40 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)]">
                        שם החייל
                    </div>

                    {/* Date Headers */}
                    <div className="flex">
                        {dates.map((date) => {
                            const isToday = new Date().toDateString() === date.toDateString();
                            const dayOfWeek = date.getDay();
                            const isWeekend = dayOfWeek === 5 || dayOfWeek === 6; // Fri/Sat

                            return (
                                <div key={date.toISOString()} className={`shrink-0 w-16 p-2 text-center border-l border-slate-100 flex flex-col justify-center items-center ${isToday ? 'bg-blue-50' : 'bg-white'}`}>
                                    <div className={`text-xs font-bold ${isToday ? 'text-blue-600' : isWeekend ? 'text-indigo-400' : 'text-slate-700'}`}>
                                        {date.getDate()}
                                    </div>
                                    <div className="text-[10px] text-slate-400">
                                        {weekDaysShort[dayOfWeek]}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Table Body */}
                <div className="min-w-max">
                    {teams.map(team => {
                        const teamPeople = people.filter(p => p.teamId === team.id);
                        if (teamPeople.length === 0) return null;
                        const isCollapsed = collapsedTeams.has(team.id);

                        return (
                            <div key={team.id} className="border-b border-slate-200">
                                {/* Team Header Row */}
                                <div
                                    className="sticky right-0 left-0 bg-slate-100 flex items-center px-4 py-2 cursor-pointer hover:bg-slate-200 transition-colors z-20"
                                    onClick={() => toggleTeam(team.id)}
                                >
                                    <div className="flex items-center gap-2 flex-1">
                                        <ChevronDown size={16} className={`text-slate-500 transition-transform ${isCollapsed ? 'rotate-90' : ''}`} />
                                        <span className="font-bold text-slate-700 text-sm">{team.name}</span>
                                        <span className="text-xs text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                                            {teamPeople.length} לוחמים
                                        </span>
                                    </div>
                                </div>

                                {/* People Rows */}
                                {!isCollapsed && (
                                    <div>
                                        {teamPeople.map((person, idx) => (
                                            <div key={person.id} className={`flex border-b border-slate-100 hover:bg-slate-50 transition-colors h-12 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/20'}`}>
                                                {/* Sticky Name Cell */}
                                                <div
                                                    className={`w-48 shrink-0 px-3 py-2 border-l border-slate-100 sticky right-0 z-10 flex items-center gap-2 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)] cursor-pointer hover:bg-slate-100 transition-colors group ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}
                                                    onClick={() => onSelectPerson(person)}
                                                >
                                                    <div
                                                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white shadow-sm"
                                                        style={{ backgroundColor: team.color || '#94a3b8' }}
                                                    >
                                                        {person.name.charAt(0)}
                                                    </div>
                                                    <span className="text-sm font-medium text-slate-700 truncate group-hover:text-blue-600 transition-colors" title={person.name}>
                                                        {person.name}
                                                    </span>
                                                </div>

                                                {/* Date Cells */}
                                                <div className="flex">
                                                    {dates.map((date) => {
                                                        const avail = getEffectiveAvailability(person, date, teamRotations);
                                                        const isAvailable = avail.isAvailable;

                                                        // Simple status derived from isAvailable
                                                        // In future, "unavailable" reason could be shown if avail.reason exists

                                                        return (
                                                            <div key={date.toISOString()} className="shrink-0 w-16 p-1 border-l border-slate-100 flex items-center justify-center">
                                                                {isAvailable ? (
                                                                    <div className="w-full h-full bg-blue-50 text-blue-700 rounded text-[10px] font-bold flex items-center justify-center border border-blue-100">
                                                                        בבסיס
                                                                    </div>
                                                                ) : (
                                                                    <div className="w-full h-full bg-slate-50 text-slate-400 rounded text-[10px] flex items-center justify-center">
                                                                        בית
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
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
