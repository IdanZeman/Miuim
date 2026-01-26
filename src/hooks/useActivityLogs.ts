import { useState, useEffect, useCallback, useRef } from 'react';
import { AuditLog, fetchLogs, LogFilters, subscribeToAuditLogs } from '../services/auditService';
import { logger } from '../services/loggingService';

interface UseActivityLogsProps {
    organizationId: string | string[] | undefined;
    entityTypes?: string[];
    initialFilters?: LogFilters;
}

export const useActivityLogs = ({ organizationId, entityTypes = ['attendance', 'shift'], initialFilters }: UseActivityLogsProps) => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [filters, setFilters] = useState<LogFilters>(initialFilters || {
        limit: 50,
        entityTypes: entityTypes
    });
    const [hasMore, setHasMore] = useState(true);

    // Sync internal filters with initialFilters if provided
    useEffect(() => {
        if (initialFilters) {
            setFilters(prev => {
                const hasChanged = 
                    prev.date !== initialFilters.date ||
                    prev.createdDate !== initialFilters.createdDate ||
                    prev.personId !== initialFilters.personId ||
                    prev.taskId !== initialFilters.taskId ||
                    prev.entityId !== initialFilters.entityId ||
                    prev.limit !== initialFilters.limit ||
                    JSON.stringify(prev.entityTypes) !== JSON.stringify(initialFilters.entityTypes);

                if (!hasChanged) return prev;
                
                // If changed, reset logs and loading state
                setLogs([]);
                setIsLoading(true);
                return initialFilters;
            });
        }
    }, [
        initialFilters?.date, 
        initialFilters?.createdDate, 
        initialFilters?.personId, 
        initialFilters?.taskId, 
        initialFilters?.entityId, 
        initialFilters?.limit,
        JSON.stringify(initialFilters?.entityTypes)
    ]);

    // Keep track of mounted state to avoid setting state on unmounted component
    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
        };
    }, []);

    const loadLogs = useCallback(async (isLoadMore = false) => {
        if (!organizationId || (Array.isArray(organizationId) && organizationId.length === 0)) {
            setIsLoading(false);
            return;
        }

        if (isLoadMore) {
            setIsLoadingMore(true);
        } else {
            setIsLoading(true);
            setLogs([]); // Clear logs for fresh load to avoid stale data flash
        }

        try {
            const offset = isLoadMore ? logs.length : 0;
            const currentLimit = filters.limit || 50;
            
            const newLogs = await fetchLogs(organizationId, {
                ...filters,
                offset
            });

            if (isMounted.current) {
                if (isLoadMore) {
                    setLogs(prev => [...prev, ...newLogs]);
                } else {
                    setLogs(newLogs);
                }

                // If we got fewer items than limit, we reached the end
                if (newLogs.length < currentLimit) {
                    setHasMore(false);
                } else {
                    setHasMore(true);
                }
            }
        } catch (error) {
            logger.error('ERROR', 'Failed to load logs', error);
        } finally {
            if (isMounted.current) {
                setIsLoading(false);
                setIsLoadingMore(false);
            }
        }
    }, [organizationId, filters, logs.length]);

    // Initial load and filter changes
    useEffect(() => {
        loadLogs(false);
    }, [
        Array.isArray(organizationId) ? organizationId.join(',') : organizationId, 
        filters.date, 
        filters.createdDate, 
        filters.personId, 
        filters.taskId, 
        filters.userId, 
        filters.entityTypes, 
        filters.entityId, 
        filters.startTime
    ]);

    // Safety timeout for loading state
    useEffect(() => {
        if (isLoading) {
            const timer = setTimeout(() => {
                setIsLoading(false);
            }, 6000);
            return () => clearTimeout(timer);
        }
    }, [isLoading]);

    // Subscription
    useEffect(() => {
        if (!organizationId || (Array.isArray(organizationId) && organizationId.length === 0)) return;

        const subOrgId = Array.isArray(organizationId) ? organizationId[0] : organizationId; // Real-time only supports one refined filter easily, or we handle it inside
        // For battalion, we effectively want to subscribe to all companies. 
        // Our updated subscribeToAuditLogs now handles clientside filtering if array passed.

        const subscription = subscribeToAuditLogs(organizationId as any, (newLog) => {
            let matches = true;

            if (filters.entityTypes && !filters.entityTypes.includes(newLog.entity_type)) matches = false;
            
            if (matches && filters.userId && newLog.user_id !== filters.userId) matches = false;
            
            if (matches && filters.date) {
                if (newLog.metadata?.date !== filters.date) matches = false;
            }

            if (matches && filters.personId) {
                const pId = filters.personId;
                const matchesEntity = newLog.entity_id === pId;
                const matchesMeta = newLog.metadata?.personId === pId;
                if (!matchesEntity && !matchesMeta) matches = false;
            }

            if (matches && filters.taskId) {
                if (newLog.metadata?.taskId !== filters.taskId) matches = false;
            }

            if (matches && filters.entityId) {
                if (newLog.entity_id !== filters.entityId) matches = false;
            }

            if (matches && filters.startTime) {
                if (newLog.metadata?.startTime !== filters.startTime) matches = false;
            }

            if (matches && filters.createdDate) {
                 // Check if the log was created on the filtered createdDate
                 const logDate = new Date(newLog.created_at).toISOString().split('T')[0];
                 if (logDate !== filters.createdDate) matches = false;
            }

            if (matches && isMounted.current) {
                setLogs(prev => [newLog, ...prev]);
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [
        Array.isArray(organizationId) ? organizationId.join(',') : organizationId,
        filters.date, 
        filters.createdDate, 
        filters.personId, 
        filters.taskId, 
        filters.userId, 
        filters.entityTypes, 
        filters.entityId, 
        filters.startTime
    ]);

    const updateFilters = (newFilters: Partial<LogFilters>) => {
        setFilters(prev => ({ ...prev, ...newFilters }));
        // Immediate UI feedback to prevent flash of old data
        setLogs([]);
        setIsLoading(true);
    };

    const loadMore = () => {
        if (!isLoadingMore && hasMore) {
            loadLogs(true);
        }
    };

    return {
        logs,
        isLoading,
        isLoadingMore,
        hasMore,
        filters,
        updateFilters,
        loadMore
    };
};
