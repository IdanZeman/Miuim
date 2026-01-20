import { useMemo } from 'react';
import { Person, Shift, TaskTemplate, Role, Absence, HourlyBlockage } from '@/types';

export interface Violation {
    id: string;
    type: 'rest_time' | 'role_mismatch' | 'absence_conflict';
    person: Person;
    shifts: Shift[];
    details: string;
    severity: 'high' | 'medium' | 'low';
    timestamp: number;
}

export function useComplianceViolations(
    people: Person[],
    shifts: Shift[],
    tasks: TaskTemplate[],
    roles: Role[],
    absences: Absence[],
    hourlyBlockages: HourlyBlockage[],
    filterDate?: Date
) {
    return useMemo(() => {
        const result: Violation[] = [];
        const activeShifts = shifts.filter(s => !s.isCancelled);

        // If filterDate is provided, filter for violations occurring strictly within that date's 24h window
        // If not provided, show all violations from beginning of time (or maybe reasonable past?) - keeping "all" for report
        const filterStart = filterDate ? new Date(filterDate).setHours(0, 0, 0, 0) : 0;
        const filterEnd = filterDate ? new Date(filterDate).setHours(23, 59, 59, 999) : Infinity;

        people.forEach(person => {
            const personShifts = activeShifts
                .filter(s => s.assignedPersonIds.includes(person.id))
                .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

            // 1. Rest Time Violations
            for (let i = 0; i < personShifts.length - 1; i++) {
                const currentShift = personShifts[i];
                const nextShift = personShifts[i + 1];

                const currentTask = tasks.find(t => t.id === currentShift.taskId);
                const currentSegment = currentTask?.segments.find(s => s.id === currentShift.segmentId);
                const minRest = currentShift.requirements?.minRest ?? currentSegment?.minRestHoursAfter ?? 0;

                if (minRest > 0) {
                    const restEnd = new Date(currentShift.endTime);
                    const restNeededUntil = new Date(restEnd.getTime() + minRest * 60 * 60 * 1000);
                    const nextStart = new Date(nextShift.startTime);

                    if (nextStart < restNeededUntil) {
                        const actualRest = (nextStart.getTime() - restEnd.getTime()) / (1000 * 60 * 60);
                        const violationTime = nextStart.getTime();

                        if (violationTime >= filterStart && violationTime <= filterEnd) {
                            result.push({
                                id: `rest-${currentShift.id}-${nextShift.id}`,
                                type: 'rest_time',
                                person,
                                shifts: [currentShift, nextShift],
                                details: `זמן מנוחה קצרה מדי: ${actualRest.toFixed(1)} שעות (נדרש ${minRest})`,
                                severity: actualRest < (minRest / 2) ? 'high' : 'medium',
                                timestamp: violationTime
                            });
                        }
                    }
                }
            }

            // 2. Role Mismatch
            personShifts.forEach(shift => {
                const shiftStart = new Date(shift.startTime).getTime();
                if (shiftStart < filterStart || shiftStart > filterEnd) return;

                const task = tasks.find(t => t.id === shift.taskId);
                const segment = task?.segments.find(s => s.id === shift.segmentId);
                const requirements = shift.requirements?.roleComposition ?? segment?.roleComposition ?? [];

                if (requirements.length > 0) {
                    const personRoles = person.roleIds || (person.roleId ? [person.roleId] : []);
                    const hasRequiredRole = requirements.some(req => personRoles.includes(req.roleId));

                    if (!hasRequiredRole) {
                        const requiredRoleNames = requirements
                            .map(req => roles.find(r => r.id === req.roleId)?.name)
                            .filter(Boolean)
                            .join(' או ');

                        result.push({
                            id: `role-${shift.id}-${person.id}`,
                            type: 'role_mismatch',
                            person,
                            shifts: [shift],
                            details: `חוסר התאמה להסמכה: דורש [${requiredRoleNames}]`,
                            severity: 'high',
                            timestamp: shiftStart
                        });
                    }
                }
            });

            // 3. Absence Conflicts
            personShifts.forEach(shift => {
                const sStart = new Date(shift.startTime);
                const sEnd = new Date(shift.endTime);
                const sStartTime = sStart.getTime();

                if (sStartTime < filterStart || sStartTime > filterEnd) return;

                const conflictAbsence = absences.find(a => {
                    if (a.person_id !== person.id || a.status !== 'approved') return false;
                    const aStart = new Date(`${a.start_date}T${a.start_time || '00:00'}`);
                    const aEnd = new Date(`${a.end_date}T${a.end_time || '23:59'}`);
                    return sStart < aEnd && sEnd > aStart;
                });

                if (conflictAbsence) {
                    result.push({
                        id: `absence-${shift.id}-${conflictAbsence.id}`,
                        type: 'absence_conflict',
                        person,
                        shifts: [shift],
                        details: `התנגשות עם היעדרות: ${conflictAbsence.reason || 'חופשה'}`,
                        severity: 'high',
                        timestamp: sStart.getTime()
                    });
                }

                const conflictBlockage = hourlyBlockages.find(b => {
                    if (b.person_id !== person.id) return false;
                    const bStart = new Date(`${b.date}T${b.start_time}`);
                    const bEnd = new Date(`${b.date}T${b.end_time}`);
                    return sStart < bEnd && sEnd > bStart;
                });

                if (conflictBlockage) {
                    result.push({
                        id: `blockage-${shift.id}-${conflictBlockage.id}`,
                        type: 'absence_conflict',
                        person,
                        shifts: [shift],
                        details: `התנגשות עם חסימה שעתית: ${conflictBlockage.reason || 'חסימה'}`,
                        severity: 'high',
                        timestamp: sStart.getTime()
                    });
                }
            });
        });

        return result;
    }, [people, shifts, tasks, roles, absences, hourlyBlockages, filterDate]);
}
