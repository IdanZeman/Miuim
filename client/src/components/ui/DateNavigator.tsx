import React, { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { CaretRight as ChevronRight, CaretLeft as ChevronLeft, CalendarBlank as CalendarIcon } from '@phosphor-icons/react';
import { Button } from './Button';
import { CustomCalendar } from './CustomCalendar';

interface DateNavigatorProps {
    date: Date;
    onDateChange: (date: Date) => void;
    mode?: 'day' | 'week' | 'month';
    label?: string;
    canGoPrev?: boolean;
    canGoNext?: boolean;
    className?: string;
    showTodayButton?: boolean;
    minDate?: Date;
    maxDate?: Date;
}

export const DateNavigator: React.FC<DateNavigatorProps> = ({
    date,
    onDateChange,
    mode = 'day',
    label,
    canGoPrev = true,
    canGoNext = true,
    className,
    showTodayButton = true,
    minDate,
    maxDate
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLDivElement>(null);
    const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});

    // Update popover position
    const updatePosition = () => {
        if (!triggerRef.current || !isOpen) return;
        const rect = triggerRef.current.getBoundingClientRect();

        setPopoverStyle({
            position: 'fixed',
            top: `${rect.bottom + 8}px`,
            left: `${rect.left + (rect.width / 2)}px`,
            transform: 'translateX(-50%)',
            zIndex: 99999, // Ensure max z-index
        });
    };

    useLayoutEffect(() => {
        if (isOpen) {
            updatePosition();
            window.addEventListener('scroll', updatePosition, true);
            window.addEventListener('resize', updatePosition);
            return () => {
                window.removeEventListener('scroll', updatePosition, true);
                window.removeEventListener('resize', updatePosition);
            };
        }
    }, [isOpen]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // Check if click is inside trigger or popover (which is in portal)
            if (
                triggerRef.current &&
                !triggerRef.current.contains(event.target as Node) &&
                !(event.target as Element).closest('.date-navigator-popover')
            ) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handlePrev = () => {
        const newDate = new Date(date);
        if (mode === 'day') {
            newDate.setDate(date.getDate() - 1);
        } else if (mode === 'week') {
            newDate.setDate(date.getDate() - 7);
        } else {
            newDate.setMonth(date.getMonth() - 1);
        }
        onDateChange(newDate);
    };

    const handleNext = () => {
        const newDate = new Date(date);
        if (mode === 'day') {
            newDate.setDate(date.getDate() + 1);
        } else if (mode === 'week') {
            newDate.setDate(date.getDate() + 7);
        } else {
            newDate.setMonth(date.getMonth() + 1);
        }
        onDateChange(newDate);
    };

    const handleToday = () => {
        const now = new Date();
        if (mode === 'month') {
            onDateChange(new Date(now.getFullYear(), now.getMonth(), 1));
        } else {
            onDateChange(now);
        }
    };

    const isMobile = window.innerWidth < 768; // Simple initial check, could use hook but this suffices for render logic if we re-check on resize

    // Re-calc isMobile on resize
    const [isMobileView, setIsMobileView] = useState(window.innerWidth < 768);
    useEffect(() => {
        const handleResize = () => setIsMobileView(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const mobileStyle: React.CSSProperties = {
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)'
    };

    return (
        <div ref={containerRef} className={`flex items-center gap-1 bg-slate-50 p-0.5 rounded-lg border border-slate-200 select-none relative ${className || ''}`}>
            <button
                onClick={handlePrev}
                disabled={!canGoPrev || (minDate && date <= startOfDay(minDate))}
                className="flex items-center justify-center h-9 w-9 rounded-md text-slate-700 hover:text-slate-900 hover:bg-white hover:shadow-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label={mode === 'day' ? "יום קודם" : "חודש קודם"}
            >
                <ChevronRight size={20} weight="bold" />
            </button>

            <div
                ref={triggerRef}
                className="relative group cursor-pointer flex items-center justify-center gap-1 md:gap-2 min-w-fit px-1 md:px-2 h-9"
                onClick={() => setIsOpen(!isOpen)}
            >
                {label && <span className="text-xs text-slate-500 font-medium hidden md:block">{label}</span>}

                <div className="flex items-center gap-2">
                    <CalendarIcon size={14} className="text-slate-500 md:hidden" weight="bold" />

                    {/* Check mode for display format */}
                    {mode === 'month' ? (
                        <span className={`text-sm md:text-base font-bold transition-colors whitespace-nowrap ${date.getMonth() === new Date().getMonth() && date.getFullYear() === new Date().getFullYear()
                            ? 'text-blue-600'
                            : 'text-slate-800 group-hover:text-blue-600'
                            }`}>
                            {date.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })}
                        </span>
                    ) : mode === 'week' ? (
                        (() => {
                            const endDate = new Date(date);
                            endDate.setDate(date.getDate() + 6);
                            return (
                                <span className="text-sm md:text-base font-black text-slate-800 group-hover:text-blue-600 transition-colors whitespace-nowrap flex items-center gap-1.5" dir="rtl">
                                    <span>{date.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}</span>
                                    <span className="text-slate-300 font-normal">-</span>
                                    <span>{endDate.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}</span>
                                </span>
                            );
                        })()
                    ) : (
                        (() => {
                            const isToday = date.toDateString() === new Date().toDateString();
                            return (
                                <>
                                    {/* Desktop Date Format - COMPACT (No Weekday) */}
                                    <span className={`hidden md:inline-flex items-center justify-center text-sm font-bold transition-all whitespace-nowrap ${isToday
                                        ? 'text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md ring-1 ring-blue-100 shadow-sm'
                                        : 'text-slate-800 group-hover:text-blue-600'
                                        }`}>
                                        {date.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                    </span>

                                    {/* Mobile Date Format (Shorter) */}
                                    <span className={`md:hidden inline-flex items-center justify-center text-sm font-bold transition-all whitespace-nowrap ${isToday
                                        ? 'text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md ring-1 ring-blue-100 shadow-sm'
                                        : 'text-slate-800 group-hover:text-blue-600'
                                        }`}>
                                        {date.getDate()}/{date.getMonth() + 1}
                                    </span>
                                </>
                            );
                        })()
                    )}
                </div>

                {/* Today Shortcut */}
                {showTodayButton && new Date().toDateString() !== date.toDateString() && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleToday();
                        }}
                        className="hidden md:flex items-center justify-center px-2 py-0.5 mr-2 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 hover:border-blue-300 rounded-md transition-all shadow-sm"
                        title="חזור להיום"
                    >
                        היום
                    </button>
                )}
            </div>

            <button
                onClick={handleNext}
                disabled={!canGoNext || (maxDate && date >= startOfDay(maxDate))}
                className="flex items-center justify-center h-9 w-9 rounded-md text-slate-700 hover:text-slate-900 hover:bg-white hover:shadow-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label={mode === 'day' ? "יום הבא" : "חודש הבא"}
            >
                <ChevronLeft size={20} weight="bold" />
            </button>

            {/* Portal Popover / Modal */}
            {isOpen && createPortal(
                <div
                    className="date-navigator-popover animate-in fade-in zoom-in-95 duration-200"
                    style={isMobileView ? mobileStyle : popoverStyle}
                    onClick={(e) => {
                        // Close on backdrop click (only relevant for mobile modal mode)
                        if (isMobileView && e.target === e.currentTarget) setIsOpen(false);
                    }}
                >
                    <CustomCalendar
                        value={date}
                        onChange={(d) => { onDateChange(d); setIsOpen(false); }}
                        onClose={() => setIsOpen(false)}
                        selectionMode={mode === 'month' ? 'month' : 'day'}
                        minDate={minDate}
                        maxDate={maxDate}
                    />
                </div>,
                (typeof document !== 'undefined' ? (document.fullscreenElement as HTMLElement) : null) || (typeof document !== 'undefined' ? document.body : null) as any
            )}
        </div>
    );
};

function startOfDay(date: Date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}
