import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';

export const joinByToken = async (req: AuthRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

    const userClient = createClient(
        process.env.SUPABASE_URL || '',
        process.env.SUPABASE_ANON_KEY || '',
        { global: { headers: { Authorization: authHeader } } }
    );

    try {
        const { p_token } = req.body;

        const { data, error } = await userClient.rpc('join_organization_by_token', {
            p_token
        });

        if (error) throw error;
        res.json(data);
    } catch (err: any) {
        logger.error('Error in joinByToken:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};

export const getOrgNameByToken = async (req: AuthRequest, res: Response) => {
    // This one might be public (pre-auth), but usually invitation link is seen after login or by anyone.
    // If it's pre-auth, we use service role or anon key without auth header.
    // Here we'll assume auth is required as per current frontend service (session? is checked).

    const userClient = createClient(
        process.env.SUPABASE_URL || '',
        process.env.SUPABASE_ANON_KEY || ''
    );

    try {
        const { p_token } = req.params;

        const { data, error } = await userClient.rpc('get_org_name_by_token', {
            p_token
        });

        if (error) throw error;
        res.json(data);
    } catch (err: any) {
        logger.error('Error in getOrgNameByToken:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};
