import { supabase } from '../lib/supabase';
import { SchedulingConstraint, Absence, Equipment } from '@/types';
import { mapAbsenceFromDB, mapAbsenceToDB, mapEquipmentFromDB, mapEquipmentToDB } from './mappers';

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
