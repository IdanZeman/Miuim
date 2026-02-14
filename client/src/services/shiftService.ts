import { supabase } from '../lib/supabase';
import { Shift } from '../types';
import { mapShiftFromDB, mapShiftToDB } from './mappers';

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
    const { data, error } = await supabase.rpc('update_shift_assignments', {
      p_shift_id: shiftId,
      p_assigned_person_ids: assignedPersonIds,
      p_metadata: metadata || null
    });

    if (error) throw error;
    return data;
  },

  async updateShift(shift: Shift) {
    const dbShift = mapShiftToDB(shift);
    const { data, error } = await supabase.rpc('upsert_shift', {
      p_id: shift.id,
      p_task_id: dbShift.task_id,
      p_start_time: dbShift.start_time,
      p_end_time: dbShift.end_time,
      p_assigned_person_ids: dbShift.assigned_person_ids || [],
      p_is_cancelled: dbShift.is_cancelled || false,
      p_metadata: dbShift.metadata || {}
    });

    if (error) throw error;
    return data;
  },

  async upsertShifts(shifts: Shift[]) {
    const dbShifts = shifts.map(mapShiftToDB);
    const { data, error } = await supabase.rpc('upsert_shifts', {
      p_shifts: dbShifts
    });

    if (error) throw error;
    return data;
  },

  async deleteShift(shiftId: string) {
    const { error } = await supabase.rpc('delete_shift_secure', {
      p_shift_id: shiftId
    });

    if (error) throw error;
  },

  async toggleShiftCancellation(shiftId: string, isCancelled: boolean) {
    const { data, error } = await supabase.rpc('toggle_shift_cancellation', {
      p_shift_id: shiftId,
      p_is_cancelled: isCancelled
    });

    if (error) throw error;
    return data;
  },

  async addShift(shift: Shift) {
    const dbShift = mapShiftToDB(shift);
    const { data, error } = await supabase.rpc('upsert_shift', {
      p_id: null,
      p_task_id: dbShift.task_id,
      p_start_time: dbShift.start_time,
      p_end_time: dbShift.end_time,
      p_assigned_person_ids: dbShift.assigned_person_ids || [],
      p_is_cancelled: dbShift.is_cancelled || false,
      p_metadata: dbShift.metadata || {}
    });

    if (error) throw error;
    return data;
  },

  async deleteShiftsByTask(taskId: string, organizationId: string) {
    const { data, error } = await supabase.rpc('delete_shifts_by_task', {
      p_task_id: taskId,
      p_start_time: null
    });

    if (error) throw error;
    return data;
  },

  async deleteFutureShiftsByTask(taskId: string, organizationId: string, startTime: string) {
    const { data, error } = await supabase.rpc('delete_shifts_by_task', {
      p_task_id: taskId,
      p_start_time: startTime
    });

    if (error) throw error;
    return data;
  },

  async clearAssignmentsInRange(organizationId: string, startDate: string, endDate: string, taskIds?: string[]) {
    const { data, error } = await supabase.rpc('clear_shift_assignments_in_range', {
      p_start_date: startDate,
      p_end_date: endDate,
      p_task_ids: taskIds || null
    });
    
    if (error) throw error;
    return data;
  }
};
