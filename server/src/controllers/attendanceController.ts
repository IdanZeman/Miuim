import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';

export const upsertDailyPresence = async (req: AuthRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

    const userClient = createClient(
        process.env.SUPABASE_URL || '',
        process.env.SUPABASE_ANON_KEY || '',
        { global: { headers: { Authorization: authHeader } } }
    );

    try {
        const { p_presence_records } = req.body;

        const { data, error } = await userClient.rpc('upsert_daily_presence', {
            p_presence_records
        });

        if (error) throw error;
        res.json(data);
    } catch (err: any) {
        logger.error('Error in upsertDailyPresence:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};

export const reportAttendance = async (req: AuthRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

    const userClient = createClient(
        process.env.SUPABASE_URL || '',
        process.env.SUPABASE_ANON_KEY || '',
        { global: { headers: { Authorization: authHeader } } }
    );

    try {
        const { p_person_id, p_type, p_location, p_authorized_locations } = req.body;

        const { data, error } = await userClient.rpc('report_attendance', {
            p_person_id,
            p_type,
            p_location,
            p_authorized_locations
        });

        if (error) throw error;
        res.json(data);
    } catch (err: any) {
        logger.error('Error in reportAttendance:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};
