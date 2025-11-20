
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
  requiredRoles: string[];
  requiredPeople: number;
  minRest: number; // Hours of rest required AFTER this task
  isCritical: boolean; // Difficulty >= 4
  currentAssignees: string[]; // IDs of people already assigned
}

// --- Helpers ---

/**
 * Check if a specific time slot is completely free in the user's timeline.
 */
const canFit = (user: AlgoUser, start: number, end: number): boolean => {
  for (const segment of user.timeline) {
    // Check for overlap: (StartA < EndB) and (EndA > StartB)
    if (start < segment.end && end > segment.start) {
      return false; // Collision
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
 * Initialize users with external constraints (Attendance/Availability).
 */
const initializeUsers = (people: Person[], targetDate: Date, historyScores: Record<string, { totalLoadScore: number, shiftsCount: number }> = {}): AlgoUser[] => {
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
  historyScores: Record<string, { totalLoadScore: number, shiftsCount: number }> = {}
): Shift[] => {
  const { people, taskTemplates, shifts } = currentState;

  // 1. Prepare Data
  const targetDateKey = startDate.toLocaleDateString('en-CA');

  // Filter shifts relevant to this specific day
  const shiftsToSolve = shifts.filter(s => {
    const sDate = new Date(s.startTime).toLocaleDateString('en-CA');
    return sDate === targetDateKey && !s.isLocked;
  });

  // If no shifts to solve, return empty array (or original)
  if (shiftsToSolve.length === 0) return [];

  // Initialize Algorithm Users (Timeline & Constraints)
  const algoUsers = initializeUsers(people, startDate, historyScores);

  // Map Shifts to AlgoTasks
  const algoTasks: AlgoTask[] = shiftsToSolve.map(s => {
    const template = taskTemplates.find(t => t.id === s.taskId);
    if (!template) return null;

    return {
      shiftId: s.id,
      taskId: template.id,
      startTime: new Date(s.startTime).getTime(),
      endTime: new Date(s.endTime).getTime(),
      durationHours: template.durationHours,
      difficulty: template.difficulty,
      requiredRoles: template.requiredRoleIds,
      requiredPeople: template.requiredPeople,
      minRest: template.minRestHoursBefore,
      isCritical: template.difficulty >= 4, // Definition of "Big Rock"
      currentAssignees: [] // Clean slate for this run
    };
  }).filter(Boolean) as AlgoTask[];

  // 2. Sort Tasks for Multi-Pass
  // Priority 1: Critical Tasks
  // Priority 2: Standard Tasks (sorted by time)
  const criticalTasks = algoTasks.filter(t => t.isCritical).sort((a, b) => a.startTime - b.startTime);
  const standardTasks = algoTasks.filter(t => !t.isCritical).sort((a, b) => a.startTime - b.startTime);

  const allSortedTasks = [...criticalTasks, ...standardTasks];

  // 3. Allocation Loop
  allSortedTasks.forEach(task => {
    const needed = task.requiredPeople;

    // Find Candidates
    let candidates = algoUsers.filter(u => {
      // Role Match
      if (task.requiredRoles.length > 0) {
        const hasRole = task.requiredRoles.some(rid => u.person.roleIds.includes(rid));
        if (!hasRole) return false;
      }

      // Time Availability (Task Duration + Post-Task Rest)
      // We treat minRest as time required AFTER the task before they can do another.
      const restDurationMs = task.minRest * 60 * 60 * 1000;
      const totalBlockEnd = task.endTime + restDurationMs;

      return canFit(u, task.startTime, totalBlockEnd);
    });

    // Scoring (Fairness)
    // Sort by Load Score (asc) -> Prefer those who worked less / easier tasks
    candidates.sort((a, b) => a.loadScore - b.loadScore);

    // Assign Top N
    const selected = candidates.slice(0, needed);

    selected.forEach(u => {
      // Assign
      task.currentAssignees.push(u.person.id);

      // Update User State
      const restDurationMs = task.minRest * 60 * 60 * 1000;

      // Block Task
      addToTimeline(u, task.startTime, task.endTime, 'TASK', task.taskId);

      // Block Rest (if exists)
      if (task.minRest > 0) {
        addToTimeline(u, task.endTime, task.endTime + restDurationMs, 'REST');
      }

      // Update Metrics
      u.loadScore += (task.durationHours * task.difficulty);
      u.shiftsCount += 1;
    });
  });

  // 4. Reconstruct Shifts
  // Create a map of new assignments
  const assignmentMap = new Map<string, string[]>();
  algoTasks.forEach(t => assignmentMap.set(t.shiftId, t.currentAssignees));

  // Return full list of updated shifts (including those we didn't touch, if any)
  // But here we operated on a filtered list. We need to merge back.
  // Actually, the app expects the *result* of the solver. 
  // We will return the solved shifts with their new assignments.

  const solvedShifts = shiftsToSolve.map(s => ({
    ...s,
    assignedPersonIds: assignmentMap.get(s.id) || []
  }));

  return solvedShifts;
};
