import { TaskTemplate, Shift } from '../types';
import { v4 as uuidv4 } from 'uuid';

export const generateShiftsForTask = (task: TaskTemplate, startOfWeek: Date): Shift[] => {
    const shifts: Shift[] = [];
    const daysToCheck = 7; // Generate for a week

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

        // Basic logic: Create a shift for this day
        // In a real app, we might check schedulingType ('continuous' vs 'one-time')
        // For 'one-time', we might only generate if it matches specificDate

        if (task.schedulingType === 'one-time' && !task.specificDate) {
            // If one-time but no date, maybe don't auto-generate? 
            // Or generate for today? Let's skip for now to be safe.
            continue;
        }

        const start = new Date(currentDate);
        if (task.defaultStartTime) {
            const [h, m] = task.defaultStartTime.split(':').map(Number);
            start.setHours(h, m, 0, 0);
        } else {
            start.setHours(8, 0, 0, 0); // Default to 08:00
        }

        const end = new Date(start);
        end.setHours(start.getHours() + (task.durationHours || 4)); // Default duration if missing

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

    return shifts;
};
