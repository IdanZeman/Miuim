import { Person, TeamRotation } from '../types';

export const getRotationStatusForDate = (person: Person, date: Date, rotation?: TeamRotation) => {
    if (!rotation || !person.teamId || person.teamId !== rotation.team_id) return null;

    // Check date range
    const anchor = new Date(rotation.start_date);
    const target = new Date(date);
    
    // Normalize to midnight UTC to avoid timezone drift
    const anchorTime = Date.UTC(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
    const targetTime = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());

    // Range Check
    if (targetTime < anchorTime) return null; // Before start
    if (rotation.end_date) {
        const end = new Date(rotation.end_date);
        const endTime = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
        // User request: If date is AFTER end date, show as HOME (not default/base)
        if (targetTime > endTime) {
             return { isAvailable: false, startHour: '00:00', endHour: '00:00', status: 'home', cycleDay: -1 };
        }
    }
    
    const diffDays = Math.floor((targetTime - anchorTime) / (1000 * 60 * 60 * 24));
    const cycleDay = ((diffDays % rotation.cycle_length) + rotation.cycle_length) % rotation.cycle_length; // Handle negative diffs

    // 0-indexed: 0 to (days_on_base - 1) is BASE
    const isBase = cycleDay < rotation.days_on_base;
    
    let startHour = '00:00';
    let endHour = '23:59';
    let status = '';

    if (isBase) {
        if (cycleDay === 0) {
            status = 'arrival';
            startHour = rotation.arrival_time; // Late arrival
        } else if (cycleDay === rotation.days_on_base - 1) {
            status = 'departure';
            endHour = rotation.departure_time; // Early departure
        } else {
            status = 'base';
        }
        return { isAvailable: true, startHour, endHour, status, cycleDay };
    } else {
         return { isAvailable: false, startHour: '00:00', endHour: '00:00', status: 'home', cycleDay };
    }
};

export const getEffectiveAvailability = (person: Person, date: Date, teamRotations: TeamRotation[]) => {
    const dateKey = date.toLocaleDateString('en-CA'); // YYYY-MM-DD
    
    // 1. Check for Manual Entry for this specific date
    const manualEntry = person.dailyAvailability?.[dateKey];
    if (manualEntry) return { ...manualEntry, source: 'manual' };

    // 2. Check for Rotation
    if (person.teamId) {
        const rotation = teamRotations.find(r => r.team_id === person.teamId);
        const rotStatus = getRotationStatusForDate(person, date, rotation);
        if (rotStatus) return { ...rotStatus, source: 'rotation' };
    }

    // 3. Default
    return { isAvailable: true, startHour: '00:00', endHour: '23:59', source: 'default', status: 'base' };
};
