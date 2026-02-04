import { supabase } from '../lib/supabase';
import { Equipment, EquipmentDailyCheck } from '../types';
import { 
  mapEquipmentFromDB, 
  mapEquipmentToDB, 
  mapEquipmentDailyCheckFromDB, 
  mapEquipmentDailyCheckToDB 
} from './mappers';

export const equipmentService = {
  // Equipment
  async fetchEquipment(organizationId: string): Promise<Equipment[]> {
    const { data, error } = await supabase
      .from('equipment')
      .select('*')
      .eq('organization_id', organizationId);

    if (error) throw error;
    return (data || []).map(mapEquipmentFromDB);
  },

  async addEquipment(equipment: Omit<Equipment, 'id'>) {
    const dbPayload = mapEquipmentToDB(equipment as Equipment);
    delete (dbPayload as any).id;

    const { data, error } = await supabase
      .from('equipment')
      .insert(dbPayload)
      .select()
      .single();

    if (error) throw error;
    return mapEquipmentFromDB(data);
  },

  async updateEquipment(equipment: Equipment) {
    const { error } = await supabase
      .from('equipment')
      .update(mapEquipmentToDB(equipment))
      .eq('id', equipment.id);

    if (error) throw error;
  },

  async deleteEquipment(id: string) {
    const { error } = await supabase
      .from('equipment')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Daily Checks
  async fetchDailyChecks(organizationId: string): Promise<EquipmentDailyCheck[]> {
    const { data, error } = await supabase
      .from('equipment_daily_checks')
      .select('*')
      .eq('organization_id', organizationId);

    if (error) throw error;
    return (data || []).map(mapEquipmentDailyCheckFromDB);
  },

  async upsertDailyCheck(check: EquipmentDailyCheck) {
    const { error } = await supabase
      .from('equipment_daily_checks')
      .upsert(mapEquipmentDailyCheckToDB(check));

    if (error) throw error;
  }
};
