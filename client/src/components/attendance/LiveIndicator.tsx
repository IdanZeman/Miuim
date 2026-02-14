import React from 'react';
import { MapPin, Clock } from '@phosphor-icons/react';

interface LiveIndicatorProps {
    type: 'arrival' | 'departure';
    time?: string;
    locationName?: string;
    size?: 'xs' | 'sm' | 'md' | 'lg';
    showLabel?: boolean;
    className?: string;
    compact?: boolean;
}

export const LiveIndicator: React.FC<LiveIndicatorProps> = ({
    type,
    time,
    locationName,
    size = 'md',
    showLabel = true,
    className = '',
    compact = false
}) => {
    const isArrival = type === 'arrival';

    // Consistent style tokens
    const styles = {
        arrival: {
            main: 'bg-emerald-500',
            light: 'bg-emerald-50',
            text: 'text-emerald-700',
            dark: 'text-emerald-900',
            border: 'border-emerald-200',
            pulse: 'bg-emerald-400'
        },
        departure: {
            main: 'bg-amber-500',
            light: 'bg-amber-50',
            text: 'text-amber-700',
            dark: 'text-amber-900',
            border: 'border-amber-200',
            pulse: 'bg-amber-400'
        }
    };

    const s = styles[type];

    // 1. GRID COMPACT MODE (For Monthly Table/Calendar Day Cells)
    if (compact) {
        return (
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded shadow-sm border border-white/20 ${s.main} text-white animate-fadeIn ${className}`}>
                <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse shrink-0" />
                <span className="text-[10px] font-black leading-none whitespace-nowrap overflow-visible">
                    <span className="hidden md:inline">{isArrival ? 'הגעה' : 'יציאה'}&nbsp;</span>
                    {time}
                </span>
            </div>
        );
    }

    // 2. STANDARD SIZES (For Daily Rows / Modals)
    const sizeConfigs = {
        xs: {
            dot: 'w-1.5 h-1.5',
            text: 'text-[10px]',
            padding: 'px-2 py-0.5',
            icon: 10
        },
        sm: {
            dot: 'w-2 h-2',
            text: 'text-[11px]',
            padding: 'px-2.5 py-1',
            icon: 12
        },
        md: {
            dot: 'w-2 h-2',
            text: 'text-xs',
            padding: 'px-3 py-1.5',
            icon: 14
        },
        lg: {
            dot: 'w-2.5 h-2.5',
            text: 'text-sm',
            padding: 'px-4 py-2',
            icon: 16
        }
    };

    const cfg = sizeConfigs[size];

    return (
        <div className={`flex flex-col items-center gap-0.5 animate-fadeIn ${className}`}>
            <div className={`flex items-center gap-2 ${cfg.padding} rounded-lg ${s.light} ${s.text} border ${s.border} shadow-sm backdrop-blur-sm`}>
                <div className="flex items-center gap-1.5 shrink-0">
                    <div className={`${cfg.dot} rounded-full ${isArrival ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse`} />
                    {showLabel && (
                        <span className={`${cfg.text} font-black uppercase tracking-tight`}>
                            {isArrival ? 'הגעה בפועל' : 'יציאה בפועל'}
                        </span>
                    )}
                </div>
                {time && (
                    <div className={`flex items-center gap-1 pr-1.5 border-r ${s.border} shrink-0`}>
                        <Clock size={cfg.icon} weight="fill" className="opacity-60" />
                        <span className={`${cfg.text} font-bold`}>{time}</span>
                    </div>
                )}
            </div>
            {locationName && size !== 'xs' && (
                <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-400 mt-0.5 w-full">
                    <MapPin size={cfg.icon - 2} weight="fill" className="opacity-40 shrink-0" />
                    <span className="truncate max-w-[140px]">{locationName}</span>
                </div>
            )}
        </div>
    );
};
