import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';

const getGenericData = async (table: string, req: AuthRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    const { orgId } = req.query;

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
        const { data, error } = await userClient
            .from(table)
            .select('*')
            .eq('organization_id', orgId);

        if (error) throw error;
        res.json(data);
    } catch (err: any) {
        logger.error(`Error in get ${table}:`, err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};

export const getConstraints = (req: AuthRequest, res: Response) => getGenericData('scheduling_constraints', req, res);
export const getAbsences = (req: AuthRequest, res: Response) => getGenericData('absences', req, res);
export const getBlockages = (req: AuthRequest, res: Response) => getGenericData('hourly_blockages', req, res);
export const getRotations = (req: AuthRequest, res: Response) => getGenericData('team_rotations', req, res);
export const getDailyPresence = (req: AuthRequest, res: Response) => getGenericData('daily_presence', req, res);
