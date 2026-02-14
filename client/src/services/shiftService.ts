import { supabase } from '../lib/supabase';
import { Shift } from '../types';
import { mapShiftFromDB, mapShiftToDB } from './mappers';
import { callBackend } from './backendService';

const callAdminRpc = (rpcName: string, params?: any) => callBackend('/api/admin/rpc', 'POST', { rpcName, params });

export const shiftService = {
  async fetchShifts(organizationId: string, options?: { startDate?: string; endDate?: string; taskId?: string }): Promise<Shift[]> {
    let query = supabase
      .from('shifts')
      .select('*')
      .eq('organization_id', organizationId);

    if (options?.startDate) query = query.gte('start_time', options.startDate);
    if (options?.endDate) query = query.lte('start_time', options.endDate);
    if (options?.taskId) query = query.eq('task_id', options.taskId);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapShiftFromDB);
  },

  async updateShiftAssignments(shiftId: string, assignedPersonIds: string[], metadata?: any) {
    return await callAdminRpc('update_shift_assignments', {
      p_shift_id: shiftId,
      p_assigned_person_ids: assignedPersonIds,
      p_metadata: metadata || null
    });
  },

  async updateShift(shift: Shift) {
    const dbShift = mapShiftToDB(shift);
    return await callAdminRpc('upsert_shift', {
      p_id: shift.id,
      p_task_id: dbShift.task_id,
      p_start_time: dbShift.start_time,
      p_end_time: dbShift.end_time,
      p_assigned_person_ids: dbShift.assigned_person_ids || [],
      p_is_cancelled: dbShift.is_cancelled || false,
      p_metadata: dbShift.metadata || {}
    });
  },

  async upsertShifts(shifts: Shift[]) {
    const dbShifts = shifts.map(mapShiftToDB);
    return await callAdminRpc('upsert_shifts', {
      p_shifts: dbShifts
    });
  },

  async deleteShift(shiftId: string) {
    await callAdminRpc('delete_shift_secure', {
      p_shift_id: shiftId
    });
  },

  async toggleShiftCancellation(shiftId: string, isCancelled: boolean) {
    return await callAdminRpc('toggle_shift_cancellation', {
      p_shift_id: shiftId,
      p_is_cancelled: isCancelled
    });
  },

  async addShift(shift: Shift) {
    const dbShift = mapShiftToDB(shift);
    return await callAdminRpc('upsert_shift', {
      p_id: null,
      p_task_id: dbShift.task_id,
      p_start_time: dbShift.start_time,
      p_end_time: dbShift.end_time,
      p_assigned_person_ids: dbShift.assigned_person_ids || [],
      p_is_cancelled: dbShift.is_cancelled || false,
      p_metadata: dbShift.metadata || {}
    });
  },

  async deleteShiftsByTask(taskId: string, organizationId: string) {
    return await callAdminRpc('delete_shifts_by_task', {
      p_task_id: taskId,
      p_start_time: null
    });
  },

  async deleteFutureShiftsByTask(taskId: string, organizationId: string, startTime: string) {
    return await callAdminRpc('delete_shifts_by_task', {
      p_task_id: taskId,
      p_start_time: startTime
    });
  },

  async clearAssignmentsInRange(organizationId: string, startDate: string, endDate: string, taskIds?: string[]) {
    return await callAdminRpc('clear_shift_assignments_in_range', {
      p_start_date: startDate,
      p_end_date: endDate,
      p_task_ids: taskIds || null
    });
  }
};
