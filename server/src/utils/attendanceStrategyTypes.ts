
import { Person, TeamRotation, Absence, HourlyBlockage, AvailabilitySlot } from '../types.js';

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
