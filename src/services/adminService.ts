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
    const { data, error } = await supabase
      .from('profiles')
      .select('email')
      .in('email', emails)
      .eq('is_super_admin', true);
    
    if (error) throw error;
    return data;
  },

  async fetchAuditLogs(startDate: string, limit: number = 2000) {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('created_at, user_id, organization_id, metadata, city, country, device_type')
      .gte('created_at', startDate)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
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
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async fetchAllOrganizations() {
    const { data, error } = await supabase.from('organizations').select('*');
    if (error) throw error;
    return data;
  },

  async fetchAllTeams() {
    const { data, error } = await supabase.from('teams').select('*');
    if (error) throw error;
    return data;
  },

  async fetchAllPermissionTemplates() {
    const { data, error } = await supabase.from('permission_templates').select('*');
    if (error) throw error;
    return data;
  },

  async updateProfile(userId: string, updates: any) {
    console.log('📡 [adminService] updateProfile - userId:', userId, 'updates:', updates);
    const { data, error } = await supabase.from('profiles').update(updates).eq('id', userId).select();
    
    if (error) {
      console.error('❌ [adminService] updateProfile Error:', error);
      throw error;
    }
    
    console.log('✅ [adminService] updateProfile Success. Updated data:', data);
  },

  async updateUserLink(userId: string, personId: string | null) {
    // 1. Unlink everyone currently linked to this user
    const { error: unlinkError } = await supabase
      .from('people')
      .update({ user_id: null })
      .eq('user_id', userId);

    if (unlinkError) throw unlinkError;

    // 2. If a person is selected, link them
    if (personId) {
      const { error: linkError } = await supabase
        .from('people')
        .update({ user_id: userId })
        .eq('id', personId);

      if (linkError) throw linkError;
    }
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
    const { error } = await supabase
      .from('organization_settings')
      .upsert(settings);

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

  async deletePermissionTemplate(id: string) {
    const { error } = await supabase
      .from('permission_templates')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async savePermissionTemplate(templateId: string | null, payload: any) {
    if (templateId) {
      const { error } = await supabase
        .from('permission_templates')
        .update(payload)
        .eq('id', templateId);
      if (error) throw error;

      // Update all users linked to this template
      const { error: updateUsersError } = await supabase
        .from('profiles')
        .update({ permissions: payload.permissions })
        .eq('permission_template_id', templateId);

      if (updateUsersError) throw updateUsersError;
    } else {
      const { error } = await supabase
        .from('permission_templates')
        .insert(payload);
      if (error) throw error;
    }
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
    const { data, error } = await supabase
      .from('battalions')
      .select('*')
      .order('name', { ascending: true });
    
    if (error) throw error;
    return data;
  },

  async updateBattalion(battalionId: string, updates: any) {
    console.log('📡 [adminService] updateBattalion - battalionId:', battalionId, 'updates:', updates);
    const { data, error } = await supabase
      .from('battalions')
      .update(updates)
      .eq('id', battalionId)
      .select();
    
    if (error) {
      console.error('❌ [adminService] updateBattalion Error:', error);
      throw error;
    }
    
    console.log('✅ [adminService] updateBattalion Success. Updated data:', data);
  }
};
