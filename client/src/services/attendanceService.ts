import { supabase } from '../lib/supabase';
import { DailyPresence } from '../types';
import { mapDailyPresenceFromDB, mapDailyPresenceToDB } from './mappers';

export const attendanceService = {
  async fetchDailyPresence(organizationId: string, options?: { startDate?: string; endDate?: string; personIds?: string[]; orderBy?: { column: string; ascending?: boolean }; limit?: number; select?: string }): Promise<DailyPresence[]> {
    let query = supabase
      .from('daily_presence')
      .select(options?.select || '*')
      .eq('organization_id', organizationId);

    if (options?.startDate) query = query.gte('date', options.startDate);
    if (options?.endDate) query = query.lte('date', options.endDate);
    if (options?.personIds && options.personIds.length > 0) query = query.in('person_id', options.personIds);
    if (options?.orderBy) query = query.order(options.orderBy.column, { ascending: options.orderBy.ascending ?? true });
    if (options?.limit) query = query.limit(options.limit);

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(mapDailyPresenceFromDB);
  },

  async upsertDailyPresence(presence: DailyPresence[] | any[]) {
    if (presence.length === 0) return;
    
    // Check if it needs mapping - if it has homeStatusType (camelCase), it needs mapping
    // If it has home_status_type (snake_case), it's already in DB format
    const needsMapping = presence[0] && 'homeStatusType' in presence[0];
    const payload = needsMapping ? presence.map(mapDailyPresenceToDB) : presence;

    // Use RPC for bulk upsert with validation and audit logging
    const { data, error } = await supabase
      .rpc('upsert_daily_presence', {
        p_presence_records: payload
      });

    if (error) {
      console.error('[attendanceService] Failed to upsert daily presence:', error);
      throw error;
    }

    return data;
  }
};
