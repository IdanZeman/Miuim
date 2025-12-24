import { AppState, Person, Shift, TaskTemplate, SchedulingConstraint, TeamRotation, Absence } from "../types";
import { getEffectiveAvailability } from "../utils/attendanceUtils";

// --- Internal Types for the Algorithm ---
// --- Internal Types for the Algorithm ---
interface TimelineSegment {
  start: number;
  end: number;
  type: 'TASK' | 'REST' | 'EXTERNAL_CONSTRAINT';
  subtype?: 'availability' | 'absence' | 'task' | 'rest'; // NEW: Distinguish constraint types
  taskId?: string;
  isCritical?: boolean;
  isMismatch?: boolean;
}

interface AlgoUser {
  person: Person;
  timeline: TimelineSegment[];
  loadScore: number;
  shiftsCount: number;
  criticalShiftCount: number;
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
  minRest: number;
  isCritical: boolean;
  currentAssignees: string[];
}

// --- Helpers ---

const isNightShift = (startTime: number, endTime: number, nightStartStr: string = '21:00', nightEndStr: string = '07:00'): boolean => {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const [startH, startM] = nightStartStr.split(':').map(Number);
  const [endH, endM] = nightEndStr.split(':').map(Number);
  const startHour = start.getHours();
  const endHour = end.getHours();
  if (startH > endH) {
    return startHour >= startH || endHour <= endH;
  }
  return startHour >= startH && endHour <= endH;
}

/**
 * Check if a specific time slot is completely free.
 */
const canFit = (user: AlgoUser, taskStart: number, taskEnd: number, restDurationMs: number, ignoreTypes: string[] = []): boolean => {
  const totalEnd = taskEnd + restDurationMs;
  
  for (const segment of user.timeline) {
    if (ignoreTypes.includes(segment.type)) continue;

    // Check for overlap: (StartA < EndB) and (EndA > StartB)
    if (taskStart < segment.end && totalEnd > segment.start) {
      return false; // Collision
    }
  }
  return true;
};



/**
 * Helper: Get human-readable availability status for a user at a specific time
 */
