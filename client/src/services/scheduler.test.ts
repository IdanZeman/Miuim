import { describe, it, expect } from 'vitest';
import { solveSchedule } from './scheduler';
import { 
  createMockRole, 
  createMockTeam, 
  createMockPerson, 
  createMockTaskTemplate, 
  createInitialState 
} from './testUtils';
import { AppState, Shift } from '../types';

describe('Scheduling Algorithm (solveSchedule)', () => {
  
  it('should assign a soldier with the correct role to a task', () => {
    const state = createInitialState();
    const role = createMockRole('לוחם');
    const person = createMockPerson('יוסי', role.id);
    const task = createMockTaskTemplate('שמירה', [{ roleId: role.id, count: 1 }]);
    const segmentId = task.segments[0].id;
    
    state.roles = [role];
    state.people = [person];
    state.taskTemplates = [task];
    
    // Create a shift for "today"
    const today = new Date();
    today.setHours(0,0,0,0);
    const shift: Shift = {
      id: 'shift-1',
      taskId: task.id,
      segmentId: segmentId,
      startTime: new Date(today.getTime() + 8 * 3600000).toISOString(),
      endTime: new Date(today.getTime() + 16 * 3600000).toISOString(),
      assignedPersonIds: [],
      isLocked: false,
      organization_id: 'org-1'
    };
    state.shifts = [shift];

    const result = solveSchedule(state, today, today);
    
    expect(result.shifts[0].assignedPersonIds).toContain(person.id);
    expect(result.suggestions).toHaveLength(0);
  });

  it('should respect minimum rest hours between shifts', () => {
    const state = createInitialState();
    const role = createMockRole('לוחם');
    const person = createMockPerson('יוסי', role.id);
    const task = createMockTaskTemplate('שמירה', [{ roleId: role.id, count: 1 }]);
    
    state.roles = [role];
    state.people = [person];
    state.taskTemplates = [task];
    
    const today = new Date();
    today.setHours(0,0,0,0);
    
    // First shift: 08:00 - 12:00
    const shift1: Shift = {
      id: 'shift-1',
      taskId: task.id,
      startTime: new Date(today.getTime() + 8 * 3600000).toISOString(),
      endTime: new Date(today.getTime() + 12 * 3600000).toISOString(),
      assignedPersonIds: [],
      isLocked: false,
      organization_id: 'org-1',
      requirements: { requiredPeople: 1, roleComposition: [{ roleId: role.id, count: 1 }], minRest: 8 }
    };

    // Second shift: 14:00 - 18:00 (Violates 8h rest)
    const shift2: Shift = {
      id: 'shift-2',
      taskId: task.id,
      startTime: new Date(today.getTime() + 14 * 3600000).toISOString(),
      endTime: new Date(today.getTime() + 18 * 3600000).toISOString(),
      assignedPersonIds: [],
      isLocked: false,
      organization_id: 'org-1',
      requirements: { requiredPeople: 1, roleComposition: [{ roleId: role.id, count: 1 }], minRest: 8 }
    };

    state.shifts = [shift1, shift2];

    const result = solveSchedule(state, today, today);
    
    // Person should be in ONE shift, but not both
    const assignments = result.shifts.flatMap(s => s.assignedPersonIds);
    const personCount = assignments.filter(id => id === person.id).length;
    
    expect(personCount).toBe(1);
  });

  it('should prioritize team organicness', () => {
    const state = createInitialState();
    const role = createMockRole('לוחם');
    const teamA = createMockTeam('צוות א');
    const teamB = createMockTeam('צוות ב');
    
    const personA = createMockPerson('לוחם א', role.id, teamA.id);
    const personB = createMockPerson('לוחם ב', role.id, teamB.id);
    
    const taskForA = createMockTaskTemplate('משימה לצוות א', [{ roleId: role.id, count: 1 }], { assignedTeamId: teamA.id });
    const segmentId = taskForA.segments[0].id;

    state.roles = [role];
    state.teams = [teamA, teamB];
    state.people = [personA, personB];
    state.taskTemplates = [taskForA];
    
    const today = new Date();
    today.setHours(0,0,0,0);
    const shift: Shift = {
      id: 'shift-1',
      taskId: taskForA.id,
      segmentId: segmentId,
      startTime: new Date(today.getTime() + 10 * 3600000).toISOString(),
      endTime: new Date(today.getTime() + 14 * 3600000).toISOString(),
      assignedPersonIds: [],
      isLocked: false,
      organization_id: 'org-1'
    };
    state.shifts = [shift];

    const result = solveSchedule(state, today, today);
    
    expect(result.shifts[0].assignedPersonIds).toContain(personA.id);
    expect(result.shifts[0].assignedPersonIds).not.toContain(personB.id);
  });

  it('should distribute load fairly between available personnel', () => {
    const state = createInitialState();
    const role = createMockRole('לוחם');
    
    // 2 Soldiers
    const person1 = createMockPerson('חייל 1', role.id);
    const person2 = createMockPerson('חייל 2', role.id);
    
    // 2 Tasks
    const task = createMockTaskTemplate('שמירה', [{ roleId: role.id, count: 1 }]);
    const segmentId = task.segments[0].id;

    state.roles = [role];
    state.people = [person1, person2];
    state.taskTemplates = [task];
    
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const shift1: Shift = {
      id: 'shift-1',
      taskId: task.id,
      segmentId: segmentId,
      startTime: new Date(today.getTime() + 8 * 3600000).toISOString(),
      endTime: new Date(today.getTime() + 12 * 3600000).toISOString(),
      assignedPersonIds: [],
      isLocked: false
    };
    const shift2: Shift = {
      id: 'shift-2',
      taskId: task.id,
      segmentId: segmentId,
      startTime: new Date(today.getTime() + 14 * 3600000).toISOString(),
      endTime: new Date(today.getTime() + 18 * 3600000).toISOString(),
      assignedPersonIds: [],
      isLocked: false
    };

    state.shifts = [shift1, shift2];

    // Give person 1 some existing load
    const history = {
      [person1.id]: { totalLoadScore: 100, shiftsCount: 10, criticalShiftCount: 0 },
      [person2.id]: { totalLoadScore: 0, shiftsCount: 0, criticalShiftCount: 0 }
    };

    const result = solveSchedule(state, today, today, history);
    
    // Person 2 (with 0 load) should handle the first available shifts before person 1
    // (Or at least handle a shift if both can fit)
    expect(result.shifts[0].assignedPersonIds).toContain(person2.id);
  });

  it('should require a commander for a patrol task', () => {
    const state = createInitialState();
    const roleCommander = createMockRole('מפקד');
    const roleWarrior = createMockRole('לוחם');
    
    const commander = createMockPerson('מ"כ א', roleCommander.id);
    const warrior1 = createMockPerson('לוחם 1', roleWarrior.id);
    const warrior2 = createMockPerson('לוחם 2', roleWarrior.id);
    
    // Patrol requires 1 commander and 2 warriors
    const patrolTask = createMockTaskTemplate('סיור', [
      { roleId: roleCommander.id, count: 1 },
      { roleId: roleWarrior.id, count: 2 }
    ]);
    const segmentId = patrolTask.segments[0].id;

    state.roles = [roleCommander, roleWarrior];
    state.people = [commander, warrior1, warrior2];
    state.taskTemplates = [patrolTask];
    
    const today = new Date();
    today.setHours(0,0,0,0);
    const shift: Shift = {
      id: 'shift-patrol',
      taskId: patrolTask.id,
      segmentId,
      startTime: new Date(today.getTime() + 10 * 3600000).toISOString(),
      endTime: new Date(today.getTime() + 14 * 3600000).toISOString(),
      assignedPersonIds: [],
      isLocked: false
    };
    state.shifts = [shift];

    const result = solveSchedule(state, today, today);
    
    const assignees = result.shifts[0].assignedPersonIds;
    expect(assignees).toContain(commander.id);
    expect(assignees).toContain(warrior1.id);
    expect(assignees).toContain(warrior2.id);
    expect(assignees).toHaveLength(3);
  });

  it('should not assign a person during a manual time block', () => {
    const state = createInitialState();
    const role = createMockRole('לוחם');
    const person = createMockPerson('יוסי', role.id);
    const task = createMockTaskTemplate('שמירה', [{ roleId: role.id, count: 1 }]);
    const segmentId = task.segments[0].id;

    state.roles = [role];
    state.people = [person];
    state.taskTemplates = [task];
    
    const today = new Date();
    today.setHours(0,0,0,0);
    const dateKey = today.toLocaleDateString('en-CA');

    // Shift at 12:00
    const shift: Shift = {
      id: 'shift-1',
      taskId: task.id,
      segmentId,
      startTime: new Date(today.getTime() + 12 * 3600000).toISOString(),
      endTime: new Date(today.getTime() + 16 * 3600000).toISOString(),
      assignedPersonIds: [],
      isLocked: false
    };
    state.shifts = [shift];

    // Constraint: Never assign between 10:00 and 14:00 (overlaps with shift)
    state.constraints = [{
      id: 'const-1',
      personId: person.id,
      type: 'never_assign',
      startTime: new Date(today.getTime() + 10 * 3600000).toISOString(),
      endTime: new Date(today.getTime() + 14 * 3600000).toISOString(),
      organization_id: 'org-1'
    }];

    const result = solveSchedule(state, today, today);
    
    expect(result.shifts[0].assignedPersonIds).not.toContain(person.id);
  });

  it('should provide suggestions when roles are missing', () => {
    const state = createInitialState();
    const roleCommander = createMockRole('מפקד');
    const teamA = createMockTeam('צוות א');
    
    // Task specifically for team A
    const task = createMockTaskTemplate('סיור', [{ roleId: roleCommander.id, count: 1 }], { assignedTeamId: teamA.id });
    const segmentId = task.segments[0].id;

    state.roles = [roleCommander];
    state.teams = [teamA];
    
    // One person exists but NOT in team A
    const otherPerson = createMockPerson('חייל אחר', roleCommander.id); 
    state.people = [otherPerson];
    
    state.taskTemplates = [task];
    
    const today = new Date();
    today.setHours(0,0,0,0);
    const shift: Shift = {
      id: 'shift-1',
      taskId: task.id,
      segmentId,
      startTime: new Date(today.getTime() + 8 * 3600000).toISOString(),
      endTime: new Date(today.getTime() + 12 * 3600000).toISOString(),
      assignedPersonIds: [],
      isLocked: false
    };
    state.shifts = [shift];

    const result = solveSchedule(state, today, today, {}, [], undefined, undefined, true);
    
    expect(result.shifts[0].assignedPersonIds).toHaveLength(0);
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.suggestions[0].missingCount).toBe(1);
  });

  it('should never assign a person to two simultaneous shifts', () => {
    const state = createInitialState();
    const role = createMockRole('לוחם');
    const person = createMockPerson('יוסי', role.id);
    const task = createMockTaskTemplate('שמירה', [{ roleId: role.id, count: 1 }]);
    const segmentId = task.segments[0].id;

    state.roles = [role];
    state.people = [person];
    state.taskTemplates = [task];
    
    const today = new Date();
    today.setHours(0,0,0,0);
    
    // Two identical shifts at the same time
    const shift1: Shift = {
      id: 'shift-1',
      taskId: task.id,
      segmentId,
      startTime: new Date(today.getTime() + 8 * 3600000).toISOString(),
      endTime: new Date(today.getTime() + 12 * 3600000).toISOString(),
      assignedPersonIds: [],
      isLocked: false
    };
    const shift2: Shift = {
      id: 'shift-2',
      taskId: task.id,
      segmentId,
      startTime: new Date(today.getTime() + 8 * 3600000).toISOString(),
      endTime: new Date(today.getTime() + 12 * 3600000).toISOString(),
      assignedPersonIds: [],
      isLocked: false
    };

    state.shifts = [shift1, shift2];

    const result = solveSchedule(state, today, today);
    
    const assignments = result.shifts.flatMap(s => s.assignedPersonIds);
    const personAppearances = assignments.filter(id => id === person.id).length;
    
    // He should only appear in ONE of them
    expect(personAppearances).toBe(1);
  });

  it('should prefer a rested person over one still in rest period (Optimality)', () => {
    const state = createInitialState();
    const role = createMockRole('לוחם');
    
    // Person A: Just finished a shift (rest period not over)
    const personA = createMockPerson('חייל א (עייף)', role.id);
    // Person B: Fresh
    const personB = createMockPerson('חייל ב (רענן)', role.id);
    
    const task = createMockTaskTemplate('שמירה', [{ roleId: role.id, count: 1 }]);
    const segmentId = task.segments[0].id;

    state.roles = [role];
    state.people = [personA, personB];
    state.taskTemplates = [task];
    
    const today = new Date();
    today.setHours(0,0,0,0);

    // 1. Existing shift for Person A that ends at 07:00
    const pastShift: Shift = {
      id: 'past-shift',
      taskId: task.id,
      segmentId,
      startTime: new Date(today.getTime() - 4 * 3600000).toISOString(), // Ends at 04:00 today? No, let's be clearer.
      endTime: new Date(today.getTime() + 7 * 3600000).toISOString(), // Ends at 07:00 today
      assignedPersonIds: [personA.id],
      isLocked: true, // It's in the past/fixed
      requirements: { requiredPeople: 1, roleComposition: [{ roleId: role.id, count: 1 }], minRest: 8 }
    };

    // 2. New shift at 10:00. 
    // Person A only had 3 hours rest (needs 8).
    // Person B is fresh.
    const newShift: Shift = {
      id: 'new-shift',
      taskId: task.id,
      segmentId,
      startTime: new Date(today.getTime() + 10 * 3600000).toISOString(), // 10:00
      endTime: new Date(today.getTime() + 14 * 3600000).toISOString(), // 14:00
      assignedPersonIds: [],
      isLocked: false
    };

    state.shifts = [pastShift, newShift];

    const result = solveSchedule(state, today, today);
    
    // Should choose Person B!
    expect(result.shifts.find(s => s.id === 'new-shift')?.assignedPersonIds).toContain(personB.id);
    expect(result.shifts.find(s => s.id === 'new-shift')?.assignedPersonIds).not.toContain(personA.id);
  });
});
