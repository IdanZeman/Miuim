
import { Person, TeamRotation, Absence, HourlyBlockage, AvailabilitySlot, V2State, V2SubState } from '../types.js';
import { AttendanceStrategy } from './attendanceStrategyTypes.js';

/**
 * SimplifiedV2Strategy
 * 
 * Implements the "V2 Simplified" deterministic engine.
 * This strategy relies entirely on explicit records in the database.
 * If no record exists for a date, the status is "Not Defined".
 */
export class SimplifiedV2Strategy implements AttendanceStrategy {
    getEffectiveAvailability(
        person: Person,
        date: Date,
        _teamRotations: TeamRotation[],
        _absences: Absence[] = [],
        _hourlyBlockages: HourlyBlockage[] = []
    ): AvailabilitySlot {
        const dateKey = date.toLocaleDateString('en-CA'); // YYYY-MM-DD

        // In V2 Simplified, we collect unavailable blocks from absences and hourly blockages
        // to ensure they are visible in the UI even if the main status is determined by dbEntry.
        let unavailableBlocks: { id: string; start: string; end: string; reason?: string; type?: string; status?: string }[] = [];

        // A. Collect blocks from Absences (display-only in V2 Simplified, unless no dbEntry)
        _absences.forEach(a => {
            if (a.person_id === person.id && dateKey >= a.start_date && dateKey <= a.end_date) {
                let start = '00:00';
                let end = '23:59';

                if (a.start_date === dateKey && a.start_time) start = a.start_time;
                if (a.end_date === dateKey && a.end_time) end = a.end_time;

                unavailableBlocks.push({
                    id: a.id,
                    start,
                    end,
                    reason: (a.reason || 'בקשת יציאה').replace('| vacation', '').trim(),
                    type: 'absence',
                    status: a.status
                });
            }
        });

        // B. Collect blocks from HourlyBlockages
        _hourlyBlockages.forEach(b => {
            if (b.person_id === person.id && (b.date === dateKey || b.date.startsWith(dateKey))) {
                unavailableBlocks.push({
                    id: b.id,
                    start: b.start_time,
                    end: b.end_time,
                    reason: b.reason || 'חסימה',
                    type: 'hourly_blockage',
                    status: 'approved'
                });
            }
        });

        const dbEntry = person.dailyAvailability?.[dateKey];

        if (!dbEntry || (!dbEntry.v2_state && !dbEntry.status)) {
            // No explicit record exists - return "Not Defined" but include blocks
            return {
                isAvailable: false,
                status: 'not_defined',
                v2_state: undefined,
                v2_sub_state: 'not_defined',
                source: 'system',
                startHour: '00:00',
                endHour: '23:59',
                unavailableBlocks: unavailableBlocks
            };
        }

        // Helper functions for type-safe V1 → V2 mapping
        const mapV1StatusToV2State = (status: string): V2State => {
            if (status === 'home' || status === 'unavailable') return 'home';
            if (status === 'base' || status === 'arrival' || status === 'departure' || status === 'full') return 'base';
            return 'home'; // Default fallback
        };

        const mapV1StatusToV2SubState = (status: string): V2SubState => {
            switch (status) {
                case 'arrival': return 'arrival';
                case 'departure': return 'departure';
                case 'home': return 'vacation';
                case 'unavailable': return 'vacation';
                case 'base':
                case 'full':
                default: return 'full_day';
            }
        };

        // Map V1 status to V2 state with type safety
        let state: V2State;
        let subState: V2SubState;

        if (dbEntry.v2_state) {
            state = dbEntry.v2_state;
            subState = dbEntry.v2_sub_state || 'full_day';
        } else if (dbEntry.status) {
            // Fallback to V1 status with type-safe conversion
            state = mapV1StatusToV2State(dbEntry.status);
            subState = mapV1StatusToV2SubState(dbEntry.status);
        } else {
            // No data at all - return not_defined
            return {
                isAvailable: false,
                status: 'not_defined',
                v2_state: undefined,
                v2_sub_state: 'not_defined',
                source: 'system',
                startHour: '00:00',
                endHour: '23:59',
                unavailableBlocks: unavailableBlocks
            };
        }
        const displayStatus = (state === 'home' && dbEntry.homeStatusType) ? dbEntry.homeStatusType : subState;

        return {
            ...dbEntry,
            isAvailable: state === 'base',
            status: displayStatus,
            v2_state: state,
            v2_sub_state: subState,
            homeStatusType: dbEntry.homeStatusType,
            source: dbEntry.source || 'manual',
            unavailableBlocks: unavailableBlocks // V2: Only use fresh data from tables, not deprecated dbEntry.unavailableBlocks
        };
    }
}
