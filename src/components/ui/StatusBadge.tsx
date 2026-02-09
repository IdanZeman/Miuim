import React from 'react';
import {
    Info,
    WarningCircle as AlertCircle,
    MapPin,
    CheckCircle as CheckCircle2,
    House as Home,
    Clock
} from '@phosphor-icons/react';
import { HomeStatusType } from '@/types';

interface StatusBadgeProps {
    status: string; // 'base', 'home', 'unavailable', 'missing_departure', 'missing_arrival', etc.
    homeStatusType?: string; // 'leave_shamp', 'gimel', 'absent', etc.
    className?: string;
    showIcon?: boolean;
    size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
    status,
    homeStatusType,
    className = '',
    showIcon = true,
    size = 'md'
}) => {
    // Determine display status logic similar to AttendanceTable

    // Normalization helper
    const getStatusConfig = () => {
        // Unknown/Default
        let config = {
            label: 'לא ידוע',
            bg: 'bg-white text-slate-400 ring-1 ring-slate-100',
            dot: 'bg-slate-300',
            icon: Info
        };

        const homeStatusLabels: Record<string, string> = {
            'leave_shamp': "חופשה בשמפ",
            'gimel': "ג'",
            'absent': "נפקד",
            'organization_days': "ימי התארגנות",
            'not_in_shamp': "לא בשמ\"פ"
        };

        // Handle explicit composite statuses first (often coming from logs)
        if (status === 'missing_departure') {
            return {
                label: 'חסרה יציאה',
                bg: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100/50',
                dot: 'bg-rose-500',
                icon: AlertCircle
            };
        }

        if (status === 'missing_arrival') {
            return {
                label: 'חסרה הגעה',
                bg: 'bg-amber-50 text-amber-800 ring-1 ring-amber-100/50',
                dot: 'bg-rose-500',
                icon: AlertCircle
            };
        }

        // Helper to check if a status matches base
        const isBase = status === 'base' || status === 'בסיס';
        const isHome = status === 'home' || status === 'בית';

        // Check for specific substrings in descriptive statuses (from logs)
        const isArrival = status.includes('הגעה') || status.toLowerCase().includes('arrival') || (status.includes('- 23:59') && !status.includes('00:00 -'));
        const isDeparture = status.includes('יציאה') || status.toLowerCase().includes('departure') || (status.includes('00:00 -') && !status.includes('23:59'));
        const isFullBase = status.includes('יום מלא') || status.toLowerCase() === 'full' || (status.includes('00:00 - 23:59'));

        // Base / Attendance
        if (isBase || status.includes('בסיס') || status.includes('נוכח') || isArrival || isDeparture) {
            // Specific sub-types
            if (isArrival) {
                return {
                    label: status.includes('(') ? status : 'הגעה לבסיס',
                    bg: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/50',
                    dot: 'bg-emerald-500',
                    icon: MapPin
                };
            }
            if (isDeparture) {
                return {
                    label: status.includes('(') ? status : 'יציאה מהבסיס',
                    bg: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200/50',
                    dot: 'bg-amber-500',
                    icon: MapPin
                };
            }

            // Generic / Full Base
            return {
                label: status.includes('(') ? status : (isFullBase ? 'נוכח (יום מלא)' : 'נוכח בבסיס'),
                bg: 'bg-emerald-50/50 text-emerald-800 ring-1 ring-emerald-100/50',
                dot: 'bg-emerald-500',
                icon: CheckCircle2
            };
        }

        // Home
        if (isHome || status.includes('בית') || status.includes('חופשה')) {
            const typeLabel = homeStatusType ? (homeStatusLabels[homeStatusType] || homeStatusType) : (status.includes('(') ? status : 'בבית');
            return {
                label: typeLabel,
                bg: 'bg-red-50/80 text-red-800 ring-1 ring-red-100/50',
                dot: 'bg-red-500',
                icon: Home
            };
        }

        // Unavailable / Other
        if (status === 'unavailable' || status === 'אילוץ' || status.includes('אילוץ')) {
            return {
                label: status.includes('(') ? status : 'אילוץ / לא זמין',
                bg: 'bg-amber-50/80 text-amber-800 ring-1 ring-amber-100/50',
                dot: 'bg-amber-500',
                icon: Clock
            };
        }

        // Fallback: if we simply have text, try to show it nicely
        if (status && status !== 'לא ידוע') {
            return {
                label: status,
                bg: 'bg-slate-50 text-slate-600 ring-1 ring-slate-200/50',
                dot: 'bg-slate-400',
                icon: Info
            };
        }

        return config;
    };

    const config = getStatusConfig();
    const textSize = size === 'sm' ? 'text-[9px]' : 'text-[10px] md:text-xs';
    const padding = size === 'sm' ? 'px-2 py-1' : 'px-2.5 py-1.5 md:px-4 md:py-2';
    const borderRadius = size === 'sm' ? 'rounded-lg' : 'rounded-xl md:rounded-2xl';

    return (
        <div className={`flex items-center gap-1.5 ${padding} ${borderRadius} font-black ${textSize} shrink-0 ${config.bg} transition-all shadow-sm ring-1 ring-black/5 ${className}`}>
            {showIcon && <config.icon size={size === 'sm' ? 12 : 14} weight="bold" className="shrink-0" />}
            <span className="whitespace-nowrap tracking-tight">{config.label}</span>
        </div>
    );
};
