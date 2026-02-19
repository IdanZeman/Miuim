import { CarpoolRide } from '../types';
import { mapCarpoolRideFromDB, mapCarpoolRideToDB } from './mappers';
import { callBackend } from './backendService';

export const carpoolService = {
  async fetchRides(organizationId: string, minDate?: string): Promise<CarpoolRide[]> {
    const data = await callBackend('/api/carpool', 'GET', { orgId: organizationId, minDate });
    return (data || []).map(mapCarpoolRideFromDB);
  },

  async addRide(ride: Omit<CarpoolRide, 'id' | 'created_at'>) {
    const dbPayload = mapCarpoolRideToDB(ride as any);
    delete (dbPayload as any).id;
    delete (dbPayload as any).created_at;

    const data = await callBackend('/api/carpool', 'POST', dbPayload);
    return mapCarpoolRideFromDB(data);
  },

  async deleteRide(id: string) {
    await callBackend(`/api/carpool/${id}`, 'DELETE');
  },
};
