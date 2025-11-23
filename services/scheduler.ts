import { AppState, Person, Shift, TaskTemplate } from "../types";

// --- Internal Types for the Algorithm ---
interface TimelineSegment {
  start: number;
  end: number;
  type: 'TASK' | 'REST' | 'EXTERNAL_CONSTRAINT';
  taskId?: string;
}

interface AlgoUser {
  person: Person;
  timeline: TimelineSegment[];
  loadScore: number; // Total duration * difficulty assigned (Initial + New)
  shiftsCount: number;
}

interface AlgoTask {
  shiftId: string;
  taskId: string;
  startTime: number;
  endTime: number;
  durationHours: number;
  difficulty: number;
  roleComposition: { roleId: string; count: number }[];
  requiredPeople: number;
  minRest: number; // Hours of rest required AFTER this task
  isCritical: boolean; // Difficulty >= 4 OR Rare Role
  currentAssignees: string[]; // IDs of people already assigned
}

// --- Helpers ---

/**
 * Check if a specific time slot is completely free in the user's timeline.
 * INCLUDES checking if rest period after the task is also free!
 */
const canFit = (user: AlgoUser, taskStart: number, taskEnd: number, restDurationMs: number): boolean => {
  // The TOTAL period we need to check is: task time + rest time
  const totalEnd = taskEnd + restDurationMs;
  
  for (const segment of user.timeline) {
    // Check for overlap: (StartA < EndB) and (EndA > StartB)
    if (taskStart < segment.end && totalEnd > segment.start) {
      return false; // Collision with task OR rest period
    }
  }
  return true;
};

/**
 * Add a segment to the user's timeline and sort it.
 */
const addToTimeline = (user: AlgoUser, start: number, end: number, type: TimelineSegment['type'], taskId?: string) => {
  user.timeline.push({ start, end, type, taskId });
  user.timeline.sort((a, b) => a.start - b.start);
};

/**
 * Initialize users with external constraints (Attendance/Availability) AND Future Assignments.
 */
const initializeUsers = (
  people: Person[],
  targetDate: Date,
  historyScores: Record<string, { totalLoadScore: number, shiftsCount: number }> = {},
  futureAssignments: Shift[],
  taskTemplates: TaskTemplate[],
  allShifts: Shift[] // NEW: Pass ALL shifts to check for cross-day tasks
): AlgoUser[] => {
  const dateKey = targetDate.toLocaleDateString('en-CA'); // YYYY-MM-DD

  return people.map(p => {
    const history = historyScores[p.id] || { totalLoadScore: 0, shiftsCount: 0 };
    const algoUser: AlgoUser = {
      person: p,
      timeline: [],
      loadScore: history.totalLoadScore, // Start with historical load
      shiftsCount: history.shiftsCount
    };

    // 1. Check Availability (Attendance Manager)
    const avail = p.dailyAvailability?.[dateKey];

    if (avail) {
      // If marked as "Absent" (isAvailable = false), block the whole day
      if (!avail.isAvailable) {
        addToTimeline(algoUser, targetDate.setHours(0, 0, 0, 0), targetDate.setHours(23, 59, 59, 999), 'EXTERNAL_CONSTRAINT');
      } else if (avail.startHour && avail.endHour) {
        // If present but has specific hours (e.g., 08:00 - 17:00)
        // Block 00:00 -> Start
        const [sH, sM] = avail.startHour.split(':').map(Number);
        const [eH, eM] = avail.endHour.split(':').map(Number);

        const dayStart = new Date(targetDate); dayStart.setHours(0, 0, 0, 0);
        const userStart = new Date(targetDate); userStart.setHours(sH, sM, 0, 0);

        const userEnd = new Date(targetDate); userEnd.setHours(eH, eM, 0, 0);
        const dayEnd = new Date(targetDate); dayEnd.setHours(23, 59, 59, 999);

        // Block time BEFORE arrival
        if (dayStart.getTime() < userStart.getTime()) {
          addToTimeline(algoUser, dayStart.getTime(), userStart.getTime(), 'EXTERNAL_CONSTRAINT');
        }

        // Block time AFTER departure
        if (userEnd.getTime() < dayEnd.getTime()) {
          addToTimeline(algoUser, userEnd.getTime(), dayEnd.getTime(), 'EXTERNAL_CONSTRAINT');
        }
      }
    }

    // 2. Block PAST shifts that END during the target day (Cross-Day Tasks)
    // Example: A shift starting 23:00 on Day 1 and ending 07:00 on Day 2
    // When scheduling Day 2, we need to block 00:00-07:00 + rest period
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    const crossDayShifts = allShifts.filter(s => {
      if (!s.assignedPersonIds.includes(p.id)) return false;
      
      const shiftStart = new Date(s.startTime);
      const shiftEnd = new Date(s.endTime);
      
      // Check if shift STARTS before target day but ENDS during or after it
      return shiftStart < dayStart && shiftEnd > dayStart;
    });

    crossDayShifts.forEach(s => {
      const shiftEnd = new Date(s.endTime).getTime();
      const task = taskTemplates.find(t => t.id === s.taskId);

      // Block from 00:00 until shift ends
      const blockStart = dayStart.getTime();
      addToTimeline(algoUser, blockStart, shiftEnd, 'TASK', s.taskId);

      // Add rest period after shift ends
      if (task && task.minRestHoursBefore > 0) {
        const restEnd = shiftEnd + (task.minRestHoursBefore * 60 * 60 * 1000);
        addToTimeline(algoUser, shiftEnd, restEnd, 'REST');
      }
    });

    // 3. Block Future Assignments (48h Lookahead)
    const userFutureShifts = futureAssignments.filter(s => s.assignedPersonIds.includes(p.id));
    userFutureShifts.forEach(s => {
      const sStart = new Date(s.startTime).getTime();
      const sEnd = new Date(s.endTime).getTime();
      const task = taskTemplates.find(t => t.id === s.taskId);

      // Block the shift itself
      addToTimeline(algoUser, sStart, sEnd, 'EXTERNAL_CONSTRAINT', s.taskId);

      // Block rest period if applicable
      if (task && task.minRestHoursBefore > 0) {
        const restEnd = sEnd + (task.minRestHoursBefore * 60 * 60 * 1000);
        addToTimeline(algoUser, sEnd, restEnd, 'REST');
      }
    });

    return algoUser;
  });
};

