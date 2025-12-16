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

    // 1. Manual Override
    if (person.dailyAvailability && person.dailyAvailability[dateKey]) {
        const manual = person.dailyAvailability[dateKey];
        // Infer status for manual overrides if not present
        let status = 'full';
        if (!manual.isAvailable) status = 'home';
        else if (manual.startHour && manual.startHour !== '00:00') status = 'arrival';
        else if (manual.endHour && manual.endHour !== '23:59') status = 'departure';
        
        return { ...manual, status, source: 'manual' };
    }

    // 2. Personal Rotation
    if (person.personalRotation?.isActive && person.personalRotation.startDate) {
        const [y, m, dStr] = person.personalRotation.startDate.split('-').map(Number);
        const start = new Date(y, m - 1, dStr); // Local midnight
        
        const d = new Date(date); 
        d.setHours(0,0,0,0);
        
        const diffTime = d.getTime() - start.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays >= 0) {
            const daysOn = person.personalRotation.daysOn || 1;
            const daysOff = person.personalRotation.daysOff || 1;
            const cycleLength = daysOn + daysOff;
            const dayInCycle = diffDays % cycleLength;

            if (dayInCycle === 0) {
                // Arrival: Default to full day 00:00-23:59
                return { isAvailable: true, startHour: '00:00', endHour: '23:59', status: 'arrival', source: 'personal_rotation' };
            } else if (dayInCycle < daysOn - 1) {
                return { isAvailable: true, startHour: '00:00', endHour: '23:59', status: 'full', source: 'personal_rotation' };
            } else if (dayInCycle === daysOn - 1) {
                // Departure: Default to full day 00:00-23:59
                return { isAvailable: true, startHour: '00:00', endHour: '23:59', status: 'departure', source: 'personal_rotation' };
            } else {
                return { isAvailable: false, startHour: '00:00', endHour: '00:00', status: 'home', source: 'personal_rotation' };
            }
        }
    }

    // 3. Team Rotation
    if (person.teamId) {
        const rotation = teamRotations.find(r => r.team_id === person.teamId);
        if (rotation) {
            const status = getRotationStatusForDate(date, rotation);
            if (status === 'home') return { isAvailable: false, startHour: '00:00', endHour: '00:00', status, source: 'rotation' };
            // Default all available statuses to 00:00-23:59
            if (status === 'arrival') return { isAvailable: true, startHour: '00:00', endHour: '23:59', status, source: 'rotation' };
            if (status === 'departure') return { isAvailable: true, startHour: '00:00', endHour: '23:59', status, source: 'rotation' };
            if (status === 'full') return { isAvailable: true, startHour: '00:00', endHour: '23:59', status, source: 'rotation' };
        }
    }

    // Default
    return { isAvailable: true, startHour: '00:00', endHour: '23:59', status: 'full', source: 'default' };
};
