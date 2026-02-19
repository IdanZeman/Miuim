import { LotteryHistory } from '../types';
import { mapLotteryHistoryFromDB, mapLotteryHistoryToDB } from './mappers';
import { callBackend } from './backendService';

export const lotteryService = {
  async fetchHistory(organizationId: string, limit: number = 20): Promise<LotteryHistory[]> {
    const data = await callBackend('/api/lottery', 'GET', { orgId: organizationId, limit });
    return (data || []).map(mapLotteryHistoryFromDB);
  },

  async addHistoryEntry(entry: Omit<LotteryHistory, 'id' | 'created_at'>) {
    const dbPayload = mapLotteryHistoryToDB(entry as any);
    delete (dbPayload as any).id;
    delete (dbPayload as any).created_at;

    const data = await callBackend('/api/lottery', 'POST', dbPayload);
    return mapLotteryHistoryFromDB(data);
  },
};