const getAvailabilityStatus = (user: AlgoUser, time: number): string => {
  const segment = user.timeline.find(s => s.start <= time && s.end > time);
  if (!segment) return 'Available';
  
  const timeLeft = Math.ceil((segment.end - time) / (1000 * 60));
  if (segment.type === 'REST') return `Resting (${timeLeft}m left)`;
  if (segment.type === 'TASK') return `Busy: Task ${segment.taskId || '?'} (${timeLeft}m left)`;
  if (segment.type === 'EXTERNAL_CONSTRAINT') return `Unavailable: ${segment.subtype || 'Constraint'}`;
  return segment.type;
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
  
  const rejectionStats = {
    role: 0,
    alreadyAssigned: 0,
    neverAssign: 0,
    exclusive: 0,
    collision: 0
  };

  let candidates = algoUsers.filter(u => {
    // 0. Check Constraints (Person > Team > Role Hierarchical Check)
    const userConstraints = constraints.filter(c => 
        c.personId === u.person.id || // Direct Person Constraint
        (c.teamId && c.teamId === u.person.teamId) || // Team Constraint
        (c.roleId && (u.person.roleIds || []).includes(c.roleId)) // Role Constraint
    );
    
    // NEVER_ASSIGN: If user has ANY "never assign" constraint for this task
    if (userConstraints.some(c => c.type === 'never_assign' && c.taskId === task.taskId)) {
        rejectionStats.neverAssign++;
        return false;
    }

    // ALWAYS_ASSIGN
    const exclusiveTaskConstraints = userConstraints.filter(c => c.type === 'always_assign');
    if (exclusiveTaskConstraints.length > 0) {
        const permittedTaskIds = exclusiveTaskConstraints.map(c => c.taskId);
        if (!permittedTaskIds.includes(task.taskId)) {
            rejectionStats.exclusive++;
            return false;
        }
    }

    // 1. Already assigned to this task?
    if (task.currentAssignees.includes(u.person.id)) {
        rejectionStats.alreadyAssigned++;
        return false;
    }

    // 2. Role Check - SKIPPED IN LEVEL 4 (Force Assign)
    if (relaxationLevel < 4) {
      if (!(u.person.roleIds || []).includes(roleId)) {
        rejectionStats.role++;
        return false;
      }
    }

    // LEVEL-SPECIFIC CHECKS
    let fit = false;
    
    if (relaxationLevel === 1) {
      fit = canFit(u, task.startTime, task.endTime, restDurationMs);
    } 
    else if (relaxationLevel === 2) {
      // LEVEL 2: FLEXIBLE ("Fair Grind") - 50% rest
      const reducedRestMs = restDurationMs * 0.5;
      fit = canFit(u, task.startTime, task.endTime, reducedRestMs);
    } 
    else if (relaxationLevel >= 3) {
      // Level 3 & 4: EMERGENCY/FORCE (Only physical availability)
      // NEW: Level 4 ignores 'REST' segments (Force Assign)
      const ignoreTypes = relaxationLevel === 4 ? ['REST'] : [];
      fit = canFit(u, task.startTime, task.endTime, 0, ignoreTypes);
    }

    if (!fit) {
        rejectionStats.collision++;
    }
    return fit;
  });

  // LOGGING FOR FAILURES (Level 4 or Critical)
  if (candidates.length < count && (relaxationLevel === 4 || task.isCritical)) {
      console.warn(`[Scheduler] ⚠️ Low Candidates for Task ${task.taskId} (Level ${relaxationLevel}). Found: ${candidates.length}/${count}`);
      console.warn(`   Stats: RoleMismatch=${rejectionStats.role}, Assigned=${rejectionStats.alreadyAssigned}, Locked=${rejectionStats.neverAssign+rejectionStats.exclusive}, Collision=${rejectionStats.collision}`);
      
      if (relaxationLevel === 4) {
          console.log(`   🔎 Deep Dive for Role ${roleId}:`);
          const potential = algoUsers.filter(u => (u.person.roleIds || []).includes(roleId) || relaxationLevel === 4);
          potential.forEach(u => {
              const status = getAvailabilityStatus(u, task.startTime);
              const isAssigned = task.currentAssignees.includes(u.person.id);
              if (!candidates.includes(u) && !isAssigned) {
                  console.log(`      - ${u.person.name}: REJECTED (${status})`);
              }
          });
      }
  }

  // SORTING LOGIC
  if (task.isCritical || relaxationLevel === 4) {
    candidates.sort((a, b) => {
      // Prioritize those who don't *need* force override first (if mixed pool, though likely filtered)
      // But mainly prioritize load.
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

const addToTimeline = (user: AlgoUser, start: number, end: number, type: TimelineSegment['type'], taskId?: string, isCritical?: boolean, isMismatch?: boolean, subtype?: TimelineSegment['subtype']) => {
  user.timeline.push({ start, end, type, taskId, isCritical, isMismatch, subtype });
  user.timeline.sort((a, b) => a.start - b.start);
};

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

    // 1. Absences
    absences.forEach(a => {
        if (a.person_id === p.id) {
            const aStart = new Date(a.start_date).getTime();
            const aEnd = new Date(a.end_date).getTime();
            
            const dayStart = new Date(targetDate); dayStart.setHours(0,0,0,0);
            const dayEnd = new Date(targetDate); dayEnd.setHours(23,59,59,999);
            
            if (aStart < dayEnd.getTime() && aEnd > dayStart.getTime()) {
                addToTimeline(algoUser, Math.max(aStart, dayStart.getTime()), Math.min(aEnd, dayEnd.getTime()), 'EXTERNAL_CONSTRAINT', undefined, undefined, undefined, 'absence');
            }
        }
    });

    // 2. Availability (Attendance/Rotation)
    const avail = getEffectiveAvailability(p, targetDate, teamRotations);

    if (avail) {
      if (!avail.isAvailable) {
        // Block whole day as 'availability'
        addToTimeline(algoUser, targetDate.setHours(0, 0, 0, 0), targetDate.setHours(23, 59, 59, 999), 'EXTERNAL_CONSTRAINT', undefined, undefined, undefined, 'availability');
      } else if (avail.startHour && avail.endHour) {
        const [sH, sM] = avail.startHour!.split(':').map(Number);
        const [eH, eM] = avail.endHour!.split(':').map(Number);

        const dayStart = new Date(targetDate); dayStart.setHours(0, 0, 0, 0);
        const userStart = new Date(targetDate); userStart.setHours(sH, sM, 0, 0);
        const userEnd = new Date(targetDate); userEnd.setHours(eH, eM, 0, 0);
        const dayEnd = new Date(targetDate); dayEnd.setHours(23, 59, 59, 999);

        // Block time BEFORE arrival
        if (dayStart.getTime() < userStart.getTime()) {
          addToTimeline(algoUser, dayStart.getTime(), userStart.getTime(), 'EXTERNAL_CONSTRAINT', undefined, undefined, undefined, 'availability');
        }
        // Block time AFTER departure
        if (userEnd.getTime() < dayEnd.getTime()) {
          addToTimeline(algoUser, userEnd.getTime(), dayEnd.getTime(), 'EXTERNAL_CONSTRAINT', undefined, undefined, undefined, 'availability');
        }
      }
    }

    // 3. Past Shifts
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
      addToTimeline(algoUser, blockStart, shiftEnd, 'TASK', s.taskId, isCritical, undefined, 'task');

      const minRest = requirements?.minRest ?? 0;
      if (minRest > 0) {
        const restEnd = shiftEnd + (minRest * 60 * 60 * 1000);
        addToTimeline(algoUser, shiftEnd, restEnd, 'REST', undefined, undefined, undefined, 'rest');
      }
    });

    // 4. Future Assignments
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
      addToTimeline(algoUser, sStart, sEnd, 'EXTERNAL_CONSTRAINT', s.taskId, isCritical, undefined, 'task');

      const minRest = requirements?.minRest ?? 0;
      if (minRest > 0) {
        const restEnd = sEnd + (minRest * 60 * 60 * 1000);
        addToTimeline(algoUser, sEnd, restEnd, 'REST', undefined, undefined, undefined, 'rest');
      }
    });

    return algoUser;
  });
};


