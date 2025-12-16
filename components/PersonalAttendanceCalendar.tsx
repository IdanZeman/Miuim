import React, { useState } from 'react';
import { Person, TeamRotation } from '../types';
import { ChevronRight, ChevronLeft, X, ArrowRight, ArrowLeft, Home, Calendar as CalendarIcon } from 'lucide-react';
import { getEffectiveAvailability } from '../utils/attendanceUtils';
import { Modal } from './ui/Modal';

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
        <Modal isOpen={true} onClose={onClose} title={person.name} size="xl">
            <div className="flex flex-col h-full max-h-[calc(90dvh-100px)]">
                {/* Sub-Header with Avatar and subtitle - Styled as part of content */}
                <div className="flex items-center gap-4 mb-6">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold shadow-sm ${person.color} text-lg`}>
                        {person.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-700">לוח נוכחות אישי</h3>
                        <p className="text-sm text-slate-500">צפה וערוך את הנוכחות החודשית</p>
                    </div>
                </div>

                {/* Calendar Controls */}
                <div className="p-4 flex items-center justify-between bg-slate-50 rounded-t-xl border border-slate-200 border-b-0">
                    <button onClick={handlePrevMonth} className="p-2 hover:bg-white rounded-lg shadow-sm border border-transparent hover:border-slate-200 transition-all text-slate-600">
                        <ChevronRight />
                    </button>
                    <h3 className="text-lg font-bold text-slate-700">{monthName}</h3>
                    <button onClick={handleNextMonth} className="p-2 hover:bg-white rounded-lg shadow-sm border border-transparent hover:border-slate-200 transition-all text-slate-600">
                        <ChevronLeft />
                    </button>
                </div>

                {/* Calendar Grid */}
                <div className="flex-1 overflow-y-auto custom-scrollbar border border-slate-200 rounded-b-xl">
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
        </Modal>
    );
};
