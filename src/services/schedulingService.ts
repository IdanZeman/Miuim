import { supabase } from '../lib/supabase';
import { SchedulingConstraint, Absence, HourlyBlockage } from '../types';
import { 
  mapConstraintFromDB, 
  mapConstraintToDB, 
  mapAbsenceFromDB, 
  mapAbsenceToDB, 
  mapHourlyBlockageFromDB, 
  mapHourlyBlockageToDB,
  mapRotationFromDB,
  mapRotationToDB
} from './mappers';
import { TeamRotation } from '../types';

export const schedulingService = {
  // Constraints
  async fetchConstraints(organizationId: string): Promise<SchedulingConstraint[]> {
    const { data, error } = await supabase
      .from('scheduling_constraints')
      .select('*')
      .eq('organization_id', organizationId);

    if (error) throw error;
    return (data || []).map(mapConstraintFromDB);
  },

  async addConstraint(constraint: Omit<SchedulingConstraint, 'id'>) {
    const dbPayload = mapConstraintToDB(constraint as SchedulingConstraint);
    const { data, error } = await supabase.rpc('upsert_constraint', {
      p_id: null,
      p_person_id: dbPayload.person_id ?? null,
      p_team_id: dbPayload.team_id ?? null,
      p_role_id: dbPayload.role_id ?? null,
      p_type: dbPayload.type,
      p_start_time: dbPayload.start_time ?? null,
      p_end_time: dbPayload.end_time ?? null,
      p_task_id: dbPayload.task_id,
      p_description: dbPayload.description
    });

    if (error) throw error;
    if (!data) throw new Error('Failed to save constraint');
    return mapConstraintFromDB(data);
  },

  async updateConstraint(constraint: SchedulingConstraint) {
    const dbPayload = mapConstraintToDB(constraint);
    const { error } = await supabase.rpc('upsert_constraint', {
      p_id: constraint.id,
      p_person_id: dbPayload.person_id ?? null,
      p_team_id: dbPayload.team_id ?? null,
      p_role_id: dbPayload.role_id ?? null,
      p_type: dbPayload.type,
      p_start_time: dbPayload.start_time ?? null,
      p_end_time: dbPayload.end_time ?? null,
      p_task_id: dbPayload.task_id,
      p_description: dbPayload.description
    });

    if (error) throw error;
  },

  async deleteConstraint(id: string) {
    const { error } = await supabase
      .from('scheduling_constraints')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async deleteConstraintsByRole(roleId: string, organizationId: string) {
    const { error } = await supabase
      .from('scheduling_constraints')
      .delete()
      .eq('role_id', roleId)
      .eq('organization_id', organizationId);

    if (error) throw error;
  },

  // Absences
  async fetchAbsences(organizationId: string): Promise<Absence[]> {
    const { data, error } = await supabase
      .from('absences')
      .select('*')
      .eq('organization_id', organizationId);

    if (error) throw error;
    return (data || []).map(mapAbsenceFromDB);
  },

  async addAbsence(absence: Omit<Absence, 'id'>) {
    const { data, error } = await supabase.rpc('upsert_absence', {
      p_id: null,
      p_person_id: absence.person_id,
      p_start_date: absence.start_date,
      p_end_date: absence.end_date,
      p_reason: absence.reason,
      p_status: absence.status
    });

    if (error) throw error;
    if (!data) throw new Error('Failed to save absence');
    return mapAbsenceFromDB(data);
  },

  async updateAbsence(absence: Absence) {
    const { error } = await supabase.rpc('upsert_absence', {
      p_id: absence.id,
      p_person_id: absence.person_id,
      p_start_date: absence.start_date,
      p_end_date: absence.end_date,
      p_reason: absence.reason,
      p_status: absence.status
    });

    if (error) throw error;
  },

  async deleteAbsence(id: string) {
    const { error } = await supabase
      .from('absences')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Hourly Blockages
  async fetchHourlyBlockages(organizationId: string): Promise<HourlyBlockage[]> {
    const { data, error } = await supabase
      .from('hourly_blockages')
      .select('*')
      .eq('organization_id', organizationId);

    if (error) throw error;
    return (data || []).map(mapHourlyBlockageFromDB);
  },

  async addHourlyBlockage(block: Omit<HourlyBlockage, 'id'>) {
    const dbPayload = mapHourlyBlockageToDB(block as HourlyBlockage);
    delete (dbPayload as any).id;

    const { data, error } = await supabase
      .from('hourly_blockages')
      .insert(dbPayload)
      .select()
      .single();

    if (error) throw error;
    return mapHourlyBlockageFromDB(data);
  },

  async updateHourlyBlockage(block: HourlyBlockage) {
    const { error } = await supabase
      .from('hourly_blockages')
      .update(mapHourlyBlockageToDB(block))
      .eq('id', block.id);

    if (error) throw error;
  },

  async deleteHourlyBlockage(id: string) {
    const { error } = await supabase
      .from('hourly_blockages')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Team Rotations
  async fetchRotations(organizationId: string): Promise<TeamRotation[]> {
    const { data, error } = await supabase
      .from('team_rotations')
      .select('*')
      .eq('organization_id', organizationId);

    if (error) throw error;
    return (data || []).map(mapRotationFromDB);
  },

  async addRotation(rotation: TeamRotation) {
    const { data, error } = await supabase
      .from('team_rotations')
      .insert(mapRotationToDB(rotation))
      .select()
      .single();

    if (error) throw error;
    return mapRotationFromDB(data);
  },

  async updateRotation(rotation: TeamRotation) {
    const { error } = await supabase
      .from('team_rotations')
      .update(mapRotationToDB(rotation))
      .eq('id', rotation.id);

    if (error) throw error;
  },

  async deleteRotation(id: string) {
    const { error } = await supabase
      .from('team_rotations')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};
