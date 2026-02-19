import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { createClient } from '@supabase/supabase-js';

export const getWarClockItems = async (req: AuthRequest, res: Response) => {
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
            .from('war_clock_items')
            .select('*')
            .eq('organization_id', orgId);

        if (error) throw error;
        res.json(data);
    } catch (err: any) {
        logger.error('Error in getWarClockItems:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};

export const addWarClockItem = async (req: AuthRequest, res: Response) => {
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
            .from('war_clock_items')
            .insert(body)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err: any) {
        logger.error('Error in addWarClockItem:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};

export const updateWarClockItem = async (req: AuthRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    const { id } = req.params;
    const body = req.body;

    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

    const userClient = createClient(
        process.env.SUPABASE_URL || '',
        process.env.SUPABASE_ANON_KEY || '',
        { global: { headers: { Authorization: authHeader } } }
    );

    try {
        const { data, error } = await userClient
            .from('war_clock_items')
            .update(body)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err: any) {
        logger.error('Error in updateWarClockItem:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};

export const deleteWarClockItem = async (req: AuthRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    const { id } = req.params;

    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

    const userClient = createClient(
        process.env.SUPABASE_URL || '',
        process.env.SUPABASE_ANON_KEY || '',
        { global: { headers: { Authorization: authHeader } } }
    );

    try {
        const { error } = await userClient
            .from('war_clock_items')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ success: true });
    } catch (err: any) {
        logger.error('Error in deleteWarClockItem:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};
