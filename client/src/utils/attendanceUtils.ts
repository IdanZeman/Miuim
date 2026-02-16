import { Person, TeamRotation, Absence, AvailabilitySlot } from '@/types';
import { createAttendanceStrategy } from './attendanceStrategy';
import { normalizeTime, getRotationStatusForDate as getRotationStatus } from './attendanceHelpers';

export const getRotationStatusForDate = getRotationStatus;

export const getEffectiveAvailability = (
    person: Person,
    date: Date,
    teamRotations: TeamRotation[],
    absences: Absence[] = [],
    hourlyBlockages: import('../types').HourlyBlockage[] = [],
    engineVersion: 'v1_legacy' | 'v2_write_based' | 'v2_simplified' = 'v1_legacy'
) => {
    const strategy = createAttendanceStrategy(engineVersion);
    return strategy.getEffectiveAvailability(person, date, teamRotations, absences, hourlyBlockages);
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
    if (baseDays === totalDays && totalDays > 0) return { status: 'rejected' };

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
    if (avail.status === 'home' || avail.status === 'unavailable' || avail.status === 'not_defined' || avail.v2_sub_state === 'not_defined') return false;

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
    hourlyBlockages: import('@/types').HourlyBlockage[] = [],
    engineVersion?: 'v1_legacy' | 'v2_write_based' | 'v2_simplified'
): boolean => {
    const avail = getEffectiveAvailability(person, date, teamRotations, absences, hourlyBlockages, engineVersion);
    const [targetH, targetM] = timeStr.split(':').map(Number);
    const targetMinutes = targetH * 60 + targetM;

    return isStatusPresent(avail, targetMinutes);
};

/**
 * Centralized logic for determining how to DISPLAY an attendance cell.
 * Handles context-aware logic like "Arrival" (based on previous day) and "Missing Departure" (based on next day).
 */
export interface AttendanceDisplayInfo {
    availability: import('@/types').AvailabilitySlot;
    displayStatus: 'base' | 'home' | 'arrival' | 'departure' | 'missing_departure' | 'missing_arrival' | 'single_day' | 'unavailable' | 'unknown' | 'not_defined';
    label: string;
    isBase: boolean;
    isHome: boolean;
    isArrival: boolean;
    isDeparture: boolean;
    isMissingDeparture: boolean;
    isMissingArrival?: boolean; // Label explicitly as optional
    hasContinuityWarning?: boolean; // New flag for warnings without changing labels
    times: string;
    actual_arrival_at?: string;
    actual_departure_at?: string;
    reported_location_id?: string;
    reported_location_name?: string;
}

/**
 * Centralized logic for determining how to DISPLAY an attendance cell.
 * Handles context-aware logic like "Arrival" (based on previous day) and "Missing Departure" (based on next day).
 */
