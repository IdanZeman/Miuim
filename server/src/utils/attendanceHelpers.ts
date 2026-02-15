
import { TeamRotation } from '../types.js';

// Helper to normalize time strings (remove seconds)
export const normalizeTime = (t: string | undefined | null) => {
    if (!t) return undefined;
    if (t.split(':').length === 3) {
        return t.split(':').slice(0, 2).join(':');
    }
    return t;
};

export const getRotationStatusForDate = (date: Date, rotation: TeamRotation) => {
    const start = new Date(rotation.start_date);
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);

    const diffTime = d.getTime() - start.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return null;

    const cycleLength = rotation.days_on_base + rotation.days_at_home;
    const dayInCycle = diffDays % cycleLength;

    if (dayInCycle === 0) return 'arrival';
    if (dayInCycle < rotation.days_on_base - 1) return 'full';
    if (dayInCycle === rotation.days_on_base - 1) return 'departure';
    return 'home';
};

// Helper to check if a date string matches the target date
export const isSameDate = (dateStr: string, target: Date) => {
    const date = new Date(dateStr);
    return date.getFullYear() === target.getFullYear() &&
        date.getMonth() === target.getMonth() &&
        date.getDate() === target.getDate();
};
