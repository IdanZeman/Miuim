import React, { useState } from 'react';
import { Person, Team, TeamRotation } from '../types';
import { ChevronRight, ChevronLeft, Calendar as CalendarIcon, ArrowRight, ArrowLeft, Home, X, Settings, User } from 'lucide-react';
import { getEffectiveAvailability, getRotationStatusForDate } from '../utils/attendanceUtils';

interface GlobalTeamCalendarProps {
    teams: Team[];
    people: Person[]; // NEW
    teamRotations: TeamRotation[];
    onManageTeam?: (teamId: string) => void;
    onToggleTeamAvailability?: (teamId: string, date: Date, isAvailable: boolean) => void;
}

export const GlobalTeamCalendar: React.FC<GlobalTeamCalendarProps> = ({ teams, people, teamRotations, onManageTeam, onToggleTeamAvailability }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDateDetails, setSelectedDateDetails] = useState<Date | null>(null);

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

    // Helper to get color styles per team
    const getTeamColorStyles = (team: Team, isAvailable: boolean) => {
        // If not available, gray out
        if (!isAvailable) {
            return {
                bg: 'bg-slate-100',
                text: 'text-slate-500',
                border: 'border-slate-200'
            };
        }

        // Use the team's actual color class if possible, or fallback
        // Current team.color is like "border-orange-500" or similar.
        // We want a background version.
        const colorClass = team.color || 'blue-500';

        let bgClass = 'bg-blue-100';
        let textClass = 'text-blue-700';
        let borderClass = 'border-blue-200';

        if (colorClass.includes('red')) { bgClass = 'bg-red-100'; textClass = 'text-red-800'; borderClass = 'border-red-200'; }
        else if (colorClass.includes('green')) { bgClass = 'bg-green-100'; textClass = 'text-green-800'; borderClass = 'border-green-200'; }
        else if (colorClass.includes('purple')) { bgClass = 'bg-purple-100'; textClass = 'text-purple-800'; borderClass = 'border-purple-200'; }
        else if (colorClass.includes('orange')) { bgClass = 'bg-orange-100'; textClass = 'text-orange-800'; borderClass = 'border-orange-200'; }
        else if (colorClass.includes('pink')) { bgClass = 'bg-pink-100'; textClass = 'text-pink-800'; borderClass = 'border-pink-200'; }
        else if (colorClass.includes('teal')) { bgClass = 'bg-teal-100'; textClass = 'text-teal-800'; borderClass = 'border-teal-200'; }
        else if (colorClass.includes('yellow')) { bgClass = 'bg-yellow-100'; textClass = 'text-yellow-800'; borderClass = 'border-yellow-200'; }
        else if (colorClass.includes('indigo')) { bgClass = 'bg-indigo-100'; textClass = 'text-indigo-800'; borderClass = 'border-indigo-200'; }
        else if (colorClass.includes('cyan')) { bgClass = 'bg-cyan-100'; textClass = 'text-cyan-800'; borderClass = 'border-cyan-200'; }
        else if (colorClass.includes('lime')) { bgClass = 'bg-lime-100'; textClass = 'text-lime-800'; borderClass = 'border-lime-200'; }
        else if (colorClass.includes('slate')) { bgClass = 'bg-slate-100'; textClass = 'text-slate-800'; borderClass = 'border-slate-200'; }

        return { bg: bgClass, text: textClass, border: borderClass };
    };

    const renderCalendarDays = () => {
        const days = [];
        const dummyPerson = { id: 'dummy', teamId: 'dummy', name: 'dummy' } as any;

        // Empty slots
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="min-h-[80px] md:min-h-[120px] bg-slate-50/50 border border-slate-100"></div>);
        }

        // Days
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month, d);
            const isToday = new Date().toDateString() === date.toDateString();

            // Calculate status for all teams for this day
            const dailyTeamsStatus = teams.map(team => {
                if (team.id === 'no-team') return null;
                const rotation = teamRotations.find(r => r.team_id === team.id);
                // Even if no rotation, we might want to show them if they have manual entries? 
                // But typically this view is for rotation-based teams.
                if (!rotation) return null;

                // NEW: Use real people data to determine status, falling back to rotation logic
                const members = people.filter(p => p.teamId === team.id);
                let status;

                if (members.length > 0) {
                    const memberStatuses = members.map(m => getEffectiveAvailability(m, date, teamRotations));
                    const isAnyAvailable = memberStatuses.some(s => s.isAvailable);

                    if (isAnyAvailable) {
                        const special = memberStatuses.find(s => s.status === 'arrival' || s.status === 'departure');
                        status = special ? { ...special, isAvailable: true } : { isAvailable: true, status: 'base' };
                    } else {
                        status = { isAvailable: false, status: 'home' };
                    }
                } else {
                    const checkPerson = { ...dummyPerson, teamId: team.id };
                    status = getRotationStatusForDate(checkPerson, date, rotation);
                }

                return { team, status, rotation };
            }).filter(Boolean);

            days.push(
                <div
                    key={d}
                    onClick={() => setSelectedDateDetails(date)}
                    className={`min-h-[80px] md:min-h-[120px] border border-slate-100 relative p-1 transition-colors hover:bg-slate-50 cursor-pointer ${isToday ? 'bg-blue-50/30' : 'bg-white'}`}
                >
                    <div className={`flex justify-between items-center px-1 mb-1 ${isToday ? 'text-blue-600 font-bold' : 'text-slate-400'}`}>
                        <span className="text-xs">{d}</span>
                        {isToday && <span className="text-[9px] bg-blue-100 px-1 rounded">היום</span>}
                    </div>

                    <div className="flex flex-col gap-1 overflow-hidden">
                        {dailyTeamsStatus.map((item: any) => {
                            if (!item.status || !item.status.isAvailable) return null;
                            const { team, status } = item;
                            const styles = getTeamColorStyles(team, true);
                            const isArrival = status.status === 'arrival';
                            const isDeparture = status.status === 'departure';

                            return (
                                <div key={team.id} className={`text-[9px] px-1 py-0.5 rounded border flex items-center gap-1 shadow-sm ${styles.bg} ${styles.text} ${styles.border} overflow-hidden`}>
                                    <span className="font-bold truncate">{team.name}</span>
                                    <div className="flex items-center gap-0.5 opacity-80 shrink-0">
                                        {isArrival && <ArrowLeft size={8} />}
                                        {isDeparture && <ArrowRight size={8} />}
                                    </div>
                                </div>
                            );
                        })}
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
                        לוח סבבים
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
                        <div key={day} className="py-2 text-center text-xs font-bold text-slate-500 border-r border-slate-100 last:border-0 hover:bg-slate-100 transition-colors cursor-default">
                            {day}
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-7 bg-white">
                    {renderCalendarDays()}
                </div>
            </div>

            {/* Day Details Modal */}
            {selectedDateDetails && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn" onClick={() => setSelectedDateDetails(null)}>
                    <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white">
                            <h3 className="text-lg font-bold text-slate-800">
                                {selectedDateDetails.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' })}
                            </h3>
                            <button onClick={() => setSelectedDateDetails(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-2 overflow-y-auto custom-scrollbar flex-1">
                            {(() => {
                                // Calculate status dynamically for the valid modal
                                const dummyPerson = { id: 'dummy', teamId: 'dummy', name: 'dummy' } as any;
                                const date = selectedDateDetails;

                                const currentDayTeamsStatus = teams.map(team => {
                                    if (team.id === 'no-team') return null;
                                    const rotation = teamRotations.find(r => r.team_id === team.id);
                                    if (!rotation) return null; // If no rotation, hide in this view

                                    // NEW: Real status check using the people list
                                    const members = people.filter(p => p.teamId === team.id);
                                    let status;

                                    if (members.length > 0) {
                                        // Collective status: If ANYONE is available, show as available
                                        // This allows the toggle to reflect the collective state.
                                        const memberStatuses = members.map(m => getEffectiveAvailability(m, date, teamRotations));
                                        const isAnyAvailable = memberStatuses.some(s => s.isAvailable);

                                        if (isAnyAvailable) {
                                            // Check for specific statuses like Arrival/Departure
                                            const special = memberStatuses.find(s => s.status === 'arrival' || s.status === 'departure');
                                            status = special ? { ...special, isAvailable: true } : { isAvailable: true, status: 'base' };
                                        } else {
                                            // Everyone (or all known data) is Home
                                            status = { isAvailable: false, status: 'home' };
                                        }
                                    } else {
                                        // Fallback to theoretical rotation status
                                        const checkPerson = { ...dummyPerson, teamId: team.id };
                                        status = getRotationStatusForDate(checkPerson, date, rotation);
                                    }

                                    return { team, status, rotation };
                                }).filter(Boolean);

                                if (currentDayTeamsStatus.length === 0) {
                                    return <div className="text-center py-8 text-slate-400 text-sm">אין נתונים ליום זה</div>;
                                }

                                return (
                                    <div className="space-y-2">
                                        {currentDayTeamsStatus.map((item: any) => {
                                            const { team, status } = item;
                                            const isAvailable = status && status.isAvailable;
                                            const styles = getTeamColorStyles(team, isAvailable);

                                            return (
                                                <div key={team.id} className={`p-3 rounded-xl border flex items-center justify-between ${isAvailable ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 border-slate-100'}`}>
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm ${team.color.replace('border-', 'bg-').replace('text-', 'text-white ')}`}>
                                                            {team.name.slice(0, 2)}
                                                        </div>
                                                        <div>
                                                            <h4 className="font-bold text-slate-800 text-sm">{team.name}</h4>
                                                            <span className={`text-xs px-2 py-0.5 rounded-full inline-flex items-center gap-1 mt-0.5 ${isAvailable ? styles.bg + ' ' + styles.text : 'bg-slate-100 text-slate-500'}`}>
                                                                {isAvailable ? (
                                                                    <>
                                                                        {status.status === 'arrival' && 'חוזר לבסיס'}
                                                                        {status.status === 'departure' && 'יוצא הביתה'}
                                                                        {status.status === 'base' && 'בבסיס'}
                                                                    </>
                                                                ) : 'בבית'}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        {onToggleTeamAvailability && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); onToggleTeamAvailability(team.id, selectedDateDetails, !isAvailable); }}
                                                                className={`relative w-11 h-6 rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${isAvailable ? 'bg-green-500' : 'bg-slate-200'}`}
                                                                title={isAvailable ? 'סמן כ-בבית' : 'סמן כ-נוכח'}
                                                            >
                                                                <span
                                                                    className={`absolute left-0.5 top-0.5 bg-white w-5 h-5 rounded-full shadow transform transition-transform duration-200 ease-in-out ${isAvailable ? 'translate-x-5' : 'translate-x-0'}`}
                                                                />
                                                            </button>
                                                        )}

                                                        {onManageTeam && (
                                                            <button
                                                                onClick={() => { setSelectedDateDetails(null); onManageTeam(team.id); }}
                                                                className="p-2 bg-slate-50 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg transition-colors text-xs"
                                                                title="הגדרות סבב"
                                                            >
                                                                <Settings size={16} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
