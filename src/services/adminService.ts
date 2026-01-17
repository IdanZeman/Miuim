import { supabase } from '../lib/supabase';

export interface AnalyticsSummary {
  deletions_30d: number;
  snapshots_30d: number;
  restores_30d: number;
  last_nightly_status: 'success' | 'failed' | 'started' | 'in_progress' | null;
  active_people: number;
}

export interface ActivityEvent {
  event_type: 'deletion' | 'create' | 'restore' | 'delete';
  event_name: string;
  user_name: string;
  occurred_at: string;
  status: string;
  metadata: any;
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
  }
};
