import { supabase } from '../lib/supabase';
import { CarpoolRide } from '../types';
import { mapCarpoolRideFromDB, mapCarpoolRideToDB } from './mappers';

export const carpoolService = {
  async fetchRides(organizationId: string, minDate?: string): Promise<CarpoolRide[]> {
    let query = supabase
      .from('carpool_rides')
      .select('*')
      .eq('organization_id', organizationId);

    if (minDate) {
      query = query.gte('date', minDate);
    }

    const { data, error } = await query
      .order('date', { ascending: true })
      .order('time', { ascending: true });

    if (error) throw error;
    return (data || []).map(mapCarpoolRideFromDB);
  },

  async addRide(ride: Omit<CarpoolRide, 'id' | 'created_at'>) {
    const dbPayload = mapCarpoolRideToDB(ride as any);
    delete (dbPayload as any).id;
    delete (dbPayload as any).created_at;

    const { data, error } = await supabase
      .from('carpool_rides')
      .insert(dbPayload)
      .select()
      .single();

    if (error) throw error;
    return mapCarpoolRideFromDB(data);
  },

  async deleteRide(id: string) {
    const { error } = await supabase
      .from('carpool_rides')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};
