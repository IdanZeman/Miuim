import React, { useState } from 'react';
import { Person, Team, TeamRotation } from '../types';
import { ChevronRight, ChevronLeft, ChevronDown, Calendar, Users, Home } from 'lucide-react';
import { getEffectiveAvailability } from '../utils/attendanceUtils';

import { StatusEditPopover } from './StatusEditPopover';

interface AttendanceTableProps {
    teams: Team[];
    people: Person[];
    teamRotations: TeamRotation[];
    currentDate: Date;
    onDateChange: (date: Date) => void;
    onSelectPerson: (person: Person) => void;
    onUpdateAvailability?: (personId: string, date: string, status: 'base' | 'home' | 'unavailable', customTimes?: { start: string, end: string }) => void; // NEW
}

export const AttendanceTable: React.FC<AttendanceTableProps> = ({
    teams, people, teamRotations, currentDate, onDateChange, onSelectPerson, onUpdateAvailability
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

    const [editingCell, setEditingCell] = useState<{ personId: string; date: string; position: { top: number; left: number } } | null>(null);

    const handleCellClick = (e: React.MouseEvent, person: Person, date: Date) => {
        if (!onUpdateAvailability) return;

        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setEditingCell({
            personId: person.id,
            date: date.toLocaleDateString('en-CA'),
            position: { top: rect.bottom + window.scrollY, left: rect.left + window.scrollX }
        });
    };

    const handleApplyStatus = (status: 'base' | 'home' | 'unavailable', customTimes?: { start: string, end: string }) => {
        if (!editingCell || !onUpdateAvailability) return;

        onUpdateAvailability(editingCell.personId, editingCell.date, status, customTimes);
        setEditingCell(null);
    };

    // ... existing return ...
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full animate-fadeIn transition-all">
            {/* Header Controls */}
            {/* ... */}

            {/* Table Container */}
            <div className="flex-1 overflow-auto bg-slate-50/30 relative">
                {/* ... existing table code ... */}
                {/* Table Body */}
                <div className="min-w-max">
                    {teams.map(team => {
                        const teamPeople = people.filter(p => p.teamId === team.id);
                        if (teamPeople.length === 0) return null;
                        const isCollapsed = collapsedTeams.has(team.id);

                        return (
                            <div key={team.id} className="border-b border-slate-200">
                                {/* Team Header Row */}
                                {/* ... */}

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
                                                            <div
                                                                key={date.toISOString()}
                                                                className="shrink-0 w-16 p-1 border-l border-slate-100 flex items-center justify-center cursor-pointer hover:ring-1 hover:ring-blue-300 transition-all"
                                                                onClick={(e) => handleCellClick(e, person, date)}
                                                            >
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

            <StatusEditPopover
                isOpen={!!editingCell}
                position={editingCell ? editingCell.position : { top: 0, left: 0 }}
                onClose={() => setEditingCell(null)}
                onApply={handleApplyStatus}
            />
        </div>
    );
};
