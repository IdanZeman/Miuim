import { House as Home, MapPin, CheckCircle as CheckCircle2, Clock, Info } from '@phosphor-icons/react';
import { Person, TeamRotation, Absence, HourlyBlockage } from '@/types';
import { getEffectiveAvailability } from './attendanceUtils';

export interface AttendanceVisualProps {
    label: string;
    subLabel?: string;
    bg: string;
    text: string;
    fillColor: string;
    textColor: string;
    icon: React.ElementType;
}

export interface EffectiveAvailability {
    isAvailable: boolean;
    startHour: string;
    endHour: string;
    status: string;
    source: string;
    unavailableBlocks?: { id: string; start: string; end: string; reason?: string }[];
    homeStatusType?: string;
}

export const getAttendanceVisualProps = (
    date: Date,
    person: Person,
    teamRotations: TeamRotation[],
    absences: Absence[],
    hourlyBlockages: HourlyBlockage[]
): AttendanceVisualProps => {
    // Helper to get effective availability for a date
    const getAvail = (d: Date) => getEffectiveAvailability(person, d, teamRotations, absences, hourlyBlockages) as EffectiveAvailability;

    const avail = getAvail(date);

    // Fetch prev/next for logic
    const prevDate = new Date(date); prevDate.setDate(date.getDate() - 1);
    const nextDate = new Date(date); nextDate.setDate(date.getDate() + 1);
    const prevAvail = getAvail(prevDate);
    const nextAvail = getAvail(nextDate);

    // Default Config
    let statusConfig: AttendanceVisualProps = {
        label: '',
        subLabel: undefined,
        bg: 'bg-white',
        text: 'text-slate-400',
        fillColor: 'FFFFFFFF', // ARGB White
        textColor: 'FF94A3B8', // ARGB Slate-400
        icon: Info
    };

    if (avail.status === 'undefined') {
        statusConfig = {
            label: 'לא מוגדר',
            subLabel: 'חסר דיווח יומי',
            bg: 'bg-slate-100',
            text: 'text-slate-500',
            fillColor: 'FFF1F5F9', // Slate-100
            textColor: 'FF64748B', // Slate-500
            icon: Info
        };
    } else if (avail.status === 'base' || avail.status === 'full' || avail.status === 'arrival' || avail.status === 'departure') {

        const isArrival = (!prevAvail.isAvailable || prevAvail.status === 'home') || (avail.startHour !== '00:00');
        const isDeparture = (!nextAvail.isAvailable || nextAvail.status === 'home') || (avail.endHour !== '23:59');
        const isSingleDay = isArrival && isDeparture;

        const isUndefinedTime = (isArrival && avail.startHour === '00:00') || (isDeparture && avail.endHour === '23:59' && avail.status !== 'departure');

        let label = isSingleDay ? 'יום בודד' : isArrival ? 'הגעה' : isDeparture ? 'יציאה' : 'בבסיס';
        let subLabel = undefined;
        let bg = isArrival || isSingleDay ? 'bg-emerald-50' : isDeparture ? 'bg-amber-50' : 'bg-emerald-50';
        let text = isArrival || isSingleDay ? 'text-emerald-700' : isDeparture ? 'text-amber-700' : 'text-emerald-700';
        let fillColor = isArrival || isSingleDay ? 'FFECFDF5' : isDeparture ? 'FFFFFBEB' : 'FFECFDF5';
        let textColor = isArrival || isSingleDay ? 'FF047857' : isDeparture ? 'FFB45309' : 'FF047857';
        let icon = isArrival || isDeparture ? MapPin : CheckCircle2;

        if (isUndefinedTime) {
            subLabel = (isArrival && isDeparture) ? 'חסר הגעה ויציאה' : isArrival ? 'חסר שעת הגעה' : 'חסר שעת יציאה';
            label = 'לא מוגדר';
            bg = 'bg-slate-100';
            text = 'text-slate-500';
            fillColor = 'FFF1F5F9';
            textColor = 'FF64748B';
            icon = Info;
        } else {
             // Append times to label
             if (avail.startHour !== '00:00' || avail.endHour !== '23:59') {
                if (isSingleDay || (!isArrival && !isDeparture)) {
                    label += ` ${avail.startHour}-${avail.endHour}`;
                } else if (isArrival && avail.startHour !== '00:00') {
                    label += ` ${avail.startHour}`;
                } else if (isDeparture && avail.endHour !== '23:59') {
                    label += ` ${avail.endHour}`;
                }
            }
        }

        statusConfig = { label, subLabel, bg, text, fillColor, textColor, icon };

    } else if (avail.status === 'home') {
        // Get home status type label
        const homeStatusLabels: Record<string, string> = {
            'leave_shamp': 'חופשה בשמפ',
            'gimel': 'ג\'',
            'absent': 'נפקד',
            'organization_days': 'ימי התארגנות',
            'not_in_shamp': 'לא בשמ"פ'
        };
        const homeTypeLabel = avail.homeStatusType ? (homeStatusLabels[avail.homeStatusType] || avail.homeStatusType) : 'חופשה בשמפ';

        statusConfig = {
            label: homeTypeLabel,
            subLabel: undefined,
            bg: 'bg-red-50',
            text: 'text-red-600',
            fillColor: 'FFF5F5F5',
            textColor: 'FFEF4444',
            icon: Home
        };
    } else if (avail.status === 'unavailable') {
        statusConfig = {
            label: 'אילוץ',
            subLabel: undefined,
            bg: 'bg-amber-50',
            text: 'text-amber-700',
            fillColor: 'FFFFFBEB',
            textColor: 'FFB45309',
            icon: Clock
        };
    }

    return statusConfig;
};
