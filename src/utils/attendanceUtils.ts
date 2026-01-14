import { Person, TeamRotation, Absence } from '../types';

export const getRotationStatusForDate = (date: Date, rotation: TeamRotation) => {
    const start = new Date(rotation.start_date);
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);

    const diffTime = d.getTime() - start.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return null; // Before rotation start

    const cycleLength = rotation.days_on_base + rotation.days_at_home;
    const dayInCycle = diffDays % cycleLength;

    if (dayInCycle === 0) return 'arrival';
    if (dayInCycle < rotation.days_on_base - 1) return 'full';
    if (dayInCycle === rotation.days_on_base - 1) return 'departure';
    return 'home';
};

// Helper to check if a date string matches the target date
const isSameDate = (dateStr: string, target: Date) => {
    return dateStr === target.toLocaleDateString('en-CA');
};

export const getEffectiveAvailability = (
    person: Person,
    date: Date,
    teamRotations: TeamRotation[],
    absences: import('../types').Absence[] = [],
    hourlyBlockages: import('../types').HourlyBlockage[] = [],
    unifiedPresence: import('../types').DailyPresence[] = []
) => {
    const dateKey = date.toLocaleDateString('en-CA');

    // 0. Check Unified Presence Table (New Source of Truth)
    if (unifiedPresence && unifiedPresence.length > 0) {
        const entry = unifiedPresence.find(up => up.person_id === person.id && up.date === dateKey);

        if (entry) {
            // Capture blocks first (still needed for UI display of reason/source)
            const unavailableBlocks: { id: string; start: string; end: string; reason?: string; type?: string; status?: string }[] = [];

            // Map the unified status to isAvailable
            const isAvailable = !['home', 'unavailable', 'leave'].includes(entry.status);

            // Reconstruct the response from the DB entry
            return {
                isAvailable,
                startHour: entry.start_time || '00:00',
                endHour: entry.end_time || '23:59',
                status: entry.status,
                source: entry.source,
                sourceId: entry.source_id,
                unavailableBlocks: [] // If we need granular blocks here, they'd need to be fetched separately or calculated
            };
        }
    }

    // 1. Manual Override & Absences
    let unavailableBlocks: { id: string; start: string; end: string; reason?: string; type?: string; status?: string }[] = [];

    // A. Collect blocks from Absences (Approved/Pending)
    const relevantAbsences = absences.filter(a =>
        a.person_id === person.id &&
        a.status !== 'rejected' && // Show pending/approved
        dateKey >= a.start_date &&
        dateKey <= a.end_date
    );

    relevantAbsences.forEach(a => {
        let start = '00:00';
        let end = '23:59';

        if (a.start_date === dateKey && a.start_time) start = a.start_time;
        if (a.end_date === dateKey && a.end_time) end = a.end_time;

        unavailableBlocks.push({
            id: a.id,
            start,
            end,
            reason: a.reason || 'Absence',
            type: 'absence',
            status: a.status // Pass status for filtering
        });
    });

    // B. Collect blocks from HourlyBlockages (NEW)
    const relevantHourlyBlockages = hourlyBlockages.filter(b =>
        b.person_id === person.id &&
        (b.date === dateKey || b.date.startsWith(dateKey))
    );

    relevantHourlyBlockages.forEach(b => {
        unavailableBlocks.push({
            id: b.id,
            start: b.start_time,
            end: b.end_time,
            reason: b.reason || 'חסימה',
            type: 'hourly_blockage',
            status: 'approved' // Manual blocks are always approved/active
        });
    });

    // Check person.dailyAvailability first (legacy/manual overrides)
    if (person.dailyAvailability && person.dailyAvailability[dateKey]) {

        const manual = person.dailyAvailability[dateKey];
        let status = manual.status || 'full';

        // Normalize 'base' to 'full' for UI consistency
        if (status === 'base') status = 'full';

        if (!manual.status && manual.isAvailable) {
            if (manual.startHour && manual.startHour !== '00:00') status = 'arrival';
            else if (manual.endHour && manual.endHour !== '23:59') status = 'departure';
        } else if (!manual.isAvailable) {
            status = 'home';
        }

        // Merge manual blocks
        if (manual.unavailableBlocks) {
            unavailableBlocks = [...unavailableBlocks, ...manual.unavailableBlocks];
        }

        return { ...manual, status, source: manual.source || 'manual', unavailableBlocks };
    }

    // Default return structure
    // If we have full-day absence blocks, status should be 'home' or 'unavailable'
    let derivedStatus = 'full' as any;
    let isAvailable = true;

    // Check for APPROVED full day coverage
    const fullDayAbsence = unavailableBlocks.find(b =>
        b.start === '00:00' &&
        b.end === '23:59' &&
        (b.status === 'approved') // Only approved blocks count as hard unavailability
    );
    if (fullDayAbsence) {
        derivedStatus = 'home'; // Or 'unavailable'
        isAvailable = false;
    }

    let result = {
        isAvailable,
        startHour: '00:00',
        endHour: '23:59',
        status: derivedStatus,
        source: fullDayAbsence ? 'absence' : 'default',
        unavailableBlocks
    };

    // 2. Personal Rotation
    if (person.personalRotation?.isActive && person.personalRotation.startDate) {
        const [y, m, dStr] = person.personalRotation.startDate.split('-').map(Number);
        const start = new Date(y, m - 1, dStr);
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        const diffTime = d.getTime() - start.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays >= 0) {
            const daysOn = person.personalRotation.daysOn || 1;
            const daysOff = person.personalRotation.daysOff || 1;
            const cycleLength = daysOn + daysOff;
            const dayInCycle = diffDays % cycleLength;

            // Preserve blocks even if rotation says something else? 
            // Rotation usually is base. Absences override rotation.
            // If result (absence) says unavailable, that wins.
            if (result.isAvailable) {
                if (dayInCycle === 0) result = { ...result, status: 'arrival', startHour: '10:00', source: 'personal_rotation' };
                else if (dayInCycle < daysOn - 1) result = { ...result, status: 'full', source: 'personal_rotation' };
                else if (dayInCycle === daysOn - 1) result = { ...result, status: 'departure', endHour: '14:00', source: 'personal_rotation' };
                else result = { ...result, isAvailable: false, status: 'home', source: 'personal_rotation' };
            }
        }
    }

    // 3. Team Rotation (Overrides Personal if exists)
    if (person.teamId) {
        const rotation = teamRotations.find(r => r.team_id === person.teamId);
        if (rotation) {
            const rotStatus = getRotationStatusForDate(date, rotation);
            if (rotStatus && result.isAvailable) { // Only apply if not already marked unavailable by absence
                if (rotStatus === 'home') result = { ...result, isAvailable: false, startHour: '00:00', endHour: '00:00', status: rotStatus, source: 'rotation' };
                else result = { ...result, isAvailable: true, startHour: rotStatus === 'arrival' ? '10:00' : '00:00', endHour: rotStatus === 'departure' ? '14:00' : '23:59', status: rotStatus, source: 'rotation' };
            }
        }
    }

    // DEBUG: Decision Trace for Dvir
    // Check various name forms just in case
    if (person.name.includes('דביר') || person.id.includes('dvir')) {
        const dbEntry = person.dailyAvailability?.[dateKey];

        // Widen filter to catch what's on screen (Dec 27, 28) and the problematic Dec 30
        if (dateKey >= '2025-12-27' && dateKey <= '2026-01-05') {
            if (dbEntry) {
                console.log(`[Trace-Dvir] ${dateKey} | Raw DB:`, JSON.stringify(dbEntry), `-> Final Status: ${result.status}`);
            } else {
                console.log(`[Trace-Dvir] ${dateKey} | No DB Entry (Used ${result.source}) -> Final: ${result.status}`);
            }
        }
    }

    return result;
};

