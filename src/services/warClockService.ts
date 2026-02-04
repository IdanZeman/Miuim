import { supabase } from './supabaseClient';
import { WarClockItem } from '@/types';
import { mapWarClockItemFromDB, mapWarClockItemToDB } from './mappers';

export const warClockService = {
  async fetchItems(organizationId: string): Promise<WarClockItem[]> {
    const { data, error } = await supabase
      .from('war_clock_items')
      .select('*')
      .eq('organization_id', organizationId);

    if (error) throw error;
    return (data || []).map(mapWarClockItemFromDB);
  },

  async addItem(item: Omit<WarClockItem, 'id'>) {
    const dbPayload = mapWarClockItemToDB(item as WarClockItem);
    delete (dbPayload as any).id;

    const { data, error } = await supabase
      .from('war_clock_items')
      .insert(dbPayload)
      .select()
      .single();

    if (error) throw error;
    return mapWarClockItemFromDB(data);
  },

  async updateItem(item: WarClockItem) {
    const { error } = await supabase
      .from('war_clock_items')
      .update(mapWarClockItemToDB(item))
      .eq('id', item.id);

    if (error) throw error;
  },

  async deleteItem(id: string) {
    const { error } = await supabase
      .from('war_clock_items')
      .delete()
      .eq('id', id);

    if (error) throw error;
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
