import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';

export const upsertPerson = async (req: AuthRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

    const userClient = createClient(
        process.env.SUPABASE_URL || '',
        process.env.SUPABASE_ANON_KEY || '',
        { global: { headers: { Authorization: authHeader } } }
    );

    try {
        const {
            p_id, p_name, p_email, p_team_id, p_role_ids,
            p_phone, p_is_active, p_custom_fields, p_color
        } = req.body;

        const { data, error } = await userClient.rpc('upsert_person', {
            p_id, p_name, p_email, p_team_id, p_role_ids,
            p_phone, p_is_active, p_custom_fields, p_color
        });

        if (error) throw error;
        res.json(data);
    } catch (err: any) {
        logger.error('Error in upsertPerson:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};

export const upsertTeam = async (req: AuthRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

    const userClient = createClient(
        process.env.SUPABASE_URL || '',
        process.env.SUPABASE_ANON_KEY || '',
        { global: { headers: { Authorization: authHeader } } }
    );

    try {
        const { p_id, p_name, p_color } = req.body;

        const { data, error } = await userClient.rpc('upsert_team', {
            p_id, p_name, p_color
        });

        if (error) throw error;
        res.json(data);
    } catch (err: any) {
        logger.error('Error in upsertTeam:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};

export const upsertRole = async (req: AuthRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

    const userClient = createClient(
        process.env.SUPABASE_URL || '',
        process.env.SUPABASE_ANON_KEY || '',
        { global: { headers: { Authorization: authHeader } } }
    );

    try {
        const { p_id, p_name, p_color, p_icon } = req.body;

        const { data, error } = await userClient.rpc('upsert_role', {
            p_id, p_name, p_color, p_icon
        });

        if (error) throw error;
        res.json(data);
    } catch (err: any) {
        logger.error('Error in upsertRole:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};
