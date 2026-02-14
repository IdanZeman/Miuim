import React, { useRef } from 'react';
import { CalendarBlank as Calendar, Clock } from '@phosphor-icons/react';

interface DatePickerProps {
    label?: string;
    value: string;
    onChange: (val: string) => void;
    className?: string;
    id?: string;
    variant?: 'default' | 'compact';
}

export const DatePicker: React.FC<DatePickerProps> = ({ label, value, onChange, className = '', id, variant = 'default' }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const dateObj = value ? new Date(value) : new Date();

    const handleClick = () => {
        const input = inputRef.current as any;
        if (input) {
            try {
                if ('showPicker' in input) {
                    input.showPicker();
                } else {
                    input.focus();
                    input.click();
                }
            } catch (e) {
                input.click();
            }
        }
    };

    if (variant === 'compact') {
        return (
            <div className={`flex flex-col gap-1 ${className}`}>
                {label && <label htmlFor={id} className="text-[10px] font-bold text-slate-500 mb-1 px-1">{label}</label>}
                <div className="relative flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-white border border-slate-200 hover:border-blue-400 rounded-xl h-12 md:h-10 px-3 transition-all duration-300 group shadow-sm active:scale-95">
                    <Calendar size={16} className="text-blue-600 shrink-0 absolute right-3 pointer-events-none z-10" weight="bold" />
                    <input
                        ref={inputRef}
                        id={id}
                        type="date"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className="w-full h-full text-base font-bold text-slate-800 bg-transparent border-0 outline-none cursor-pointer text-center pr-5 appearance-none [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                        style={{
                            colorScheme: 'light',
                        }}
                        aria-label={`בחר תאריך${label ? ' עבור ' + label : ''}`}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className={`flex flex-col gap-1.5 w-full ${className}`}>
            {label && <label htmlFor={id} className="text-xs font-bold text-slate-500 mb-0.5 px-0.5">{label}</label>}
            <div
                className="relative flex items-center gap-3 bg-slate-50 hover:bg-white border border-slate-200 hover:border-blue-500 rounded-xl px-4 py-3 cursor-pointer transition-all duration-300 group w-full shadow-sm active:scale-[0.98]"
                onClick={handleClick}
            >
                <div className="text-blue-600 bg-white p-2 rounded-lg border border-slate-100 shadow-sm group-hover:scale-110 transition-transform">
                    <Calendar size={20} weight="bold" />
                </div>
                <div className="flex flex-col min-w-0">
                    <span className="text-lg font-bold text-slate-800 truncate">
                        {value ? dateObj.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' }) : 'בחר תאריך'}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">
                        {value ? dateObj.toLocaleDateString('he-IL', { weekday: 'long' }) : 'לחץ לבחירה'}
                    </span>
                </div>
                <input
                    ref={inputRef}
                    id={id}
                    type="date"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                    aria-label={`בחר תאריך${label ? ' עבור ' + label : ''}`}
                />
            </div>
        </div>
    );
};

interface TimePickerProps {
    label?: string;
    value: string;
    onChange: (val: string) => void;
    className?: string;
    id?: string;
    variant?: 'default' | 'compact';
}

export const TimePicker: React.FC<TimePickerProps> = ({ label, value, onChange, className = '', id, variant = 'default' }) => {
    const inputRef = useRef<HTMLInputElement>(null);

    const handleClick = () => {
        const input = inputRef.current as any;
        if (input) {
            try {
                if ('showPicker' in input) {
                    input.showPicker();
                } else {
                    input.focus();
                    input.click();
                }
            } catch (e) {
                input.click();
            }
        }
    };

    if (variant === 'compact') {
        return (
            <div className={`flex flex-col gap-1 ${className}`}>
                {label && <label htmlFor={id} className="text-[10px] font-bold text-slate-500 mb-1 px-1">{label}</label>}
                <div
                    className="relative flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-white border border-slate-200 hover:border-blue-400 rounded-xl h-12 md:h-10 px-2 md:px-3 cursor-pointer transition-all duration-300 group shadow-sm active:scale-95"
                    onClick={handleClick}
                >
                    <Clock size={16} className="text-blue-600 shrink-0" weight="bold" />
                    <span className="text-base font-bold text-slate-800 font-mono whitespace-nowrap">
                        {value || '00:00'}
                    </span>
                    <input
                        ref={inputRef}
                        id={id}
                        type="time"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                        aria-label={`בחר שעה${label ? ' עבור ' + label : ''}`}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className={`flex flex-col gap-1.5 w-full ${className}`}>
            {label && <label htmlFor={id} className="text-xs font-bold text-slate-500 mb-0.5 px-0.5">{label}</label>}
            <div
                className="relative flex items-center gap-3 bg-slate-50 hover:bg-white border border-slate-200 hover:border-blue-500 rounded-xl px-3 py-2 cursor-pointer transition-all duration-300 group w-full shadow-sm h-full active:scale-[0.98]"
                onClick={handleClick}
            >
                <div className="text-blue-600 bg-white p-1.5 rounded-lg border border-slate-100 shadow-sm group-hover:scale-110 transition-transform">
                    <Clock size={20} weight="bold" />
                </div>
                <div className="flex flex-col min-w-0 justify-center">
                    <span className="text-xl font-bold text-slate-800 tracking-tight">
                        {value || '00:00'}
                    </span>
                </div>
                <input
                    ref={inputRef}
                    id={id}
                    type="time"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                    aria-label={`בחר שעה${label ? ' עבור ' + label : ''}`}
                />
            </div>
        </div>
    );
};

export const DateTimePicker: React.FC<DatePickerProps> = ({ label, value, onChange, className = '', id }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const dateObj = value ? new Date(value) : null;

    const handleClick = () => {
        const input = inputRef.current as any;
        if (input) {
            try {
                if ('showPicker' in input) {
                    input.showPicker();
                } else {
                    input.focus();
                    input.click();
                }
            } catch (e) {
                input.click();
            }
        }
    };

    return (
        <div className={`flex flex-col gap-1.5 w-full ${className}`}>
            {label && <label htmlFor={id} className="text-xs font-bold text-slate-500 mb-0.5 px-0.5">{label}</label>}
            <div
                className="relative flex items-center gap-3 bg-slate-50 hover:bg-white border border-slate-200 hover:border-blue-500 rounded-xl px-4 py-3 cursor-pointer transition-all duration-300 group w-full shadow-sm"
                onClick={handleClick}
            >
                <div className="text-blue-600 bg-white p-2 rounded-lg border border-slate-100 shadow-sm group-hover:scale-110 transition-transform">
                    <Calendar size={18} weight="bold" />
                </div>
                <div className="flex flex-col min-w-0">
                    <span className="text-base font-bold text-slate-800 truncate">
                        {dateObj ? dateObj.toLocaleString('he-IL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'בחר תאריך ושעה'}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">
                        {dateObj ? dateObj.toLocaleDateString('he-IL', { weekday: 'long' }) : 'לחץ לבחירה'}
                    </span>
                </div>
                <input
                    ref={inputRef}
                    id={id}
                    type="datetime-local"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                    aria-label={`בחר תאריך ושעה עבור ${label}`}
                />
            </div>
        </div>
    );
};