// getAvailabilityStatus moved from here


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

  // --- DAILY SADAM REPORT ---
  console.log(`\n📊 [Daily Sadam Report] ${startDate.toLocaleDateString()}`);
  console.log(`   Total Personnel: ${people.length}`);
  
  const fullyUnavailable = algoUsers.filter(u => 
      u.timeline.some(t => t.type === 'EXTERNAL_CONSTRAINT' && (t.end - t.start) >= 24 * 60 * 60 * 1000)
  ).length;
  console.log(`   Fully Unavailable (Absence/Off-duty): ${fullyUnavailable}`);
  console.log(`   Effective Pool: ${people.length - fullyUnavailable}`);
  
  console.log(`   Role Breakdown (Total / Available):`);
  const allRoleIds = Array.from(rolePoolCounts.keys());
  allRoleIds.forEach(rid => {
      const total = rolePoolCounts.get(rid);
      const available = algoUsers.filter(u => 
          (u.person.roleIds || []).includes(rid) && 
          !u.timeline.some(t => t.type === 'EXTERNAL_CONSTRAINT' && (t.end - t.start) >= 12 * 60 * 60 * 1000) // Rough check for "mostly available"
      ).length;
      console.log(`   - ${rid}: ${available} / ${total}`);
  });
  console.log(`----------------------------------------\n`);

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
