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

export interface LogFilters {
    entityTypes?: string[];
    userId?: string; // The user who performed the action
    personId?: string; // The person affected (in metadata or entity_id)
    date?: string; // Specific mission/target date (YYYY-MM-DD)
    createdDate?: string; // Specific edit date (YYYY-MM-DD)
    startDate?: string; // Start range for created_at (YYYY-MM-DD)
    endDate?: string; // End range for created_at (YYYY-MM-DD)
    startDateTime?: string; // Start range for created_at (ISO)
    endDateTime?: string; // End range for created_at (ISO)
    taskId?: string; // Specific task
    entityId?: string; // Specific entity ID (e.g. specific shift ID)
    startTime?: string; // Specific start time ISO string
    limit?: number;
    offset?: number;
    people?: import('@/types').Person[];
}

export const fetchAttendanceLogs = async (organizationId: string, limit: number = 50): Promise<AuditLog[]> => {
    return fetchLogs(organizationId, { entityTypes: ['attendance'], limit });
};

export const fetchSchedulingLogs = async (organizationId: string, limit: number = 50): Promise<AuditLog[]> => {
    return fetchLogs(organizationId, { entityTypes: ['shift'], limit });
};

export const fetchLogs = async (organizationId: string | string[], filters: LogFilters = {}): Promise<AuditLog[]> => {
    console.log('[AuditService] fetchLogs filters:', filters);
    const {
        entityTypes = ['attendance', 'shift'],
        userId,
        personId,
        date,
        taskId,
        limit = 50,
        offset = 0
    } = filters;

    try {
        let query = supabase
            .from('audit_logs')
            .select('*');

        if (Array.isArray(organizationId)) {
            query = query.in('organization_id', organizationId);
        } else {
            query = query.eq('organization_id', organizationId);
        }

        // Filter by Entity Types
        if (entityTypes && entityTypes.length > 0) {
            query = query.in('entity_type', entityTypes);
        }

        // Filter by Actor
        if (userId) {
            query = query.eq('user_id', userId);
        }

        // Filter by Mission/Target Date
        if (date) {
            // Support legacy logs that might use 'startTime' instead of 'date' key,
            // or have it stored in different ways.
            query = query.or(`metadata->>date.eq.${date},metadata->>startTime.ilike.${date}%`);
        }

        // Filter by Mission Date Range (for attendance logs)
        // We include logs where the date matches OR where metadata->>date is null
        // (to catch system/bulk logs that don't have the date set yet)
        if (filters.startDate) {
            query = query.or(`metadata->>date.gte.${filters.startDate},metadata->>date.is.null`);
        }
        if (filters.endDate) {
            query = query.or(`metadata->>date.lte.${filters.endDate},metadata->>date.is.null`);
        }

        // Filter by Date-Time Range (ISO strings - keeping for internal use)
        if (filters.startDateTime) {
            query = query.gte('created_at', filters.startDateTime);
        }
        if (filters.endDateTime) {
            query = query.lte('created_at', filters.endDateTime);
        }

        // Filter by Task
        if (taskId) {
            // Support both camelCase and snake_case in metadata
            query = query.or(`metadata->>taskId.eq.${taskId},metadata->>task_id.eq.${taskId}`);
        }

        // Filter by Entity ID
        if (filters.entityId) {
            query = query.eq('entity_id', filters.entityId);
        }

        // Filter by Start Time
        if (filters.startTime) {
            query = query.eq('metadata->>startTime', filters.startTime);
        }

        // Filter by Person
        if (filters.personId) {
            const pId = filters.personId;
            let orQuery = `entity_id.eq.${pId},metadata->>personId.eq.${pId}`;
            
            // If we have access to the people array
            const person = filters.people?.find(p => p.id === pId);
            if (person) {
                orQuery += `,action_description.ilike.%${person.name}%`;
            }
            
            query = query.or(orQuery);
        }

        query = query
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        const { data, error } = await query;

        if (error) throw error;
        return data || [];
    } catch (err: any) {
        // Fallback: If the complex OR query fails (likely due to JSONB filtering on large table),
        // try a simpler query matching only entity_id if personId was requested.
        if (filters.personId && (err.code === '500' || err.status === 500)) {
             console.warn('[AuditService] Complex query failed (500). Retrying with simple entity_id filter...');
             try {
                // Simplified query reconstruction
                let retryQuery = supabase
                    .from('audit_logs')
                    .select('*')
                    .eq('organization_id', organizationId)
                    .eq('entity_id', filters.personId) // Only match direct entity_id
                    .order('created_at', { ascending: false })
                    .range(offset, offset + limit - 1);
                
                if (entityTypes && entityTypes.length > 0) {
                     retryQuery = retryQuery.in('entity_type', entityTypes);
                }
                
                const { data: retryData, error: retryError } = await retryQuery;
                if (!retryError) return retryData || [];
             } catch (retryErr) {
                 console.error('[AuditService] Retry failed as well.', retryErr);
             }
        }

        logger.error('ERROR', 'Failed to fetch audit logs', err);
        return [];
    }
};

export const fetchBattalionLogs = async (companyIds: string[], filters: LogFilters = {}): Promise<AuditLog[]> => {
    return fetchLogs(companyIds, filters);
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
                filter: Array.isArray(organizationId) 
                    ? undefined // Realtime filter doesn't support 'in' easily via string filter, clientside filtering needed
                    : `organization_id=eq.${organizationId}`
            },
            (payload) => {
                if (Array.isArray(organizationId) && !organizationId.includes(payload.new.organization_id)) {
                    return;
                }
                if (entityTypeFilter.includes(payload.new.entity_type)) {
                    callback(payload.new);
                }
            }
        )
        .subscribe((status) => {
            // console.log('📡 Audit Service: Subscription status:', status);
        });
};
