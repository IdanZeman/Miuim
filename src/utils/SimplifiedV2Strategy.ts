import { Person, TeamRotation, Absence, HourlyBlockage, AvailabilitySlot, V2State, V2SubState } from '@/types';
import { AttendanceStrategy } from './attendanceStrategyTypes';

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
                reason: a.reason || 'בקשת יציאה',
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

    // Map V1 status to V2 state if needed (for transitional support or mixed data)
    let state: V2State;
    
    if (dbEntry.v2_state) {
        state = dbEntry.v2_state;
    } else {
        // Fallback logic based on legacy status
        if (dbEntry.status === 'home' || dbEntry.status === 'unavailable') {
            state = 'home';
        } else if (dbEntry.status === 'base' || dbEntry.status === 'arrival' || dbEntry.status === 'departure') {
            state = 'base';
        } else {
             // If status is 'not_defined' or unknown, treat as no record but keep blocks
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
    }

    const subState = (dbEntry.v2_sub_state || dbEntry.status || 'full_day') as V2SubState;

    return {
      ...dbEntry,
      isAvailable: state === 'base',
      status: subState, // We use the subState as the display status
      v2_state: state,
      v2_sub_state: subState,
      source: dbEntry.source || 'manual',
      unavailableBlocks: [...unavailableBlocks, ...(dbEntry.unavailableBlocks || [])]
    };
  }
}