/**
 * Dynamic Status Calculation based on DAILY AVAILABILITY (Source of Truth)
 * This handles cases where state might be desynced but daily_presence is updated.
 */
export const getComputedAbsenceStatus = (person: Person, absence: Absence | null | undefined): { status: 'approved' | 'rejected' | 'pending' | 'partially_approved' } => {
    if (!absence) return { status: 'pending' };

    // If we have an explicit optimistic status (that is NOT pending), use it. 
    if (absence.status && absence.status !== 'pending') return { status: absence.status as any };

    const start = new Date(absence.start_date);
    const end = new Date(absence.end_date);

    let totalDays = 0;
    let homeDays = 0;
    let baseDays = 0;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        totalDays++;
        const dateKey = d.toLocaleDateString('en-CA');
        const availability = person.dailyAvailability?.[dateKey];

        if (!availability) {
            continue;
        }

        if (availability.status === 'home' || availability.status === 'leave' || availability.isAvailable === false) {
            homeDays++;
        } else if (availability.status === 'base' || availability.status === 'arrival' || availability.status === 'departure' || availability.isAvailable === true) {
            baseDays++;
        }
    }

    if (homeDays === totalDays && totalDays > 0) return { status: 'approved' };
    if (homeDays > 0 && homeDays < totalDays) return { status: 'partially_approved' };
    if (baseDays === totalDays && totalDays > 0 && absence.status === 'rejected') return { status: 'rejected' };

    return { status: 'pending' };
};
