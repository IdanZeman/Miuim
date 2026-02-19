import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { createClient } from '@supabase/supabase-js';

export const getEquipment = async (req: AuthRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    const { orgId } = req.query;

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
            .from('equipment')
            .select('*')
            .eq('organization_id', orgId);

        if (error) throw error;
        res.json(data || []);
    } catch (err: any) {
        logger.error('Error in getEquipment:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};

export const getEquipmentDailyChecks = async (req: AuthRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    const { orgId, date } = req.query;

    if (!authHeader || !orgId) {
        return res.status(400).json({ error: 'Auth header and Organization ID are required' });
    }

    const userClient = createClient(
        process.env.SUPABASE_URL || '',
        process.env.SUPABASE_ANON_KEY || '',
        { global: { headers: { Authorization: authHeader } } }
    );

    try {
        let query = userClient
            .from('equipment_daily_checks')
            .select('*')
            .eq('organization_id', orgId);

        if (date) {
            query = query.eq('check_date', date as string);
        }

        const { data, error } = await query;

        if (error) throw error;
        res.json(data || []);
    } catch (err: any) {
        logger.error('Error in getEquipmentDailyChecks:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};