export const getAttendanceDisplayInfo = (
    person: Person,
    date: Date,
    teamRotations: TeamRotation[],
    absences: Absence[] = [],
    hourlyBlockages: import('@/types').HourlyBlockage[] = [],
    engineVersion?: 'v1_legacy' | 'v2_write_based' | 'v2_simplified'
): AttendanceDisplayInfo => {
    const avail = getEffectiveAvailability(person, date, teamRotations, absences, hourlyBlockages, engineVersion);

    // Initial result object
    const result: AttendanceDisplayInfo = {
        availability: avail, // Keep the raw effective availability
        displayStatus: 'unknown',
        label: 'לא ידוע',
        isBase: false,
        isHome: false,
        isArrival: false,
        isDeparture: false,
        isMissingDeparture: false,
        times: '',
        actual_arrival_at: avail.actual_arrival_at,
        actual_departure_at: avail.actual_departure_at,
        reported_location_id: avail.reported_location_id,
        reported_location_name: avail.reported_location_name
    };

    if (avail.status === 'base' || avail.status === 'full' || avail.status === 'arrival' || avail.status === 'departure' || avail.v2_state === 'base') {
        const prevDate = new Date(date);
        prevDate.setDate(date.getDate() - 1);
        const prevAvail = getEffectiveAvailability(person, prevDate, teamRotations, absences, hourlyBlockages, engineVersion);

        // Explicit time checks
        const isExplicitStart = avail.startHour && avail.startHour !== '00:00';
        const isExplicitEnd = avail.endHour && avail.endHour !== '23:59';

        // Continuity check: was the person here at the end of yesterday?
        const prevEndedAtBase = prevAvail.isAvailable && prevAvail.endHour === '23:59' && prevAvail.v2_state !== 'home';

        // Logic for warnings
        const missingArrivalTrigger = !prevEndedAtBase && !isExplicitStart;

        result.isBase = true;
        result.isArrival = !!isExplicitStart;
        result.isDeparture = !!isExplicitEnd;
        result.hasContinuityWarning = missingArrivalTrigger;

        // Label prioritization:
        // 1. If we have explicit times, use Arrival/Departure labels.
        // 2. Otherwise, use the sub-state label (e.g., "Full Day").

        if (isExplicitStart && isExplicitEnd) {
            result.displayStatus = 'single_day';
            result.label = 'יום בודד';
        } else if (isExplicitStart) {
            result.displayStatus = 'arrival';
            result.label = 'הגעה';
        } else if (isExplicitEnd) {
            result.displayStatus = 'departure';
            result.label = 'יציאה';
            if (missingArrivalTrigger) {
                result.displayStatus = 'missing_arrival';
                result.label = 'יציאה (חסר הגעה)';
            }
        } else {
            result.displayStatus = 'base';
            result.label = avail.v2_sub_state === 'full_day' ? 'בבסיס' : 'בבסיס';

            // Special Case: If the user explicitly set 'arrival' or 'departure' as status but no times
            if (avail.status === 'arrival') {
                result.displayStatus = 'arrival';
                result.label = 'הגעה';
            } else if (avail.status === 'departure') {
                result.displayStatus = 'departure';
                result.label = 'יציאה';
            }
        }

        // Time formatting
        if (avail.startHour !== '00:00' || avail.endHour !== '23:59') {
            if (result.displayStatus === 'single_day' || (!result.isArrival && !result.isDeparture)) {
                result.times = `${avail.startHour || '00:00'}-${avail.endHour || '23:59'}`;
                if (result.displayStatus === 'single_day') result.label += ` ${result.times}`;
            } else if (result.isArrival && avail.startHour !== '00:00') {
                result.times = avail.startHour || '';
                result.label += ` ${avail.startHour}`;
            } else if (result.isDeparture && avail.endHour !== '23:59') {
                result.times = avail.endHour || '';
                if (!result.isMissingArrival) result.label += ` ${avail.endHour}`;
                else result.label += ` ${avail.endHour}`;
                result.times = avail.endHour || '';
            }
        }

    } else if (avail.status === 'home' || avail.v2_state === 'home') {
        result.isHome = true;
        result.displayStatus = 'home';
        // Get home status type label
        const homeStatusLabels: Record<string, string> = {
            'leave_shamp': 'חופשה בשמ"פ',
            'gimel': 'ג\'',
            'absent': 'נפקד',
            'organization_days': 'ימי התארגנות',
            'not_in_shamp': 'לא בשמ"פ',
            'vacation': 'חופשה',
            'org_days': 'התארגנות',
            'home': 'חופשה'
        };
        const homeTypeLabel = (avail.homeStatusType && homeStatusLabels[avail.homeStatusType]) ||
            (avail.v2_sub_state && homeStatusLabels[avail.v2_sub_state]) ||
            (avail.status && homeStatusLabels[avail.status]) ||
            'חופשה';
        result.label = homeTypeLabel;

    } else if (avail.status === 'unavailable' || avail.v2_sub_state === 'not_defined' || avail.status === 'not_defined') {
        result.displayStatus = avail.status === 'unavailable' ? 'unavailable' : 'not_defined';
        result.label = avail.status === 'unavailable' ? 'אילוץ' : 'לא הוגדר';
    }

    return result;
};
