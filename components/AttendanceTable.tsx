import React, { useState, useRef, useEffect } from 'react';
import { Person, Team, TeamRotation } from '../types';
import { ChevronRight, ChevronLeft, ChevronDown, Calendar, Users, Home, MapPin, XCircle, Clock, Info, CheckCircle2, Search } from 'lucide-react';
import { getEffectiveAvailability, getRotationStatusForDate } from '../utils/attendanceUtils';
import { StatusEditPopover } from './StatusEditPopover';

interface AttendanceTableProps {
    teams: Team[];
    people: Person[];
    teamRotations: TeamRotation[];
    currentDate: Date;
    onDateChange: (date: Date) => void;
    onSelectPerson: (person: Person) => void;
    onUpdateAvailability?: (personId: string, date: string, status: 'base' | 'home' | 'unavailable', customTimes?: { start: string, end: string }) => void;
    className?: string; // Allow parent styling for mobile sheet integration
}

export const AttendanceTable: React.FC<AttendanceTableProps> = ({
    teams, people, teamRotations, currentDate, onDateChange, onSelectPerson, onUpdateAvailability, className
}) => {
    const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(new Set());
    const [editingCell, setEditingCell] = useState<{ personId: string; date: string; position: { top: number; left: number } } | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

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

    const dates = [];
    for (let d = 1; d <= daysInMonth; d++) {
        dates.push(new Date(year, month, d));
    }

    const weekDaysShort = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

    const handleCellClick = (e: React.MouseEvent, person: Person, date: Date) => {
        if (!onUpdateAvailability) return;

        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();

        // Prevent opening if clicking on the same open cell (toggle off)
        const dateStr = date.toLocaleDateString('en-CA');
        if (editingCell?.personId === person.id && editingCell?.date === dateStr) {
            setEditingCell(null);
            return;
        }

        setEditingCell({
            personId: person.id,
            date: dateStr,
            position: { top: rect.bottom + window.scrollY, left: rect.left + window.scrollX }
        });
    };

    const handleApplyStatus = (status: 'base' | 'home' | 'unavailable', customTimes?: { start: string, end: string }) => {
        if (!editingCell || !onUpdateAvailability) return;
        onUpdateAvailability(editingCell.personId, editingCell.date, status, customTimes);
        setEditingCell(null);
    };

    // Auto-scroll to current day on mount
    useEffect(() => {
        if (scrollContainerRef.current) {
            const today = new Date();
            if (today.getMonth() === month && today.getFullYear() === year) {
                const dayWidth = 64; // Increased from 48
                const scrollPos = (today.getDate() - 1) * dayWidth;
                scrollContainerRef.current.scrollLeft = -scrollPos; // RTL scroll adjustment
            }
        }
    }, [month, year]);

    return (
        <div className="h-full flex flex-col relative" dir="rtl">
            {/* --- MOBILE DAY AGENDA VIEW --- */}
            <div className="md:hidden flex-1 overflow-y-auto custom-scrollbar bg-white pb-20">
                <div className="flex flex-col">
                    {teams.map(team => {
                        const members = people.filter(p => p.teamId === team.id);
                        if (members.length === 0) return null;

                        return (
                            <div key={team.id} className="relative">
                                {/* Sticky Team Header */}
                                <div className="sticky top-0 z-10 bg-slate-50 border-y border-slate-100 px-4 py-2 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-4 rounded-full" style={{ backgroundColor: team.color || '#cbd5e1' }} />
                                        <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{team.name}</h3>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-300">{members.length} לוחמים</span>
                                </div>

                                {/* Personnel List */}
                                <div className="divide-y divide-slate-50">
                                    {members.map(person => {
                                        const avail = getEffectiveAvailability(person, currentDate, teamRotations);
                                        const dateStr = currentDate.toLocaleDateString('en-CA');

                                        // Status Pill UI Logic
                                        let statusConfig = {
                                            label: 'לא ידוע',
                                            bg: 'bg-white border-slate-200 text-slate-400',
                                            dot: 'bg-slate-300',
                                            icon: Info
                                        };

                                        if (avail.status === 'base') {
                                            statusConfig = {
                                                label: avail.startHour !== '00:00' || avail.endHour !== '23:59' ? `${avail.startHour}-${avail.endHour}` : 'בבסיס',
                                                bg: 'bg-emerald-50 border-emerald-100 text-emerald-700',
                                                dot: 'bg-emerald-500',
                                                icon: CheckCircle2
                                            };
                                        } else if (avail.status === 'home') {
                                            statusConfig = {
                                                label: 'בבית',
                                                bg: 'bg-red-50 border-red-100 text-red-600',
                                                dot: 'bg-red-500',
                                                icon: Home
                                            };
                                        } else if (avail.status === 'unavailable') {
                                            statusConfig = {
                                                label: 'אילוץ',
                                                bg: 'bg-amber-50 border-amber-100 text-amber-700',
                                                dot: 'bg-amber-500',
                                                icon: Clock
                                            };
                                        }

                                        return (
                                            <div
                                                key={person.id}
                                                onClick={(e) => handleCellClick(e, person, currentDate)}
                                                className="flex items-center justify-between p-4 bg-white active:bg-slate-50 transition-colors h-[68px]"
                                            >
                                                {/* Left: Person Info */}
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-black text-white shadow-sm ring-2 ring-white"
                                                        style={{ backgroundColor: team.color || '#cbd5e1' }}
                                                    >
                                                        {person.name.charAt(0)}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-black text-slate-800 leading-none">{person.name}</span>
                                                        <span className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">לוחם</span>
                                                    </div>
                                                </div>

                                                {/* Right: Status Pill */}
                                                <div className={`
                                                    flex items-center gap-1.5 px-3 py-1.5 rounded-full border 
                                                    ${statusConfig.bg} transition-all shadow-sm
                                                `}>
                                                    <statusConfig.icon size={12} />
                                                    <span className="text-xs font-black whitespace-nowrap">{statusConfig.label}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* --- DESKTOP MONTHLY TABLE VIEW --- */}
            <div className="hidden md:flex flex-1 flex-col h-full overflow-hidden animate-fadeIn">
                {/* Table Area (Desktop Only) */}
                <div className="flex-1 overflow-auto bg-slate-50/10 relative custom-scrollbar" ref={scrollContainerRef}>
                    <div className="min-w-max">
                        {/* Floating Header (Dates) */}
                        <div className="flex sticky top-0 z-40">
                            <div className="w-60 shrink-0 bg-white border-b border-l border-slate-200 sticky right-0 z-50 flex items-center px-6 py-4 font-black text-slate-400 text-xs uppercase tracking-widest">
                                שם הלוחם
                            </div>
                            <div className="flex bg-white border-b border-slate-200">
                                {dates.map((date) => {
                                    const isToday = new Date().toDateString() === date.toDateString();
                                    const isWeekend = date.getDay() === 6; // Saturday
                                    return (
                                        <div
                                            key={date.toISOString()}
                                            className={`w-24 h-16 shrink-0 flex flex-col items-center justify-center border-l border-slate-100 transition-all relative ${isToday ? 'bg-blue-600 text-white z-10' : isWeekend ? 'bg-slate-50' : 'bg-white'}`}
                                        >
                                            <span className={`text-[11px] font-black uppercase mb-0.5 ${isToday ? 'text-blue-100' : isWeekend ? 'text-slate-500' : 'text-slate-400'}`}>
                                                {weekDaysShort[date.getDay()]}
                                            </span>
                                            <span className={`text-xl font-black ${isToday ? 'text-white' : 'text-slate-800'}`}>
                                                {date.getDate()}
                                            </span>
                                            {isToday && <div className="absolute top-0 right-0 left-0 h-1 bg-white/30" />}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Team Sections */}
                        {teams.map(team => {
                            const teamPeople = people.filter(p => p.teamId === team.id);
                            if (teamPeople.length === 0) return null;
                            const isCollapsed = collapsedTeams.has(team.id);

                            return (
                                <div key={team.id} className="relative">
                                    {/* Team Header Row */}
                                    <div
                                        onClick={() => toggleTeam(team.id)}
                                        className="flex sticky z-30 top-16 group cursor-pointer"
                                    >
                                        {/* Sticky Name Part */}
                                        <div className="w-60 shrink-0 bg-slate-100 border-b border-l border-slate-200 py-3 px-6 flex items-center gap-3 shadow-md sticky right-0 z-30">
                                            <div className={`transition-transform duration-300 ${isCollapsed ? 'rotate-0' : 'rotate-180'}`}>
                                                <ChevronDown size={18} className="text-slate-600" />
                                            </div>
                                            <span className="text-base font-black text-slate-900 tracking-tight">{team.name}</span>
                                            <span className="text-[11px] bg-white text-slate-600 px-2.5 py-1 rounded-lg font-black border border-slate-200 shadow-sm">
                                                {teamPeople.length} לוחמים
                                            </span>
                                        </div>
                                        {/* Background extension for the rest of the row */}
                                        <div className="flex-1 bg-slate-50 border-b border-slate-200" />
                                    </div>

                                    {/* Team Members */}
                                    {!isCollapsed && (
                                        <div className="divide-y divide-slate-100">
                                            {teamPeople.map((person, idx) => (
                                                <div key={person.id} className="flex group/row hover:bg-blue-50/20 transition-all">
                                                    {/* Person Info Sticky Cell */}
                                                    <div
                                                        onClick={() => onSelectPerson(person)}
                                                        className={`w-60 shrink-0 px-6 py-4 border-l border-slate-100 sticky right-0 z-20 flex items-center gap-4 cursor-pointer transition-all ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'} group-hover/row:bg-blue-50/50 group-hover/row:shadow-[4px_0_12px_rgba(0,0,0,0.05)] shadow-[2px_0_5px_rgba(0,0,0,0.02)]`}
                                                    >
                                                        <div
                                                            className="w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-black shrink-0 text-white shadow-md ring-4 ring-white transition-transform group-hover/row:scale-110"
                                                            style={{
                                                                backgroundColor: team.color?.startsWith('#') ? team.color : '#94a3b8',
                                                                backgroundImage: !team.color?.startsWith('#') ? `linear-gradient(135deg, #94a3b8, #64748b)` : `linear-gradient(135deg, ${team.color}, ${team.color}cc)`
                                                            }}
                                                        >
                                                            {person.name.charAt(0)}
                                                        </div>
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="text-base font-black text-slate-800 truncate group-hover/row:text-blue-600 transition-colors">
                                                                {person.name}
                                                            </span>
                                                            <span className="text-[11px] text-slate-400 font-bold truncate tracking-wide">
                                                                {person.roleId ? team.name : 'לוחם במילואים'}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Attendance Grid Cells */}
                                                    <div className="flex min-w-max">
                                                        {dates.map((date, dateIdx) => {
                                                            const avail = getEffectiveAvailability(person, date, teamRotations);
                                                            const isToday = new Date().toDateString() === date.toDateString();
                                                            const isSelected = editingCell?.personId === person.id && editingCell?.date === date.toLocaleDateString('en-CA');

                                                            // Roster Wizard Style Logic
                                                            const prevDate = new Date(date);
                                                            prevDate.setDate(date.getDate() - 1);
                                                            const nextDate = new Date(date);
                                                            nextDate.setDate(date.getDate() + 1);

                                                            const prevAvail = getEffectiveAvailability(person, prevDate, teamRotations);
                                                            const nextAvail = getEffectiveAvailability(person, nextDate, teamRotations);

                                                            let content = null;
                                                            let cellBg = "bg-white";
                                                            let themeColor = "bg-slate-200";

                                                            if (avail.status === 'home' || avail.status === 'unavailable' || !avail.isAvailable) {
                                                                cellBg = "bg-red-50/70 text-red-800";
                                                                themeColor = "bg-red-400";
                                                                const isConstraint = avail.status === 'unavailable';

                                                                content = (
                                                                    <div className="flex flex-col items-center justify-center gap-1">
                                                                        <Home size={14} className="text-red-300" />
                                                                        <span className="text-[10px] font-black">{isConstraint ? 'אילוץ' : 'בית'}</span>
                                                                    </div>
                                                                );
                                                            } else {
                                                                // Available (Base)
                                                                const isArrival = !prevAvail.isAvailable || prevAvail.status === 'home';
                                                                const isDeparture = !nextAvail.isAvailable || nextAvail.status === 'home';

                                                                if (isArrival && isDeparture) {
                                                                    cellBg = "bg-emerald-50 text-emerald-800";
                                                                    themeColor = "bg-emerald-500";
                                                                    content = (
                                                                        <div className="flex flex-col items-center justify-center">
                                                                            <span className="text-[10px] font-black">יום בודד</span>
                                                                            <span className="text-[9px] font-bold opacity-70">{avail.startHour}-{avail.endHour}</span>
                                                                        </div>
                                                                    );
                                                                } else if (isArrival) {
                                                                    cellBg = "bg-emerald-50/60 text-emerald-800";
                                                                    themeColor = "bg-emerald-500";
                                                                    content = (
                                                                        <div className="flex flex-col items-center justify-center">
                                                                            <MapPin size={12} className="text-emerald-500 mb-0.5" />
                                                                            <span className="text-[10px] font-black">הגעה</span>
                                                                            <span className="text-[9px] font-bold opacity-70">{avail.startHour}</span>
                                                                        </div>
                                                                    );
                                                                } else if (isDeparture) {
                                                                    cellBg = "bg-amber-50/60 text-amber-900";
                                                                    themeColor = "bg-amber-500";
                                                                    content = (
                                                                        <div className="flex flex-col items-center justify-center">
                                                                            <MapPin size={12} className="text-amber-500 mb-0.5" />
                                                                            <span className="text-[10px] font-black">יציאה</span>
                                                                            <span className="text-[9px] font-bold opacity-70">{avail.endHour}</span>
                                                                        </div>
                                                                    );
                                                                } else {
                                                                    cellBg = "bg-emerald-50/40 text-emerald-800";
                                                                    themeColor = "bg-emerald-500";
                                                                    content = (
                                                                        <div className="flex flex-col items-center justify-center gap-0.5">
                                                                            <MapPin size={14} className="text-emerald-500/50" />
                                                                            <span className="text-[10px] font-black">בסיס</span>
                                                                        </div>
                                                                    );
                                                                }
                                                            }

                                                            return (
                                                                <div
                                                                    key={date.toISOString()}
                                                                    className={`w-24 h-20 shrink-0 border-l border-slate-100 flex flex-col items-center justify-center cursor-pointer transition-all relative group/cell 
                                                                        ${cellBg} 
                                                                        ${isSelected ? 'z-30 ring-4 ring-blue-500 shadow-2xl scale-110 rounded-lg bg-white' : 'hover:z-10 hover:shadow-lg hover:bg-white'} 
                                                                        ${isToday ? 'ring-inset shadow-[inset_0_0_0_2px_rgba(59,130,246,0.5)]' : ''}
                                                                    `}
                                                                    onClick={(e) => handleCellClick(e, person, date)}
                                                                >
                                                                    {content}

                                                                    {/* Status indicator bar at bottom */}
                                                                    <div className={`absolute bottom-0 left-0 right-0 h-1 ${themeColor} opacity-20 group-hover/cell:opacity-100 transition-opacity`} />

                                                                    {/* Is Manual/Algorithm dot */}
                                                                    {(avail.source === 'manual' || avail.source === 'algorithm') && (
                                                                        <div className={`absolute top-1.5 left-1.5 w-1.5 h-1.5 rounded-full ${avail.source === 'manual' ? 'bg-amber-400' : 'bg-blue-400'}`} />
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

                {/* Footer Summary */}
                <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-center gap-4 shrink-0">
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" />
                        <span className="text-[10px] font-bold text-slate-500">נמצא בבסיס</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-400/40 shadow-sm" />
                        <span className="text-[10px] font-bold text-slate-500">נמצא בבית</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm" />
                        <span className="text-[10px] font-bold text-slate-500">אילוץ / חריג</span>
                    </div>
                </div>
            </div>

            <StatusEditPopover
                isOpen={!!editingCell}
                date={editingCell?.date}
                position={editingCell ? editingCell.position : { top: 0, left: 0 }}
                onClose={() => setEditingCell(null)}
                onApply={handleApplyStatus}
            />
        </div>
    );
};
