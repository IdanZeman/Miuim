// Full implementation as provided in the user request
import { AppState, Person, Shift, TaskTemplate, SchedulingConstraint, TeamRotation, Absence, InterPersonConstraint } from "../types";
import { getEffectiveAvailability } from "../utils/attendanceUtils";

// --- Internal Types for the Algorithm ---
interface TimelineSegment {
  start: number;
  end: number;
  type: 'TASK' | 'REST' | 'EXTERNAL_CONSTRAINT';
  subtype?: 'availability' | 'absence' | 'task' | 'rest';
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

export interface SchedulingSuggestion {
  taskId: string;
  taskName: string;
  startTime: number;
  teamId: string;
  missingCount: number;
  alternatives: {
    name: string;
    teamId: string;
    loadScore: number;
  }[];
}

export interface AssignmentFailure {
  shiftId: string;
  taskName: string;
  startTime: number;
  endTime: number;
  requiredPeople: number;
  assignedCount: number;
  reasons: {
    type: 'no_available_people' | 'role_mismatch' | 'constraint_violation' |
    'rest_period' | 'team_organic' | 'inter_person_constraint' | 'unavailable';
    roleId?: string;
    roleName?: string;
    count: number;
    details?: string;
  }[];
}

export interface SchedulingStats {
  totalShifts: number;
  fullyAssigned: number;
  partiallyAssigned: number;
  unassigned: number;
  successRate: number;
  totalSlotsRequired: number;
  totalSlotsFilled: number;
}

export interface SchedulingResult {
  shifts: Shift[];
  suggestions: SchedulingSuggestion[];
  failures: AssignmentFailure[];
  stats: SchedulingStats;
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
  assignedTeamId?: string;
  preferredTeamId?: string;
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

const canFit = (user: AlgoUser, taskStart: number, taskEnd: number, restDurationMs: number, ignoreTypes: string[] = []): boolean => {
  const totalEnd = taskEnd + restDurationMs;
  const collision = user.timeline.find(seg => {
    if (ignoreTypes.includes(seg.type)) return false;
    return (taskStart < seg.end && totalEnd > seg.start);
  });

  if (collision && user.person.name.includes('הדר ביטון')) {
    console.log(`[Scheduler] ${user.person.name} cannot fit: collision with ${collision.type} (${collision.subtype}) at ${new Date(collision.start).getHours()}:${new Date(collision.start).getMinutes()}-${new Date(collision.end).getHours()}:${new Date(collision.end).getMinutes()}. Task: ${new Date(taskStart).getHours()}:${new Date(taskStart).getMinutes()}-${new Date(taskEnd).getHours()}:${new Date(taskEnd).getMinutes()}, Rest: ${restDurationMs / 3600000}h`);
  }

  return !collision;
};

const addToTimeline = (user: AlgoUser, start: number, end: number, type: 'TASK' | 'REST' | 'EXTERNAL_CONSTRAINT', taskId?: string, isCritical?: boolean, isMismatch?: boolean, subtype?: TimelineSegment['subtype']) => {
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
  absences: Absence[] = [],
  hourlyBlockages: any[] = [],
  engineVersion: 'v1_legacy' | 'v2_write_based' | 'v2_simplified' = 'v1_legacy'
): AlgoUser[] => {

  const initialized = people
    .filter(p => p.isActive !== false)
    .map(p => {
      const history = historyScores[p.id] || { totalLoadScore: 0, shiftsCount: 0, criticalShiftCount: 0 };
      const algoUser: AlgoUser = {
        person: p,
        timeline: [],
        loadScore: history.totalLoadScore,
        shiftsCount: history.shiftsCount,
        criticalShiftCount: history.criticalShiftCount
      };

      // Use centralized availability logic (handles Rotations, Absences, Hourly Blockages according to engine version)
      const avail = getEffectiveAvailability(p, targetDate, teamRotations, absences, hourlyBlockages, engineVersion);

      console.log(`[Scheduler] User ${p.name} availability:`, {
        isAvailable: avail.isAvailable,
        status: avail.status,
        v2_state: avail.v2_state,
        engineVersion
      });

      if (avail) {
        if (!avail.isAvailable) {
          // Entire day is unavailable
          addToTimeline(algoUser, targetDate.getTime(), targetDate.getTime() + 24 * 60 * 60 * 1000, 'EXTERNAL_CONSTRAINT', undefined, undefined, undefined, 'availability');
        } else {
          // Check for specific arrival/departure times
          if (avail.startHour && avail.startHour !== '00:00') {
            const [sH, sM] = avail.startHour.split(':').map(Number);
            const dayStart = new Date(targetDate); dayStart.setHours(0, 0, 0, 0);
            const userStart = new Date(targetDate); userStart.setHours(sH, sM, 0, 0);
            addToTimeline(algoUser, dayStart.getTime(), userStart.getTime(), 'EXTERNAL_CONSTRAINT', undefined, undefined, undefined, 'availability');
          }

          if (avail.endHour && avail.endHour !== '23:59') {
            const [eH, eM] = avail.endHour.split(':').map(Number);
            const userEnd = new Date(targetDate); userEnd.setHours(eH, eM, 0, 0);
            const dayEnd = new Date(targetDate); dayEnd.setHours(23, 59, 59, 999);
            addToTimeline(algoUser, userEnd.getTime(), dayEnd.getTime(), 'EXTERNAL_CONSTRAINT', undefined, undefined, undefined, 'availability');
          }

          // Process discrete unavailable blocks (Hourly Blockages / Partial Absences)
          if (avail.unavailableBlocks && avail.unavailableBlocks.length > 0) {
            avail.unavailableBlocks.forEach(block => {
              // Only block if it's approved or not an absence (manual blocks are usually active)
              if (block.type === 'absence' && block.status !== 'approved' && block.status !== 'partially_approved') return;
              if (block.status === 'rejected') return;

              const [sH, sM] = block.start.split(':').map(Number);
              const [eH, eM] = block.end.split(':').map(Number);
              const bStart = new Date(targetDate); bStart.setHours(sH, sM, 0, 0);
              const bEnd = new Date(targetDate); bEnd.setHours(eH, eM, 0, 0);

              // Handle cross-day blocks if any
              let endTime = bEnd.getTime();
              if (endTime < bStart.getTime()) endTime += 24 * 60 * 60 * 1000;

              addToTimeline(algoUser, bStart.getTime(), endTime, 'EXTERNAL_CONSTRAINT', undefined, undefined, undefined, 'availability');
            });
          }
        }
      }

      // 3. Past/Spillover Shifts
      const dayStart = new Date(targetDate);
      dayStart.setHours(0, 0, 0, 0);
      allShifts.filter(s => s.assignedPersonIds.includes(p.id)).forEach(s => {
        const shiftStart = new Date(s.startTime).getTime();
        const shiftEnd = new Date(s.endTime).getTime();
        if (shiftStart < dayStart.getTime() && shiftEnd > dayStart.getTime()) {
          const task = taskTemplates.find(t => t.id === s.taskId);
          const isCritical = task && (task.difficulty >= 4);
          addToTimeline(algoUser, dayStart.getTime(), shiftEnd, 'TASK', s.taskId, isCritical, undefined, 'task');
          const minRest = s.requirements?.minRest || 0;
          if (minRest > 0) {
            addToTimeline(algoUser, shiftEnd, shiftEnd + (minRest * 60 * 60 * 1000), 'REST', undefined, undefined, undefined, 'rest');
          }
        }
      });

      // 4. Future Assignments
      futureAssignments.filter(s => s.assignedPersonIds.includes(p.id)).forEach(s => {
        const sStart = new Date(s.startTime).getTime();
        const sEnd = new Date(s.endTime).getTime();
        const task = taskTemplates.find(t => t.id === s.taskId);
        const isCritical = task && (task.difficulty >= 4);
        addToTimeline(algoUser, sStart, sEnd, 'EXTERNAL_CONSTRAINT', s.taskId, isCritical, undefined, 'task');
        const minRest = s.requirements?.minRest || 0;
        if (minRest > 0) {
          addToTimeline(algoUser, sEnd, sEnd + (minRest * 60 * 60 * 1000), 'REST', undefined, undefined, undefined, 'rest');
        }
      });

      return algoUser;
    });

  const availableOnes = initialized.filter(au => au.person.isActive !== false && !au.timeline.some(seg => seg.type === 'EXTERNAL_CONSTRAINT' && seg.subtype === 'availability'));
  console.log(`[Scheduler] Total Available People for ${targetDate.toLocaleDateString()}: ${availableOnes.length}`, {
    names: availableOnes.map(u => u.person.name)
  });

  return initialized;
};

const findBestCandidates = (
  users: AlgoUser[],
  task: AlgoTask,
  roleId: string,
  count: number,
  relaxationLevel: 1 | 2 | 3 | 4,
  constraints: SchedulingConstraint[] = [],
  interPersonConstraints: InterPersonConstraint[] = [],
  allPeople: Person[] = [],
  batchCandidateIds: string[] = []
): AlgoUser[] => {
  // DEBUG: Check IPCs
  // if (interPersonConstraints?.length > 0) console.log(`[findBestCandidates] Checking ${interPersonConstraints.length} IPCs for task ${task.taskId}`);

  const allCurrentAndBatchAssignees = [...(task.currentAssignees || []), ...batchCandidateIds];

  const taskStart = task.startTime;
  const taskEnd = task.endTime;
  const minRestMs = task.minRest * 60 * 60 * 1000;

  const filtered = users.filter(u => {
    const hasRole = (u.person.roleIds || []).includes(roleId);

    // Role filter (except level 4)
    if (relaxationLevel < 4 && !hasRole) return false;

    // Hard constraints
    const hasHardBlock = constraints.some(c =>
      c.personId === u.person.id && c.type === 'never_assign' &&
      (c.startTime && c.endTime && taskStart < new Date(c.endTime).getTime() && taskEnd > new Date(c.startTime).getTime())
    );
    if (hasHardBlock) return false;

    // INTER-PERSON CONSTRAINTS
    const isForbidden = interPersonConstraints.filter(i => i.type === 'forbidden_together').some(ipc => {
      // Helper to extract value (Custom Field OR Role)
      const getValue = (p: Person, field: string) => {
        if (field === 'role') return p.roleId ? [p.roleId, ...(p.roleIds || [])] : [];
        if (field === 'person') return p.id;
        if (field === 'team') return p.teamId;
        return p.customFields?.[field];
      };

      // Check if current user matches condition A or B
      const rawValA = getValue(u.person, ipc.fieldA);
      const rawValB = getValue(u.person, ipc.fieldB);

      const areValuesEquivalent = (val1: any, val2: any): boolean => {
        if (val1 === val2) return true;
        const s1 = String(val1).trim().toLowerCase();
        const s2 = String(val2).trim().toLowerCase();
        if (s1 === s2) return true;

        // Handle Boolean <-> Hebrew/English Mapping
        const isTrue = (s: string) => s === 'true' || s === 'yes' || s === 'כן' || s === '1';
        const isFalse = (s: string) => s === 'false' || s === 'no' || s === 'לא' || s === '0';

        if (isTrue(s1) && isTrue(s2)) return true;
        if (isFalse(s1) && isFalse(s2)) return true;

        // Handle Arrays (Multi-Select)
        if (Array.isArray(val1) && !Array.isArray(val2)) return val1.some(v => areValuesEquivalent(v, val2));
        if (!Array.isArray(val1) && Array.isArray(val2)) return val2.some(v => areValuesEquivalent(v, val1));
        if (Array.isArray(val1) && Array.isArray(val2)) return val1.some(v1 => val2.some(v2 => areValuesEquivalent(v1, v2))); // Overlap check

        return false;
      };

      const matchesA = areValuesEquivalent(rawValA, ipc.valueA);
      const matchesB = areValuesEquivalent(rawValB, ipc.valueB);

      if (matchesA || matchesB) {
        if (u.person.name.includes('הדר ביטון')) console.log(`[Scheduler] Hadar matches IPC ${ipc.fieldA}=${ipc.valueA} / ${ipc.fieldB}=${ipc.valueB}`);
        // If matches, check if anyone already assigned to this task matches the OTHER condition
        return allCurrentAndBatchAssignees.some(pid => {
          const assigned = allPeople.find(p => p.id === pid);
          if (!assigned) return false;

          const assignedValA = getValue(assigned, ipc.fieldA);
          const assignedValB = getValue(assigned, ipc.fieldB);

          const assignedMatchesA = areValuesEquivalent(assignedValA, ipc.valueA);
          const assignedMatchesB = areValuesEquivalent(assignedValB, ipc.valueB);

          // Return TRUE if it violates (Matches OTHER condition)
          return matchesA ? assignedMatchesB : assignedMatchesA;
        });
      }
      return false;
    });

    if (isForbidden) return false;

    // Availability/Rest logic
    let restMs = minRestMs;
    if (relaxationLevel === 2) restMs = minRestMs / 2;
    if (relaxationLevel >= 3) restMs = 0;

    const fits = canFit(u, taskStart, taskEnd, restMs);

    if (u.person.name.includes('הדר ביטון')) {
      console.log(`[Scheduler] Hadar Check: Fits=${fits}, Rest=${restMs / 3600000}h, Relaxation=${relaxationLevel}, RoleMatch=${hasRole}`);
    }

    return fits;
  });

  if (filtered.length === 0 && relaxationLevel === 1) {
    console.log(`[Scheduler] No candidates for Task ${task.taskId} (Role ${roleId}) at level 1. Total people with role: ${users.filter(u => (u.person.roleIds || []).includes(roleId)).length}`);
  }


  const sortCandidates = (a: AlgoUser, b: AlgoUser) => {
    const targetTeamId = task.assignedTeamId || (task as any).preferredTeamId;
    if (targetTeamId) {
      const aIsTeam = a.person.teamId === targetTeamId;
      const bIsTeam = b.person.teamId === targetTeamId;
      if (aIsTeam !== bIsTeam) return aIsTeam ? -1 : 1;
    }
    if (a.loadScore !== b.loadScore) return a.loadScore - b.loadScore;
    return a.shiftsCount - b.shiftsCount;
  };

  return filtered.sort(sortCandidates).slice(0, count);
};

export const solveSchedule = (
  currentState: AppState,
  startDate: Date,
  endDate: Date,
  historyScores: Record<string, { totalLoadScore: number, shiftsCount: number, criticalShiftCount: number }> = {},
  futureAssignments: Shift[] = [],
  selectedTaskIds?: string[],
  specificShiftsToSolve?: Shift[],
  strictOrganicness: boolean = false,
  engineVersionOverride?: 'v1_legacy' | 'v2_write_based' | 'v2_simplified'
): SchedulingResult => {
  const { people, taskTemplates, shifts, constraints, settings, hourlyBlockages = [] } = currentState;
  const suggestions: SchedulingSuggestion[] = [];
  const engineVersion = engineVersionOverride || settings?.engine_version || (currentState as any).organization?.engine_version || 'v1_legacy';
  console.log(`[Scheduler] Starting solveSchedule. Engine: ${engineVersion}, Total People: ${people.length}, Shifts: ${shifts.length}`);

  const nightStart = settings?.night_shift_start || '21:00';
  const nightEnd = settings?.night_shift_end || '07:00';
  const rareRoleThreshold = (settings as any)?.rare_role_threshold || 2;

  const targetDateKey = startDate.toLocaleDateString('en-CA');
  let shiftsToSolve: Shift[] = [];
  let fixedShiftsOnDay: Shift[] = [];

  if (specificShiftsToSolve) {
    // Filter out cancelled shifts from the specific list
    shiftsToSolve = specificShiftsToSolve.filter(s => !s.isCancelled);
    const solveIds = shiftsToSolve.map(s => s.id);
    // Also filter out cancelled shifts from fixed shifts
    fixedShiftsOnDay = shifts.filter(s => new Date(s.startTime).toLocaleDateString('en-CA') === targetDateKey && !solveIds.includes(s.id) && !s.isCancelled);
  } else {
    // Filter out locked and cancelled shifts
    const allOnDay = shifts.filter(s => new Date(s.startTime).toLocaleDateString('en-CA') === targetDateKey && !s.isLocked && !s.isCancelled);
    shiftsToSolve = selectedTaskIds ? allOnDay.filter(s => selectedTaskIds.includes(s.taskId)) : allOnDay;
    fixedShiftsOnDay = allOnDay.filter(s => !shiftsToSolve.includes(s));
  }

  if (shiftsToSolve.length === 0) return {
    shifts: [],
    suggestions: [],
    failures: [],
    stats: {
      totalShifts: 0,
      fullyAssigned: 0,
      partiallyAssigned: 0,
      unassigned: 0,
      successRate: 100,
      totalSlotsRequired: 0,
      totalSlotsFilled: 0
    }
  };

  // CLEANUP: Remove deleted role IDs from people
  // This prevents issues when roles are deleted but people still reference them
  const validRoleIds = new Set(currentState.roles.map(r => r.id));
  const activePeople = people.filter(p => p.isActive !== false).map(p => {
    const cleanedRoleIds = (p.roleIds || [p.roleId]).filter(rid => rid && validRoleIds.has(rid));

    // Log if we found orphaned roles
    const orphanedRoles = (p.roleIds || []).filter(rid => rid && !validRoleIds.has(rid));
    if (orphanedRoles.length > 0) {
      console.warn(`[Scheduler] Person ${p.name} has deleted role IDs:`, orphanedRoles);
    }

    return {
      ...p,
      roleIds: cleanedRoleIds.length > 0 ? cleanedRoleIds : []
    };
  });

  const rolePoolCounts = new Map<string, number>();
  activePeople.forEach(p => (p.roleIds || []).forEach(rid => rolePoolCounts.set(rid, (rolePoolCounts.get(rid) || 0) + 1)));
  const isRareRole = (roleId: string) => (rolePoolCounts.get(roleId) || 0) <= rareRoleThreshold;

  const algoUsers = initializeUsers(activePeople, startDate, historyScores, [...futureAssignments, ...fixedShiftsOnDay], taskTemplates, shifts, rolePoolCounts, constraints || [], currentState.teamRotations || [], currentState.absences || [], hourlyBlockages, engineVersion);

  const algoTasks: AlgoTask[] = shiftsToSolve.map(s => {
    const template = taskTemplates.find(t => t.id === s.taskId);
    if (!template) return null;
    const startTime = new Date(s.startTime).getTime();
    const endTime = new Date(s.endTime).getTime();
    const isNight = isNightShift(startTime, endTime, nightStart, nightEnd);
    const difficulty = isNight ? template.difficulty * 1.5 : template.difficulty;
    let reqs: any = s.requirements || template.segments?.find(seg => seg.id === s.segmentId);

    // ROBUSTNESS: If no segment matched by ID, try to match by start time overlap
    if (!reqs && template.segments && template.segments.length > 0) {
      const shiftStartTime = new Date(s.startTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      reqs = template.segments.find(seg => (seg.startTime || (seg as any).start_time) === shiftStartTime);

      // Final fallback: if still nothing, just pick the first segment if there's only one, 
      // or find the one that is "active" during the shift center point
      if (!reqs) {
        if (template.segments.length === 1) {
          reqs = template.segments[0];
        } else {
          // Find segment whose startTime <= shiftStartTime (closest one)
          const sortedSegments = [...template.segments].sort((a, b) => {
            const timeA = a.startTime || (a as any).start_time || '00:00';
            const timeB = b.startTime || (b as any).start_time || '00:00';
            return timeA.localeCompare(timeB);
          });

          for (let i = sortedSegments.length - 1; i >= 0; i--) {
            if ((sortedSegments[i].startTime || (sortedSegments[i] as any).start_time) <= shiftStartTime) {
              reqs = sortedSegments[i];
              break;
            }
          }
          if (!reqs) reqs = sortedSegments[0];
        }
      }
    }

    // FALLBACK: If no role composition is defined, create a generic one
    // Handle both camelCase and snake_case for DB-originated segments
    let roleComposition = reqs?.roleComposition || reqs?.role_composition || [];
    let requiredPeople = reqs?.requiredPeople || reqs?.required_people || 0;

    // Normalize roles (handle snake_case role_id)
    roleComposition = roleComposition.map((rc: any) => ({
      roleId: rc.roleId || rc.role_id || 'any',
      count: rc.count || 0
    }));

    // Sync requiredPeople with roleComposition to ensure stats are accurate
    if (roleComposition.length > 0) {
      const compositionTotal = roleComposition.reduce((sum: number, rc: any) => sum + rc.count, 0);
      requiredPeople = Math.max(requiredPeople, compositionTotal);
    }

    // If roleComposition is missing but requiredPeople is defined, populate it with a default role
    if (roleComposition.length === 0 && requiredPeople > 0) {
      // IMPORTANT: Only count roles that actually exist in the system
      const validRoleIds = new Set(currentState.roles.map(r => r.id));

      // Try to find the most common VALID role among active people
      const roleFrequency = new Map<string, number>();
      activePeople.forEach(p => {
        (p.roleIds || [p.roleId]).forEach(rid => {
          if (rid && validRoleIds.has(rid)) {
            roleFrequency.set(rid, (roleFrequency.get(rid) || 0) + 1);
          }
        });
      });

      const mostCommonRole = Array.from(roleFrequency.entries())
        .sort((a, b) => b[1] - a[1])[0]?.[0];

      if (mostCommonRole) {
        roleComposition = [{ roleId: mostCommonRole, count: requiredPeople }];
      } else if (validRoleIds.size > 0) {
        // Fallback to the first available role if no one has a role assigned
        roleComposition = [{ roleId: Array.from(validRoleIds)[0], count: requiredPeople }];
      } else {
        // Absolute fallback if no roles exist at all
        roleComposition = [{ roleId: 'any', count: requiredPeople }];
      }
    } else if (roleComposition.length === 0 && requiredPeople === 0) {
      requiredPeople = 1;
      roleComposition = [{ roleId: 'any', count: 1 }];
    }

    return {
      shiftId: s.id, taskId: template.id, startTime, endTime, durationHours: (endTime - startTime) / 3600000,
      difficulty, roleComposition, requiredPeople,
      minRest: reqs?.minRest ?? reqs?.minRestHoursAfter ?? 7, isCritical: difficulty >= 4 || roleComposition.some((rc: any) => isRareRole(rc.roleId)),
      assignedTeamId: template.assignedTeamId, currentAssignees: []
    };
  }).filter(Boolean) as AlgoTask[];

  const failures: AssignmentFailure[] = [];

  const processTasks = (tasks: AlgoTask[]) => {
    tasks.forEach(task => {
      if (!task.assignedTeamId && task.requiredPeople > 1) {
        const teamScores = new Map<string, { load: number; count: number }>();
        task.roleComposition.forEach(comp => {
          findBestCandidates(algoUsers, task, comp.roleId, 10, 3, constraints || [], settings?.interPersonConstraints || [], people).forEach(u => {
            if (!u.person.teamId) return;
            const s = teamScores.get(u.person.teamId) || { load: 0, count: 0 };
            s.count++; s.load += u.loadScore;
            teamScores.set(u.person.teamId, s);
          });
        });
        let bestTId: string | undefined; let bestScore = -Infinity;
        teamScores.forEach((s, tId) => {
          const score = (Math.min(s.count, task.requiredPeople) / task.requiredPeople * 1000) - (s.load / s.count);
          if (score > bestScore) { bestScore = score; bestTId = tId; }
        });
        (task as any).preferredTeamId = bestTId;
      }

      task.roleComposition.forEach(comp => {
        let selected: AlgoUser[] = [];
        const targetTeam = task.assignedTeamId || (task as any).preferredTeamId;

        // First pass: try to fill from the target team with minimal relaxation
        if (targetTeam) {
          for (let l = 1; l <= 2; l++) { // Relaxation levels 1 and 2 for target team
            if (selected.length >= comp.count) break;
            const candidates = findBestCandidates(algoUsers, task, comp.roleId, algoUsers.length, l as any, constraints || [], settings?.interPersonConstraints || [], people, selected.map(u => u.person.id));
            const members = candidates.filter(u => u.person.teamId === targetTeam && !selected.includes(u));
            selected.push(...members.slice(0, comp.count - selected.length));
          }
        }

        // If still not enough, try target team with more relaxation
        if (selected.length < comp.count && targetTeam) {
          for (let l = 1; l <= 4; l++) {
            if (selected.length >= comp.count) break;
            const cands = findBestCandidates(algoUsers, task, comp.roleId, comp.count, l as any, constraints || [], settings?.interPersonConstraints || [], people, selected.map(u => u.person.id))
              .filter(u => u.person.teamId === targetTeam && !selected.includes(u));
            selected.push(...cands.slice(0, comp.count - selected.length));
          }
        }

        // Final fallback: any team if strict organicness is OFF, OR if we have NO ONE at all from target team
        if (selected.length < comp.count) {
          if (strictOrganicness && targetTeam && selected.length > 0) {
            // If we have SOME people from target team and strict is ON, we stop and provide suggestions
            const alts = findBestCandidates(algoUsers, task, comp.roleId, 50, 2, constraints || [], settings?.interPersonConstraints || [], people, selected.map(u => u.person.id))
              .filter(u => u.person.teamId !== targetTeam && !selected.includes(u));

            console.log(`[Diagnostic] Task ${task.taskId} reached partial fill (${selected.length}/${comp.count}) for team ${targetTeam}. Strict organicness is ON. Found ${alts.length} alternatives.`);

            if (alts.length > 0) {
              let sug = suggestions.find(s => s.taskId === task.taskId && s.startTime === task.startTime);
              if (!sug) {
                sug = { taskId: task.taskId, taskName: taskTemplates.find(t => t.id === task.taskId)?.name || task.taskId, startTime: task.startTime, teamId: targetTeam, missingCount: 0, alternatives: [] };
                suggestions.push(sug);
              }
              sug.missingCount += (comp.count - selected.length);
              alts.forEach(a => { if (!sug!.alternatives.some(al => al.name === a.person.name)) sug!.alternatives.push({ name: a.person.name, teamId: a.person.teamId || '', loadScore: a.loadScore }); });
            }
          } else {
            // Either strict is OFF, or we have ZERO people from target team, so we MUST fill from elsewhere
            for (let l = 1; l <= 4; l++) {
              if (selected.length >= comp.count) break;
              const cands = findBestCandidates(algoUsers, task, comp.roleId, comp.count, l as any, constraints || [], settings?.interPersonConstraints || [], people, selected.map(u => u.person.id))
                .filter(u => !selected.includes(u));

              if (cands.length > 0) {
                console.log(`[Diagnostic] Task ${task.taskId} filling remaining ${comp.count - selected.length} slots with relaxation level ${l} from OTHER teams.`);
              }
              selected.push(...cands.slice(0, comp.count - selected.length));
            }
          }
        }

        if (selected.length < comp.count) {
          console.warn(`[Diagnostic] FAILED to fill task ${task.taskId} role ${comp.roleId}. Required: ${comp.count}, Found: ${selected.length}`);
        }

        // Track failures if we couldn't fill all slots
        if (selected.length < comp.count) {
          const roleName = currentState.roles.find(r => r.id === comp.roleId)?.name || comp.roleId;
          const taskName = taskTemplates.find(t => t.id === task.taskId)?.name || task.taskId;

          // Find or create failure entry for this shift
          let failure = failures.find(f => f.shiftId === task.shiftId);
          if (!failure) {
            failure = {
              shiftId: task.shiftId,
              taskName,
              startTime: task.startTime,
              endTime: task.endTime,
              requiredPeople: task.requiredPeople,
              assignedCount: 0,
              reasons: []
            };
            failures.push(failure);
          }

          // Determine the specific reason
          const totalInRole = rolePoolCounts.get(comp.roleId) || 0;
          const availableInRole = algoUsers.filter(u =>
            (u.person.roleIds || []).includes(comp.roleId) &&
            canFit(u, task.startTime, task.endTime, 0)
          ).length;

          let reasonType: AssignmentFailure['reasons'][0]['type'] = 'no_available_people';
          let details = '';

          if (totalInRole === 0) {
            reasonType = 'role_mismatch';
            details = `אין אנשים בתפקיד "${roleName}"`;
          } else if (availableInRole === 0) {
            reasonType = 'unavailable';
            details = `כל האנשים בתפקיד "${roleName}" (${totalInRole}) לא זמינים`;
          } else if (availableInRole < comp.count) {
            reasonType = 'no_available_people';
            details = `נדרשו ${comp.count} ${roleName}, נמצאו רק ${availableInRole} זמינים`;
          } else {
            // People exist and are available, but constraints prevented assignment
            reasonType = 'constraint_violation';
            details = `קיימים ${availableInRole} ${roleName} זמינים, אך אילוצים מנעו שיבוץ`;
          }

          failure.reasons.push({
            type: reasonType,
            roleId: comp.roleId,
            roleName,
            count: comp.count - selected.length,
            details
          });
        }

        selected.forEach(u => {
          task.currentAssignees.push(u.person.id);
          addToTimeline(u, task.startTime, task.endTime, 'TASK', task.taskId, task.isCritical, !(u.person.roleIds || []).includes(comp.roleId));
          if (task.minRest > 0) addToTimeline(u, task.endTime, task.endTime + task.minRest * 3600000, 'REST');
          u.loadScore += (task.durationHours * task.difficulty);
          u.shiftsCount++;
          if (task.isCritical) u.criticalShiftCount++;
        });
      });

      // Update assigned count for this shift
      const assignedCount = task.currentAssignees.length;
      let failure = failures.find(f => f.shiftId === task.shiftId);

      if (assignedCount < task.requiredPeople) {
        if (!failure) {
          const taskName = taskTemplates.find(t => t.id === task.taskId)?.name || task.taskId;
          failure = {
            shiftId: task.shiftId,
            taskName,
            startTime: task.startTime,
            endTime: task.endTime,
            requiredPeople: task.requiredPeople,
            assignedCount,
            reasons: []
          };
          failures.push(failure);
        } else {
          failure.assignedCount = assignedCount;
        }

        // Add a generic reason if there are missing slots not covered by roles
        const accountedForAsFailure = failure.reasons.reduce((sum, r) => sum + r.count, 0);
        const gapsNotAccountedFor = (task.requiredPeople - assignedCount) - accountedForAsFailure;

        if (gapsNotAccountedFor > 0) {
          failure.reasons.push({
            type: 'no_available_people',
            roleId: 'generic',
            roleName: 'אנשי צוות כללי',
            count: gapsNotAccountedFor,
            details: `חסרים ${gapsNotAccountedFor} אנשי צוות להשלמת התקן (${task.requiredPeople})`
          });
        }
      } else if (failure) {
        failure.assignedCount = assignedCount;
      }
    });
  };

  processTasks(algoTasks.filter(t => t.isCritical).sort((a, b) => a.startTime - b.startTime));
  processTasks(algoTasks.filter(t => !t.isCritical).sort((a, b) => a.startTime - b.startTime));

  // Build assignment map - merge assignees across multiple algoTasks for the same shiftId
  const assignmentMap = new Map<string, string[]>();
  algoTasks.forEach(t => {
    const existing = assignmentMap.get(t.shiftId) || [];
    // Merge without duplicates
    t.currentAssignees.forEach(id => {
      if (!existing.includes(id)) existing.push(id);
    });
    assignmentMap.set(t.shiftId, existing);
  });

  // Calculate statistics grouped by shiftId
  // IMPORTANT: We use the original shiftsToSolve to get the base requirements
  // to avoid double-counting if shifts are segmented in algoTasks
  const shiftStatsMap = new Map<string, { required: number; filled: number }>();

  shiftsToSolve.forEach(s => {
    shiftStatsMap.set(s.id, {
      required: s.requirements?.requiredPeople || 0,
      filled: assignmentMap.get(s.id)?.length || 0
    });
  });

  let totalSlotsRequired = 0;
  let totalSlotsFilled = 0;
  let fullyAssigned = 0;
  let partiallyAssigned = 0;
  let unassigned = 0;

  shiftStatsMap.forEach(({ required, filled }) => {
    totalSlotsRequired += required;
    totalSlotsFilled += filled;

    if (required === 0) {
      // If a shift requires 0 people, it's considered fully assigned by default
      fullyAssigned++;
    } else if (filled === 0) {
      unassigned++;
    } else if (filled < required) {
      partiallyAssigned++;
    } else {
      fullyAssigned++;
    }
  });

  const totalShifts = shiftStatsMap.size;

  const stats: SchedulingStats = {
    totalShifts,
    fullyAssigned,
    partiallyAssigned,
    unassigned,
    successRate: totalShifts > 0 ? Math.round((fullyAssigned / totalShifts) * 100) : 100,
    totalSlotsRequired,
    totalSlotsFilled
  };

  const resultShifts = shiftsToSolve.map(s => ({ ...s, assignedPersonIds: assignmentMap.get(s.id) || [] }));

  return {
    shifts: resultShifts,
    suggestions,
    failures,
    stats
  };
};
