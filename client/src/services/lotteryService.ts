import { supabase } from '../lib/supabase';
import { LotteryHistory } from '../types';
import { mapLotteryHistoryFromDB, mapLotteryHistoryToDB } from './mappers';

export const lotteryService = {
  async fetchHistory(organizationId: string, limit: number = 20): Promise<LotteryHistory[]> {
    const { data, error } = await supabase
      .from('lottery_history')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []).map(mapLotteryHistoryFromDB);
  },

  async addHistoryEntry(entry: Omit<LotteryHistory, 'id' | 'created_at'>) {
    const dbPayload = mapLotteryHistoryToDB(entry as any);
    delete (dbPayload as any).id;
    delete (dbPayload as any).created_at;

    const { data, error } = await supabase
      .from('lottery_history')
      .insert(dbPayload)
      .select()
      .single();

    if (error) throw error;
    return mapLotteryHistoryFromDB(data);
  }
};
