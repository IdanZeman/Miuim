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
    // console.log('[AuditService] fetchLogs filters:', filters);
    const {
        entityTypes = ['attendance', 'shift', 'shifts'],
        userId,
        personId,
        date,
        taskId,
        limit = 50,
        offset = 0
    } = filters;

    try {
        const { callBackend } = await import('./backendService');

        // Construct query parameters
        const queryParams: any = {
            limit,
            offset,
            orgId: Array.isArray(organizationId) ? organizationId[0] : organizationId // Backend handles single orgId for now, multi-org needs update if required
        };

        if (entityTypes && entityTypes.length > 0) queryParams.entityTypes = entityTypes;
        if (userId) queryParams.userId = userId;
        if (filters.entityId) queryParams.entityId = filters.entityId;
        if (filters.startDate) queryParams.startDate = filters.startDate;
        if (filters.endDate) queryParams.endDate = filters.endDate;
        if (filters.startDateTime) queryParams.startDate = filters.startDateTime; // Map to same param
        if (filters.endDateTime) queryParams.endDate = filters.endDateTime;

        // Note: Some complex filters (personId logic, metadata JSON search) are best handled by the specific RPC 'admin_fetch_audit_logs'
        // or by improving the backend endpoint.
        // For now, if we have specific filters that the simple endpoint doesn't support well, we might want to stick to the RPC.
        // The original code tried RPC first. Let's keep that pattern but replace the FALLBACK with the new endpoint.

        // 1. Try RPC First (as it handles complex JSONB filtering better currently)
        const startDate = filters.startDateTime || filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        try {
            const p_filters: any = {};
            if (filters.entityId) {
                p_filters.entity_id = filters.entityId;
                if (entityTypes && entityTypes.length > 0) p_filters.entity_types = entityTypes;
                if (userId) p_filters.user_id = userId;
            } else {
                if (entityTypes && entityTypes.length > 0) p_filters.entity_types = entityTypes;
                if (userId) p_filters.user_id = userId;
                if (date) p_filters.target_date = date;
                if (taskId) p_filters.task_id = taskId;
                if (filters.startTime) p_filters.start_time = filters.startTime;
            }

            if (filters.personId) {
                p_filters.person_id = filters.personId;
                const person = filters.people?.find(p => p.id === filters.personId);
                if (person) p_filters.person_name = person.name;
            }

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
            console.warn('[AuditService] RPC fetch failed, falling back to REST endpoint', rpcErr);
        }

        // 2. Fallback to new REST Endpoint (instead of direct DB)
        // This endpoint supports basic filtering.
        const data = await callBackend('/api/admin/audit-logs', 'GET', queryParams);
        return data?.data || [];

    } catch (err: any) {
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
