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
    const payload: any = { assigned_person_ids: assignedPersonIds };
    if (metadata) payload.metadata = metadata;

    const { error } = await supabase
      .from('shifts')
      .update(payload)
      .eq('id', shiftId);

    if (error) throw error;
  },

  async updateShift(shift: Shift) {
    const { error } = await supabase
      .from('shifts')
      .update(mapShiftToDB(shift))
      .eq('id', shift.id);

    if (error) throw error;
  },

  async upsertShifts(shifts: Shift[]) {
    const dbShifts = shifts.map(mapShiftToDB);
    const { error } = await supabase
      .from('shifts')
      .upsert(dbShifts);

    if (error) throw error;
  },

  async deleteShift(shiftId: string) {
    const { error } = await supabase
      .from('shifts')
      .delete()
      .eq('id', shiftId);

    if (error) throw error;
  },

  async toggleShiftCancellation(shiftId: string, isCancelled: boolean) {
    const { error } = await supabase
      .from('shifts')
      .update({ is_cancelled: isCancelled })
      .eq('id', shiftId);

    if (error) throw error;
  },

  async addShift(shift: Shift) {
    const { error } = await supabase
      .from('shifts')
      .insert(mapShiftToDB(shift));

    if (error) throw error;
  },

  async deleteShiftsByTask(taskId: string, organizationId: string) {
    const { error } = await supabase
      .from('shifts')
      .delete()
      .eq('task_id', taskId)
      .eq('organization_id', organizationId);

    if (error) throw error;
  },

  async deleteFutureShiftsByTask(taskId: string, organizationId: string, startTime: string) {
    const { error } = await supabase
      .from('shifts')
      .delete()
      .eq('task_id', taskId)
      .eq('organization_id', organizationId)
      .gte('start_time', startTime);

    if (error) throw error;
  },

  async clearAssignmentsInRange(organizationId: string, startDate: string, endDate: string, taskIds?: string[]) {
    let query = supabase
      .from('shifts')
      .update({ assigned_person_ids: [] })
      .gte('start_time', startDate)
      .lte('start_time', endDate)
      .eq('organization_id', organizationId);

    if (taskIds && taskIds.length > 0) {
      query = query.in('task_id', taskIds);
    }

    const { data, error } = await query.select();
    if (error) throw error;
    return data;
  }
};
