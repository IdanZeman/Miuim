import { createClient } from '@supabase/supabase-js';
import { Person, Role, Team, TaskTemplate, Shift, SchedulingConstraint, Absence } from '../types';

const supabaseUrl = 'https://rfqkkzhhvytkkgrnyarm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmcWtremhodnl0a2tncm55YXJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwNjgxMjMsImV4cCI6MjA3NzY0NDEyM30.4kMkKtzq4eowtOQvQXVxwBU5iiEfNqw0f2JYBrVXR4E';

export const isSupabaseConfigured = !!(supabaseUrl && supabaseKey);

// Create client
export const supabase = createClient(supabaseUrl, supabaseKey);

// --- Mappers (App Types <-> DB Types) ---

// People
export const mapPersonFromDB = (p: any): Person => {
    let dailyAvailability = p.daily_availability || {};
    if (typeof dailyAvailability === 'string') {
        try { dailyAvailability = JSON.parse(dailyAvailability); } catch (e) { dailyAvailability = {}; }
    }

    let personalRotation = p.personal_rotation || undefined;
    if (typeof personalRotation === 'string') {
        try { personalRotation = JSON.parse(personalRotation); } catch (e) { personalRotation = undefined; }
    }

    return {
        id: p.id,
        name: p.name,
        phone: p.phone, // NEW
        isActive: p.is_active !== false, // NEW: Default to true if null/undefined
    roleId: p.role_id || (p.role_ids && p.role_ids[0]) || '',
    roleIds: p.role_ids || [], // NEW: Map role_ids from DB
    teamId: p.team_id,
    userId: p.user_id,
    color: p.color || 'bg-blue-500',
    maxShiftsPerWeek: p.max_shifts_per_week || 5,
    dailyAvailability,
    personalRotation,
    organization_id: p.organization_id // NEW: Map organization_id
};
};

export const mapPersonToDB = (p: Person) => ({
id: p.id,
name: p.name,
phone: p.phone, // NEW
is_active: p.isActive, // NEW
// role_id removed as it doesn't exist in DB schema
role_ids: (p.roleIds && p.roleIds.length > 0) ? p.roleIds : (p.roleId ? [p.roleId] : []),
team_id: p.teamId,
user_id: p.userId,
    color: p.color,
    max_shifts_per_week: p.maxShiftsPerWeek,
    daily_availability: p.dailyAvailability,
    personal_rotation: p.personalRotation === undefined ? null : p.personalRotation,
    organization_id: p.organization_id
});

// Teams
export const mapTeamFromDB = (t: any): Team => ({
    id: t.id,
    name: t.name,
    color: t.color || 'border-slate-500'
});

export const mapTeamToDB = (t: Team) => ({
    id: t.id,
    name: t.name,
    color: t.color,
    organization_id: (t as any).organization_id
});

// Roles
export const mapRoleFromDB = (r: any): Role => ({
    id: r.id,
    name: r.name,
    color: r.color || 'bg-slate-200'
});

export const mapRoleToDB = (r: Role) => ({
    id: r.id,
    name: r.name,
    color: r.color,
    organization_id: (r as any).organization_id
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
    segments: typeof dbTask.segments === 'string' ? JSON.parse(dbTask.segments) : (dbTask.segments || []),
    assignedTeamId: dbTask.assigned_team_id // NEW
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
    segments: task.segments || [], // Will be stored as JSONB
    assigned_team_id: task.assignedTeamId // NEW
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
    teamId: dbConstraint.team_id, // NEW
    roleId: dbConstraint.role_id, // NEW
    type: dbConstraint.type,
    taskId: dbConstraint.task_id,
    startTime: dbConstraint.start_time,
    endTime: dbConstraint.end_time,
    organization_id: dbConstraint.organization_id
});

export const mapConstraintToDB = (constraint: import('../types').SchedulingConstraint) => ({
    id: constraint.id,
    person_id: constraint.personId,
    team_id: constraint.teamId, // NEW
    role_id: constraint.roleId, // NEW
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

// Absences
export const mapAbsenceFromDB = (dbAbsence: any): Absence => ({
    id: dbAbsence.id,
    person_id: dbAbsence.person_id,
    organization_id: dbAbsence.organization_id,
    start_date: dbAbsence.start_date,
    end_date: dbAbsence.end_date,
    reason: dbAbsence.reason,
    created_at: dbAbsence.created_at
});

export const mapAbsenceToDB = (absence: Absence) => ({
    id: absence.id,
    person_id: absence.person_id,
    organization_id: absence.organization_id,
    start_date: absence.start_date,
    end_date: absence.end_date,
    reason: absence.reason
});

// Constraints
export const fetchConstraints = async (organizationId: string): Promise<SchedulingConstraint[]> => {
    const { data, error } = await supabase
        .from('scheduling_constraints')
        .select('*')
        .eq('organization_id', organizationId);
    
    if (error) throw error;
    
    return data.map((c: any) => ({
        id: c.id,
        personId: c.person_id,
        teamId: c.team_id,
        roleId: c.role_id,
        type: c.type,
        taskId: c.task_id,
        startTime: c.start_time,
        endTime: c.end_time,
        organization_id: c.organization_id,
        description: c.description
    }));
};

export const addConstraint = async (constraint: Omit<SchedulingConstraint, 'id'>) => {
    const sanitizeUuid = (id: string | undefined | null) => (id && id.length > 0 ? id : null);

    const dbConstraint = {
        person_id: sanitizeUuid(constraint.personId),
        team_id: sanitizeUuid(constraint.teamId),
        role_id: sanitizeUuid(constraint.roleId),
        type: constraint.type,
        task_id: sanitizeUuid(constraint.taskId),
        start_time: constraint.startTime,
        end_time: constraint.endTime,
        organization_id: constraint.organization_id,
        description: constraint.description
    };

    const { data, error } = await supabase
        .from('scheduling_constraints')
        .insert([dbConstraint])
        .select()
        .single();
    
    if (error) throw error;

    return {
        id: data.id,
        personId: data.person_id,
        teamId: data.team_id,
        roleId: data.role_id,
        type: data.type,
        taskId: data.task_id,
        startTime: data.start_time,
        endTime: data.end_time,
        organization_id: data.organization_id,
        description: data.description
    };
};

export const deleteConstraint = async (id: string) => {
    const { error } = await supabase
        .from('scheduling_constraints')
        .delete()
        .eq('id', id);
    
    if (error) throw error;
};

// Absences CRUD
export const fetchAbsences = async (organizationId: string): Promise<Absence[]> => {
    const { data, error } = await supabase
        .from('absences')
        .select('*')
        .eq('organization_id', organizationId);
    
    if (error) throw error;
    
    return data.map(mapAbsenceFromDB);
};

export const addAbsence = async (absence: Omit<Absence, 'id'>) => {
    const dbAbsence = {
        person_id: absence.person_id,
        organization_id: absence.organization_id,
        start_date: absence.start_date,
        end_date: absence.end_date,
        reason: absence.reason
    };

    const { data, error } = await supabase
        .from('absences')
        .insert([dbAbsence])
        .select()
        .single();
    
    if (error) throw error;

    return mapAbsenceFromDB(data);
};

export const updateAbsence = async (absence: Absence) => {
    const dbAbsence = mapAbsenceToDB(absence);
    const { error } = await supabase
        .from('absences')
        .update(dbAbsence)
        .eq('id', absence.id);
    
    if (error) throw error;
};

export const deleteAbsence = async (id: string) => {
    const { error } = await supabase
        .from('absences')
        .delete()
        .eq('id', id);
    
    if (error) throw error;
};
