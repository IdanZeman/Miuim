import { WarClockItem } from '@/types';
import { mapWarClockItemFromDB, mapWarClockItemToDB } from './mappers';
import { callBackend } from './backendService';
import { supabase } from '../lib/supabase';

export const warClockService = {
  async fetchItems(organizationId: string): Promise<WarClockItem[]> {
    const data = await callBackend('/api/war-clock', 'GET', { orgId: organizationId });
    return (data || []).map(mapWarClockItemFromDB);
  },

  async addItem(item: Omit<WarClockItem, 'id'>) {
    const dbPayload = mapWarClockItemToDB(item as WarClockItem);
    delete (dbPayload as any).id;

    const data = await callBackend('/api/war-clock', 'POST', dbPayload);
    return mapWarClockItemFromDB(data);
  },

  async updateItem(item: WarClockItem) {
    await callBackend(`/api/war-clock/${item.id}`, 'PATCH', mapWarClockItemToDB(item));
  },

  async deleteItem(id: string) {
    await callBackend(`/api/war-clock/${id}`, 'DELETE');
  },

  subscribeToItems(organizationId: string, onUpdate: () => void) {
    const channel = supabase
      .channel('war_clock_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'war_clock_items',
          filter: `organization_id=eq.${organizationId}`
        },
        () => onUpdate()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
};
