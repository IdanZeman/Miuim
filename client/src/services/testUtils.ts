import { Person, Role, Team, TaskTemplate, AppState, SchedulingConstraint, Absence, OrganizationSettings, TeamRotation } from '../types';
import { v4 as uuidv4 } from 'uuid';

export const createMockRole = (name: string, color: string = '#000'): Role => ({
  id: uuidv4(),
  name,
  color,
  organization_id: 'org-1'
});

export const createMockTeam = (name: string, color: string = 'blue'): Team => ({
  id: uuidv4(),
  name,
  color,
  organization_id: 'org-1'
});

export const createMockPerson = (name: string, roleId: string, teamId?: string, overrides: Partial<Person> = {}): Person => ({
  id: uuidv4(),
  name,
  roleId,
  teamId,
  color: '#000',
  maxShiftsPerWeek: 5,
  roleIds: [roleId],
  isActive: true,
  organization_id: 'org-1',
  ...overrides
});

export const createMockTaskTemplate = (name: string, roleComposition: { roleId: string, count: number }[], overrides: Partial<TaskTemplate> = {}): TaskTemplate => ({
  id: uuidv4(),
  name,
  difficulty: 3,
  color: 'green',
  organization_id: 'org-1',
  segments: [
    {
      id: uuidv4(),
      taskId: '', // will be set later if needed
      name: 'Shift 1',
      startTime: '08:00',
      durationHours: 8,
      frequency: 'daily',
      requiredPeople: roleComposition.reduce((sum, r) => sum + r.count, 0),
      roleComposition,
      minRestHoursAfter: 8,
      isRepeat: true
    }
  ],
  ...overrides
});

export const createMockOrganizationSettings = (overrides: Partial<OrganizationSettings> = {}): OrganizationSettings => ({
  organization_id: 'org-1',
  night_shift_start: '22:00',
  night_shift_end: '06:00',
  min_daily_staff: 5,
  optimization_mode: 'ratio',
  ...overrides
});

export const createMockTeamRotation = (teamId: string, overrides: Partial<TeamRotation> = {}): TeamRotation => ({
  id: uuidv4(),
  organization_id: 'org-1',
  team_id: teamId,
  days_on_base: 11,
  days_at_home: 3,
  cycle_length: 14,
  start_date: '2026-01-01',
  arrival_time: '10:00',
  departure_time: '14:00',
  ...overrides
});

export const createInitialState = (): AppState => ({
  people: [],
  roles: [],
  teams: [],
  taskTemplates: [],
  shifts: [],
  constraints: [],
  teamRotations: [],
  settings: {
    organization_id: 'org-1',
    night_shift_start: '22:00',
    night_shift_end: '06:00',
    min_daily_staff: 5,
    optimization_mode: 'ratio'
  },
  absences: [],
  hourlyBlockages: [],
  equipment: [],
  equipmentDailyChecks: []
});
