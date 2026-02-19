import { supabase } from '../lib/supabase';
import { SchedulingConstraint, Absence, HourlyBlockage, TeamRotation } from '../types';
import {
  mapConstraintFromDB,
  mapConstraintToDB,
  mapAbsenceFromDB,
  mapAbsenceToDB,
  mapHourlyBlockageFromDB,
  mapHourlyBlockageToDB,
  mapRotationFromDB,
  mapRotationToDB
} from './mappers/index';
import { callBackend } from './backendService';

const callAdminRpc = (rpcName: string, params?: any) => callBackend('/api/admin/rpc', 'POST', { rpcName, params });

export const schedulingService = {
  // Constraints
  async fetchConstraints(organizationId: string): Promise<SchedulingConstraint[]> {
    const data = await callBackend('/api/scheduling/constraints', 'GET', { orgId: organizationId });
    return (data || []).map(mapConstraintFromDB);
  },

  async addConstraint(constraint: Omit<SchedulingConstraint, 'id'>) {
    const dbPayload = mapConstraintToDB(constraint as SchedulingConstraint);
    const data = await callAdminRpc('upsert_constraint', {
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

    if (!data) throw new Error('Failed to save constraint');
    return mapConstraintFromDB(data);
  },

  async updateConstraint(constraint: SchedulingConstraint) {
    const dbPayload = mapConstraintToDB(constraint);
    await callAdminRpc('upsert_constraint', {
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
  },

  async deleteConstraint(id: string) {
    await callAdminRpc('delete_constraint_secure', {
      p_constraint_id: id
    });
  },

  async deleteConstraintsByRole(roleId: string, organizationId: string) {
    return await callAdminRpc('delete_constraints_by_role', {
      p_role_id: roleId
    });
  },

  // Absences
  async fetchAbsences(organizationId: string): Promise<Absence[]> {
    const data = await callBackend('/api/scheduling/absences', 'GET', { orgId: organizationId });
    return (data || []).map(mapAbsenceFromDB);
  },

  async addAbsence(absence: Omit<Absence, 'id'>) {
    const data = await callAdminRpc('upsert_absence', {
      p_id: null,
      p_person_id: absence.person_id,
      p_start_date: absence.start_date,
      p_end_date: absence.end_date,
      p_reason: absence.reason,
      p_status: absence.status,
      p_type: null
    });

    if (!data) throw new Error('Failed to save absence');
    return mapAbsenceFromDB(data);
  },

  async updateAbsence(absence: Absence) {
    await callAdminRpc('upsert_absence', {
      p_id: absence.id,
      p_person_id: absence.person_id,
      p_start_date: absence.start_date,
      p_end_date: absence.end_date,
      p_reason: absence.reason,
      p_status: absence.status,
      p_type: null
    });
  },

  async deleteAbsence(id: string) {
    await callAdminRpc('delete_absence_secure', {
      p_absence_id: id
    });
  },

  // Hourly Blockages
  async fetchHourlyBlockages(organizationId: string): Promise<HourlyBlockage[]> {
    const data = await callBackend('/api/scheduling/blockages', 'GET', { orgId: organizationId });
    return (data || []).map(mapHourlyBlockageFromDB);
  },

  async addHourlyBlockage(block: Omit<HourlyBlockage, 'id'>) {
    const dbPayload = mapHourlyBlockageToDB(block as HourlyBlockage);
    const data = await callAdminRpc('upsert_hourly_blockage', {
      p_id: null,
      p_person_id: dbPayload.person_id,
      p_date: dbPayload.date,
      p_start_time: dbPayload.start_time, // TEXT format HH:MM
      p_end_time: dbPayload.end_time,     // TEXT format HH:MM
      p_reason: dbPayload.reason || null
    });

    return mapHourlyBlockageFromDB(data);
  },

  async updateHourlyBlockage(block: HourlyBlockage) {
    const dbPayload = mapHourlyBlockageToDB(block);
    return await callAdminRpc('upsert_hourly_blockage', {
      p_id: block.id,
      p_person_id: dbPayload.person_id,
      p_date: dbPayload.date,
      p_start_time: dbPayload.start_time, // TEXT format HH:MM
      p_end_time: dbPayload.end_time,     // TEXT format HH:MM
      p_reason: dbPayload.reason || null
    });
  },

  async deleteHourlyBlockage(id: string) {
    await callAdminRpc('delete_hourly_blockage_secure', {
      p_blockage_id: id
    });
  },

  // Team Rotations
  async fetchRotations(organizationId: string): Promise<TeamRotation[]> {
    const data = await callBackend('/api/scheduling/rotations', 'GET', { orgId: organizationId });
    return (data || []).map(mapRotationFromDB);
  },

  async addRotation(rotation: TeamRotation) {
    const dbPayload = mapRotationToDB(rotation);
    const data = await callAdminRpc('upsert_team_rotation', {
      p_id: null,
      p_team_id: dbPayload.team_id,
      p_start_date: dbPayload.start_date,
      p_end_date: dbPayload.end_date,
      p_days_on: dbPayload.days_on_base,
      p_days_off: dbPayload.days_at_home,
      p_pattern: {}
    });

    return mapRotationFromDB(data);
  },

  async updateRotation(rotation: TeamRotation) {
    const dbPayload = mapRotationToDB(rotation);
    return await callAdminRpc('upsert_team_rotation', {
      p_id: rotation.id,
      p_team_id: dbPayload.team_id,
      p_start_date: dbPayload.start_date,
      p_end_date: dbPayload.end_date,
      p_days_on: dbPayload.days_on_base,
      p_days_off: dbPayload.days_at_home,
      p_pattern: {}
    });
  },

  async deleteRotation(id: string) {
    await callAdminRpc('delete_team_rotation_secure', {
      p_rotation_id: id
    });
  }
};
