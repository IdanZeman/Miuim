import { TaskTemplate, Shift } from '../types';
import { v4 as uuidv4 } from 'uuid';

export const generateShiftsForTask = (task: TaskTemplate, startOfWeek: Date): Shift[] => {
    const shifts: Shift[] = [];
    const daysToCheck = 30; // Generate for 30 days ahead

    const getLocalYMD = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const windowStart = new Date(startOfWeek);
    windowStart.setHours(0, 0, 0, 0);
    const windowEnd = new Date(startOfWeek);
    windowEnd.setDate(startOfWeek.getDate() + daysToCheck);
    windowEnd.setHours(23, 59, 59, 999);

    if (!task.segments || task.segments.length === 0) return [];

    task.segments.forEach(segment => {
        if (segment.isRepeat) {
            // TYPE 3: Continuous Periodic Chain (24/7 or recurring every X hours)
            // Anchor start is task.startDate + segment.startTime
            const anchorDateStr = task.startDate || getLocalYMD(windowStart);
            const timeParts = (segment.startTime || '00:00').split(':').map(Number);
            const h = isNaN(timeParts[0]) ? 0 : timeParts[0];
            const m = isNaN(timeParts[1]) ? 0 : timeParts[1];

            let current = new Date(anchorDateStr);
            current.setHours(h, m, 0, 0);

            const durationHours = segment.durationHours || 4;
            const cycleMs = durationHours * 3600000;

            // Fast-forward to windowStart to avoid generating too much history
            // but keep the phase (distance from anchor)
            if (cycleMs > 0 && current < windowStart) {
                const diffMs = windowStart.getTime() - current.getTime();
                const skips = Math.floor(diffMs / cycleMs);
                current.setTime(current.getTime() + skips * cycleMs);
            }

            let count = 0;
            // Generate until windowEnd, respecting task.endDate
            while (current < windowEnd && count < 2000) { // Increased limit slightly
                const sEnd = new Date(current.getTime() + cycleMs);
                const dateStr = getLocalYMD(current);

                const isAfterTaskStart = !task.startDate || dateStr >= task.startDate;
                const isBeforeTaskEnd = !task.endDate || dateStr <= task.endDate;
                const isInWindow = sEnd > windowStart && current < windowEnd;

                if (isAfterTaskStart && isBeforeTaskEnd && isInWindow) {
                    shifts.push({
                        id: uuidv4(),
                        taskId: task.id,
                        segmentId: segment.id,
                        startTime: current.toISOString(),
                        endTime: sEnd.toISOString(),
                        assignedPersonIds: [],
                        isLocked: false,
                        organization_id: task.organization_id,
                        requirements: {
                            requiredPeople: segment.requiredPeople || 0,
                            roleComposition: segment.roleComposition || [],
                            minRest: segment.minRestHoursAfter || 8
                        }
                    });
                }

                current = sEnd;
                count++;
            }
        } else {
            // TYPE 1 & 2: Fixed Window Tasks (Specific hours on specific days)
            for (let i = 0; i < daysToCheck; i++) {
                const currentDate = new Date(startOfWeek);
                currentDate.setDate(startOfWeek.getDate() + i);
                const dateStr = getLocalYMD(currentDate);
                const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

                // 1. Check Global Task Validity
                if (task.startDate && dateStr < task.startDate) continue;
                if (task.endDate && dateStr > task.endDate) continue;

                // 2. Check Segment Frequency
                if (segment.frequency === 'specific_date') {
                    if (!segment.specificDate || segment.specificDate !== dateStr) continue;
                } else if (segment.frequency === 'weekly') {
                    if (!segment.daysOfWeek || !segment.daysOfWeek.map(d => d.toLowerCase()).includes(dayName)) continue;
                }

                // 3. Generate Shift
                const [h, m] = segment.startTime.split(':').map(Number);
                const start = new Date(currentDate);
                start.setHours(h, m, 0, 0);
                const end = new Date(start.getTime() + segment.durationHours * 3600000);

                shifts.push({
                    id: uuidv4(),
                    taskId: task.id,
                    segmentId: segment.id,
                    startTime: start.toISOString(),
                    endTime: end.toISOString(),
                    assignedPersonIds: [],
                    isLocked: false,
                    organization_id: task.organization_id,
                    requirements: {
                        requiredPeople: segment.requiredPeople,
                        roleComposition: segment.roleComposition,
                        minRest: segment.minRestHoursAfter
                    }
                });
            }
        }
    });

    return shifts;
};
