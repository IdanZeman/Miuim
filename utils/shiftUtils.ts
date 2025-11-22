import { TaskTemplate, Shift } from '../types';
import { v4 as uuidv4 } from 'uuid';

export const generateShiftsForTask = (task: TaskTemplate, startOfWeek: Date): Shift[] => {
    const shifts: Shift[] = [];
    const daysToCheck = 30; // Generate for 30 days ahead

    for (let i = 0; i < daysToCheck; i++) {
        const currentDate = new Date(startOfWeek);
        currentDate.setDate(startOfWeek.getDate() + i);

        // Check if specific date is set and matches
        if (task.specificDate) {
            const specific = new Date(task.specificDate);
            if (currentDate.toDateString() !== specific.toDateString()) {
                continue;
            }
        }

        if (task.schedulingType === 'one-time' && !task.specificDate) {
            continue;
        }

        const start = new Date(currentDate);
        if (task.defaultStartTime) {
            const [h, m] = task.defaultStartTime.split(':').map(Number);
            start.setHours(h, m, 0, 0);
        } else {
            start.setHours(8, 0, 0, 0); // Default to 08:00
        }

        // 24/7 Logic: Generate shifts until the end of the day (or cover 24 hours)
        if (task.is247) {
            let currentShiftStart = new Date(start);
            const dayLimit = new Date(start);
            dayLimit.setHours(start.getHours() + 24);

            let count = 0;
            while (currentShiftStart < dayLimit && count < 20) { // Safety break
                const end = new Date(currentShiftStart);
                end.setHours(currentShiftStart.getHours() + (task.durationHours || 4));

                const shift: Shift = {
                    id: uuidv4(),
                    taskId: task.id,
                    startTime: currentShiftStart.toISOString(),
                    endTime: end.toISOString(),
                    assignedPersonIds: [],
                    isLocked: false,
                    organization_id: task.organization_id
                };
                shifts.push(shift);

                currentShiftStart = new Date(end);
                count++;
            }
        } else {
            // Single shift logic
            const end = new Date(start);
            end.setHours(start.getHours() + (task.durationHours || 4));

            const shift: Shift = {
                id: uuidv4(),
                taskId: task.id,
                startTime: start.toISOString(),
                endTime: end.toISOString(),
                assignedPersonIds: [],
                isLocked: false,
                organization_id: task.organization_id
            };
            shifts.push(shift);
        }
    }

    return shifts;
};
