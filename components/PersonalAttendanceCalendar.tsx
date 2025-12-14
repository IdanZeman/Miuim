import React, { useState } from 'react';
import { Person, TeamRotation } from '../types';
import { ChevronRight, ChevronLeft, X, ArrowRight, ArrowLeft, Home, Calendar as CalendarIcon } from 'lucide-react';
import { getEffectiveAvailability } from '../utils/attendanceUtils';

interface PersonalAttendanceCalendarProps {
    person: Person;
    teamRotations: TeamRotation[];
    onClose: () => void;
}

export const PersonalAttendanceCalendar: React.FC<PersonalAttendanceCalendarProps> = ({ person, teamRotations, onClose }) => {
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

    const renderCalendarDays = () => {
        const days = [];

        // Empty slots for start of month
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="h-24 bg-slate-50 border border-slate-100"></div>);
        }

        // Days
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month, d);
            const isToday = new Date().toDateString() === date.toDateString();

            const avail = getEffectiveAvailability(person, date, teamRotations);
            const isManual = avail.source === 'manual';
            const status = (avail as any).status; // Cast for now

            let bgClass = 'bg-white';
            let content = null;

            if (!avail.isAvailable) {
                bgClass = 'bg-slate-100/50';
                content = (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                        <Home size={16} />
                        <span className="text-[10px] font-bold mt-1">בבית</span>
                    </div>
                );
            } else if (status === 'arrival') {
                bgClass = 'bg-blue-50';
                content = (
                    <div className="flex flex-col items-center justify-center h-full text-blue-600">
                        <ArrowLeft size={16} strokeWidth={3} />
                        <span className="text-[10px] font-bold mt-1">הגעה</span>
                        <span className="text-[9px]">{avail.startHour}</span>
                    </div>
                );
            } else if (status === 'departure') {
                bgClass = 'bg-orange-50';
                content = (
                    <div className="flex flex-col items-center justify-center h-full text-orange-600">
                        <ArrowRight size={16} strokeWidth={3} />
                        <span className="text-[10px] font-bold mt-1">יציאה</span>
                        <span className="text-[9px]">{avail.endHour}</span>
                    </div>
                );
            } else {
                // Base - Full
                bgClass = 'bg-green-50/50';
                content = (
                    <div className="flex flex-col items-center justify-center h-full text-green-600/50">
                        <span className="text-[10px] font-bold">בבסיס</span>
                    </div>
                );
            }

            days.push(
                <div key={d} className={`h-24 border border-slate-100 relative p-1 transition-colors hover:bg-opacity-70 ${bgClass} ${isToday ? 'ring-2 ring-inset ring-blue-400' : ''}`}>
                    <span className={`absolute top-1 right-2 text-xs font-bold ${isToday ? 'text-blue-600 bg-blue-100 px-1.5 rounded-full' : 'text-slate-400'}`}>
                        {d}
                    </span>
                    {isManual && (
                        <span className="absolute top-1 left-1 w-2 h-2 bg-amber-400 rounded-full" title="שינוי ידני"></span>
                    )}
                    <div className="mt-4 h-full">
                        {content}
                    </div>
                </div>
            );
        }

        return days;
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 py-12 animate-fadeIn" onClick={onClose}>
            <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh]" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white text-slate-800">
                    <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-sm ${person.color}`}>
                            {person.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">{person.name}</h2>
                            <p className="text-sm text-slate-500 flex items-center gap-1">
                                <CalendarIcon size={12} />
                                לוח נוכחות אישי
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Calendar Controls */}
                <div className="p-4 flex items-center justify-between bg-slate-50 border-b border-slate-100">
                    <button onClick={handlePrevMonth} className="p-2 hover:bg-white rounded-lg shadow-sm border border-transparent hover:border-slate-200 transition-all text-slate-600">
                        <ChevronRight />
                    </button>
                    <h3 className="text-lg font-bold text-slate-700">{monthName}</h3>
                    <button onClick={handleNextMonth} className="p-2 hover:bg-white rounded-lg shadow-sm border border-transparent hover:border-slate-200 transition-all text-slate-600">
                        <ChevronLeft />
                    </button>
                </div>

                {/* Calendar Grid */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
                        {['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'].map(day => (
                            <div key={day} className="py-2 text-center text-xs font-bold text-slate-500">
                                {day}
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7">
                        {renderCalendarDays()}
                    </div>
                </div>
            </div>
        </div>
    );
};
