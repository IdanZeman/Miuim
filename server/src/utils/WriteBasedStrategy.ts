
import { Person, TeamRotation, Absence, HourlyBlockage, AvailabilitySlot } from '../types.js';
import { AttendanceStrategy } from './attendanceStrategyTypes.js';

/**
 * WriteBasedStrategy (V2)
 * 
 * Implements the new "Write-Based Deterministic Logic".
 * In V2, status is pre-calculated and written to the database at write-time.
 * This strategy simply fetches the existing records - no propagation needed.
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

        // Check for approved absences
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

        // Check team rotation
        if (person.teamId) {
            const rotation = teamRotations.find(r => r.team_id === person.teamId);
            if (rotation) {
                const rotStatus = this.getRotationStatus(date, rotation);
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

        // Fallback to default
        return {
            isAvailable: true,
            status: 'full',
            source: 'default',
            startHour: '00:00',
            endHour: '23:59',
            unavailableBlocks: []
        };
    }

    private getRotationStatus(date: Date, rotation: TeamRotation): string | null {
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
}
