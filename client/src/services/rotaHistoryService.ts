import { RotaGenerationHistory, DailyPresence } from '../types';
import { logger } from '../lib/logger';
import { callBackend } from './backendService';

/**
 * Fetch the most recent N rota generation history records for an organization
 */
export const fetchRotaHistory = async (
    organizationId: string,
    limit: number = 10
): Promise<RotaGenerationHistory[]> => {
    try {
        const data = await callBackend('/api/history/rota', 'GET', { orgId: organizationId, limit });
        return (data || []) as RotaGenerationHistory[];
    } catch (e) {
        logger.error('VIEW', 'Failed to fetch rota history', e);
        return [];
    }
};

/**
 * Save a new rota generation to history
 * Automatically cleans up old records to maintain the limit
 */
export const saveRotaHistory = async (
    organizationId: string,
    config: RotaGenerationHistory['config'],
    rosterData: DailyPresence[],
    manualOverrides?: Record<string, { status: string; startTime?: string; endTime?: string }>,
    createdBy?: string
): Promise<RotaGenerationHistory | null> => {
    try {
        // Generate title from date range
        const title = `${new Date(config.startDate).toLocaleDateString('he-IL', {
            day: '2-digit',
            month: '2-digit'
        })} - ${new Date(config.endDate).toLocaleDateString('he-IL', {
            day: '2-digit',
            month: '2-digit'
        })}`;

        const data = await callBackend('/api/history/rota', 'POST', {
            organization_id: organizationId,
            config,
            roster_data: rosterData,
            manual_overrides: manualOverrides,
            created_by: createdBy,
            title
        });

        // Clean up old records (keep only the 10 most recent)
        // Note: Ideally the server handles this, but for now we call the cleanup function
        await cleanupOldHistory(organizationId, 10);

        logger.info('SAVE', 'Saved rota generation to history', {
            organizationId,
            title,
            rosterSize: rosterData.length
        });

        return data as RotaGenerationHistory;
    } catch (e) {
        logger.error('SAVE', 'Failed to save rota history', e);
        return null;
    }
};

/**
 * Delete old history records, keeping only the N most recent
 */
export const cleanupOldHistory = async (
    organizationId: string,
    keepCount: number = 10
): Promise<void> => {
    try {
        // Get all records for this organization, ordered by date
        const allRecords = await callBackend('/api/history/rota', 'GET', {
            orgId: organizationId,
            limit: keepCount + 10
        });

        if (!allRecords || allRecords.length <= keepCount) {
            return; // Nothing to clean up
        }

        // Get IDs of records to delete (everything after the Nth record)
        const idsToDelete = allRecords.slice(keepCount).map((r: any) => r.id);

        for (const id of idsToDelete) {
            await deleteRotaHistory(id);
        }

        logger.info('DELETE', 'Cleaned up old history records', {
            organizationId,
            deletedCount: idsToDelete.length
        });
    } catch (e) {
        logger.error('DELETE', 'Failed to cleanup old history', e);
    }
};

/**
 * Delete a specific history record
 */
export const deleteRotaHistory = async (historyId: string): Promise<boolean> => {
    try {
        await callBackend(`/api/history/rota/${historyId}`, 'DELETE');

        logger.info('DELETE', 'Deleted history record', { historyId });
        return true;
    } catch (e) {
        logger.error('DELETE', 'Failed to delete history record', e);
        return false;
    }
};
