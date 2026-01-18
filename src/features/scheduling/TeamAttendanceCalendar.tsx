import React, { useState } from 'react';
import { Team, TeamRotation } from '@/types';
import { CaretRight as ChevronRight, CaretLeft as ChevronLeft, X, CalendarBlank as CalendarIcon, House as Home, ArrowRight, ArrowLeft } from '@phosphor-icons/react';
import { GenericModal } from '@/components/ui/GenericModal';
import { getEffectiveAvailability } from '@/utils/attendanceUtils';

interface TeamAttendanceCalendarProps {
    team: Team;
    teamRotations: TeamRotation[];
    onClose: () => void;
}

export const TeamAttendanceCalendar: React.FC<TeamAttendanceCalendarProps> = ({ team, teamRotations, onClose }) => {
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

    // Get color styles for the team
    const getTeamColorStyles = () => {
        // Map common Tailwind border colors to background/text
        // Default to blue if unknown
        const baseColor = team.color?.replace('border-', '') || 'blue-500';
        // This is a simple approximation. In a real app we might want explicit color mapping.
        // We can try to use the color name directly if possible.

        let bgClass = 'bg-blue-100';
        let textClass = 'text-blue-700';
        let borderClass = 'border-blue-200';

        if (baseColor.includes('red')) { bgClass = 'bg-red-100'; textClass = 'text-red-700'; borderClass = 'border-red-200'; }
        else if (baseColor.includes('green')) { bgClass = 'bg-green-100'; textClass = 'text-green-700'; borderClass = 'border-green-200'; }
        else if (baseColor.includes('purple')) { bgClass = 'bg-purple-100'; textClass = 'text-purple-700'; borderClass = 'border-purple-200'; }
        else if (baseColor.includes('orange')) { bgClass = 'bg-orange-100'; textClass = 'text-orange-700'; borderClass = 'border-orange-200'; }
        else if (baseColor.includes('pink')) { bgClass = 'bg-pink-100'; textClass = 'text-pink-700'; borderClass = 'border-pink-200'; }
        else if (baseColor.includes('teal')) { bgClass = 'bg-teal-100'; textClass = 'text-teal-700'; borderClass = 'border-teal-200'; }
        else if (baseColor.includes('yellow')) { bgClass = 'bg-yellow-100'; textClass = 'text-yellow-700'; borderClass = 'border-yellow-200'; }

        return { bg: bgClass, text: textClass, border: borderClass };
    };

    const teamStyles = getTeamColorStyles();

    const renderCalendarDays = () => {
        const days = [];

        // Empty slots for start of month
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="h-24 bg-slate-50 border border-slate-100"></div>);
        }

        const rotation = teamRotations.find(r => r.team_id === team.id);

        // Days
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month, d);
            const isToday = new Date().toDateString() === date.toDateString();

            // Generate dummy person for util
            const dummyPerson = { id: 'dummy', teamId: team.id, name: 'dummy' } as any;
            const availability = getEffectiveAvailability(dummyPerson, date, teamRotations);

            let content = null;
            let cellBg = 'bg-white';

            if (availability.source !== 'default') {
                if (!availability.isAvailable) {
                    // Home
                    cellBg = 'bg-slate-50/50';
                    content = (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60">
                            <Home size={18} weight="bold" />
                            <span className="text-xs font-bold mt-1">בבית</span>
                        </div>
                    );
                } else {
                    // Base / Arrival / Departure
                    const isArrival = availability.status === 'arrival';
                    const isDeparture = availability.status === 'departure';

                    content = (
                        <div className={`flex flex-col items-center justify-center h-full w-full rounded-md m-1 p-1 ${teamStyles.bg} ${teamStyles.text} ${teamStyles.border} border`}>
                            {isArrival && <ArrowLeft size={16} className="mb-1" weight="bold" />}
                            {isDeparture && <ArrowRight size={16} className="mb-1" weight="bold" />}

                            <span className="text-sm font-bold text-center leading-tight">
                                {team.name}
                            </span>

                            {(isArrival || isDeparture) && (
                                <span className="text-[10px] mt-1 opacity-80">
                                    {isArrival ? availability.startHour : availability.endHour}
                                </span>
                            )}
                        </div>
                    );
                }
            } else {
                // No rotation defined
                content = <div className="text-[10px] text-slate-300 flex items-center justify-center h-full">אין סבב</div>;
            }

            days.push(
                <div key={d} className={`h-28 border border-slate-100 relative p-1 transition-colors hover:bg-slate-50 ${cellBg} ${isToday ? 'ring-2 ring-inset ring-blue-400' : ''}`}>
                    <span className={`absolute top-1 right-2 text-xs font-bold ${isToday ? 'text-blue-600 bg-blue-100 px-1.5 rounded-full' : 'text-slate-400'}`}>
                        {d}
                    </span>
                    <div className="mt-5 h-[calc(100%-24px)] flex items-center justify-center">
                        {content}
                    </div>
                </div>
            );
        }

        return days;
    };

    // Weekdays header
    const weekDays = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

    const modalTitle = (
        <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold shadow-sm ${team.color.replace('border-', 'bg-').replace('text-', 'text-white ')}`}>
                {team.name.slice(0, 2)}
            </div>
            <div className="flex flex-col gap-0.5">
                <h2 className="text-xl font-black text-slate-800 leading-tight">{team.name}</h2>
                <div className="flex items-center gap-2 text-xs text-slate-500 font-bold uppercase tracking-wider">
                    <CalendarIcon size={14} className="text-slate-400" weight="bold" />
                    <span>לוח סבב צוותי</span>
                </div>
            </div>
        </div>
    );

    return (
        <GenericModal
            isOpen={true}
            onClose={onClose}
            title={modalTitle}
            size="2xl"
            className="h-[85vh]"
        >
            <div className="flex flex-col h-full">
                {/* Calendar Controls */}
                <div className="flex items-center justify-between mb-4 bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <button onClick={handlePrevMonth} className="p-2 hover:bg-white rounded-lg shadow-sm border border-transparent hover:border-slate-200 transition-all text-slate-600">
                        <ChevronRight weight="bold" />
                    </button>
                    <h3 className="text-lg font-black text-slate-800 tracking-tight">{monthName}</h3>
                    <button onClick={handleNextMonth} className="p-2 hover:bg-white rounded-lg shadow-sm border border-transparent hover:border-slate-200 transition-all text-slate-600">
                        <ChevronLeft weight="bold" />
                    </button>
                </div>

                {/* Calendar Grid */}
                <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/30 border border-slate-200 rounded-2xl">
                    <div className="grid grid-cols-7 border-b border-slate-200 bg-white sticky top-0 z-10 shadow-sm">
                        {weekDays.map(day => (
                            <div key={day} className="py-3 text-center text-sm font-bold text-slate-500">
                                {day}
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 bg-white">
                        {renderCalendarDays()}
                    </div>
                </div>
            </div>
        </GenericModal>
    );
};
