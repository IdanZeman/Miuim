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
 * Check if a shift is during night hours (starts after 21:00 OR ends before 07:00)
 */
const isNightShift = (startTime: number, endTime: number): boolean => {
  const start = new Date(startTime);
  const end = new Date(endTime);
  
  const startHour = start.getHours();
  const endHour = end.getHours();
  
  // Night is defined as: starts at/after 21:00 OR ends at/before 07:00
  return startHour >= 21 || endHour <= 7;
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
  relaxationLevel: 1 | 2 | 3 | 4, // NEW: Added Level 4
  constraints: SchedulingConstraint[] = []
): AlgoUser[] => {
  const restDurationMs = task.minRest * 60 * 60 * 1000;

  let candidates = algoUsers.filter(u => {
    // 0. Check Constraints (Person > Team > Role Hierarchical Check)
    // Find all constraints relevant to this user (Person specific OR Team specific OR Role specific)
    const userConstraints = constraints.filter(c => 
        c.personId === u.person.id || // Direct Person Constraint
        (c.teamId && c.teamId === u.person.teamId) || // Team Constraint
        (c.roleId && (u.person.roleIds || []).includes(c.roleId)) // Role Constraint
    );
    
    // NEVER_ASSIGN: If user has ANY "never assign" constraint for this task (from any source)
    if (userConstraints.some(c => c.type === 'never_assign' && c.taskId === task.taskId)) {
        return false;
    }

    // TIME_BLOCK: Check if the task overlaps with ANY time block constraint
    const hasTimeBlock = userConstraints.some(c => {
        if (c.type === 'time_block' && c.startTime && c.endTime) {
            const blockStart = new Date(c.startTime).getTime();
            const blockEnd = new Date(c.endTime).getTime();
            // Check overlap: (StartA < EndB) and (EndA > StartB)
            return task.startTime < blockEnd && task.endTime > blockStart;
        }
        return false;
    });

    if (hasTimeBlock) return false;

    // ALWAYS_ASSIGN (Restriction): If user has "always assign to X", they CANNOT do Y (unless Y is X)
    // "X תמיד ישובץ רק למשימה Y" -> X can only do Y.
    // Note: If multiple "always_assign" exist for different tasks, it creates an impossible condition (conflicting exclusives), so user matches none.
    const exclusiveTaskConstraints = userConstraints.filter(c => c.type === 'always_assign');
    if (exclusiveTaskConstraints.length > 0) {
        // If there are exclusive constraints, the current task MUST be one of the permitted tasks
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
      if (task.isCritical) {
        const cooldownWindow = 36 * 60 * 60 * 1000;
        const hadRecentCriticalShift = u.timeline.some(seg => 
          seg.type === 'TASK' && 
          seg.isCritical === true &&
          seg.start > (task.startTime - cooldownWindow)
        );
        if (hadRecentCriticalShift) return false;
      }
      return canFit(u, task.startTime, task.endTime, restDurationMs);
    }

    if (relaxationLevel === 2) {
      // LEVEL 2: FLEXIBLE ("Fair Grind")
      const reducedRestMs = restDurationMs * 0.5;
      return canFit(u, task.startTime, task.endTime, reducedRestMs);
    }

    if (relaxationLevel >= 3) {
      // LEVEL 3 & 4: EMERGENCY/FORCE (Only physical availability)
      return canFit(u, task.startTime, task.endTime, 0);
    }

    return false;
  });

  // CRITICAL: SORTING LOGIC IS IDENTICAL FOR ALL LEVELS
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
  historyScores: Record<string, { totalLoadScore: number, shiftsCount: number, criticalShiftCount: number }> = {}, // NEW: add criticalShiftCount
  futureAssignments: Shift[],
  taskTemplates: TaskTemplate[],
  allShifts: Shift[],
  roleCounts: Map<string, number>, // NEW: Pass roleCounts as parameter
  constraints: SchedulingConstraint[] = [],
  teamRotations: TeamRotation[] = [], // NEW
  absences: Absence[] = [] // NEW
): AlgoUser[] => {
  const dateKey = targetDate.toLocaleDateString('en-CA'); // YYYY-MM-DD

  return people.map(p => {
    const history = historyScores[p.id] || { totalLoadScore: 0, shiftsCount: 0, criticalShiftCount: 0 };
    const algoUser: AlgoUser = {
      person: p,
      timeline: [],
      loadScore: history.totalLoadScore, // Start with historical load
      shiftsCount: history.shiftsCount,
      criticalShiftCount: history.criticalShiftCount // NEW: start with historical count
    };

    // 0. Apply Time Block Constraints
    // NEW: Filter for Person OR Team OR Role
    const userConstraints = constraints.filter(c => 
        c.type === 'time_block' && (
            c.personId === p.id ||
            (c.teamId && c.teamId === p.teamId) ||
            (c.roleId && (p.roleIds || []).includes(c.roleId))
        )
    );
    userConstraints.forEach(c => {
        if (c.startTime && c.endTime) {
            const cStart = new Date(c.startTime).getTime();
            const cEnd = new Date(c.endTime).getTime();
            
            // Check if overlaps with target day
            const dayStart = new Date(targetDate); dayStart.setHours(0,0,0,0);
            const dayEnd = new Date(targetDate); dayEnd.setHours(23,59,59,999);
            
            if (cStart < dayEnd.getTime() && cEnd > dayStart.getTime()) {
                addToTimeline(algoUser, cStart, cEnd, 'EXTERNAL_CONSTRAINT');
            }
        }
    });

    // 0.5 Absences - Create EXTERNAL_CONSTRAINT for any absence overlapping this day
    absences.forEach(a => {
        if (a.person_id === p.id) {
            const aStart = new Date(a.start_date).getTime();
            const aEnd = new Date(a.end_date).getTime();
            
            // Check overlap with target day
            const dayStart = new Date(targetDate); dayStart.setHours(0,0,0,0);
            const dayEnd = new Date(targetDate); dayEnd.setHours(23,59,59,999);
            
            if (aStart < dayEnd.getTime() && aEnd > dayStart.getTime()) {
                addToTimeline(algoUser, Math.max(aStart, dayStart.getTime()), Math.min(aEnd, dayEnd.getTime()), 'EXTERNAL_CONSTRAINT');
            }
        }
    });

    // 1. Check Availability (Attendance Manager + Rotation) - Using Shared Utility
    // We assume teamRotations are passed correctly.
    const avail = getEffectiveAvailability(p, targetDate, teamRotations);

    if (avail) {
      // If marked as "Absent" (isAvailable = false), block the whole day
      if (!avail.isAvailable) {
        addToTimeline(algoUser, targetDate.setHours(0, 0, 0, 0), targetDate.setHours(23, 59, 59, 999), 'EXTERNAL_CONSTRAINT');
      } else if (avail.startHour && avail.endHour) {
        // If present but has specific hours (e.g., 08:00 - 17:00)
        // Block 00:00 -> Start
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

    // 2. Block PAST shifts that END during the target day (Cross-Day Tasks)
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    const crossDayShifts = allShifts.filter(s => {
      if (!s.assignedPersonIds.includes(p.id)) return false;
      const shiftStart = new Date(s.startTime);
      const shiftEnd = new Date(s.endTime);
      return shiftStart < dayStart && shiftEnd > dayStart;
    });

    crossDayShifts.forEach(s => {
      const shiftEnd = new Date(s.endTime).getTime();
      const task = taskTemplates.find(t => t.id === s.taskId);
      
      // Resolve requirements from Shift Snapshot OR Segment OR Fallback
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
      // Use resolved requirements or defaults
      const isCritical = task && (task.difficulty >= 4 || (requirements?.roleComposition?.some(rc => (roleCounts.get(rc.roleId) || 0) <= 2) ?? false));
      addToTimeline(algoUser, blockStart, shiftEnd, 'TASK', s.taskId, isCritical);

      const minRest = requirements?.minRest ?? 0;
      if (minRest > 0) {
        const restEnd = shiftEnd + (minRest * 60 * 60 * 1000);
        addToTimeline(algoUser, shiftEnd, restEnd, 'REST');
      }
    });

    // 2.5 NEW: Block RECENT critical shifts from the last 48h (INCREASED from 24h)
    const lookbackStart = new Date(dayStart);
    lookbackStart.setHours(lookbackStart.getHours() - 48); // NEW: 48 hours lookback

    const recentCriticalShifts = allShifts.filter(s => {
      if (!s.assignedPersonIds.includes(p.id)) return false;
      const shiftStart = new Date(s.startTime);
      
      if (shiftStart < lookbackStart || shiftStart >= dayStart) return false;
      
      const task = taskTemplates.find(t => t.id === s.taskId);
      if (!task) return false;

      // Resolve requirements
      let requirements = s.requirements;
      if (!requirements && s.segmentId) {
         const seg = task.segments?.find(seg => seg.id === s.segmentId);
         if (seg) {
             requirements = { 
                requiredPeople: seg.requiredPeople, 
                roleComposition: seg.roleComposition, 
                minRest: seg.minRestHoursAfter 
             };
         }
      }

      const isCritical = task.difficulty >= 4 || (requirements?.roleComposition?.some(rc => (roleCounts.get(rc.roleId) || 0) <= 2) ?? false);
      
      return isCritical;
    });

    recentCriticalShifts.forEach(s => {
      const shiftStart = new Date(s.startTime).getTime();
      const shiftEnd = new Date(s.endTime).getTime();
      const task = taskTemplates.find(t => t.id === s.taskId);
      
      const alreadyExists = algoUser.timeline.some(seg => seg.taskId === s.taskId && seg.start === shiftStart);
      if (!alreadyExists) {
        addToTimeline(algoUser, shiftStart, shiftEnd, 'TASK', s.taskId, true);
        
        let minRest = 0;
        if (s.requirements) minRest = s.requirements.minRest;
        else if (s.segmentId && task) {
             const seg = task.segments?.find(seg => seg.id === s.segmentId);
             if (seg) minRest = seg.minRestHoursAfter;
        }

        if (minRest > 0) {
          const restEnd = shiftEnd + (minRest * 60 * 60 * 1000);
          addToTimeline(algoUser, shiftEnd, restEnd, 'REST');
        }

        // NEW: Increment criticalShiftCount for historical shifts
        algoUser.criticalShiftCount += 1;
      }
    });

    // 3. Block Future Assignments (48h Lookahead)
    const userFutureShifts = futureAssignments.filter(s => s.assignedPersonIds.includes(p.id));
    userFutureShifts.forEach(s => {
      const sStart = new Date(s.startTime).getTime();
      const sEnd = new Date(s.endTime).getTime();
      const task = taskTemplates.find(t => t.id === s.taskId);

      // Resolve requirements
      let requirements = s.requirements;
      if (!requirements && task && s.segmentId) {
         const seg = task.segments?.find(seg => seg.id === s.segmentId);
         if (seg) requirements = { requiredPeople: seg.requiredPeople, roleComposition: seg.roleComposition, minRest: seg.minRestHoursAfter };
      }

      const isCritical = task && (task.difficulty >= 4 || (requirements?.roleComposition?.some(rc => (roleCounts.get(rc.roleId) || 0) <= 2) ?? false));
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
  futureAssignments: Shift[] = [], // Shifts already assigned in the next 48h
  selectedTaskIds?: string[] // NEW: Optional filter for partial scheduling
): Shift[] => {
  const { people, taskTemplates, shifts, constraints } = currentState;

  // 1. Prepare Data
  const targetDateKey = startDate.toLocaleDateString('en-CA');

  // Filter shifts relevant to this specific day (to be solved)
  const allShiftsOnDay = shifts.filter(s => {
    const sDate = new Date(s.startTime).toLocaleDateString('en-CA');
    return sDate === targetDateKey && !s.isLocked;
  });

  let shiftsToSolve = allShiftsOnDay;
  let fixedShiftsOnDay: Shift[] = [];

  // NEW: If selectedTaskIds is provided, filter shifts to solve and treat others as fixed
  if (selectedTaskIds && selectedTaskIds.length > 0) {
    shiftsToSolve = allShiftsOnDay.filter(s => selectedTaskIds.includes(s.taskId));
    fixedShiftsOnDay = allShiftsOnDay.filter(s => !selectedTaskIds.includes(s.taskId));
  }

  // If no shifts to solve, return empty array
  if (shiftsToSolve.length === 0) return [];

  // Calculate Role Rarity (<= 2 people is "Rare")
  const roleCounts = new Map<string, number>();
  people.forEach(p => {
    (p.roleIds || []).forEach(rid => {
      roleCounts.set(rid, (roleCounts.get(rid) || 0) + 1);
    });
  });

  // Initialize Algorithm Users
  // NEW: Add fixedShiftsOnDay to futureAssignments so they are treated as constraints
  const effectiveConstraints = [...futureAssignments, ...fixedShiftsOnDay];
  
  const algoUsers = initializeUsers(people, startDate, historyScores, effectiveConstraints, taskTemplates, shifts, roleCounts, constraints || [], currentState.teamRotations || [], currentState.absences || []);

  // Map Shifts to AlgoTasks with DYNAMIC DIFFICULTY
  const algoTasks: AlgoTask[] = shiftsToSolve.map(s => {
    const template = taskTemplates.find(t => t.id === s.taskId);
    if (!template) return null;

    const startTime = new Date(s.startTime).getTime();
    const endTime = new Date(s.endTime).getTime();

    // PRINCIPLE 1: Calculate effective difficulty based on time
    const isNight = isNightShift(startTime, endTime);
    const effectiveDifficulty = isNight ? template.difficulty * 1.5 : template.difficulty;

    // Resolve Requirements from Shift Snapshot OR Segment
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
    } else {
        // Fallback or Error?
        // Assuming partial mock or legacy logic, defaulting to 0 requirements
       // console.warn('Missing requirements for shift', s.id);
    }

    // Check if any required role is Rare
    const hasRareRole = roleComposition.some(rc => (roleCounts.get(rc.roleId) || 0) <= 2);

    // UPDATED: isCritical based on EFFECTIVE difficulty
    const isCritical = effectiveDifficulty >= 4 || hasRareRole;

    return {
      shiftId: s.id,
      taskId: template.id,
      startTime,
      endTime,
      durationHours,
      difficulty: effectiveDifficulty, // Use effective difficulty
      roleComposition,
      requiredPeople,
      minRest,
      isCritical,
      currentAssignees: []
    };
  }).filter(Boolean) as AlgoTask[];

  // 2. Sort Tasks for Multi-Pass (Big Rocks First)
  const criticalTasks = algoTasks.filter(t => t.isCritical).sort((a, b) => a.startTime - b.startTime);
  const standardTasks = algoTasks.filter(t => !t.isCritical).sort((a, b) => a.startTime - b.startTime);

  const processTasks = (tasks: AlgoTask[], phaseName: string) => {
    console.log(`\n🚀 Starting Phase: ${phaseName} (${tasks.length} tasks)`);

    tasks.forEach((task) => {
      console.log(`\n📋 Task ${task.taskId} (${new Date(task.startTime).toLocaleTimeString()}): Needs ${task.requiredPeople} | Difficulty: ${task.difficulty.toFixed(1)} | Critical: ${task.isCritical}`);

      task.roleComposition.forEach(comp => {
        const { roleId, count } = comp;
        if (count <= 0) return;

        console.log(`   - Looking for ${count} people with role ${roleId}`);

        // MULTI-PASS FALLBACK MECHANISM (4 LEVELS)
        let selected: AlgoUser[] = [];
        let usedLevel: 1 | 2 | 3 | 4 = 1;

        // Try Level 1: Strict (Ideal)
        selected = findBestCandidates(algoUsers, task, roleId, count, 1, constraints || []);

        if (selected.length < count) {
          console.warn(`   ⚠️ Level 1 (Strict) insufficient: Found ${selected.length}/${count}. Trying Level 2 (Flexible)...`);
          
          // Try Level 2: Flexible
          selected = findBestCandidates(algoUsers, task, roleId, count, 2, constraints || []);
          usedLevel = 2;

          if (selected.length < count) {
            console.warn(`   ⚠️ Level 2 (Flexible) insufficient: Found ${selected.length}/${count}. Trying Level 3 (Emergency)...`);
            
            // Try Level 3: Emergency
            selected = findBestCandidates(algoUsers, task, roleId, count, 3, constraints || []);
            usedLevel = 3;

            if (selected.length < count) {
              console.warn(`   🛑 Level 3 (Emergency) insufficient: Found ${selected.length}/${count}. Trying Level 4 (Force Assign - Role Mismatch)...`);
              
              // NEW: Try Level 4: Force Assign (Ignore Role)
              const forceCandidates = findBestCandidates(algoUsers, task, roleId, count, 4, constraints || []);
              usedLevel = 4;
              
              // Take only the missing count
              const needed = count - selected.length;
              selected = [...selected, ...forceCandidates.slice(0, needed)];

              if (selected.length < count) {
                console.error(`   ❌ CRITICAL FAILURE: Even Level 4 (Force Assign) failed! Only ${selected.length}/${count}. Physically no humans available at this time.`);
              }
            }
          }
        }

        // Log the outcome
        if (selected.length >= count) {
          if (usedLevel === 1) {
            console.log(`   ✅ Assigned via Level 1 (Strict/Ideal)`);
          } else if (usedLevel === 2) {
            console.log(`   ⚠️ Assigned via Level 2 (Flexible - Fair Grind)`);
          } else if (usedLevel === 3) {
            console.log(`   🚨 Assigned via Level 3 (Emergency - All Hands)`);
          } else if (usedLevel === 4) {
            console.log(`   🛑 Assigned via Level 4 (Force Assign - ROLE MISMATCH)`);
          }
        }

        // Show top candidates for transparency
        if (task.isCritical && selected.length > 0) {
          console.log(`   📊 Selected candidates by critical shift count:`);
          selected.forEach(c => {
            const hasRole = (c.person.roleIds || []).includes(roleId);
            const roleWarning = hasRole ? '' : ' [⚠️ ROLE MISMATCH]';
            console.log(`      ${c.person.name}: ${c.criticalShiftCount} critical shifts | Load: ${c.loadScore.toFixed(1)}${roleWarning}`);
          });
        }

        // Assign selected users
        selected.forEach(u => {
          task.currentAssignees.push(u.person.id);

          const restDurationMs = task.minRest * 60 * 60 * 1000;
          const isMismatch = !(u.person.roleIds || []).includes(roleId); // NEW: Check for role mismatch

          // Update User State with mismatch flag
          addToTimeline(u, task.startTime, task.endTime, 'TASK', task.taskId, task.isCritical, isMismatch);
          if (task.minRest > 0) {
            addToTimeline(u, task.endTime, task.endTime + restDurationMs, 'REST');
          }

          // Update Metrics
          u.loadScore += (task.durationHours * task.difficulty);
          u.shiftsCount += 1;
          if (task.isCritical) {
            u.criticalShiftCount += 1;
          }

          // Log assignment with warning if role mismatch
          if (isMismatch) {
            console.log(`   🛑 ${u.person.name} FORCE ASSIGNED (Wrong Role: needed ${roleId}) - Load: ${u.loadScore.toFixed(1)}`);
          } else if (task.isCritical) {
            console.log(`   ✅ ${u.person.name} assigned (Critical: ${u.criticalShiftCount - 1} → ${u.criticalShiftCount})`);
          } else {
            console.log(`   ✅ ${u.person.name} assigned (Load: ${(u.loadScore - task.durationHours * task.difficulty).toFixed(1)} → ${u.loadScore.toFixed(1)})`);
          }
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
