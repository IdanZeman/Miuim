import { AppState, Person, Shift, TaskTemplate, SchedulingConstraint, TeamRotation, Absence } from "../types";
import { getEffectiveAvailability } from "../utils/attendanceUtils";

// --- Internal Types for the Algorithm ---
interface TimelineSegment {
  start: number;
  end: number;
  type: 'TASK' | 'REST' | 'EXTERNAL_CONSTRAINT';
  taskId?: string;
  isCritical?: boolean;
  isMismatch?: boolean; // NEW: Flag for role mismatch (Level 4 assignments)
}

interface AlgoUser {
  person: Person;
  timeline: TimelineSegment[];
  loadScore: number;
  shiftsCount: number;
  criticalShiftCount: number; // NEW: counts critical shifts assigned
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
 * Check if a shift is during night hours (using dynamic settings)
 */
const isNightShift = (startTime: number, endTime: number, nightStartStr: string = '21:00', nightEndStr: string = '07:00'): boolean => {
  const start = new Date(startTime);
  const end = new Date(endTime);
  
  const [startH, startM] = nightStartStr.split(':').map(Number);
  const [endH, endM] = nightEndStr.split(':').map(Number);
  
  const startHour = start.getHours();
  const endHour = end.getHours();
  
  // Handle overnight range (e.g. 21:00 to 07:00)
  if (startH > endH) {
    return startHour >= startH || endHour <= endH;
  }
  // Handle same-day range (e.g. 00:00 to 06:00)
  return startHour >= startH && endHour <= endH;
}

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
 * NEW: Multi-level candidate finder with fallback mechanism
 * @param relaxationLevel 1 (Strict) → 2 (Flexible) → 3 (Emergency) → 4 (Force/Hail Mary)
 */
const findBestCandidates = (
  algoUsers: AlgoUser[],
  task: AlgoTask,
  roleId: string,
  count: number,
  relaxationLevel: 1 | 2 | 3 | 4,
  constraints: SchedulingConstraint[] = []
): AlgoUser[] => {
  const restDurationMs = task.minRest * 60 * 60 * 1000;

  let candidates = algoUsers.filter(u => {
    // 0. Check Constraints (Person > Team > Role Hierarchical Check)
    const userConstraints = constraints.filter(c => 
        c.personId === u.person.id || // Direct Person Constraint
        (c.teamId && c.teamId === u.person.teamId) || // Team Constraint
        (c.roleId && (u.person.roleIds || []).includes(c.roleId)) // Role Constraint
    );
    
    // NEVER_ASSIGN: If user has ANY "never assign" constraint for this task
    if (userConstraints.some(c => c.type === 'never_assign' && c.taskId === task.taskId)) {
        return false;
    }

    // REMOVED: "time_block" check here - it's handled in initializeUsers/Attendance logic.

    // ALWAYS_ASSIGN (Restriction): If user has "always assign to X", they CANNOT do Y (unless Y is X)
    const exclusiveTaskConstraints = userConstraints.filter(c => c.type === 'always_assign');
    if (exclusiveTaskConstraints.length > 0) {
        const permittedTaskIds = exclusiveTaskConstraints.map(c => c.taskId);
        if (!permittedTaskIds.includes(task.taskId)) {
            return false;
        }
    }

    // 1. Already assigned to this task? (Always check)
    if (task.currentAssignees.includes(u.person.id)) return false;

    // 2. Role Check - SKIPPED IN LEVEL 4 (Force Assign)
    if (relaxationLevel < 4) {
      if (!(u.person.roleIds || []).includes(roleId)) return false;
    }

    // LEVEL-SPECIFIC CHECKS
    if (relaxationLevel === 1) {
      // LEVEL 1: STRICT (Ideal conditions)
      // REMOVED: 36h Critical Task blocking (Burnout Protection)
      return canFit(u, task.startTime, task.endTime, restDurationMs);
    }

    if (relaxationLevel === 2) {
      // LEVEL 2: FLEXIBLE ("Fair Grind") - 50% rest
      const reducedRestMs = restDurationMs * 0.5;
      return canFit(u, task.startTime, task.endTime, reducedRestMs);
    }

    if (relaxationLevel >= 3) {
      // LEVEL 3 & 4: EMERGENCY/FORCE (Only physical availability)
      return canFit(u, task.startTime, task.endTime, 0);
    }

    return false;
  });

  // SORTING LOGIC
  if (task.isCritical || relaxationLevel === 4) {
    candidates.sort((a, b) => {
      if (a.criticalShiftCount !== b.criticalShiftCount) {
        return a.criticalShiftCount - b.criticalShiftCount;
      }
      return a.loadScore - b.loadScore;
    });
  } else {
    candidates.sort((a, b) => a.loadScore - b.loadScore);
  }

  return candidates.slice(0, count);
};

/**
 * Add a segment to the user's timeline and sort it.
 */
const addToTimeline = (user: AlgoUser, start: number, end: number, type: TimelineSegment['type'], taskId?: string, isCritical?: boolean, isMismatch?: boolean) => {
  user.timeline.push({ start, end, type, taskId, isCritical, isMismatch });
  user.timeline.sort((a, b) => a.start - b.start);
};

/**
 * Initialize users with external constraints (Attendance/Availability) AND Future Assignments.
 */
const initializeUsers = (
  people: Person[],
  targetDate: Date,
  historyScores: Record<string, { totalLoadScore: number, shiftsCount: number, criticalShiftCount: number }> = {},
  futureAssignments: Shift[],
  taskTemplates: TaskTemplate[],
  allShifts: Shift[],
  roleCounts: Map<string, number>,
  constraints: SchedulingConstraint[] = [],
  teamRotations: TeamRotation[] = [],
  absences: Absence[] = []
): AlgoUser[] => {
  console.log(`[InitializeUsers] Processing ${people.length} people for ${targetDate.toLocaleDateString()}`);

  return people.map(p => {
    const history = historyScores[p.id] || { totalLoadScore: 0, shiftsCount: 0, criticalShiftCount: 0 };
    const algoUser: AlgoUser = {
      person: p,
      timeline: [],
      loadScore: history.totalLoadScore,
      shiftsCount: history.shiftsCount,
      criticalShiftCount: history.criticalShiftCount
    };

    // NOTE: Removed all "time_block" constraint logic.
    // Soldier availability is now purely driven by getEffectiveAvailability (Attendance/Rotation/Absences).

    // 1. Absences - Create EXTERNAL_CONSTRAINT for any absence overlapping this day
    absences.forEach(a => {
        if (a.person_id === p.id) {
            const aStart = new Date(a.start_date).getTime();
            const aEnd = new Date(a.end_date).getTime();
            
            const dayStart = new Date(targetDate); dayStart.setHours(0,0,0,0);
            const dayEnd = new Date(targetDate); dayEnd.setHours(23,59,59,999);
            
            if (aStart < dayEnd.getTime() && aEnd > dayStart.getTime()) {
                addToTimeline(algoUser, Math.max(aStart, dayStart.getTime()), Math.min(aEnd, dayEnd.getTime()), 'EXTERNAL_CONSTRAINT');
            }
        }
    });

    // 2. Check Availability (Attendance Manager + Rotation) - Using Shared Utility
    const avail = getEffectiveAvailability(p, targetDate, teamRotations);

    if (avail) {
      if (!avail.isAvailable) {
        addToTimeline(algoUser, targetDate.setHours(0, 0, 0, 0), targetDate.setHours(23, 59, 59, 999), 'EXTERNAL_CONSTRAINT');
      } else if (avail.startHour && avail.endHour) {
        const [sH, sM] = avail.startHour!.split(':').map(Number);
        const [eH, eM] = avail.endHour!.split(':').map(Number);

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

    // 3. Block PAST shifts that END during the target day (Cross-Day Tasks)
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);

    const crossDayShifts = allShifts.filter(s => {
      if (!s.assignedPersonIds.includes(p.id)) return false;
      const shiftStart = new Date(s.startTime);
      const shiftEnd = new Date(s.endTime);
      return shiftStart < dayStart && shiftEnd > dayStart;
    });

    crossDayShifts.forEach(s => {
      const shiftEnd = new Date(s.endTime).getTime();
      const task = taskTemplates.find(t => t.id === s.taskId);
      
      let requirements = s.requirements;
      if (!requirements && task && s.segmentId) {
         const seg = task.segments?.find(seg => seg.id === s.segmentId);
         if (seg) {
             requirements = {
                 requiredPeople: seg.requiredPeople,
                 roleComposition: seg.roleComposition,
                 minRest: seg.minRestHoursAfter
             };
         }
      }

      const blockStart = dayStart.getTime();
      const isCritical = task && (task.difficulty >= 4);
      addToTimeline(algoUser, blockStart, shiftEnd, 'TASK', s.taskId, isCritical);

      const minRest = requirements?.minRest ?? 0;
      if (minRest > 0) {
        const restEnd = shiftEnd + (minRest * 60 * 60 * 1000);
        addToTimeline(algoUser, shiftEnd, restEnd, 'REST');
      }
    });

    // 4. Block Future Assignments (48h Lookahead)
    const userFutureShifts = futureAssignments.filter(s => s.assignedPersonIds.includes(p.id));
    userFutureShifts.forEach(s => {
      const sStart = new Date(s.startTime).getTime();
      const sEnd = new Date(s.endTime).getTime();
      const task = taskTemplates.find(t => t.id === s.taskId);

      let requirements = s.requirements;
      if (!requirements && task && s.segmentId) {
         const seg = task.segments?.find(seg => seg.id === s.segmentId);
         if (seg) requirements = { requiredPeople: seg.requiredPeople, roleComposition: seg.roleComposition, minRest: seg.minRestHoursAfter };
      }

      const isCritical = task && (task.difficulty >= 4);
      addToTimeline(algoUser, sStart, sEnd, 'EXTERNAL_CONSTRAINT', s.taskId, isCritical);

      const minRest = requirements?.minRest ?? 0;
      if (minRest > 0) {
        const restEnd = sEnd + (minRest * 60 * 60 * 1000);
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
  historyScores: Record<string, { totalLoadScore: number, shiftsCount: number, criticalShiftCount: number }> = {},
  futureAssignments: Shift[] = [],
  selectedTaskIds?: string[]
): Shift[] => {
  const { people, taskTemplates, shifts, constraints, settings } = currentState;

  console.log(`\n--- [SolveSchedule] Starting for ${startDate.toLocaleDateString()} ---`);
  
  // 0. Extract Settings
  const nightStart = settings?.night_shift_start || '21:00';
  const nightEnd = settings?.night_shift_end || '07:00';
  const rareRoleThreshold = (settings as any)?.rare_role_threshold || 2;
  
  console.log(`[Config] Night Shift: ${nightStart}-${nightEnd} | Rare Role Threshold: ${rareRoleThreshold}`);

  // 1. Prepare Data
  const targetDateKey = startDate.toLocaleDateString('en-CA');

  const allShiftsOnDay = shifts.filter(s => {
    const sDate = new Date(s.startTime).toLocaleDateString('en-CA');
    return sDate === targetDateKey && !s.isLocked;
  });

  let shiftsToSolve = allShiftsOnDay;
  let fixedShiftsOnDay: Shift[] = [];

  if (selectedTaskIds && selectedTaskIds.length > 0) {
    shiftsToSolve = allShiftsOnDay.filter(s => selectedTaskIds.includes(s.taskId));
    fixedShiftsOnDay = allShiftsOnDay.filter(s => !selectedTaskIds.includes(s.taskId));
  }

  if (shiftsToSolve.length === 0) {
    console.log('[SolveSchedule] No shifts to solve on this day.');
    return [];
  }

  // Calculate Role Rarity based on dynamic threshold
  const rolePoolCounts = new Map<string, number>();
  people.forEach(p => {
    (p.roleIds || []).forEach(rid => {
      rolePoolCounts.set(rid, (rolePoolCounts.get(rid) || 0) + 1);
    });
  });
  
  const isRareRole = (roleId: string) => (rolePoolCounts.get(roleId) || 0) <= rareRoleThreshold;

  const effectiveConstraints = [...futureAssignments, ...fixedShiftsOnDay];
  const algoUsers = initializeUsers(people, startDate, historyScores, effectiveConstraints, taskTemplates, shifts, rolePoolCounts, constraints || [], currentState.teamRotations || [], currentState.absences || []);

  const algoTasks: AlgoTask[] = shiftsToSolve.map(s => {
    const template = taskTemplates.find(t => t.id === s.taskId);
    if (!template) return null;

    const startTime = new Date(s.startTime).getTime();
    const endTime = new Date(s.endTime).getTime();

    const isNight = isNightShift(startTime, endTime, nightStart, nightEnd);
    const effectiveDifficulty = isNight ? template.difficulty * 1.5 : template.difficulty;

    let requiredPeople = 0;
    let roleComposition: { roleId: string; count: number }[] = [];
    let minRest = 0;
    let durationHours = (endTime - startTime) / (1000 * 60 * 60);

    if (s.requirements) {
        requiredPeople = s.requirements.requiredPeople;
        roleComposition = s.requirements.roleComposition;
        minRest = s.requirements.minRest;
    } else if (s.segmentId) {
        const seg = template.segments?.find(seg => seg.id === s.segmentId);
        if (seg) {
            requiredPeople = seg.requiredPeople;
            roleComposition = seg.roleComposition;
            minRest = seg.minRestHoursAfter;
        }
    }

    const hasRareRole = roleComposition.some(rc => isRareRole(rc.roleId));
    const isCritical = effectiveDifficulty >= 4 || hasRareRole;

    return {
      shiftId: s.id,
      taskId: template.id,
      startTime,
      endTime,
      durationHours,
      difficulty: effectiveDifficulty,
      roleComposition,
      requiredPeople,
      minRest,
      isCritical,
      currentAssignees: []
    };
  }).filter(Boolean) as AlgoTask[];

  const criticalTasks = algoTasks.filter(t => t.isCritical).sort((a, b) => a.startTime - b.startTime);
  const standardTasks = algoTasks.filter(t => !t.isCritical).sort((a, b) => a.startTime - b.startTime);

  const processTasks = (tasks: AlgoTask[], phaseName: string) => {
    console.log(`\n🚀 [Phase: ${phaseName}] ${tasks.length} tasks`);

    tasks.forEach((task) => {
      console.log(`[Task] ID: ${task.taskId} | Start: ${new Date(task.startTime).toLocaleTimeString()} | Needs: ${task.requiredPeople} | Critical: ${task.isCritical}`);

      task.roleComposition.forEach(comp => {
        const { roleId, count } = comp;
        if (count <= 0) return;

        let selected: AlgoUser[] = [];
        let usedLevel: 1 | 2 | 3 | 4 = 1;

        // Try Levels 1-4
        for (let level = 1; level <= 4; level++) {
          selected = findBestCandidates(algoUsers, task, roleId, count, level as any, constraints || []);
          if (selected.length >= count || level === 4) {
            usedLevel = level as any;
            break;
          }
        }

        selected.forEach(u => {
          task.currentAssignees.push(u.person.id);
          const restDurationMs = task.minRest * 60 * 60 * 1000;
          const isMismatch = !(u.person.roleIds || []).includes(roleId);

          addToTimeline(u, task.startTime, task.endTime, 'TASK', task.taskId, task.isCritical, isMismatch);
          if (task.minRest > 0) {
            addToTimeline(u, task.endTime, task.endTime + restDurationMs, 'REST');
          }

          u.loadScore += (task.durationHours * task.difficulty);
          u.shiftsCount += 1;
          if (task.isCritical) u.criticalShiftCount += 1;

          console.log(`   - Level ${usedLevel}: ${u.person.name} ${isMismatch ? '[ROLE MISMATCH]' : '[MATCH]'} | Load: ${u.loadScore.toFixed(1)}`);
        });

        if (selected.length < count) {
          console.error(`   - [FAIL] Could only find ${selected.length}/${count} people even at Level 4.`);
        }
      });
    });
  };

  processTasks(criticalTasks, "BIG ROCKS (Critical)");
  processTasks(standardTasks, "SAND (Standard)");

  const assignmentMap = new Map<string, string[]>();
  algoTasks.forEach(t => assignmentMap.set(t.shiftId, t.currentAssignees));

  console.log(`\n--- [SolveSchedule] Completed. Returning ${shiftsToSolve.length} updated shifts. ---\n`);

  return shiftsToSolve.map(s => ({
    ...s,
    assignedPersonIds: assignmentMap.get(s.id) || []
  }));
};
