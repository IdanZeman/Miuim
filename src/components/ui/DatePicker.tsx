import React, { useRef } from 'react';
import { Calendar, Clock } from 'lucide-react';

interface DatePickerProps {
    label: string;
    value: string;
    onChange: (val: string) => void;
    className?: string;
    id?: string;
}

export const DatePicker: React.FC<DatePickerProps> = ({ label, value, onChange, className = '', id }) => {
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

    return (
        <div className={`flex flex-col gap-1.5 w-full ${className}`}>
            <label htmlFor={id} className="text-xs font-bold text-slate-500 mr-1">{label}</label>
            <div
                className="relative flex items-center gap-3 bg-white hover:bg-slate-50 border border-slate-200 hover:border-blue-400 rounded-xl p-3 cursor-pointer transition-all duration-200 shadow-sm hover:shadow group w-full"
                onClick={handleClick}
            >
                <div className="bg-blue-50 text-blue-600 p-2 rounded-lg group-hover:bg-blue-100 transition-colors">
                    <Calendar size={18} />
                </div>
                <div className="flex flex-col">
                    <span className="text-sm font-black text-slate-700 group-hover:text-blue-700 transition-colors">
                        {value ? dateObj.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' }) : 'בחר תאריך'}
                    </span>
                    <span className="text-[10px] font-medium text-slate-400">
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
                    aria-label={`בחר תאריך עבור ${label}`}
                />
            </div>
        </div>
    );
};

interface TimePickerProps {
    label: string;
    value: string;
    onChange: (val: string) => void;
    className?: string;
    id?: string;
}

export const TimePicker: React.FC<TimePickerProps> = ({ label, value, onChange, className = '', id }) => {
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

    return (
        <div className={`flex flex-col gap-1.5 w-full ${className}`}>
            <label htmlFor={id} className="text-xs font-bold text-slate-500 mr-1">{label}</label>
            <div
                className="relative flex items-center gap-3 bg-white hover:bg-slate-50 border border-slate-200 hover:border-blue-400 rounded-xl p-3 cursor-pointer transition-all duration-200 shadow-sm hover:shadow group w-full"
                onClick={handleClick}
            >
                <div className="bg-blue-50 text-blue-600 p-2 rounded-lg group-hover:bg-blue-100 transition-colors">
                    <Clock size={18} />
                </div>
                <div className="flex flex-col">
                    <span className="text-sm font-black text-slate-700 group-hover:text-blue-700 transition-colors">
                        {value || '00:00'}
                    </span>
                    <span className="text-[10px] font-medium text-slate-400">
                        שעה
                    </span>
                </div>
                <input
                    ref={inputRef}
                    id={id}
                    type="time"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                    aria-label={`בחר שעה עבור ${label}`}
                />
            </div>
        </div>
    );
};
