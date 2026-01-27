import { Person, TeamRotation, Absence } from '@/types';

// Helper to normalize time strings (remove seconds)
const normalizeTime = (t: string | undefined | null) => {
    if (!t) return undefined;
    return t.length > 5 ? t.substring(0, 5) : t;
};

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

    // C. Check Current Date Manual Entry
    const dbEntry = person.dailyAvailability?.[dateKey];
    const isManualEntry = dbEntry && dbEntry.source !== 'algorithm';

    if (isManualEntry) {
        const manual = dbEntry;
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

        return { 
            ...manual, 
            status, 
            source: manual.source || 'manual', 
            unavailableBlocks, 
            homeStatusType: manual.homeStatusType,
            startHour: normalizeTime(manual.startHour) || '00:00',
            endHour: (normalizeTime(manual.endHour) === '00:00' ? '23:59' : normalizeTime(manual.endHour)) || '23:59'
        };
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
        (b.status === 'approved' || b.status === 'partially_approved') // Only approved/partially_approved blocks count as hard unavailability
    );
    if (fullDayAbsence) {
        derivedStatus = 'home'; // Or 'unavailable'
        isAvailable = false;
        // Absences might result in specific home types in the future, but for now generic
    }

    // D. Apply last manual status from history (Chronological Propagation)
    // IMPORTANT: We only propagate from NON-ALGORITHM manual entries
    if (!fullDayAbsence) {
        const availKeys = person.dailyAvailability ? Object.keys(person.dailyAvailability) : [];
        let maxPrevManualDate = '';

        // If many keys, this linear search is slow. But for small sets it's fine.
        // For the AttendanceTable loop, we've optimized it by using a pre-calculated map when possible.
        for (let i = 0; i < availKeys.length; i++) {
            const k = availKeys[i];
            if (k < dateKey && k > maxPrevManualDate) {
                const entry = person.dailyAvailability![k];
                if (entry.source !== 'algorithm') {
                    maxPrevManualDate = k;
                }
            }
        }

        if (maxPrevManualDate && person.dailyAvailability) {
            const prevEntry = person.dailyAvailability[maxPrevManualDate];
            let prevStatus = prevEntry.status || (prevEntry.isAvailable === false ? 'home' : 'full');
            if (prevStatus === 'base') prevStatus = 'full';

            // Derive arrival/departure for propagation even if status isn't 'full'
            if (prevEntry.isAvailable !== false) {
                const isArrival = prevEntry.startHour && prevEntry.startHour !== '00:00';
                const isDeparture = prevEntry.endHour && prevEntry.endHour !== '23:59';
                // Departure takes priority for next-day propagation
                if (isDeparture) prevStatus = 'departure';
                else if (isArrival) prevStatus = 'arrival';
            }
            
            if (['home', 'unavailable', 'leave', 'gimel', 'not_in_shamp', 'organization_days', 'absent', 'departure'].includes(prevStatus)) {
                derivedStatus = 'home';
                isAvailable = false;
                
                if (prevEntry.homeStatusType) {
                    derivedHomeStatusType = prevEntry.homeStatusType;
                } else if (['gimel', 'leave_shamp', 'absent', 'organization_days', 'not_in_shamp'].includes(prevStatus)) {
                    derivedHomeStatusType = prevStatus as import('@/types').HomeStatusType;
                } else {
                    derivedHomeStatusType = 'leave_shamp'; 
                }
            } else if (['base', 'full', 'arrival'].includes(prevStatus)) {
                derivedStatus = 'full';
                isAvailable = true;
            }
        } else if (person.lastManualStatus) {
            // Fallback to global last manual status
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

    // E. Handle Algorithm Entry (Override propagation ONLY if manual propagation didn't find "Home" intent)
    // If propagation says we are Home (due to manual departure), we MUST ignore the algorithm's 'base'
    if (dbEntry && dbEntry.source === 'algorithm') {
        if (isAvailable === false && derivedStatus === 'home' && (dbEntry.status === 'base' || dbEntry.status === 'full' || dbEntry.isAvailable !== false)) {
            // Manual intent (Home) wins
        } else {
            // Otherwise, algorithm entry provides more specific data for this date
            let status = dbEntry.status || (dbEntry.isAvailable === false ? 'home' : 'full');
            if (status === 'base') status = 'full';
            
            // Derive arrival/departure
            if (status === 'full' && dbEntry.isAvailable !== false) {
                const isArrival = dbEntry.startHour && dbEntry.startHour !== '00:00';
                const isDeparture = dbEntry.endHour && dbEntry.endHour !== '23:59';
                if (isArrival) status = 'arrival';
                else if (isDeparture) status = 'departure';
            } else if (dbEntry.isAvailable === false) {
                status = 'home';
            }

            return { 
                ...dbEntry, 
                status, 
                source: 'algorithm', 
                unavailableBlocks: [...unavailableBlocks, ...(dbEntry.unavailableBlocks || [])],
                homeStatusType: dbEntry.homeStatusType,
                startHour: normalizeTime(dbEntry.startHour) || '00:00',
                endHour: (normalizeTime(dbEntry.endHour) === '00:00' ? '23:59' : normalizeTime(dbEntry.endHour)) || '23:59',
                isAvailable: dbEntry.isAvailable ?? (status !== 'home' && status !== 'unavailable')
            };
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
            // ONLY consider blocks that are explicitly active/confirmed.
            // If it's an absence: it MUST be approved or partially_approved to count as a blockage.
            // If it's an hourly_blockage (manual): it's always considered approved/active.
            
            const isAbsence = block.type === 'absence' || block.id?.startsWith('abs-'); // Fallback check
            const status = block.status;

            if (isAbsence) {
                // For absences, only approved or partially_approved statuses create a real "blockage"
                if (status !== 'approved' && status !== 'partially_approved') {
                    return false;
                }
            } else {
                // For manual hourly blockages, they are always active unless explicitly rejected/deleted
                if (status === 'rejected') return false;
            }

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

/**
 * Centralized logic for determining how to DISPLAY an attendance cell.
 * Handles context-aware logic like "Arrival" (based on previous day) and "Missing Departure" (based on next day).
 */
export const getAttendanceDisplayInfo = (
    person: Person,
    date: Date,
    teamRotations: TeamRotation[],
    absences: Absence[] = [],
    hourlyBlockages: import('@/types').HourlyBlockage[] = []
) => {
    const avail = getEffectiveAvailability(person, date, teamRotations, absences, hourlyBlockages);

    // Initial result object
    const result = {
        availability: avail, // Keep the raw effective availability
        displayStatus: 'unknown' as 'base' | 'home' | 'arrival' | 'departure' | 'missing_departure' | 'missing_arrival' | 'single_day' | 'unavailable' | 'unknown',
        label: 'לא ידוע',
        isBase: false,
        isHome: false,
        isArrival: false,
        isDeparture: false,
        isMissingDeparture: false,
        times: ''
    };

    if (avail.status === 'base' || avail.status === 'full' || avail.status === 'arrival' || avail.status === 'departure') {
        const prevDate = new Date(date);
        prevDate.setDate(date.getDate() - 1);
        const nextDate = new Date(date);
        nextDate.setDate(date.getDate() + 1);

        const prevAvail = getEffectiveAvailability(person, prevDate, teamRotations, absences, hourlyBlockages);
        const nextAvail = getEffectiveAvailability(person, nextDate, teamRotations, absences, hourlyBlockages);


        // Stronger continuity check: Only consider it an ARRRIVAL if we have an explicit start time
        // OR if we are staying the night (end=23:59) and weren't here yesterday.
        // We act as if '10:00' (or '10') is a default/phantom start if it appears without previous continuity in a departure context.
        const prevEndedAtBase = prevAvail.isAvailable && prevAvail.endHour === '23:59' && prevAvail.status !== 'home';
        
        // Phantom starts are default values that shouldn't count as explicit arrivals
        const isPhantomStart = (h: string) => {
             if (!h) return true;
             const t = h.trim();
             return t === '10:00' || t === '10' || t === '10:00:00' || t === '10:0' || t === '00:00';
        };

        const isExplicitStart = !isPhantomStart(avail.startHour);
        
        const isArrival = isExplicitStart || (!prevEndedAtBase && avail.endHour === '23:59');
        
        // Modified departure logic: Only true if explicitly set
        const isExplicitDeparture = (avail.endHour !== '23:59');
        
        // We only flag "Missing Departure" if the status explicitly says 'departure' but we have no valid time.
        const isMissingDeparture = (avail.status === 'departure' && !isExplicitDeparture);

        // NEW: Missing Arrival Logic - Simplified
        // If we are departing (explicit end), and we didn't qualify as a valid "Arrival" (no explicit non-default start, no overnight stay)
        // then we are missing the arrival.
        const isMissingArrival = isExplicitDeparture && !isArrival && !prevEndedAtBase;
        
        const isDeparture = isExplicitDeparture;
        const isSingleDay = isArrival && isDeparture; // Will be false if isArrival is false


        result.isBase = true;
        result.isArrival = isArrival;
        result.isDeparture = isDeparture;
        result.isMissingDeparture = isMissingDeparture;
        (result as any).isMissingArrival = isMissingArrival;

        if (isMissingArrival) {
            result.displayStatus = 'missing_arrival';
            result.label = 'יציאה (חסר הגעה)';
        } else if (isMissingDeparture) {
            result.displayStatus = 'missing_departure';
            result.label = isArrival ? 'הגעה (חסר יציאה)' : 'בסיס (חסר יציאה)';
        } else if (isSingleDay) {
            result.displayStatus = 'single_day';
            result.label = 'יום בודד';
        } else if (isArrival) {
            result.displayStatus = 'arrival';
            result.label = 'הגעה';
        } else if (isDeparture) {
            result.displayStatus = 'departure';
            result.label = 'יציאה';
        } else {
            result.displayStatus = 'base';
            result.label = 'בבסיס';
        }

        // Time formatting
        if (avail.startHour !== '00:00' || avail.endHour !== '23:59') {
            if (isSingleDay || (!isArrival && !isDeparture)) {
                result.times = `${avail.startHour}-${avail.endHour}`;
                if(isSingleDay) result.label += ` ${result.times}`; 
                 // Note: Implementation in Table usually appends checks: 
                 // if (isSingleDay || (!isArrival && !isDeparture)) label += times
            } else if (isArrival && avail.startHour !== '00:00') {
                result.times = avail.startHour;
                result.label += ` ${avail.startHour}`;
            } else if (isDeparture && avail.endHour !== '23:59') {
                result.times = avail.endHour;
                if (!isMissingArrival) result.label += ` ${avail.endHour}`; // Don't append if missing arrival, label handles it
                if (isMissingArrival)  result.label += ` ${avail.endHour}`; // Actually we do want the time, just formatted nicer? No, label is fixed.
                // Wait, if missing arrival, we might want to just show the end time clearly.
                // Reverting complex logic, just set times.
                result.times = avail.endHour;
            }
        }

    } else if (avail.status === 'home') {
        result.isHome = true;
        result.displayStatus = 'home';
        // Get home status type label
        const homeStatusLabels: Record<string, string> = {
            'leave_shamp': 'חופשה בשמפ',
            'gimel': 'ג\'',
            'absent': 'נפקד',
            'organization_days': 'ימי התארגנות',
            'not_in_shamp': 'לא בשמ"פ'
        };
        const homeTypeLabel = avail.homeStatusType ? homeStatusLabels[avail.homeStatusType] : 'חופשה בשמפ';
        result.label = homeTypeLabel;

    } else if (avail.status === 'unavailable') {
        result.displayStatus = 'unavailable';
        result.label = 'אילוץ';
    }

    return result;
};