/**
 * The Main Solver Function
 */
export const solveSchedule = (
  currentState: AppState,
  startDate: Date,
  endDate: Date,
  historyScores: Record<string, { totalLoadScore: number, shiftsCount: number }> = {},
  futureAssignments: Shift[] = [] // Shifts already assigned in the next 48h
): Shift[] => {
  const { people, taskTemplates, shifts } = currentState;

  // 1. Prepare Data
  const targetDateKey = startDate.toLocaleDateString('en-CA');

  // Filter shifts relevant to this specific day (to be solved)
  const shiftsToSolve = shifts.filter(s => {
    const sDate = new Date(s.startTime).toLocaleDateString('en-CA');
    return sDate === targetDateKey && !s.isLocked;
  });

  // If no shifts to solve, return empty array
  if (shiftsToSolve.length === 0) return [];

  // Initialize Algorithm Users (Timeline & Constraints)
  const algoUsers = initializeUsers(people, startDate, historyScores, futureAssignments, taskTemplates, shifts);

  // Calculate Role Rarity (<= 2 people is "Rare")
  const roleCounts = new Map<string, number>();
  people.forEach(p => {
    p.roleIds.forEach(rid => {
      roleCounts.set(rid, (roleCounts.get(rid) || 0) + 1);
    });
  });

  // Map Shifts to AlgoTasks
  const algoTasks: AlgoTask[] = shiftsToSolve.map(s => {
    const template = taskTemplates.find(t => t.id === s.taskId);
    if (!template) return null;

    // Check if any required role is Rare
    const hasRareRole = template.roleComposition.some(rc => (roleCounts.get(rc.roleId) || 0) <= 2);

    return {
      shiftId: s.id,
      taskId: template.id,
      startTime: new Date(s.startTime).getTime(),
      endTime: new Date(s.endTime).getTime(),
      durationHours: template.durationHours,
      difficulty: template.difficulty,
      roleComposition: template.roleComposition,
      requiredPeople: template.requiredPeople,
      minRest: template.minRestHoursBefore,
      isCritical: template.difficulty >= 4 || hasRareRole, // Definition of "Big Rock"
      currentAssignees: [] // Clean slate for this run
    };
  }).filter(Boolean) as AlgoTask[];

  // 2. Sort Tasks for Multi-Pass (Big Rocks First)
  const criticalTasks = algoTasks.filter(t => t.isCritical).sort((a, b) => a.startTime - b.startTime);
  const standardTasks = algoTasks.filter(t => !t.isCritical).sort((a, b) => a.startTime - b.startTime);

  const processTasks = (tasks: AlgoTask[], phaseName: string) => {
    console.log(`\n🚀 Starting Phase: ${phaseName} (${tasks.length} tasks)`);

    tasks.forEach((task, i) => {
      console.log(`\n📋 Task ${task.taskId} (${new Date(task.startTime).toLocaleTimeString()}): Needs ${task.requiredPeople}`);

      // Iterate through Role Composition Buckets
      task.roleComposition.forEach(comp => {
        const { roleId, count } = comp;
        if (count <= 0) return;

        console.log(`   - Looking for ${count} people with role ${roleId}`);

        const restDurationMs = task.minRest * 60 * 60 * 1000; // Calculate ONCE per task

        // Find Candidates for THIS specific role bucket
        let candidates = algoUsers.filter(u => {
          // 1. Role Check
          if (!u.person.roleIds.includes(roleId)) return false;

          // 2. Already assigned to this task?
          if (task.currentAssignees.includes(u.person.id)) return false;

          // 3. Time Availability - NOW INCLUDES REST CHECK
          return canFit(u, task.startTime, task.endTime, restDurationMs);
        });

        // Scoring (Fairness)
        candidates.sort((a, b) => a.loadScore - b.loadScore);

        // Assign Top N
        const selected = candidates.slice(0, count);

        if (selected.length < count) {
          console.warn(`   ⚠️ Not enough candidates for role ${roleId}! Needed ${count}, found ${selected.length}`);
        }

        selected.forEach(u => {
          // Assign
          task.currentAssignees.push(u.person.id);

          // Update User State
          addToTimeline(u, task.startTime, task.endTime, 'TASK', task.taskId);
          if (task.minRest > 0) {
            addToTimeline(u, task.endTime, task.endTime + restDurationMs, 'REST');
          }

          // Update Metrics
          u.loadScore += (task.durationHours * task.difficulty);
          u.shiftsCount += 1;
        });
      });
    });
  };

  // 3. Execute Phases
  processTasks(criticalTasks, "BIG ROCKS (Critical)");
  processTasks(standardTasks, "SAND (Standard)");

  // 4. Reconstruct Shifts
  const assignmentMap = new Map<string, string[]>();
  algoTasks.forEach(t => assignmentMap.set(t.shiftId, t.currentAssignees));

  const solvedShifts = shiftsToSolve.map(s => ({
    ...s,
    assignedPersonIds: assignmentMap.get(s.id) || []
  }));

  return solvedShifts;
};
