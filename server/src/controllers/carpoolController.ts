import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { createClient } from '@supabase/supabase-js';

export const getCarpoolRides = async (req: AuthRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    const { orgId, minDate } = req.query;

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
            .from('carpool_rides')
            .select('*')
            .eq('organization_id', orgId);

        if (minDate) {
            query = query.gte('date', minDate as string);
        }

        const { data, error } = await query
            .order('date', { ascending: true })
            .order('time', { ascending: true });

        if (error) throw error;
        res.json(data || []);
    } catch (err: any) {
        logger.error('Error in getCarpoolRides:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};

export const addCarpoolRide = async (req: AuthRequest, res: Response) => {
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
            .from('carpool_rides')
            .insert(body)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err: any) {
        logger.error('Error in addCarpoolRide:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};

export const deleteCarpoolRide = async (req: AuthRequest, res: Response) => {
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
            .from('carpool_rides')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ success: true });
    } catch (err: any) {
        logger.error('Error in deleteCarpoolRide:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};
