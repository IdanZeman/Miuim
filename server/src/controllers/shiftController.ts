import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';

export const getShifts = async (req: AuthRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    const { orgId, startDate, endDate, taskId } = req.query;

    if (!authHeader || !orgId) {
        return res.status(400).json({ error: 'Auth header and Organization ID are required' });
    }

    const userClient = createClient(
        process.env.SUPABASE_URL || '',
        process.env.SUPABASE_ANON_KEY || '',
        {
            global: {
                headers: { Authorization: authHeader }
            }
        }
    );

    try {
        let query = userClient
            .from('shifts')
            .select('*')
            .eq('organization_id', orgId);

        if (startDate) query = query.gte('start_time', startDate as string);
        if (endDate) query = query.lte('start_time', endDate as string);
        if (taskId) query = query.eq('task_id', taskId as string);

        const { data, error } = await query;

        if (error) throw error;
        res.json(data);
    } catch (err: any) {
        logger.error('Error in getShifts:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};
