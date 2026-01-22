import { supabase } from '../lib/supabase';
import { logger } from './loggingService';

export interface AuditLog {
    id: string;
    user_id: string;
    user_name: string;
    user_email: string;
    event_type: string;
    entity_type: string;
    entity_id: string;
    entity_name?: string;
    action_description: string;
    before_data?: any;
    after_data?: any;
    metadata?: any;
    created_at: string;
}

export const fetchAttendanceLogs = async (organizationId: string, limit: number = 50): Promise<AuditLog[]> => {
    return fetchLogs(organizationId, ['attendance'], limit);
};

export const fetchSchedulingLogs = async (organizationId: string, limit: number = 50): Promise<AuditLog[]> => {
    try {
        const { data, error } = await supabase
            .from('audit_logs')
            .select('id, created_at, user_id, user_email, user_name, entity_type, event_type, metadata, action_description, entity_id')
            .eq('organization_id', organizationId)
            .in('entity_type', ['shift'])
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    } catch (err) {
        logger.error('ERROR', 'Failed to fetch scheduling logs', err);
        return [];
    }
};

export const fetchLogs = async (organizationId: string, entityTypes: string[], limit: number = 50): Promise<AuditLog[]> => {
    try {
        const { data, error } = await supabase
            .from('audit_logs')
            .select('*')
            .eq('organization_id', organizationId)
            .in('entity_type', entityTypes)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        // console.log(`🔍 Audit Service: Fetched ${data?.length || 0} logs for org ${organizationId} types: ${entityTypes.join(', ')}`);
        return data || [];
    } catch (err) {
        logger.error('ERROR', 'Failed to fetch audit logs', err);
        return [];
    }
};

export const subscribeToAuditLogs = (organizationId: string, callback: (payload: any) => void, entityTypeFilter: string[] = ['attendance']) => {
    return supabase
        .channel('audit_logs_changes')
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'audit_logs',
                filter: `organization_id=eq.${organizationId}`
            },
            (payload) => {
                // console.log('🔔 Audit Service: Real-time change detected', payload.new);
                if (entityTypeFilter.includes(payload.new.entity_type)) {
                    callback(payload.new);
                }
            }
        )
        .subscribe((status) => {
            // console.log('📡 Audit Service: Subscription status:', status);
        });
};
