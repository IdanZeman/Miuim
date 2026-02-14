import { supabase } from '../lib/supabase';
import { callBackend } from './backendService';

const callAdminRpc = (rpcName: string, params?: any) => callBackend('/api/admin/rpc', 'POST', { rpcName, params });

export interface AnalyticsSummary {
  active_people: number;
  deletions_30d: number;
  snapshots_30d: number;
  restores_30d: number;
  last_nightly_status: 'success' | 'failed' | 'pending' | null;
  avg_latency_ms: number;
  health_score: number;
}

export interface ActivityEvent {
  event_type: 'deletion' | 'create' | 'restore' | 'delete' | 'system';
  event_name: string;
  user_name: string;
  occurred_at: string;
  status: string;
  metadata: any;
}

export interface UserStats {
  user_id: string;
  full_name: string;
  email: string;
  org_name: string;
  activity_count: number;
}

export interface NewUser {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
  org_name: string;
}

export interface NewOrg {
  id: string;
  name: string;
  created_at: string;
}

export const adminService = {
  async fetchAnalyticsSummary(organizationId: string): Promise<AnalyticsSummary> {
    const data = await callAdminRpc('get_org_analytics_summary', {
      p_org_id: organizationId
    });

    return data as AnalyticsSummary;
  },

  async fetchRecentActivity(organizationId: string, limit: number = 20): Promise<ActivityEvent[]> {
    const data = await callAdminRpc('get_recent_system_activity', {
      p_org_id: organizationId,
      p_limit: limit
    });

    return data as ActivityEvent[];
  },

  async getSystemActivityChart(timeRange: string) {
    return await callAdminRpc('get_system_activity_chart', { time_range: timeRange });
  },

  async getGlobalStatsAggregated(timeRange: string) {
    return await callAdminRpc('get_global_stats_aggregated', { time_range: timeRange });
  },

  async getTopOrganizations(timeRange: string, limit: number = 100) {
    return await callAdminRpc('get_top_organizations', { time_range: timeRange, limit_count: limit });
  },

  async getSystemUsersChart(timeRange: string) {
    return await callAdminRpc('get_system_users_chart', { time_range: timeRange });
  },

  async getSystemOrgsChart(timeRange: string) {
    return await callAdminRpc('get_system_orgs_chart', { time_range: timeRange });
  },

  async getOrgTopUsers(timeRange: string, limit: number) {
    return await callAdminRpc('get_org_top_users', { time_range: timeRange, limit_count: limit });
  },

  async getOrgTopPages(timeRange: string, limit: number) {
    return await callAdminRpc('get_org_top_pages', { time_range: timeRange, limit_count: limit });
  },

  async getOrgTopActions(timeRange: string, limit: number) {
    return await callAdminRpc('get_org_top_actions', { time_range: timeRange, limit_count: limit });
  },

  async getOrgActivityGraph(timeRange: string) {
    return await callAdminRpc('get_org_activity_graph', { time_range: timeRange });
  },

  async getDashboardKPIs() {
    return await callAdminRpc('get_dashboard_kpis');
  },

  async getNewOrgsStats(limit: number) {
    return await callAdminRpc('get_new_orgs_stats', { limit_count: limit });
  },

  async getTopUsers(timeRange: string, limit: number) {
    return await callAdminRpc('get_top_users', { time_range: timeRange, limit_count: limit });
  },

  async fetchSuperAdmins(emails: string[]) {
    return await callAdminRpc('check_super_admins', {
      p_emails: emails
    });
  },

  async fetchAuditLogs(startDate: string, limit: number = 2000) {
    const data = await callAdminRpc('admin_fetch_audit_logs', {
      p_start_date: startDate,
      p_limit: limit
    });

    return data || [];
  },

  async getNewOrgsList(timeRange: string, limit: number = 100) {
    const data = await callAdminRpc('get_new_orgs_list', {
      time_range: timeRange,
      limit_count: limit
    });

    return data as NewOrg[];
  },

  async getNewUsersList(timeRange: string, limit: number = 100) {
    const data = await callAdminRpc('get_new_users_list', {
      time_range: timeRange,
      limit_count: limit
    });

    return data as NewUser[];
  },

  async getActiveUsersStats(timeRange: string, limit: number = 100) {
    const data = await callAdminRpc('get_active_users_stats', {
      time_range: timeRange,
      limit_count: limit
    });

    return data as UserStats[];
  },

  async fetchAllProfiles() {
    const data = await callAdminRpc('admin_fetch_all_profiles');
    return data || [];
  },

  async fetchAllOrganizations() {
    const data = await callAdminRpc('admin_fetch_all_organizations');
    return data || [];
  },

  async fetchAllTeams() {
    const data = await callAdminRpc('admin_fetch_all_teams');
    return data || [];
  },

  async fetchAllPermissionTemplates() {
    const data = await callAdminRpc('admin_fetch_all_permission_templates');
    return data || [];
  },

  async updateProfile(userId: string, updates: any) {
    const data = await callAdminRpc('admin_update_profile', {
      p_user_id: userId,
      p_updates: updates
    });

    if (!data?.data) {
      throw new Error('Profile update blocked or no rows updated');
    }

    return data.data;
  },

  async updateUserLink(userId: string, personId: string | null) {
    await callAdminRpc('admin_update_user_link', {
      p_user_id: userId,
      p_person_id: personId
    });
  },

  async fetchOrganizationSettings(organizationId: string) {
    const data = await callAdminRpc('get_organization_settings', {
      p_org_id: organizationId
    });

    return data && data.length > 0 ? data[0] : null;
  },

  async upsertOrganizationSettings(settings: any) {
    await callAdminRpc('update_organization_settings_v3', {
      p_data: settings
    });
  },

  async fetchPermissionTemplates(organizationId: string) {
    return await callAdminRpc('get_permission_templates', {
      p_org_id: organizationId
    });
  },

  async deletePermissionTemplate(organizationId: string, id: string) {
    await callAdminRpc('delete_permission_template_v2', {
      p_template_id: id,
      p_organization_id: organizationId
    });
  },

  async savePermissionTemplate(templateId: string | null, payload: any) {
    await callAdminRpc('update_permission_template_v2', {
      p_template_id: templateId,
      p_organization_id: payload.organization_id,
      p_name: payload.name,
      p_permissions: payload.permissions
    });
  },

  async fetchMembers(organizationId: string) {
    return await callAdminRpc('get_org_members', {
      p_org_id: organizationId
    });
  },

  async fetchInvites(organizationId: string) {
    return await callAdminRpc('get_org_invites', {
      p_org_id: organizationId
    });
  },

  async generateInviteToken() {
    return await callAdminRpc('generate_invite_token');
  },

  async updateOrganizationInviteConfig(organizationId: string, updates: any) {
    await callAdminRpc('update_org_invite_config', {
      p_is_active: updates.is_invite_link_active,
      p_role: updates.invite_link_role,
      p_template_id: updates.invite_link_template_id,
      p_regenerate_token: updates.regenerate_token || false
    });
  },

  async fetchRoles(organizationId: string) {
    return await callAdminRpc('get_org_roles', {
      p_org_id: organizationId
    });
  },

  async fetchPeople(organizationId: string) {
    return await callAdminRpc('get_org_people', {
      p_org_id: organizationId
    });
  },

  async fetchTeamsByOrg(organizationId: string) {
    return await callAdminRpc('get_org_teams', {
      p_org_id: organizationId
    });
  },

  async fetchOrganizationOverview(organizationId: string) {
    const data = await callAdminRpc('get_organization_overview', {
      p_org_id: organizationId
    });

    // Data comes back as a single object with keys
    const result = data as any;

    return {
      people: result.people || [],
      teams: result.teams || [],
      presence: result.presence || [],
      absences: result.absences || [],
      rotations: result.rotations || [],
      blockages: result.blockages || []
    };
  },

  async insertAttendanceSnapshots(records: any[]) {
    // Chunking for large inserts
    for (let i = 0; i < records.length; i += 1000) {
      const chunk = records.slice(i, i + 1000);
      await callAdminRpc('bulk_insert_attendance_snapshots', {
        p_records: chunk
      });
    }
  },

  async joinBattalion(code: string, organizationId: string) {
    const data = await callAdminRpc('join_battalion', {
      p_code: code,
      p_organization_id: organizationId
    });

    return data?.battalion_id;
  },

  async fetchBattalion(battalionId: string) {
    const { data, error } = await supabase
      .from('battalions')
      .select('*')
      .eq('id', battalionId)
      .single();

    if (error) throw error;
    return data;
  },

  async unlinkBattalion(organizationId: string) {
    await callAdminRpc('unlink_battalion_admin', {
      p_organization_id: organizationId
    });
  },

  async fetchAllBattalions() {
    const data = await callAdminRpc('admin_fetch_all_battalions');

    return data || [];
  },

  async updateBattalion(battalionId: string, updates: any) {
    console.log('📡 [adminService] updateBattalion - battalionId:', battalionId, 'updates:', updates);
    const data = await callAdminRpc('admin_update_battalion', {
      p_battalion_id: battalionId,
      p_updates: updates
    });

    console.log('✅ [adminService] updateBattalion Success. Updated data:', data?.data);
  }
};
