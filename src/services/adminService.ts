import { supabase } from '../lib/supabase';

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
    const { data, error } = await supabase.rpc('get_org_analytics_summary', {
      p_org_id: organizationId
    });

    if (error) throw error;
    return data as AnalyticsSummary;
  },

  async fetchRecentActivity(organizationId: string, limit: number = 20): Promise<ActivityEvent[]> {
    const { data, error } = await supabase.rpc('get_recent_system_activity', {
      p_org_id: organizationId,
      p_limit: limit
    });

    if (error) throw error;
    return data as ActivityEvent[];
  },

  async getSystemActivityChart(timeRange: string) {
    const { data, error } = await supabase.rpc('get_system_activity_chart', { time_range: timeRange });
    if (error) throw error;
    return data;
  },

  async getGlobalStatsAggregated(timeRange: string) {
    const { data, error } = await supabase.rpc('get_global_stats_aggregated', { time_range: timeRange });
    if (error) throw error;
    return data;
  },

  async getTopOrganizations(timeRange: string, limit: number = 100) {
    const { data, error } = await supabase.rpc('get_top_organizations', { time_range: timeRange, limit_count: limit });
    if (error) throw error;
    return data;
  },

  async getSystemUsersChart(timeRange: string) {
    const { data, error } = await supabase.rpc('get_system_users_chart', { time_range: timeRange });
    if (error) throw error;
    return data;
  },

  async getSystemOrgsChart(timeRange: string) {
    const { data, error } = await supabase.rpc('get_system_orgs_chart', { time_range: timeRange });
    if (error) throw error;
    return data;
  },

  async getOrgTopUsers(timeRange: string, limit: number) {
    const { data, error } = await supabase.rpc('get_org_top_users', { time_range: timeRange, limit_count: limit });
    if (error) throw error;
    return data;
  },

  async getOrgTopPages(timeRange: string, limit: number) {
    const { data, error } = await supabase.rpc('get_org_top_pages', { time_range: timeRange, limit_count: limit });
    if (error) throw error;
    return data;
  },

  async getOrgTopActions(timeRange: string, limit: number) {
    const { data, error } = await supabase.rpc('get_org_top_actions', { time_range: timeRange, limit_count: limit });
    if (error) throw error;
    return data;
  },

  async getOrgActivityGraph(timeRange: string) {
    const { data, error } = await supabase.rpc('get_org_activity_graph', { time_range: timeRange });
    if (error) throw error;
    return data;
  },

  async getDashboardKPIs() {
    const { data, error } = await supabase.rpc('get_dashboard_kpis');
    if (error) throw error;
    return data;
  },

  async getNewOrgsStats(limit: number) {
    const { data, error } = await supabase.rpc('get_new_orgs_stats', { limit_count: limit });
    if (error) throw error;
    return data;
  },

  async getTopUsers(timeRange: string, limit: number) {
    const { data, error } = await supabase.rpc('get_top_users', { time_range: timeRange, limit_count: limit });
    if (error) throw error;
    return data;
  },

  async fetchSuperAdmins(emails: string[]) {
    // Note: This function still uses direct read as it's checking specific emails
    // Converting to RPC would require passing emails array and filtering in SQL
    const { data, error } = await supabase
      .from('profiles')
      .select('email')
      .in('email', emails)
      .eq('is_super_admin', true);
    
    if (error) throw error;
    return data;
  },

  async fetchAuditLogs(startDate: string, limit: number = 2000) {
    const { data, error } = await supabase.rpc('admin_fetch_audit_logs', {
      p_start_date: startDate,
      p_limit: limit
    });

    if (error) throw error;
    return data || [];
  },

  async getNewOrgsList(timeRange: string, limit: number = 100) {
    const { data, error } = await supabase.rpc('get_new_orgs_list', {
      time_range: timeRange,
      limit_count: limit
    });

    if (error) throw error;
    return data as NewOrg[];
  },

  async getNewUsersList(timeRange: string, limit: number = 100) {
    const { data, error } = await supabase.rpc('get_new_users_list', {
      time_range: timeRange,
      limit_count: limit
    });

    if (error) throw error;
    return data as NewUser[];
  },

  async getActiveUsersStats(timeRange: string, limit: number = 100) {
    const { data, error } = await supabase.rpc('get_active_users_stats', {
      time_range: timeRange,
      limit_count: limit
    });

    if (error) throw error;
    return data as UserStats[];
  },

  async fetchAllProfiles() {
    const { data, error } = await supabase.rpc('admin_fetch_all_profiles');
    if (error) throw error;
    return data || [];
  },

  async fetchAllOrganizations() {
    const { data, error } = await supabase.rpc('admin_fetch_all_organizations');
    if (error) throw error;
    return data || [];
  },

  async fetchAllTeams() {
    const { data, error } = await supabase.rpc('admin_fetch_all_teams');
    if (error) throw error;
    return data || [];
  },

  async fetchAllPermissionTemplates() {
    const { data, error } = await supabase.rpc('admin_fetch_all_permission_templates');
    if (error) throw error;
    return data || [];
  },

  async updateProfile(userId: string, updates: any) {

    const { data, error } = await supabase.rpc('admin_update_profile', {
      p_user_id: userId,
      p_updates: updates
    });

    if (error) {
      console.error('❌ [adminService] updateProfile Error:', error);
      throw error;
    }

    if (!data?.data) {
      const noRowsError = new Error('Profile update blocked or no rows updated');
      console.error('❌ [adminService] updateProfile No rows updated.');
      throw noRowsError;
    }


    return data.data;
  },

  async updateUserLink(userId: string, personId: string | null) {
    const { error } = await supabase.rpc('admin_update_user_link', {
      p_user_id: userId,
      p_person_id: personId
    });

    if (error) throw error;
  },

  async fetchOrganizationSettings(organizationId: string) {
    const { data, error } = await supabase
      .from('organization_settings')
      .select('*')
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (error && error.code !== '406' && error.code !== 'PGRST116') throw error;
    return data;
  },

  async upsertOrganizationSettings(settings: any) {
    const { error } = await supabase.rpc('update_organization_settings_v3', {
      p_data: settings
    });

    if (error) throw error;
  },

  async fetchPermissionTemplates(organizationId: string) {
    const { data, error } = await supabase
      .from('permission_templates')
      .select('*')
      .eq('organization_id', organizationId);

    if (error) throw error;
    return data;
  },

  async deletePermissionTemplate(organizationId: string, id: string) {
    const { error } = await supabase.rpc('delete_permission_template_v2', {
      p_template_id: id,
      p_organization_id: organizationId
    });

    if (error) throw error;
  },

  async savePermissionTemplate(templateId: string | null, payload: any) {
    const { error } = await supabase.rpc('update_permission_template_v2', {
      p_template_id: templateId,
      p_organization_id: payload.organization_id,
      p_name: payload.name,
      p_permissions: payload.permissions
    });

    if (error) throw error;
  },

  async fetchMembers(organizationId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('organization_id', organizationId)
      .order('full_name', { ascending: true });

    if (error) throw error;
    return data;
  },

  async fetchInvites(organizationId: string) {
    const { data, error } = await supabase
      .from('organization_invites')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('accepted', false)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async generateInviteToken() {
    const { data, error } = await supabase.rpc('generate_invite_token');
    if (error) throw error;
    return data;
  },

  async updateOrganizationInviteConfig(organizationId: string, updates: any) {
    const { error } = await supabase
      .from('organizations')
      .update(updates)
      .eq('id', organizationId);
    if (error) throw error;
  },

  async fetchRoles(organizationId: string) {
    const { data, error } = await supabase
      .from('roles')
      .select('*')
      .eq('organization_id', organizationId);
    if (error) throw error;
    return data;
  },

  async fetchPeople(organizationId: string) {
    const { data, error } = await supabase
      .from('people')
      .select('*')
      .eq('organization_id', organizationId);
    if (error) throw error;
    return data;
  },

  async fetchTeamsByOrg(organizationId: string) {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('organization_id', organizationId);
    if (error) throw error;
    return data;
  },

  async fetchOrganizationOverview(organizationId: string) {
    const [people, teams, presence, absences, rotations, blockages] = await Promise.all([
      supabase.from('people').select('*').eq('organization_id', organizationId),
      supabase.from('teams').select('*').eq('organization_id', organizationId),
      supabase.from('daily_presence').select('*').eq('organization_id', organizationId),
      supabase.from('absences').select('*').eq('organization_id', organizationId),
      supabase.from('team_rotations').select('*').eq('organization_id', organizationId),
      supabase.from('hourly_blockages').select('*').eq('organization_id', organizationId)
    ]);

    return {
      people: people.data || [],
      teams: teams.data || [],
      presence: presence.data || [],
      absences: absences.data || [],
      rotations: rotations.data || [],
      blockages: blockages.data || []
    };
  },

  async insertAttendanceSnapshots(records: any[]) {
    // Chunking for large inserts
    for (let i = 0; i < records.length; i += 1000) {
      const chunk = records.slice(i, i + 1000);
      const { error } = await supabase
        .from('daily_attendance_snapshots')
        .insert(chunk);
      if (error) throw error;
    }
  },

  async joinBattalion(code: string, organizationId: string) {
    const { data: battalion, error: findError } = await supabase
      .from('battalions')
      .select('id')
      .eq('code', code)
      .single();

    if (findError) throw new Error('Invalid battalion code');

    const { error: linkError } = await supabase
      .from('organizations')
      .update({ battalion_id: battalion.id })
      .eq('id', organizationId);

    if (linkError) throw linkError;
    return battalion.id;
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
    const { error } = await supabase
      .from('organizations')
      .update({ battalion_id: null, is_hq: false })
      .eq('id', organizationId);

    if (error) throw error;
  },

  async fetchAllBattalions() {
    const { data, error } = await supabase.rpc('admin_fetch_all_battalions');
    
    if (error) throw error;
    return data || [];
  },

  async updateBattalion(battalionId: string, updates: any) {
    console.log('📡 [adminService] updateBattalion - battalionId:', battalionId, 'updates:', updates);
    const { data, error } = await supabase.rpc('admin_update_battalion', {
      p_battalion_id: battalionId,
      p_updates: updates
    });
    
    if (error) {
      console.error('❌ [adminService] updateBattalion Error:', error);
      throw error;
    }
    
    console.log('✅ [adminService] updateBattalion Success. Updated data:', data?.data);
  }
};
