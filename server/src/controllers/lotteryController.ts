import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { createClient } from '@supabase/supabase-js';

export const getLotteryHistory = async (req: AuthRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    const { orgId, limit = 20 } = req.query;

    if (!authHeader || !orgId) {
        return res.status(400).json({ error: 'Auth header and Organization ID are required' });
    }

    const userClient = createClient(
        process.env.SUPABASE_URL || '',
        process.env.SUPABASE_ANON_KEY || '',
        { global: { headers: { Authorization: authHeader } } }
    );

    try {
        const { data, error } = await userClient
            .from('lottery_history')
            .select('*')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false })
            .limit(Number(limit));

        if (error) throw error;
        res.json(data || []);
    } catch (err: any) {
        logger.error('Error in getLotteryHistory:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};

export const addLotteryHistoryEntry = async (req: AuthRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    const body = req.body;

    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

    const userClient = createClient(
        process.env.SUPABASE_URL || '',
        process.env.SUPABASE_ANON_KEY || '',
        { global: { headers: { Authorization: authHeader } } }
    );

    try {
        const { data, error } = await userClient
            .from('lottery_history')
            .insert(body)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err: any) {
        logger.error('Error in addLotteryHistoryEntry:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};
