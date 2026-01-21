import { Person, TeamRotation, Absence } from '@/types';

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
    hourlyBlockages: import('../types').HourlyBlockage[] = []
) => {
    const dateKey = date.toLocaleDateString('en-CA');

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
        let status = manual.status || (manual.isAvailable === false ? 'home' : 'full');
        if (status === 'base') status = 'full';

        // Derive arrival/departure from hours if it's a base-related status
        if (status === 'full' && manual.isAvailable !== false) {
            const isArrival = manual.startHour && manual.startHour !== '00:00';
            const isDeparture = manual.endHour && manual.endHour !== '23:59';
            if (isArrival) status = 'arrival';
            else if (isDeparture) status = 'departure';
        } else if (manual.isAvailable === false) {
            status = 'home';
        }

        // Merge manual blocks
        if (manual.unavailableBlocks) {
            unavailableBlocks = [...unavailableBlocks, ...manual.unavailableBlocks];
        }

        return { ...manual, status, source: manual.source || 'manual', unavailableBlocks, homeStatusType: manual.homeStatusType };
    }

    // Default return structure
    // Default return structure
    let derivedStatus = 'full' as any;
    let isAvailable = true;
    let derivedHomeStatusType: import('@/types').HomeStatusType | undefined;

    // Check for APPROVED full day coverage
    const fullDayAbsence = unavailableBlocks.find(b =>
        b.start === '00:00' &&
        b.end === '23:59' &&
        (b.status === 'approved') // Only approved blocks count as hard unavailability
    );
    if (fullDayAbsence) {
        derivedStatus = 'home'; // Or 'unavailable'
        isAvailable = false;
        // Absences might result in specific home types in the future, but for now generic
    }

    // Apply last manual status from history (Chronological Propagation)
    if (!fullDayAbsence) {
        const availKeys = person.dailyAvailability ? Object.keys(person.dailyAvailability) : [];
        let maxPrevDate = '';

        for (const k of availKeys) {
            if (k < dateKey && k > maxPrevDate) {
                maxPrevDate = k;
            }
        }

        if (maxPrevDate && person.dailyAvailability) {
            const prevEntry = person.dailyAvailability[maxPrevDate];
            let prevStatus = prevEntry.status || (prevEntry.isAvailable === false ? 'home' : 'full');
            if (prevStatus === 'base') prevStatus = 'full';

            // Derive arrival/departure for propagation
            if (prevStatus === 'full' && prevEntry.isAvailable !== false) {
                const isArrival = prevEntry.startHour && prevEntry.startHour !== '00:00';
                const isDeparture = prevEntry.endHour && prevEntry.endHour !== '23:59';
                if (isArrival) prevStatus = 'arrival';
                if (isDeparture) prevStatus = 'departure'; // Departure wins for next-day propagation
            }
            
            if (['home', 'unavailable', 'leave', 'gimel', 'not_in_shamp', 'organization_days', 'absent', 'departure'].includes(prevStatus)) {
                derivedStatus = 'home';
                isAvailable = false;
                
                if (prevEntry.homeStatusType) {
                    derivedHomeStatusType = prevEntry.homeStatusType;
                } else if (['gimel', 'leave_shamp', 'absent', 'organization_days', 'not_in_shamp'].includes(prevStatus)) {
                    derivedHomeStatusType = prevStatus as import('@/types').HomeStatusType;
                } else {
                    derivedHomeStatusType = 'leave_shamp'; // Default to vacation for generic home/departure
                }
            } else if (['base', 'full', 'arrival'].includes(prevStatus)) {
                derivedStatus = 'full';
                isAvailable = true;
            }
        } else if (person.lastManualStatus) {
            // Fallback to global last manual status if no history found in window
             if (person.lastManualStatus.status === 'home' || person.lastManualStatus.status === 'unavailable') {
                derivedStatus = 'home';
                isAvailable = false;
                derivedHomeStatusType = person.lastManualStatus.homeStatusType || 'leave_shamp';
            } else if (person.lastManualStatus.status === 'base') {
                derivedStatus = 'full';
                isAvailable = true;
            }
        }
    }

    let result = {
        isAvailable,
        startHour: '00:00',
        endHour: '23:59',
        status: derivedStatus,
        source: fullDayAbsence ? 'absence' : (person.lastManualStatus ? 'last_manual' : 'default'),
        unavailableBlocks,
        homeStatusType: derivedHomeStatusType
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
                if (dayInCycle === 0) result = { ...result, status: 'arrival', source: 'personal_rotation', homeStatusType: undefined };
                else if (dayInCycle < daysOn - 1) result = { ...result, status: 'full', source: 'personal_rotation', homeStatusType: undefined };
                else if (dayInCycle === daysOn - 1) result = { ...result, status: 'departure', source: 'personal_rotation', homeStatusType: undefined };
                else result = { ...result, isAvailable: false, status: 'home', source: 'personal_rotation', homeStatusType: undefined };
            }
        }
    }

    // 3. Team Rotation (Overrides Personal if exists)
    if (person.teamId) {
        const rotation = teamRotations.find(r => r.team_id === person.teamId);
        if (rotation) {
            const rotStatus = getRotationStatusForDate(date, rotation);
            if (rotStatus && result.isAvailable) { // Only apply if not already marked unavailable by absence
                if (rotStatus === 'home') result = { ...result, isAvailable: false, startHour: '00:00', endHour: '00:00', status: rotStatus, source: 'rotation', homeStatusType: undefined };
                else result = { ...result, isAvailable: true, startHour: '00:00', endHour: '23:59', status: rotStatus, source: 'rotation', homeStatusType: undefined };
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

/**
 * Determines if a given availability status counts as "present" at a specific time.
 * This is the central source of truth for headcount calculations.
 */
export const isStatusPresent = (
    avail: any, // AvailabilitySlot or effective availability
    targetMinutes: number
): boolean => {
    // 1. Basic Availability Check
    if (!avail.isAvailable) return false;
    if (avail.status === 'home' || avail.status === 'unavailable') return false;

    // 2. Time-of-Day Check (Arrival/Departure)
    if (avail.status === 'arrival' && avail.startHour) {
        const [startH, startM] = avail.startHour.split(':').map(Number);
        if (targetMinutes < (startH * 60 + startM)) return false;
    }

    if (avail.status === 'departure' && avail.endHour) {
        const [endH, endM] = avail.endHour.split(':').map(Number);
        if (targetMinutes >= (endH * 60 + endM)) return false;
    }

    // 3. Hourly Blockages Check
    if (avail.unavailableBlocks && avail.unavailableBlocks.length > 0) {
        const isBlocked = avail.unavailableBlocks.some((block: any) => {
            const [sh, sm] = block.start.split(':').map(Number);
            const [eh, em] = block.end.split(':').map(Number);
            const startMin = sh * 60 + sm;
            let endMin = eh * 60 + em;
            
            // Handle cross-day blocks if any
            if (endMin < startMin) endMin += 24 * 60;
            
            return targetMinutes >= startMin && targetMinutes < endMin;
        });
        if (isBlocked) return false;
    }

    return true;
};

/**
 * Checks if a person is physically present at a specific date and time.
 * Handles arrivals, departures, and hourly blockages.
 */
export const isPersonPresentAtHour = (
    person: Person,
    date: Date,
    timeStr: string, // HH:mm
    teamRotations: TeamRotation[],
    absences: Absence[] = [],
    hourlyBlockages: import('@/types').HourlyBlockage[] = []
): boolean => {
    const avail = getEffectiveAvailability(person, date, teamRotations, absences, hourlyBlockages);
    const [targetH, targetM] = timeStr.split(':').map(Number);
    const targetMinutes = targetH * 60 + targetM;

    return isStatusPresent(avail, targetMinutes);
};
