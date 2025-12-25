import { TaskTemplate, Shift } from '../types';
import { v4 as uuidv4 } from 'uuid';

export const generateShiftsForTask = (task: TaskTemplate, startOfWeek: Date): Shift[] => {
    const shifts: Shift[] = [];
    const daysToCheck = 30; // Generate for 30 days ahead

    // Limit generation if task has an end date
    let effectiveEndDate: Date | null = null;
    if (task.endDate) {
        effectiveEndDate = new Date(task.endDate);
        effectiveEndDate.setHours(23, 59, 59, 999);
    }

    if (!task.segments || task.segments.length === 0) return [];

    task.segments.forEach(segment => {
        for (let i = 0; i < daysToCheck; i++) {
            const currentDate = new Date(startOfWeek);
            currentDate.setDate(startOfWeek.getDate() + i);
            // Fix: Use local date string instead of UTC (toISOString) to prevent timezone shifts
            const year = currentDate.getFullYear();
            const month = String(currentDate.getMonth() + 1).padStart(2, '0');
            const day = String(currentDate.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase(); // e.g., "monday"

            // 1. Check Global Task Validity (Start/End Date)
            if (task.startDate && dateStr < task.startDate) continue;
            if (task.endDate && dateStr > task.endDate) continue;

            // 2. Check Segment Frequency
            if (segment.frequency === 'specific_date') {
                if (!segment.specificDate || segment.specificDate !== dateStr) continue;
            } else if (segment.frequency === 'weekly') {
                if (!segment.daysOfWeek || !segment.daysOfWeek.map(d => d.toLowerCase()).includes(dayName)) continue;
            }
            // 'daily' runs every day, so no extra check needed

            // 3. Generate Shift
            const [h, m] = segment.startTime.split(':').map(Number);
            const start = new Date(currentDate);
            start.setHours(h, m, 0, 0);

            // Handle Repeat Cycle (e.g., continuous 4h shifts) or Single Block
            if (segment.isRepeat) {
                // Generate shifts until end of the relevant "day" window or 24h
                // For simplicity in this version, we will just generate repeatable shifts for 24h from start
                // OR we can stick to the previous "24/7" logic if that was the intent.
                // Assuming "Repeat" means "Fill the day with this segment's duration"
                
                let currentShiftStart = new Date(start);
                const cycleEnd = new Date(start);
                cycleEnd.setHours(start.getHours() + 24); // Cover 24h cycle

                // If specific end date is today, stop at end of day
                if (effectiveEndDate && cycleEnd > effectiveEndDate) {
                   // clamp? For now, let's just break if start is past end
                }

                let count = 0;
                while (currentShiftStart < cycleEnd && count < 50) { // Safety break increased
                     if (effectiveEndDate && currentShiftStart > effectiveEndDate) break;

                     const end = new Date(currentShiftStart);
                     end.setHours(currentShiftStart.getHours() + segment.durationHours);

                     shifts.push({
                        id: uuidv4(),
                        taskId: task.id,
                        segmentId: segment.id, // Link to segment
                        startTime: currentShiftStart.toISOString(),
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
                    
                    currentShiftStart = new Date(end);
                    count++;
                }

            } else {
                // Single Instance per match
                const end = new Date(start);
                end.setHours(start.getHours() + segment.durationHours);
                
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
