import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday, setMonth, setYear } from 'date-fns';
import { he } from 'date-fns/locale';

interface CustomCalendarProps {
    value: Date;
    onChange: (date: Date) => void;
    onClose?: () => void;
    selectionMode?: 'day' | 'month';
}

type CalendarView = 'days' | 'months' | 'years';

export const CustomCalendar: React.FC<CustomCalendarProps> = ({
    value,
    onChange,
    onClose,
    selectionMode = 'day'
}) => {
    const [currentMonth, setCurrentMonth] = useState(value || new Date());
    const [view, setView] = useState<CalendarView>(selectionMode === 'month' ? 'months' : 'days');
    const [yearRangeStart, setYearRangeStart] = useState(currentMonth.getFullYear() - 5);

    // Navigation Logic
    const next = () => {
        if (view === 'days') setCurrentMonth(addMonths(currentMonth, 1));
        else if (view === 'years') setYearRangeStart(yearRangeStart + 12);
        else if (view === 'months') setCurrentMonth(new Date(currentMonth.getFullYear() + 1, 0, 1));
    };

    const prev = () => {
        if (view === 'days') setCurrentMonth(subMonths(currentMonth, 1));
        else if (view === 'years') setYearRangeStart(yearRangeStart - 12);
        else if (view === 'months') setCurrentMonth(new Date(currentMonth.getFullYear() - 1, 0, 1));
    };

    // View Switching
    const toggleMonthView = () => {
        if (selectionMode === 'month') return; // Disable switching to days if specific mode
        setView(view === 'months' ? 'days' : 'months');
    };

    const toggleYearView = () => {
        setYearRangeStart(currentMonth.getFullYear() - 5);
        setView(view === 'years' ? (selectionMode === 'month' ? 'months' : 'days') : 'years');
    };

    // Selection Logic
    const handleMonthSelect = (monthIndex: number) => {
        const newDate = setMonth(currentMonth, monthIndex);
        setCurrentMonth(newDate);

        if (selectionMode === 'month') {
            onChange(newDate);
            if (onClose) onClose();
        } else {
            setView('days');
        }
    };

    const handleYearSelect = (year: number) => {
        const newDate = setYear(currentMonth, year);
        setCurrentMonth(newDate);
        setView(selectionMode === 'month' ? 'months' : 'days');
    };

    // Render Helpers
    const renderDays = () => {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(monthStart);
        const startDate = startOfWeek(monthStart, { locale: he });
        const endDate = endOfWeek(monthEnd, { locale: he });
        const allDays = eachDayOfInterval({ start: startDate, end: endDate });
        const weekDays = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

        return (
            <>
                <div className="grid grid-cols-7 w-full mb-2">
                    {weekDays.map((d, i) => (
                        <div key={i} className="flex justify-center items-center h-[32px] md:h-[40px] text-sm md:text-base font-bold text-slate-500 font-['Lexend']"> {/* Rule 2: min 14px text */}
                            {d}
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-7 w-full gap-y-0.5">
                    {allDays.map((dayItem, i) => {
                        const isSelected = isSameDay(dayItem, value);
                        const isTodayItem = isToday(dayItem);
                        const isCurrentMonth = isSameMonth(dayItem, monthStart);

                        let bgClass = "";
                        let textClass = "text-[#1F1F1F]";

                        if (isSelected) {
                            bgClass = "bg-[#0047FF] shadow-[0px_1.5px_1px_rgba(0,31,112,0.25),0px_3px_2px_rgba(0,71,255,0.2)]";
                            textClass = "text-white";
                        } else if (isTodayItem) {
                            bgClass = "bg-white border text-[#0047FF] border-[#0047FF]";
                            textClass = "text-[#0047FF] font-black";
                        } else if (!isCurrentMonth) {
                            textClass = "text-[rgba(0,23,84,0.15)]";
                        }

                        return (
                            <div
                                key={i}
                                onClick={() => {
                                    onChange(dayItem);
                                    if (onClose) onClose();
                                }}
                                className={`
                                    flex justify-center items-center 
                                    h-11 md:h-12 w-full max-w-[40px] md:max-w-[44px] mx-auto rounded-lg cursor-pointer // Rule 1: 44-48px touch target
                                    font-['Lexend'] text-base md:text-lg font-bold transition-all // Rule 2: 16px text base
                                    ${bgClass} ${textClass}
                                    ${!isSelected && !isTodayItem && "hover:bg-slate-200"}
                                `}
                            >
                                {format(dayItem, 'd')}
                            </div>
                        );
                    })}
                </div>
            </>
        );
    };

    const renderMonths = () => {
        const months = Array.from({ length: 12 }, (_, i) => i);
        return (
            <div className="grid grid-cols-3 gap-3 w-full h-[220px] overflow-y-auto content-start py-2">
                {months.map((m) => (
                    <button
                        key={m}
                        onClick={() => handleMonthSelect(m)}
                        className={`
                            rounded-xl text-base md:text-lg font-bold font-['Lexend'] transition-all h-12 md:h-14 flex items-center justify-center // Rule 1: 48px height
                            ${currentMonth.getMonth() === m ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'}
                        `}
                    >
                        {format(new Date(2000, m, 1), 'MMMM', { locale: he })}
                    </button>
                ))}
            </div>
        );
    };

    const renderYears = () => {
        const years = Array.from({ length: 12 }, (_, i) => yearRangeStart + i);
        return (
            <div className="grid grid-cols-3 gap-3 w-full h-[220px] overflow-y-auto content-start py-2">
                {years.map((y) => (
                    <button
                        key={y}
                        onClick={() => handleYearSelect(y)}
                        className={`
                            rounded-xl text-base md:text-lg font-bold font-['Lexend'] transition-all h-12 md:h-14 flex items-center justify-center // Rule 1: 48px height
                            ${currentMonth.getFullYear() === y ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'}
                        `}
                    >
                        {y}
                    </button>
                ))}
            </div>
        );
    };

    return (
        <div
            className="flex flex-col bg-[#F8F9FA] rounded-2xl shadow-xl border border-slate-200 p-4 md:p-6 w-[320px] md:w-[380px] gap-3 select-none z-[9999]" // Rule 5: Safe width for alignment
            onClick={(e) => e.stopPropagation()}
        >
            {/* Header */}
            <div className="flex items-center justify-between w-full h-14 md:h-16 mb-2 relative"> {/* Rule 1: Header area h-14 */}
                <button
                    onClick={prev}
                    className="flex items-center justify-center w-11 h-11 bg-white text-slate-700 border border-slate-200 rounded-full shadow-sm hover:bg-slate-50 active:bg-slate-100 transition-colors" // Rule 1: 44-48px target
                >
                    <ChevronRight size={24} strokeWidth={2.5} /> {/* Rule 2: legible icon */}
                </button>

                {/* Selectors */}
                <div className="flex gap-2">
                    {/* Hide Month Toggle if in Month Selection Mode */}
                    {selectionMode !== 'month' && (
                        <button
                            onClick={toggleMonthView}
                            className={`flex items-center gap-2 bg-white border border-slate-200 shadow-sm rounded-lg px-3 h-11 cursor-pointer transition-colors ${view === 'months' ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-slate-50'}`} // Rule 1: h-11 (44px)
                        >
                            <span className="text-base md:text-lg font-bold text-slate-800 font-['Lexend']"> {/* Rule 2: 16px text */}
                                {format(currentMonth, 'MMMM', { locale: he })}
                            </span>
                            <ChevronDown size={14} className={`text-blue-600 transition-transform ${view === 'months' ? 'rotate-180' : ''}`} />
                        </button>
                    )}

                    <button
                        onClick={toggleYearView}
                        className={`flex items-center gap-2 bg-white border border-slate-200 shadow-sm rounded-lg px-3 h-11 cursor-pointer transition-colors ${view === 'years' ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-slate-50'}`} // Rule 1: h-11 (44px)
                    >
                        <span className="text-base md:text-lg font-bold text-slate-800 font-['Lexend']"> {/* Rule 2: 16px text */}
                            {format(currentMonth, 'yyyy')}
                        </span>
                        <ChevronDown size={14} className={`text-blue-600 transition-transform ${view === 'years' ? 'rotate-180' : ''}`} />
                    </button>
                </div>

                <button
                    onClick={next}
                    className="flex items-center justify-center w-11 h-11 bg-white text-slate-700 border border-slate-200 rounded-full shadow-sm hover:bg-slate-50 active:bg-slate-100 transition-colors" // Rule 1: 44-48px target
                >
                    <ChevronLeft size={24} strokeWidth={2.5} />
                </button>
            </div>

            {/* Content Switcher */}
            {view === 'days' && renderDays()}
            {view === 'months' && renderMonths()}
            {view === 'years' && renderYears()}
        </div>
    );
};
