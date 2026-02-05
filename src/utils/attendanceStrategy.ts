import { Person, TeamRotation, Absence, HourlyBlockage, AvailabilitySlot } from '@/types';
import { getEffectiveAvailability } from './attendanceUtils';

/**
 * AttendanceStrategy Interface
 * 
 * Defines the contract for calculating a person's effective availability for a given date.
 * Supports both V1 (legacy propagation) and V2 (write-based) engines.
 */
export interface AttendanceStrategy {
  /**
   * Calculate the effective availability for a person on a specific date.
   * 
   * @param person - The person whose availability is being calculated
   * @param date - The target date
   * @param teamRotations - Active team rotations
   * @param absences - Person's absence records
   * @param hourlyBlockages - Person's hourly blockages
   * @returns The effective availability slot for the person on the date
   */
  getEffectiveAvailability(
    person: Person,
    date: Date,
    teamRotations: TeamRotation[],
    absences: Absence[],
    hourlyBlockages: HourlyBlockage[]
  ): AvailabilitySlot;
}

/**
 * LegacyPropagationStrategy (V1)
 * 
 * Wraps the current "Read-Time Propagation" logic.
 * This strategy calculates status dynamically by:
 * 1. Checking manual overrides
 * 2. Applying approved absences
 * 3. Propagating last manual status chronologically
 * 4. Falling back to rotations and defaults
 * 
 * Use this for organizations with `engine_version = 'v1_legacy'`.
 */
export class LegacyPropagationStrategy implements AttendanceStrategy {
  getEffectiveAvailability(
    person: Person,
    date: Date,
    teamRotations: TeamRotation[],
    absences: Absence[] = [],
    hourlyBlockages: HourlyBlockage[] = []
  ): AvailabilitySlot {
    // Delegate to the existing getEffectiveAvailability function
    // This preserves all the complex propagation logic from V1
    return getEffectiveAvailability(person, date, teamRotations, absences, hourlyBlockages);
  }
}

/**
 * WriteBasedStrategy (V2)
 * 
 * Implements the new "Write-Based Deterministic Logic".
 * In V2, status is pre-calculated and written to the database at write-time.
 * This strategy simply fetches the existing records - no propagation needed.
 * 
 * The V2 engine follows the "3 Layers of Truth":
 * 1. Layer 1 (Reality): Manual Overrides & Approved Absences
 * 2. Layer 2 (The Plan): Rotations (e.g., 11/3)
 * 3. Layer 3 (Fallback): System Default (Base)
 * 
 * Records are written by the Edge Function during status changes.
 * Use this for organizations with `engine_version = 'v2_write_based'`.
 */
export class WriteBasedStrategy implements AttendanceStrategy {
  getEffectiveAvailability(
    person: Person,
    date: Date,
    teamRotations: TeamRotation[],
    absences: Absence[] = [],
    hourlyBlockages: HourlyBlockage[] = []
  ): AvailabilitySlot {
    const dateKey = date.toLocaleDateString('en-CA');
    
    // In V2, we trust the database records that were written at update-time
    const dbEntry = person.dailyAvailability?.[dateKey];
    
    if (dbEntry) {
      // Record exists - return it directly (no propagation needed)
      let status = dbEntry.status || (dbEntry.isAvailable === false ? 'home' : 'full');
      if (status === 'base') status = 'full';
      
      // Normalize time strings
      const normalizeTime = (t: string | undefined | null) => {
        if (!t) return undefined;
        return t.length > 5 ? t.substring(0, 5) : t;
      };
      
      return {
        ...dbEntry,
        status,
        startHour: normalizeTime(dbEntry.startHour) || '00:00',
        endHour: (normalizeTime(dbEntry.endHour) === '00:00' ? '23:59' : normalizeTime(dbEntry.endHour)) || '23:59',
        isAvailable: dbEntry.isAvailable ?? (status !== 'home' && status !== 'unavailable'),
        unavailableBlocks: dbEntry.unavailableBlocks || [],
      };
    }
    
    // No record found - fallback to rotation or default
    // This should be rare in V2, as the system writes ahead for up to 45 days
    
    // Check for approved absences (Layer 1)
    const relevantAbsences = absences.filter(a =>
      a.person_id === person.id &&
      a.status !== 'rejected' &&
      dateKey >= a.start_date &&
      dateKey <= a.end_date
    );
    
    if (relevantAbsences.length > 0) {
      const absence = relevantAbsences[0];
      let start = '00:00';
      let end = '23:59';
      
      if (absence.start_date === dateKey && absence.start_time) start = absence.start_time;
      if (absence.end_date === dateKey && absence.end_time) end = absence.end_time;
      
      return {
        isAvailable: false,
        status: 'home',
        source: 'absence',
        startHour: start,
        endHour: end,
        unavailableBlocks: [{
          id: absence.id,
          start,
          end,
          reason: absence.reason || 'Absence',
          type: 'absence',
          status: absence.status
        }]
      };
    }
    
    // Check team rotation (Layer 2)
    if (person.teamId) {
      const rotation = teamRotations.find(r => r.team_id === person.teamId);
      if (rotation) {
        const rotStatus = getRotationStatus(date, rotation);
        if (rotStatus) {
          return {
            isAvailable: rotStatus !== 'home',
            status: rotStatus === 'base' ? 'full' : rotStatus,
            source: 'rotation',
            startHour: '00:00',
            endHour: rotStatus === 'home' ? '00:00' : '23:59',
            unavailableBlocks: []
          };
        }
      }
    }
    
    // Fallback to default (Layer 3)
    return {
      isAvailable: true,
      status: 'full',
      source: 'default',
      startHour: '00:00',
      endHour: '23:59',
      unavailableBlocks: []
    };
  }
}

/**
 * Helper function to calculate rotation status for a date
 * (Duplicated from attendanceUtils to keep strategies self-contained)
 */
function getRotationStatus(date: Date, rotation: TeamRotation): string | null {
  const start = new Date(rotation.start_date);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);

  const diffTime = d.getTime() - start.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return null;

  const cycleLength = rotation.days_on_base + rotation.days_at_home;
  const dayInCycle = diffDays % cycleLength;

  if (dayInCycle === 0) return 'arrival';
  if (dayInCycle < rotation.days_on_base - 1) return 'full';
  if (dayInCycle === rotation.days_on_base - 1) return 'departure';
  return 'home';
}

/**
 * AttendanceStrategyFactory
 * 
 * Factory function that selects the appropriate strategy based on the organization's engine version.
 * 
 * @param engineVersion - The organization's engine_version ('v1_legacy' or 'v2_write_based')
 * @returns The appropriate AttendanceStrategy implementation
 * 
 * @example
 * const strategy = createAttendanceStrategy(organization.engine_version);
 * const availability = strategy.getEffectiveAvailability(person, date, rotations, absences, blockages);
 */
export function createAttendanceStrategy(engineVersion: 'v1_legacy' | 'v2_write_based'): AttendanceStrategy {
  switch (engineVersion) {
    case 'v2_write_based':
      return new WriteBasedStrategy();
    case 'v1_legacy':
    default:
      return new LegacyPropagationStrategy();
  }
}
