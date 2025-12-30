import React, { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, ChevronLeft, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from './Button';
import { CustomCalendar } from './CustomCalendar';

interface DateNavigatorProps {
    date: Date;
    onDateChange: (date: Date) => void;
    mode?: 'day' | 'month';
    label?: string;
    canGoPrev?: boolean;
    canGoNext?: boolean;
    className?: string;
    showTodayButton?: boolean;
}

export const DateNavigator: React.FC<DateNavigatorProps> = ({
    date,
    onDateChange,
    mode = 'day',
    label,
    canGoPrev = true,
    canGoNext = true,
    className,
    showTodayButton = true
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
        } else {
            newDate.setMonth(date.getMonth() - 1);
        }
        onDateChange(newDate);
    };

    const handleNext = () => {
        const newDate = new Date(date);
        if (mode === 'day') {
            newDate.setDate(date.getDate() + 1);
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
                disabled={!canGoPrev}
                className="flex items-center justify-center h-11 w-11 rounded-md text-slate-700 hover:text-slate-900 hover:bg-white hover:shadow-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label={mode === 'day' ? "יום קודם" : "חודש קודם"}
            >
                <ChevronRight size={24} strokeWidth={2.5} /> {/* Rule 1: Larger icon for 48px target */}
            </button>

            <div
                ref={triggerRef}
                className="relative group cursor-pointer flex items-center justify-center gap-2 min-w-[140px] md:min-w-[180px] px-2 h-11" // Rule 1: h-11 (44px) min height
                onClick={() => setIsOpen(!isOpen)}
            >
                {label && <span className="text-sm text-slate-500 font-medium hidden md:block">{label}</span>} {/* Rule 2: min 14px text */}

                <div className="flex items-center gap-2">
                    <CalendarIcon size={18} className="text-slate-500 md:hidden" /> {/* Rule 2: Larger icon */}

                    {/* Check mode for display format */}
                    {mode === 'month' ? (
                        <span className="text-base md:text-lg font-bold text-slate-800 group-hover:text-blue-600 transition-colors whitespace-nowrap"> {/* Rule 2: 16px body font */}
                            {date.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })}
                        </span>
                    ) : (
                        <>
                            {/* Desktop Date Format */}
                            <span className="hidden md:inline text-lg font-bold text-slate-800 group-hover:text-blue-600 transition-colors whitespace-nowrap">
                                {date.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </span>

                            {/* Mobile Date Format (Shorter) */}
                            <span className="md:hidden text-base font-bold text-slate-800 group-hover:text-blue-600 transition-colors whitespace-nowrap"> {/* Rule 2: 16px body font */}
                                {date.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' })}
                            </span>
                        </>
                    )}
                </div>

                {/* Today Shortcut */}
                {showTodayButton && (
                    <button
                        onClick={(e) => { e.stopPropagation(); handleToday(); }}
                        className="text-xs font-bold text-blue-700 hover:text-blue-800 hover:underline leading-none flex items-center bg-blue-50 px-3 h-8 rounded-full transition-colors border border-blue-100" // Rule 1 & 2
                    >
                        {mode === 'month' ? 'חודש נוכחי' : 'היום'}
                    </button>
                )}
            </div>

            <button
                onClick={handleNext}
                disabled={!canGoNext}
                className="flex items-center justify-center h-11 w-11 rounded-md text-slate-700 hover:text-slate-900 hover:bg-white hover:shadow-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label={mode === 'day' ? "יום הבא" : "חודש הבא"}
            >
                <ChevronLeft size={24} strokeWidth={2.5} /> {/* Rule 1: 44-48px target area */}
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
                    />
                </div>,
                document.body
            )}
        </div>
    );
};
