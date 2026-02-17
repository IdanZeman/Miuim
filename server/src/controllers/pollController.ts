import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';
import * as pollHandlers from '../services/rpcHandlers/pollHandlers.js';
import { fetchWithRetry } from '../utils/fetchWithRetry.js';

const getSupabaseClient = (authHeader: string) => {
    return createClient(
        process.env.SUPABASE_URL || '',
        process.env.SUPABASE_ANON_KEY || '',
        {
            global: {
                headers: { Authorization: authHeader },
                fetch: fetchWithRetry
            }
        }
    );
};

export const getPolls = async (req: AuthRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const { organizationId } = req.query;
        if (!organizationId) return res.status(400).json({ error: 'Organization ID is required' });

        const client = getSupabaseClient(authHeader);
        const data = await pollHandlers.get_polls(client, { p_organization_id: organizationId as string });
        res.json(data);
    } catch (err: any) {
        logger.error('Error in getPolls:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};

export const createPoll = async (req: AuthRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const client = getSupabaseClient(authHeader);
        const data = await pollHandlers.create_poll(client, { p_poll: req.body });
        res.json(data);
    } catch (err: any) {
        logger.error('Error in createPoll:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};

export const updatePoll = async (req: AuthRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const { id } = req.params;
        const client = getSupabaseClient(authHeader);
        const data = await pollHandlers.update_poll(client, { p_id: id, p_updates: req.body });
        res.json(data);
    } catch (err: any) {
        logger.error('Error in updatePoll:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};

export const submitResponse = async (req: AuthRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const client = getSupabaseClient(authHeader);
        const data = await pollHandlers.submit_poll_response(client, { p_response: req.body });
        res.json(data);
    } catch (err: any) {
        logger.error('Error in submitResponse:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};

export const getPollResults = async (req: AuthRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const { id } = req.params;
        const client = getSupabaseClient(authHeader);
        const data = await pollHandlers.get_poll_results(client, { p_poll_id: id });
        res.json(data);
    } catch (err: any) {
        logger.error('Error in getPollResults:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};

export const checkUserResponse = async (req: AuthRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const { pollId, userId } = req.query;
        if (!pollId || !userId) return res.status(400).json({ error: 'Poll ID and User ID are required' });

        const client = getSupabaseClient(authHeader);
        const data = await pollHandlers.check_user_response(client, {
            p_poll_id: pollId as string,
            p_user_id: userId as string
        });
        res.json(data);
    } catch (err: any) {
        logger.error('Error in checkUserResponse:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};
