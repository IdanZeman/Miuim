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
        entityTypes = ['attendance', 'shift', 'shifts'],
        userId,
        personId,
        date,
        taskId,
        limit = 50,
        offset = 0
    } = filters;

    // Use RPC if possible for general fetch to bypass RLS issues
    if (Object.keys(filters).length === 2 && filters.limit && Object.keys(filters).includes('startDateTime')) {
        // This matches the "full fetch" pattern usually
    }

    try {
        // ALWAYS TRY RPC FIRST TO BYPASS RLS
        // The RPC 'admin_fetch_audit_logs' now supports p_filters to handle all logic securely server-side.

        const startDate = filters.startDateTime || filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        try {
            const { callBackend } = await import('./backendService');

            // Map client filters to RPC p_filters
            const p_filters: any = {};

            // IF we have a specific entity ID, that's the strongest signal. Use it and relax other filters.
            if (filters.entityId) {
                p_filters.entity_id = filters.entityId;
                // We keep entity_types as it helps optimize or filter if ID is ambiguous (unlikely)
                if (entityTypes && entityTypes.length > 0) p_filters.entity_types = entityTypes;
                // We DO NOT send date, taskId, startTime as they might mismatch metadata vs reality

                // We might still want userId if we are looking for "User X's actions on Entity Y"
                if (userId) p_filters.user_id = userId;
            } else {
                // Standard filtering
                if (entityTypes && entityTypes.length > 0) p_filters.entity_types = entityTypes;
                if (userId) p_filters.user_id = userId;
                if (date) p_filters.target_date = date;
                if (taskId) p_filters.task_id = taskId;
                if (filters.startTime) p_filters.start_time = filters.startTime;
            }

            // Person filter is special, can be orthogonal to entityId (e.g. history of Person X on Shift Y?)
            // Usually personId IS the entityId for person history.
            if (filters.personId) {
                p_filters.person_id = filters.personId;
                const person = filters.people?.find(p => p.id === filters.personId);
                if (person) {
                    p_filters.person_name = person.name;
                }
            }

            console.log('[AuditService] Calling admin_fetch_audit_logs with params:', { p_start_date: startDate, p_limit: limit, p_filters });

            const result = await callBackend('/api/admin/rpc', 'POST', {
                rpcName: 'admin_fetch_audit_logs',
                params: {
                    p_start_date: startDate,
                    p_limit: limit,
                    p_filters: p_filters
                }
            });

            if (Array.isArray(result)) {
                return result as AuditLog[];
            }
        } catch (rpcErr) {
            console.warn('[AuditService] RPC fetch failed, falling back to direct query', rpcErr);
        }

        // --- FALLBACK (Only executes if RPC fails completely) ---
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
            query = query.or(`metadata->>date.eq.${date},metadata->>startTime.ilike.${date}%,after_data->>date.eq.${date}`);
        }

        // Filter by Mission Date Range
        if (filters.startDate) {
            query = query.or(`metadata->>date.gte.${filters.startDate},metadata->>date.is.null`);
        }
        if (filters.endDate) {
            query = query.or(`metadata->>date.lte.${filters.endDate},metadata->>date.is.null`);
        }

        // Filter by Date-Time Range
        if (filters.startDateTime) {
            query = query.gte('created_at', filters.startDateTime);
        }
        if (filters.endDateTime) {
            query = query.lte('created_at', filters.endDateTime);
        }

        // Filter by Task
        if (taskId) {
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
            const person = filters.people?.find(p => p.id === pId);
            if (person) {
                // Warning: ilike on action_description might be slow
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
        // Fallback for 500 errors (JSONB filtering issues)
        if (filters.personId && (err.code === '500' || err.status === 500)) {
            console.warn('[AuditService] Complex query failed (500). Retrying with simple entity_id filter...');
            try {
                let retryQuery = supabase
                    .from('audit_logs')
                    .select('*')
                    .eq('organization_id', organizationId)
                    .eq('entity_id', filters.personId)
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
