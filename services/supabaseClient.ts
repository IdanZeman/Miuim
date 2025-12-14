
import { createClient } from '@supabase/supabase-js';
import { Person, Role, Team, TaskTemplate, Shift } from '../types';

const supabaseUrl = 'https://rfqkkzhhvytkkgrnyarm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmcWtremhodnl0a2tncm55YXJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwNjgxMjMsImV4cCI6MjA3NzY0NDEyM30.4kMkKtzq4eowtOQvQXVxwBU5iiEfNqw0f2JYBrVXR4E';

export const isSupabaseConfigured = !!(supabaseUrl && supabaseKey);

// Create client
export const supabase = createClient(supabaseUrl, supabaseKey);

// --- Mappers (App Types <-> DB Types) ---

// People
export const mapPersonFromDB = (dbPerson: any): Person => ({
    id: dbPerson.id,
    name: dbPerson.name,
    teamId: dbPerson.team_id,
    roleIds: dbPerson.role_ids || [],
    maxHoursPerWeek: dbPerson.max_hours_per_week,
    unavailableDates: dbPerson.unavailable_dates || [],
    preferences: dbPerson.preferences || { preferNight: false, avoidWeekends: false },
    color: dbPerson.color,
    dailyAvailability: dbPerson.daily_availability || {},
    organization_id: dbPerson.organization_id,
    email: dbPerson.email,
    userId: dbPerson.user_id
});

export const mapPersonToDB = (person: Person) => ({
    id: person.id,
    name: person.name,
    team_id: person.teamId,
    role_ids: person.roleIds,
    max_hours_per_week: person.maxHoursPerWeek,
    unavailable_dates: person.unavailableDates,
    preferences: person.preferences,
    color: person.color,
    daily_availability: person.dailyAvailability,
    organization_id: person.organization_id,
    email: person.email,
    user_id: person.userId
});

// Teams
export const mapTeamFromDB = (dbTeam: any): Team => ({
    id: dbTeam.id,
    name: dbTeam.name,
    color: dbTeam.color,
    organization_id: dbTeam.organization_id
});

export const mapTeamToDB = (team: Team) => ({
    id: team.id,
    name: team.name,
    color: team.color,
    organization_id: team.organization_id
});

// Roles
export const mapRoleFromDB = (dbRole: any): Role => ({
    id: dbRole.id,
    name: dbRole.name,
    color: dbRole.color,
    icon: dbRole.icon,
    organization_id: dbRole.organization_id
});

export const mapRoleToDB = (role: Role) => ({
    id: role.id,
    name: role.name,
    color: role.color,
    icon: role.icon,
    organization_id: role.organization_id
});

// Tasks
// Tasks
// Tasks
export const mapTaskFromDB = (dbTask: any): TaskTemplate => ({
    id: dbTask.id,
    name: dbTask.name,
    difficulty: dbTask.difficulty,
    color: dbTask.color,
    startDate: dbTask.start_date,
    endDate: dbTask.end_date,
    organization_id: dbTask.organization_id,
    is247: dbTask.is_24_7,
    segments: typeof dbTask.segments === 'string' ? JSON.parse(dbTask.segments) : (dbTask.segments || [])
});

export const mapTaskToDB = (task: TaskTemplate) => ({
    id: task.id,
    name: task.name,
    difficulty: task.difficulty,
    color: task.color,
    start_date: task.startDate,
    end_date: task.endDate,
    organization_id: task.organization_id,
    is_24_7: task.is247,
    segments: task.segments || [] // Will be stored as JSONB
});

// Shifts
export const mapShiftFromDB = (dbShift: any): Shift => ({
    id: dbShift.id,
    taskId: dbShift.task_id,
    segmentId: dbShift.segment_id, // NEW
    startTime: dbShift.start_time,
    endTime: dbShift.end_time,
    assignedPersonIds: dbShift.assigned_person_ids || [],
    isLocked: dbShift.is_locked,
    organization_id: dbShift.organization_id,
    isCancelled: dbShift.is_cancelled,
    requirements: dbShift.requirements // NEW: Snapshot
});

export const mapShiftToDB = (shift: Shift) => ({
    id: shift.id,
    task_id: shift.taskId,
    segment_id: shift.segmentId, // NEW
    start_time: shift.startTime,
    end_time: shift.endTime,
    assigned_person_ids: shift.assignedPersonIds,
    is_locked: shift.isLocked,
    organization_id: shift.organization_id,
    is_cancelled: shift.isCancelled,
    requirements: shift.requirements // NEW
});

// Constraints
export const mapConstraintFromDB = (dbConstraint: any): import('../types').SchedulingConstraint => ({
    id: dbConstraint.id,
    personId: dbConstraint.person_id,
    type: dbConstraint.type,
    taskId: dbConstraint.task_id,
    startTime: dbConstraint.start_time,
    endTime: dbConstraint.end_time,
    organization_id: dbConstraint.organization_id
});

export const mapConstraintToDB = (constraint: import('../types').SchedulingConstraint) => ({
    id: constraint.id,
    person_id: constraint.personId,
    type: constraint.type,
    task_id: constraint.taskId,
    start_time: constraint.startTime,
    end_time: constraint.endTime,
    organization_id: constraint.organization_id
});

// Team Rotations
export const mapRotationFromDB = (dbRot: any): import('../types').TeamRotation => ({
    id: dbRot.id,
    organization_id: dbRot.organization_id,
    team_id: dbRot.team_id,
    days_on_base: dbRot.days_on_base,
    days_at_home: dbRot.days_at_home,
    cycle_length: dbRot.cycle_length,
    start_date: dbRot.start_date,
    end_date: dbRot.end_date, // NEW
    arrival_time: dbRot.arrival_time,
    departure_time: dbRot.departure_time
});

export const mapRotationToDB = (rot: import('../types').TeamRotation) => ({
    id: rot.id,
    organization_id: rot.organization_id,
    team_id: rot.team_id,
    days_on_base: rot.days_on_base,
    days_at_home: rot.days_at_home,
    cycle_length: rot.cycle_length,
    start_date: rot.start_date,
    end_date: rot.end_date, // NEW
    arrival_time: rot.arrival_time,
    departure_time: rot.departure_time
});
