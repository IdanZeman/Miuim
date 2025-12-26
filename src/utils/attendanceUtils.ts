import { Person, TeamRotation } from '../types';

export const getRotationStatusForDate = (date: Date, rotation: TeamRotation) => {
    const start = new Date(rotation.start_date);
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);

    const diffTime = d.getTime() - start.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return null; // Before rotation start

    const cycleLength = rotation.days_on_base + rotation.days_at_home;
    const dayInCycle = diffDays % cycleLength;

    if (dayInCycle === 0) return 'arrival';
    if (dayInCycle < rotation.days_on_base - 1) return 'full';
    if (dayInCycle === rotation.days_on_base - 1) return 'departure';
    return 'home';
};

export const getEffectiveAvailability = (person: Person, date: Date, teamRotations: TeamRotation[]) => {
    const dateKey = date.toLocaleDateString('en-CA');

    // 1. Manual Override & Absences
    let unavailableBlocks: { id: string; start: string; end: string; reason?: string }[] = [];
    
    // Check person.dailyAvailability first (legacy/manual overrides)
    if (person.dailyAvailability && person.dailyAvailability[dateKey]) {
        const manual = person.dailyAvailability[dateKey];
        let status = manual.status || 'full';
        
        if (!manual.status && manual.isAvailable) {
            if (manual.startHour && manual.startHour !== '00:00') status = 'arrival';
            else if (manual.endHour && manual.endHour !== '23:59') status = 'departure';
        } else if (!manual.isAvailable) {
            status = 'home';
        }
        
        return { ...manual, status, source: manual.source || 'manual', unavailableBlocks: manual.unavailableBlocks || [] };
    }

    // Default return structure
    let result = { isAvailable: true, startHour: '00:00', endHour: '23:59', status: 'full', source: 'default', unavailableBlocks };

    // 2. Personal Rotation
    if (person.personalRotation?.isActive && person.personalRotation.startDate) {
        const [y, m, dStr] = person.personalRotation.startDate.split('-').map(Number);
        const start = new Date(y, m - 1, dStr);
        const d = new Date(date); 
        d.setHours(0,0,0,0);
        const diffTime = d.getTime() - start.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays >= 0) {
            const daysOn = person.personalRotation.daysOn || 1;
            const daysOff = person.personalRotation.daysOff || 1;
            const cycleLength = daysOn + daysOff;
            const dayInCycle = diffDays % cycleLength;

            if (dayInCycle === 0) result = { ...result, startHour: '00:00', endHour: '23:59', status: 'arrival', source: 'personal_rotation' };
            else if (dayInCycle < daysOn - 1) result = { ...result, startHour: '00:00', endHour: '23:59', status: 'full', source: 'personal_rotation' };
            else if (dayInCycle === daysOn - 1) result = { ...result, startHour: '00:00', endHour: '23:59', status: 'departure', source: 'personal_rotation' };
            else result = { ...result, isAvailable: false, startHour: '00:00', endHour: '00:00', status: 'home', source: 'personal_rotation' };
        }
    }

    // 3. Team Rotation (Overrides Personal if exists and implies base)
    if (person.teamId) {
        const rotation = teamRotations.find(r => r.team_id === person.teamId);
        if (rotation) {
            const status = getRotationStatusForDate(date, rotation);
            if (status) {
                // If Team Rotation dictates HOME, it usually overrides unless specific override exists
                 if (status === 'home') result = { ...result, isAvailable: false, startHour: '00:00', endHour: '00:00', status, source: 'rotation' };
                 else result = { ...result, isAvailable: true, startHour: '00:00', endHour: '23:59', status, source: 'rotation' };
            }
        }
    }

    return result;
};
