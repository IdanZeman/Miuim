import { supabase } from '../lib/supabase';
import { AuthorizedVehicle, GateLog } from '../hooks/useGateSystem';

export const gateService = {
  async fetchOrganizations(battalionId?: string) {
    let query = supabase.from('organizations').select('id, name');
    if (battalionId) {
      query = query.eq('battalion_id', battalionId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async fetchActiveLogs(orgIds: string[], organizationId: string, battalionId?: string) {
    let q = supabase
        .from('gate_logs')
        .select('*, organizations(name, battalion_id), entry_reporter:profiles!entry_reported_by(full_name), exit_reporter:profiles!exit_reported_by(full_name)')
        .eq('status', 'inside')
        .order('entry_time', { ascending: false });

    if (battalionId && orgIds.length > 0) {
        q = q.in('organization_id', orgIds);
    } else {
        q = q.eq('organization_id', organizationId);
    }
    
    const { data, error } = await q;
    if (error) throw error;
    return (data as any) || [];
  },

  async fetchAuthorizedVehicles(orgIds: string[], organizationId: string, battalionId?: string) {
    let q = supabase
        .from('gate_authorized_vehicles')
        .select('*, organizations(name, battalion_id)');

    if (battalionId && orgIds.length > 0) {
        q = q.in('organization_id', orgIds);
    } else {
        q = q.eq('organization_id', organizationId);
    }

    const { data, error } = await q;
    if (error) throw error;
    return (data as any) || [];
  },

  async fetchTeams(orgIds: string[]) {
    const { data, error } = await supabase
        .from('teams')
        .select('id, name, organization_id')
        .in('organization_id', orgIds);

    if (error) throw error;
    return data || [];
  },

  async searchPeople(query: string, organizationId: string, battalionId?: string) {
    let q = supabase
        .from('people')
        .select('id, name, phone, organization_id, team_id, organizations!inner(battalion_id)')
        .ilike('name', `%${query}%`)
        .limit(10);

    if (battalionId) {
        q = q.eq('organizations.battalion_id', battalionId);
    } else {
        q = q.eq('organization_id', organizationId);
    }

    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },

  async registerEntry(payload: any) {
    const { data, error } = await supabase.rpc('register_gate_entry', {
      p_organization_id: payload.organization_id,
      p_plate_number: payload.plate_number,
      p_driver_name: payload.driver_name,
      p_entry_time: payload.entry_time,
      p_entry_type: payload.entry_type || 'vehicle',
      p_is_exceptional: payload.is_exceptional || false,
      p_notes: payload.notes || null,
      p_battalion_id: payload.battalion_id || null
    });
    if (error) throw error;
    return data?.data;
  },

  async registerExit(logId: string, profileId: string, exitTime: string) {
    const { data, error } = await supabase.rpc('register_gate_exit', {
      p_log_id: logId,
      p_exit_time: exitTime
    });
    if (error) throw error;
    return data?.data;
  },

  async fetchGateHistory(filters: {
    search?: string;
    orgId?: string;
    battalionId?: string;
    organizationId?: string;
    startDate?: Date | null;
    endDate?: Date | null;
    limit?: number
  }) {
    let query = supabase
        .from('gate_logs')
        .select('*, organizations(name, battalion_id), entry_reporter:profiles!entry_reported_by(full_name), exit_reporter:profiles!exit_reported_by(full_name)')
        .order('entry_time', { ascending: false })
        .limit(filters.limit || 50);

    if (filters.battalionId) {
        query = query.eq('battalion_id', filters.battalionId);
    } else {
        query = query.eq('organization_id', filters.organizationId || '');
    }

    if (filters.orgId && filters.orgId !== 'all') {
        query = query.eq('organization_id', filters.orgId);
    }

    if (filters.search) {
        const term = filters.search;
        query = query.or(`plate_number.ilike.%${term}%,driver_name.ilike.%${term}%`);
    }

    if (filters.startDate) {
        query = query.gte('entry_time', filters.startDate.toISOString());
    }

    if (filters.endDate) {
        const endOfDay = new Date(filters.endDate);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte('entry_time', endOfDay.toISOString());
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as GateLog[];
  },

  async addAuthorizedVehicle(vehicle: any) {
    const { data, error } = await supabase.rpc('upsert_gate_authorized_vehicle', {
      p_id: null,
      p_organization_id: vehicle.organization_id,
      p_plate_number: vehicle.plate_number,
      p_owner_name: vehicle.owner_name,
      p_vehicle_type: vehicle.vehicle_type || null,
      p_is_permanent: vehicle.is_permanent || false,
      p_expiry_date: vehicle.expiry_date || null,
      p_valid_from: vehicle.valid_from || null,
      p_valid_until: vehicle.valid_until || null,
      p_notes: vehicle.notes || null,
      p_battalion_id: vehicle.battalion_id || null
    });

    if (error) throw error;
    return data?.data;
  },

  async updateAuthorizedVehicle(vehicleId: string, vehicle: Partial<AuthorizedVehicle>) {
    const { data, error } = await supabase.rpc('upsert_gate_authorized_vehicle', {
      p_id: vehicleId,
      p_organization_id: (vehicle as any).organization_id || null,
      p_plate_number: vehicle.plate_number || null,
      p_owner_name: vehicle.owner_name || null,
      p_vehicle_type: vehicle.vehicle_type || null,
      p_is_permanent: vehicle.is_permanent ?? null,
      p_expiry_date: (vehicle as any).expiry_date || null,
      p_valid_from: vehicle.valid_from || null,
      p_valid_until: vehicle.valid_until || null,
      p_notes: vehicle.notes || null,
      p_battalion_id: (vehicle as any).battalion_id || null
    });

    if (error) throw error;
    return data?.data;
  },

  async deleteAuthorizedVehicle(vehicleId: string) {
    const { data, error } = await supabase.rpc('delete_gate_authorized_vehicle_secure', {
      p_vehicle_id: vehicleId
    });

    if (error) throw error;
    return data;
  }
};
