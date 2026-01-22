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
    before_data: any;
    after_data: any;
    metadata: any;
    created_at: string;
}

export const fetchAttendanceLogs = async (organizationId: string, limit: number = 50): Promise<AuditLog[]> => {
    try {
        const { data, error } = await supabase
            .from('audit_logs')
            .select('*')
            .eq('organization_id', organizationId)
            .eq('entity_type', 'attendance')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        console.log(`🔍 Audit Service: Fetched ${data?.length || 0} logs for org ${organizationId}`);
        return data || [];
    } catch (err) {
        logger.error('ERROR', 'Failed to fetch attendance logs', err);
        return [];
    }
};

export const subscribeToAuditLogs = (organizationId: string, callback: (payload: any) => void) => {
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
                console.log('🔔 Audit Service: Real-time change detected', payload.new);
                if (payload.new.entity_type === 'attendance') {
                    callback(payload.new);
                }
            }
        )
        .subscribe((status) => {
            console.log('📡 Audit Service: Subscription status:', status);
        });
};
