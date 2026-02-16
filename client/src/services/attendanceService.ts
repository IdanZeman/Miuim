import { supabase } from '../lib/supabase';
import { DailyPresence } from '../types';
import { mapDailyPresenceFromDB, mapDailyPresenceToDB } from './mappers';
import { callBackend } from './backendService';

export const attendanceService = {
  async fetchDailyPresence(organizationId: string, options?: { startDate?: string; endDate?: string; personIds?: string[]; orderBy?: { column: string; ascending?: boolean }; limit?: number; select?: string }): Promise<DailyPresence[]> {
    const params = new URLSearchParams();
    params.append('organizationId', organizationId);
    if (options?.startDate) params.append('startDate', options.startDate);
    if (options?.endDate) params.append('endDate', options.endDate);
    if (options?.personIds && options.personIds.length > 0) params.append('personIds', options.personIds.join(','));
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.select) params.append('select', options.select);

    const data = await callBackend(`/api/attendance?${params.toString()}`, 'GET');
    return (data || []).map(mapDailyPresenceFromDB);
  },

  async upsertDailyPresence(presence: DailyPresence[] | any[]) {
    if (presence.length === 0) return;

    // Check if it needs mapping - if it has homeStatusType (camelCase), it needs mapping
    // If it has home_status_type (snake_case), it's already in DB format
    const needsMapping = presence[0] && 'homeStatusType' in presence[0];
    const payload = needsMapping ? presence.map(mapDailyPresenceToDB) : presence;

    // Use backend API for bulk upsert with validation and audit logging
    const data = await callBackend('/api/attendance/upsert', 'POST', {
      p_presence_records: payload
    });

    return data;
  }
};
