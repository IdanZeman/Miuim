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
    const { error } = await supabase.from('gate_logs').insert([payload]);
    if (error) throw error;
  },

  async registerExit(logId: string, profileId: string, exitTime: string) {
    const { error } = await supabase
        .from('gate_logs')
        .update({
            status: 'left',
            exit_time: exitTime,
            exit_reported_by: profileId,
        })
        .eq('id', logId);

    if (error) throw error;
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
    const { data, error } = await supabase
        .from('gate_authorized_vehicles')
        .insert([vehicle])
        .select('*, organizations(name, battalion_id)')
        .single();

    if (error) throw error;
    return data;
  },

  async updateAuthorizedVehicle(vehicleId: string, vehicle: Partial<AuthorizedVehicle>) {
    const { data, error } = await supabase
        .from('gate_authorized_vehicles')
        .update(vehicle)
        .eq('id', vehicleId)
        .select('*, organizations(name, battalion_id)')
        .single();

    if (error) throw error;
    return data;
  },

  async deleteAuthorizedVehicle(vehicleId: string) {
    const { error } = await supabase
        .from('gate_authorized_vehicles')
        .delete()
        .eq('id', vehicleId);

    if (error) throw error;
  }
};
