import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';

export const getSnapshots = async (req: AuthRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    const { organizationId } = req.query;

    if (!authHeader || !organizationId) {
        return res.status(400).json({ error: 'Auth header and Organization ID are required' });
    }

    const userClient = createClient(
        process.env.SUPABASE_URL || '',
        process.env.SUPABASE_ANON_KEY || '',
        { global: { headers: { Authorization: authHeader } } }
    );

    try {
        const { data, error } = await userClient
            .from('organization_snapshots')
            .select(`
                *,
                profiles:created_by (full_name)
            `)
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (err: any) {
        logger.error('Error in getSnapshots:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};

export const getSnapshotById = async (req: AuthRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    const { snapshotId } = req.query;

    if (!authHeader || !snapshotId) {
        return res.status(400).json({ error: 'Auth header and Snapshot ID are required' });
    }

    const userClient = createClient(
        process.env.SUPABASE_URL || '',
        process.env.SUPABASE_ANON_KEY || '',
        { global: { headers: { Authorization: authHeader } } }
    );

    try {
        const { data, error } = await userClient
            .from('organization_snapshots')
            .select('*')
            .eq('id', snapshotId)
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err: any) {
        logger.error('Error in getSnapshotById:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};

export const getSnapshotTableData = async (req: AuthRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    const { snapshotId, tableName } = req.query;

    if (!authHeader || !snapshotId || !tableName) {
        return res.status(400).json({ error: 'Auth header, Snapshot ID, and Table Name are required' });
    }

    const userClient = createClient(
        process.env.SUPABASE_URL || '',
        process.env.SUPABASE_ANON_KEY || '',
        { global: { headers: { Authorization: authHeader } } }
    );

    try {
        const { data, error } = await userClient
            .from('snapshot_table_data')
            .select('data, row_count')
            .eq('snapshot_id', snapshotId)
            .eq('table_name', tableName)
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err: any) {
        logger.error('Error in getSnapshotTableData:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};

export const deleteSnapshotDirect = async (req: AuthRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    const { snapshotId } = req.body;

    if (!authHeader || !snapshotId) {
        return res.status(400).json({ error: 'Auth header and Snapshot ID are required' });
    }

    const userClient = createClient(
        process.env.SUPABASE_URL || '',
        process.env.SUPABASE_ANON_KEY || '',
        { global: { headers: { Authorization: authHeader } } }
    );

    try {
        const { error } = await userClient
            .from('organization_snapshots')
            .delete()
            .eq('id', snapshotId);

        if (error) throw error;
        res.json({ success: true });
    } catch (err: any) {
        logger.error('Error in deleteSnapshotDirect:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};
