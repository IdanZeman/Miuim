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

export interface SchedulingResult {
  shifts: Shift[];
  suggestions: SchedulingSuggestion[];
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
  return !user.timeline.some(seg => {
    if (ignoreTypes.includes(seg.type)) return false;
    return (taskStart < seg.end && totalEnd > seg.start);
  });
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
  absences: Absence[] = []
): AlgoUser[] => {

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
      if (a.person_id === p.id && (a.status === 'approved' || a.status === 'partially_approved')) {
        const aStart = new Date(a.start_date).getTime();
        const aEnd = new Date(a.end_date).getTime();
        const dayStart = new Date(targetDate); dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(targetDate); dayEnd.setHours(23, 59, 59, 999);
        if (aStart < dayEnd.getTime() && aEnd > dayStart.getTime()) {
          addToTimeline(algoUser, Math.max(aStart, dayStart.getTime()), Math.min(aEnd, dayEnd.getTime()), 'EXTERNAL_CONSTRAINT', undefined, undefined, undefined, 'absence');
        }
      }
    });

    // 2. Availability
    const avail = getEffectiveAvailability(p, targetDate, teamRotations);
    if (avail) {
      if (!avail.isAvailable) {
        addToTimeline(algoUser, targetDate.getTime(), targetDate.getTime() + 24 * 60 * 60 * 1000, 'EXTERNAL_CONSTRAINT', undefined, undefined, undefined, 'availability');
      } else if (avail.startHour && avail.endHour) {
        const [sH, sM] = avail.startHour.split(':').map(Number);
        const [eH, eM] = avail.endHour.split(':').map(Number);
        const dayStart = new Date(targetDate); dayStart.setHours(0, 0, 0, 0);
        const userStart = new Date(targetDate); userStart.setHours(sH, sM, 0, 0);
        const userEnd = new Date(targetDate); userEnd.setHours(eH, eM, 0, 0);
        const dayEnd = new Date(targetDate); dayEnd.setHours(23, 59, 59, 999);
        if (dayStart.getTime() < userStart.getTime()) {
          addToTimeline(algoUser, dayStart.getTime(), userStart.getTime(), 'EXTERNAL_CONSTRAINT', undefined, undefined, undefined, 'availability');
        }
        const isEndOfDay = eH === 23 && eM >= 59;
        if (!isEndOfDay && userEnd.getTime() < dayEnd.getTime()) {
          addToTimeline(algoUser, userEnd.getTime(), dayEnd.getTime(), 'EXTERNAL_CONSTRAINT', undefined, undefined, undefined, 'availability');
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
};

const findBestCandidates = (
  users: AlgoUser[],
  task: AlgoTask,
  roleId: string,
  count: number,
  relaxationLevel: 1 | 2 | 3 | 4,
  constraints: SchedulingConstraint[] = [],
  interPersonConstraints: InterPersonConstraint[] = [],
  allPeople: Person[] = []
): AlgoUser[] => {
  // DEBUG: Check IPCs
  // if (interPersonConstraints?.length > 0) console.log(`[findBestCandidates] Checking ${interPersonConstraints.length} IPCs for task ${task.taskId}`);

  const taskStart = task.startTime;
  const taskEnd = task.endTime;
  const minRestMs = task.minRest * 60 * 60 * 1000;

  const filtered = users.filter(u => {
    // Role filter (except level 4)
    if (relaxationLevel < 4 && !(u.person.roleIds || []).includes(roleId)) return false;

    // Hard constraints
    const hasHardBlock = constraints.some(c =>
      c.personId === u.person.id && c.type === 'never_assign' &&
      (c.startTime && c.endTime && taskStart < new Date(c.endTime).getTime() && taskEnd > new Date(c.startTime).getTime())
    );
    if (hasHardBlock) return false;

    // INTER-PERSON CONSTRAINTS
    const isForbidden = interPersonConstraints.some(ipc => {
      if (ipc.type !== 'forbidden_together') return false;

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
        // If matches, check if anyone already assigned to this task matches the OTHER condition
        return task.currentAssignees.some(pid => {
          const assigned = allPeople.find(p => p.id === pid);
          if (!assigned) return false;

          const assignedValA = getValue(assigned, ipc.fieldA);
          const assignedValB = getValue(assigned, ipc.fieldB);

          const assignedMatchesA = areValuesEquivalent(assignedValA, ipc.valueA);
          const assignedMatchesB = areValuesEquivalent(assignedValB, ipc.valueB);

          return false;
        });
      }
      return false;
    });

    if (isForbidden) return false;

    // Availability/Rest logic
    let restMs = minRestMs;
    if (relaxationLevel === 2) restMs = minRestMs / 2;
    if (relaxationLevel >= 3) restMs = 0;

    return canFit(u, taskStart, taskEnd, restMs);
  });

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
  strictOrganicness: boolean = false
): SchedulingResult => {
  const { people, taskTemplates, shifts, constraints, settings } = currentState;
  const suggestions: SchedulingSuggestion[] = [];

  const nightStart = settings?.night_shift_start || '21:00';
  const nightEnd = settings?.night_shift_end || '07:00';
  const rareRoleThreshold = (settings as any)?.rare_role_threshold || 2;

  const targetDateKey = startDate.toLocaleDateString('en-CA');
  let shiftsToSolve: Shift[] = [];
  let fixedShiftsOnDay: Shift[] = [];

  if (specificShiftsToSolve) {
    shiftsToSolve = specificShiftsToSolve;
    const solveIds = shiftsToSolve.map(s => s.id);
    fixedShiftsOnDay = shifts.filter(s => new Date(s.startTime).toLocaleDateString('en-CA') === targetDateKey && !solveIds.includes(s.id));
  } else {
    const allOnDay = shifts.filter(s => new Date(s.startTime).toLocaleDateString('en-CA') === targetDateKey && !s.isLocked);
    shiftsToSolve = selectedTaskIds ? allOnDay.filter(s => selectedTaskIds.includes(s.taskId)) : allOnDay;
    fixedShiftsOnDay = allOnDay.filter(s => !shiftsToSolve.includes(s));
  }

  if (shiftsToSolve.length === 0) return { shifts: [], suggestions: [] };

  const activePeople = people.filter(p => p.isActive !== false);
  const rolePoolCounts = new Map<string, number>();
  activePeople.forEach(p => (p.roleIds || []).forEach(rid => rolePoolCounts.set(rid, (rolePoolCounts.get(rid) || 0) + 1)));
  const isRareRole = (roleId: string) => (rolePoolCounts.get(roleId) || 0) <= rareRoleThreshold;

  const algoUsers = initializeUsers(activePeople, startDate, historyScores, [...futureAssignments, ...fixedShiftsOnDay], taskTemplates, shifts, rolePoolCounts, constraints || [], currentState.teamRotations || [], currentState.absences || []);

  const algoTasks: AlgoTask[] = shiftsToSolve.map(s => {
    const template = taskTemplates.find(t => t.id === s.taskId);
    if (!template) return null;
    const startTime = new Date(s.startTime).getTime();
    const endTime = new Date(s.endTime).getTime();
    const isNight = isNightShift(startTime, endTime, nightStart, nightEnd);
    const difficulty = isNight ? template.difficulty * 1.5 : template.difficulty;
    let reqs: any = s.requirements || template.segments?.find(seg => seg.id === s.segmentId);
    return {
      shiftId: s.id, taskId: template.id, startTime, endTime, durationHours: (endTime - startTime) / 3600000,
      difficulty, roleComposition: reqs?.roleComposition || [], requiredPeople: reqs?.requiredPeople || 0,
      minRest: reqs?.minRest || reqs?.minRestHoursAfter || 0, isCritical: difficulty >= 4 || (reqs?.roleComposition || []).some((rc: any) => isRareRole(rc.roleId)),
      assignedTeamId: template.assignedTeamId, currentAssignees: []
    };
  }).filter(Boolean) as AlgoTask[];

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
        if (targetTeam) {
          for (let l = 1; l <= 3; l++) {
            if (selected.length >= comp.count) break;
            // FIX: We must fetch ALL valid candidates (limit: algoUsers.length) because the "global top 3" might not be in our team.
            // If we limit to comp.count immediately, we might slice off the specific team members we need.
            const candidates = findBestCandidates(algoUsers, task, comp.roleId, algoUsers.length, l as any, constraints || [], settings?.interPersonConstraints || [], people);
            const members = candidates.filter(u => u.person.teamId === targetTeam && !selected.includes(u));
            selected.push(...members.slice(0, comp.count - selected.length));
          }
        }
        if (selected.length < comp.count) {
          if (strictOrganicness && targetTeam) {
            // FIX: Similar to above, request more candidates to ensure we find valid alternatives outside the team
            const alts = findBestCandidates(algoUsers, task, comp.roleId, 50, 2, constraints || [], settings?.interPersonConstraints || [], people).filter(u => u.person.teamId !== targetTeam && !selected.includes(u));
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
            for (let l = 1; l <= 4; l++) {
              if (selected.length >= comp.count) break;
              const cands = findBestCandidates(algoUsers, task, comp.roleId, comp.count, l as any, constraints || [], settings?.interPersonConstraints || [], people).filter(u => !selected.includes(u));
              selected.push(...cands.slice(0, comp.count - selected.length));
            }
          }
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
    });
  };

  processTasks(algoTasks.filter(t => t.isCritical).sort((a, b) => a.startTime - b.startTime));
  processTasks(algoTasks.filter(t => !t.isCritical).sort((a, b) => a.startTime - b.startTime));

  const assignmentMap = new Map<string, string[]>();
  algoTasks.forEach(t => assignmentMap.set(t.shiftId, t.currentAssignees));

  return {
    shifts: shiftsToSolve.map(s => ({ ...s, assignedPersonIds: assignmentMap.get(s.id) || [] })),
    suggestions
  };
};
