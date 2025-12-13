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
            // Compare YYYY-MM-DD strings to avoid time issues
            if (currentDate.toISOString().split('T')[0] !== specific.toISOString().split('T')[0]) {
                continue;
            }
        }

        // Check date range (startDate / endDate) for continuous tasks
        if (task.startDate) {
            const startLimit = new Date(task.startDate);
            // Reset time to 00:00:00 for accurate date comparison
            startLimit.setHours(0, 0, 0, 0);
            currentDate.setHours(0, 0, 0, 0);
            if (currentDate.getTime() < startLimit.getTime()) {
                continue;
            }
        }

        if (task.endDate) {
            // Use local date parts to construct YYYY-MM-DD for comparison
            // to avoid timezone issues with toISOString() which uses UTC
            const year = currentDate.getFullYear();
            const month = String(currentDate.getMonth() + 1).padStart(2, '0');
            const day = String(currentDate.getDate()).padStart(2, '0');
            const currentStr = `${year}-${month}-${day}`;
            
            // task.endDate is already YYYY-MM-DD
            if (currentStr > task.endDate) {
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
                // STRICT CHECK: If specific endDate is set, ensure individual shift starts on/before that date
                if (task.endDate) {
                    const shiftStartYear = currentShiftStart.getFullYear();
                    const shiftStartMonth = String(currentShiftStart.getMonth() + 1).padStart(2, '0');
                    const shiftStartDay = String(currentShiftStart.getDate()).padStart(2, '0');
                    const shiftStartStr = `${shiftStartYear}-${shiftStartMonth}-${shiftStartDay}`;
                    
                    console.log(`Checking shift start: ${shiftStartStr} vs EndDate: ${task.endDate}`);

                    if (shiftStartStr > task.endDate) {
                        console.log('Break: Shift starts after end date');
                        break;
                    }
                }

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
