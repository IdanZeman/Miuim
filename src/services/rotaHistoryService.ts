import { supabase } from './supabaseClient';
import { RotaGenerationHistory, DailyPresence } from '../types';
import { logger } from '../lib/logger';

/**
 * Fetch the most recent N rota generation history records for an organization
 */
export const fetchRotaHistory = async (
    organizationId: string,
    limit: number = 10
): Promise<RotaGenerationHistory[]> => {
    try {
        const { data, error } = await supabase
            .from('rota_generation_history')
            .select(`
                *,
                creator:created_by (
                    full_name,
                    email
                )
            `)
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;

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

        const { data, error } = await supabase
            .from('rota_generation_history')
            .insert({
                organization_id: organizationId,
                config,
                roster_data: rosterData,
                manual_overrides: manualOverrides,
                created_by: createdBy,
                title
            })
            .select()
            .single();

        if (error) throw error;

        // Clean up old records (keep only the 10 most recent)
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
        const { data: allRecords, error: fetchError } = await supabase
            .from('rota_generation_history')
            .select('id, created_at')
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;

        if (!allRecords || allRecords.length <= keepCount) {
            return; // Nothing to clean up
        }

        // Get IDs of records to delete (everything after the Nth record)
        const idsToDelete = allRecords.slice(keepCount).map(r => r.id);

        if (idsToDelete.length > 0) {
            const { error: deleteError } = await supabase
                .from('rota_generation_history')
                .delete()
                .in('id', idsToDelete);

            if (deleteError) throw deleteError;

            logger.info('DELETE', 'Cleaned up old history records', {
                organizationId,
                deletedCount: idsToDelete.length
            });
        }
    } catch (e) {
        logger.error('DELETE', 'Failed to cleanup old history', e);
    }
};

/**
 * Delete a specific history record
 */
export const deleteRotaHistory = async (historyId: string): Promise<boolean> => {
    try {
        const { error } = await supabase
            .from('rota_generation_history')
            .delete()
            .eq('id', historyId);

        if (error) throw error;

        logger.info('DELETE', 'Deleted history record', { historyId });
        return true;
    } catch (e) {
        logger.error('DELETE', 'Failed to delete history record', e);
        return false;
    }
};
