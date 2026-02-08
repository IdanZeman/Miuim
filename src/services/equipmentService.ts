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

    // Use RPC for equipment creation with validation and audit logging
    const { data, error } = await supabase
      .rpc('upsert_equipment', {
        p_equipment: dbPayload
      });

    if (error) throw error;
    return mapEquipmentFromDB(data);
  },

  async updateEquipment(equipment: Equipment) {
    // Use RPC for equipment update with validation and audit logging
    const { error } = await supabase
      .rpc('upsert_equipment', {
        p_equipment: mapEquipmentToDB(equipment)
      });

    if (error) throw error;
  },

  async deleteEquipment(id: string) {
    // Use RPC for secure equipment deletion with audit logging
    const { error } = await supabase
      .rpc('delete_equipment_secure', {
        p_equipment_id: id
      });

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
    // Use RPC for equipment daily check with validation and audit logging
    const { error } = await supabase
      .rpc('upsert_equipment_daily_check', {
        p_check: mapEquipmentDailyCheckToDB(check)
      });

    if (error) throw error;
  }
};
