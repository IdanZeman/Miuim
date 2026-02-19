import { Person, TeamRotation, Absence, HourlyBlockage, AvailabilitySlot, HomeStatusType } from '@/types';
import { AttendanceStrategy } from './attendanceStrategyTypes';
import { normalizeTime, getRotationStatusForDate } from './attendanceHelpers';

/**
 * LegacyPropagationStrategy (V1)
 * 
 * Implements the original "Read-Time Propagation" logic.
 * This strategy calculates status dynamically by:
 * 1. Checking manual overrides
 * 2. Applying approved absences
 * 3. Propagating last manual status chronologically
 * 4. Falling back to rotations and defaults
 */
export class LegacyV1Strategy implements AttendanceStrategy {
    getEffectiveAvailability(
        person: Person,
        date: Date,
        teamRotations: TeamRotation[],
        absences: Absence[] = [],
        hourlyBlockages: HourlyBlockage[] = []
    ): AvailabilitySlot {
        const dateKey = date.toLocaleDateString('en-CA');



        // 1. Manual Override & Absences
        let unavailableBlocks: { id: string; start: string; end: string; reason?: string; type?: string; status?: string }[] = [];

        // A. Collect blocks from Absences
        const relevantAbsences = absences.filter(a =>
            a.person_id === person.id &&
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
                reason: a.reason || 'בקשת יציאה',
                type: 'absence',
                status: a.status
            });
        });

        // B. Collect blocks from HourlyBlockages
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
                status: 'approved'
            });
        });

        // C. Check Current Date Manual Entry
        const dbEntry = person.dailyAvailability?.[dateKey];
        const isManualEntry = dbEntry && dbEntry.source !== 'algorithm';

        if (isManualEntry) {
            const manual = dbEntry;
            let status = manual.status || (manual.isAvailable === false ? 'home' : 'full');
            if (status === 'base') status = 'full';

            if (status === 'full' && manual.isAvailable !== false) {
                const isArrival = manual.startHour && manual.startHour !== '00:00';
                const isDeparture = manual.endHour && manual.endHour !== '23:59';
                if (isArrival) status = 'arrival';
                else if (isDeparture) status = 'departure';
            } else if (manual.isAvailable === false) {
                status = 'home';
            }

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
                endHour: (normalizeTime(manual.endHour) === '00:00' ? '23:59' : normalizeTime(manual.endHour)) || '23:59',
                isAvailable: manual.isAvailable ?? (status !== 'home' && status !== 'unavailable'),
                actual_arrival_at: manual.actual_arrival_at,
                actual_departure_at: manual.actual_departure_at,
                reported_location_id: manual.reported_location_id,
                reported_location_name: manual.reported_location_name
            };
        }

        // Default return structure
        let derivedStatus = 'full' as any;
        let isAvailable = true;
        let derivedHomeStatusType: HomeStatusType | undefined;

        const fullDayAbsence = unavailableBlocks.find(b =>
            b.start === '00:00' &&
            b.end === '23:59' &&
            (b.status === 'approved' || b.status === 'partially_approved')
        );
        if (fullDayAbsence) {
            derivedStatus = 'home';
            isAvailable = false;
        }

        if (dbEntry && dbEntry.source === 'algorithm') {
            let status = dbEntry.v2_state || dbEntry.status || (dbEntry.isAvailable === false ? 'home' : 'full');
            if (status === 'base') status = 'full';

            const subState = dbEntry.v2_sub_state;
            if (subState === 'arrival') status = 'arrival';
            else if (subState === 'departure') status = 'departure';
            else if (status === 'full' && dbEntry.isAvailable !== false) {
                const isArrival = dbEntry.startHour && dbEntry.startHour !== '00:00';
                const isDeparture = dbEntry.endHour && dbEntry.endHour !== '23:59';
                if (isArrival) status = 'arrival';
                else if (isDeparture) status = 'departure';
            } else if (dbEntry.isAvailable === false || status === 'home') {
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
                isAvailable: dbEntry.isAvailable ?? (status !== 'home' && status !== 'unavailable'),
                actual_arrival_at: dbEntry.actual_arrival_at,
                actual_departure_at: dbEntry.actual_departure_at,
                reported_location_id: dbEntry.reported_location_id,
                reported_location_name: dbEntry.reported_location_name,
                v2_state: dbEntry.v2_state,
                v2_sub_state: dbEntry.v2_sub_state
            };
        }

        if (!fullDayAbsence) {
            const availKeys = person.dailyAvailability ? Object.keys(person.dailyAvailability) : [];
            let maxPrevManualDate = '';

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

                if (prevEntry.isAvailable !== false) {
                    const isArrival = prevEntry.startHour && prevEntry.startHour !== '00:00';
                    const isDeparture = prevEntry.endHour && prevEntry.endHour !== '23:59';
                    if (isDeparture) prevStatus = 'departure';
                    else if (isArrival) prevStatus = 'arrival';
                }

                if (['home', 'unavailable', 'leave', 'gimel', 'not_in_shamp', 'organization_days', 'absent', 'departure'].includes(prevStatus)) {
                    derivedStatus = 'home';
                    isAvailable = false;

                    if (prevEntry.homeStatusType) {
                        derivedHomeStatusType = prevEntry.homeStatusType;
                    } else if (['gimel', 'leave_shamp', 'absent', 'organization_days', 'not_in_shamp'].includes(prevStatus)) {
                        derivedHomeStatusType = prevStatus as HomeStatusType;
                    } else {
                        derivedHomeStatusType = 'leave_shamp';
                    }
                } else if (['base', 'full', 'arrival'].includes(prevStatus)) {
                    derivedStatus = 'full';
                    isAvailable = true;
                }
            } else if (person.lastManualStatus) {
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

        let result: AvailabilitySlot = {
            isAvailable,
            startHour: '00:00',
            endHour: '23:59',
            status: derivedStatus,
            source: fullDayAbsence ? 'absence' : (person.lastManualStatus ? 'last_manual' : 'default'),
            unavailableBlocks,
            homeStatusType: derivedHomeStatusType,
            actual_arrival_at: undefined,
            actual_departure_at: undefined,
            reported_location_id: undefined,
            reported_location_name: undefined,
            v2_state: undefined,
            v2_sub_state: undefined
        };

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

                if (result.isAvailable) {
                    if (dayInCycle === 0) result = { ...result, status: 'arrival', source: 'personal_rotation', homeStatusType: undefined };
                    else if (dayInCycle < daysOn - 1) result = { ...result, status: 'full', source: 'personal_rotation', homeStatusType: undefined };
                    else if (dayInCycle === daysOn - 1) result = { ...result, status: 'departure', source: 'personal_rotation', homeStatusType: undefined };
                    else result = { ...result, isAvailable: false, status: 'home', source: 'personal_rotation', homeStatusType: undefined };
                }
            }
        }

        if (person.teamId) {
            const rotation = teamRotations.find(r => r.team_id === person.teamId);
            if (rotation) {
                const rotStatus = getRotationStatusForDate(date, rotation);
                if (rotStatus && result.isAvailable) {
                    if (rotStatus === 'home') result = { ...result, isAvailable: false, startHour: '00:00', endHour: '00:00', status: rotStatus, source: 'rotation', homeStatusType: undefined };
                    else result = { ...result, isAvailable: true, startHour: '00:00', endHour: '23:59', status: rotStatus, source: 'rotation', homeStatusType: undefined };
                }
            }
        }

        return result;
    }
}
