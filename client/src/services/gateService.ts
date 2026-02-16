import { supabase } from '../lib/supabase';
import { AuthorizedVehicle, GateLog } from '../hooks/useGateSystem';
import { callBackend } from './backendService';

const callAdminRpc = (rpcName: string, params?: any) => callBackend('/api/admin/rpc', 'POST', { rpcName, params });

export const gateService = {
  async fetchOrganizations(battalionId?: string) {
    const data = await callBackend(`/api/gate/organizations${battalionId ? `?battalionId=${battalionId}` : ''}`, 'GET');
    return data || [];
  },

  async fetchActiveLogs(orgIds: string[], organizationId: string, battalionId?: string) {
    const data = await callAdminRpc('get_active_gate_logs', {
      p_org_ids: orgIds.length > 0 ? orgIds : null,
      p_organization_id: organizationId,
      p_battalion_id: battalionId || null
    });

    // Map RPC result to expected format if needed
    return (data || []).map((log: any) => ({
      ...log,
      organizations: {
        name: log.organization_name,
        battalion_id: log.organization_battalion_id
      },
      entry_reporter: log.entry_reporter_name ? { full_name: log.entry_reporter_name } : null,
      exit_reporter: log.exit_reporter_name ? { full_name: log.exit_reporter_name } : null
    }));
  },

  async fetchAuthorizedVehicles(orgIds: string[], organizationId: string, battalionId?: string) {
    const params = new URLSearchParams();
    if (battalionId && orgIds.length > 0) {
      params.append('battalionId', battalionId);
      params.append('orgIds', orgIds.join(','));
    } else {
      params.append('organizationId', organizationId);
    }

    const data = await callBackend(`/api/gate/vehicles?${params.toString()}`, 'GET');
    return data || [];
  },

  async fetchTeams(orgIds: string[]) {
    const data = await callBackend(`/api/personnel/teams?organizationId=${orgIds[0]}`, 'GET'); // Simplified for now
    // Actually our getTeams takes only one orgId. If orgIds has multiple, we might need a bulk endpoint.
    // But usually in gate it's just one or a few.
    return (data || []).filter((t: any) => orgIds.includes(t.organization_id));
  },

  async searchPeople(query: string, organizationId: string, battalionId?: string) {
    const data = await callAdminRpc('search_gate_people', {
      p_query: query,
      p_organization_id: organizationId,
      p_battalion_id: battalionId || null
    });

    return (data || []).map((p: any) => ({
      ...p,
      organizations: {
        battalion_id: p.organization_battalion_id
      }
    }));
  },

  async registerEntry(payload: any) {
    const data = await callAdminRpc('register_gate_entry', {
      p_organization_id: payload.organization_id,
      p_plate_number: payload.plate_number,
      p_driver_name: payload.driver_name,
      p_entry_time: payload.entry_time,
      p_entry_type: payload.entry_type || 'vehicle',
      p_is_exceptional: payload.is_exceptional || false,
      p_notes: payload.notes || null,
      p_battalion_id: payload.battalion_id || null
    });
    return (data as any)?.data;
  },

  async registerExit(logId: string, profileId: string, exitTime: string) {
    const data = await callAdminRpc('register_gate_exit', {
      p_log_id: logId,
      p_exit_time: exitTime
    });
    return (data as any)?.data;
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
    // Determine effective filters
    let targetOrgId = filters.organizationId;
    if (filters.orgId && filters.orgId !== 'all') {
      targetOrgId = filters.orgId;
    }

    const data = await callAdminRpc('get_gate_logs_v2', {
      p_organization_id: targetOrgId || null,
      p_battalion_id: filters.battalionId || null,
      p_search: filters.search || null,
      p_start_date: filters.startDate ? filters.startDate.toISOString() : null,
      p_end_date: filters.endDate ? new Date(new Date(filters.endDate).setHours(23, 59, 59, 999)).toISOString() : null,
      p_limit: filters.limit || 50,
      p_offset: 0,
      p_status: null
    });

    // Map RPC result to GateLog interface to maintain compatibility
    return (data || []).map((log: any) => ({
      id: log.id,
      organization_id: log.organization_id,
      plate_number: log.plate_number,
      driver_name: log.driver_name,
      entry_time: log.entry_time,
      exit_time: log.exit_time,
      status: log.status,
      notes: log.notes,
      entry_type: log.entry_type,
      is_exceptional: log.is_exceptional,
      entry_reported_by: log.entry_reported_by,
      exit_reported_by: log.exit_reported_by,
      organizations: {
        name: log.organization_name,
        battalion_id: log.organization_battalion_id
      },
      entry_reporter: log.entry_reporter_name ? { full_name: log.entry_reporter_name } : undefined,
      exit_reporter: log.exit_reporter_name ? { full_name: log.exit_reporter_name } : undefined
    })) as GateLog[];
  },

  async addAuthorizedVehicle(vehicle: any) {
    const data = await callAdminRpc('upsert_gate_authorized_vehicle', {
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

    return (data as any)?.data;
  },

  async updateAuthorizedVehicle(vehicleId: string, vehicle: Partial<AuthorizedVehicle>) {
    const data = await callAdminRpc('upsert_gate_authorized_vehicle', {
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

    return (data as any)?.data;
  },

  async deleteAuthorizedVehicle(vehicleId: string) {
    return await callAdminRpc('delete_gate_authorized_vehicle_secure', {
      p_vehicle_id: vehicleId
    });
  }
};
