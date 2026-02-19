import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { createClient } from '@supabase/supabase-js';

export const getUserLoadStats = async (req: AuthRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    const { orgId, lastUpdated } = req.query;

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
            .from('user_load_stats')
            .select('*')
            .eq('organization_id', orgId);

        if (lastUpdated) {
            query = query.gte('last_updated', lastUpdated as string);
        }

        const { data, error } = await query;
        if (error) throw error;
        res.json(data || []);
    } catch (err: any) {
        logger.error('Error in getUserLoadStats:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};

export const upsertUserLoadStats = async (req: AuthRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    const body = req.body; // Expect array of records

    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

    const userClient = createClient(
        process.env.SUPABASE_URL || '',
        process.env.SUPABASE_ANON_KEY || '',
        { global: { headers: { Authorization: authHeader } } }
    );

    try {
        const { data, error } = await userClient
            .from('user_load_stats')
            .upsert(body, { onConflict: 'organization_id,person_id' });

        if (error) throw error;
        res.json({ success: true, data });
    } catch (err: any) {
        logger.error('Error in upsertUserLoadStats:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};

export const getRotaGenerationHistory = async (req: AuthRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    const { orgId, limit = 50 } = req.query;

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
            .from('rota_generation_history')
            .select('*')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false })
            .limit(Number(limit));

        if (error) throw error;
        res.json(data || []);
    } catch (err: any) {
        logger.error('Error in getRotaGenerationHistory:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};

export const addRotaGenerationHistory = async (req: AuthRequest, res: Response) => {
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
            .from('rota_generation_history')
            .insert(body)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err: any) {
        logger.error('Error in addRotaGenerationHistory:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};

export const deleteRotaGenerationHistory = async (req: AuthRequest, res: Response) => {
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
            .from('rota_generation_history')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ success: true });
    } catch (err: any) {
        logger.error('Error in deleteRotaGenerationHistory:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};
