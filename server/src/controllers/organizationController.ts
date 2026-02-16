import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { cacheService } from '../services/cacheService.js';
import { createClient } from '@supabase/supabase-js';

export const getOrgDataBundle = async (req: AuthRequest, res: Response) => {
    const user = req.user;
    const authHeader = req.headers.authorization;
    const { orgId, startDate, endDate } = req.query;

    if (!user || !authHeader) {
        return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!orgId) {
        return res.status(400).json({ error: 'Organization ID is required' });
    }

    // Default dates similar to RPC default: 14 days back, 30 days forward
    const vStart = (startDate as string) || new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const vEnd = (endDate as string) || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    try {
        const bundle = await cacheService.getOrgData(orgId as string, vStart, vEnd);
        res.json(bundle);
    } catch (err: any) {
        logger.error('Error in getOrgDataBundle:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};

export const getOrgSettings = async (req: AuthRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    const { orgId } = req.query;

    if (!authHeader || !orgId) {
        return res.status(400).json({ error: 'Auth header and Organization ID are required' });
    }

    const userClient = createClient(
        process.env.SUPABASE_URL || '',
        process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
        { global: { headers: { Authorization: authHeader } } }
    );

    try {
        const { data, error } = await userClient
            .from('organization_settings')
            .select('*')
            .eq('organization_id', orgId)
            .maybeSingle();

        if (error) throw error;
        res.json(data);
    } catch (err: any) {
        logger.error('Error in getOrgSettings:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};

export const getOrganization = async (req: AuthRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    const { orgId } = req.query;

    if (!authHeader || !orgId) {
        return res.status(400).json({ error: 'Auth header and Organization ID are required' });
    }

    const userClient = createClient(
        process.env.SUPABASE_URL || '',
        process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
        { global: { headers: { Authorization: authHeader } } }
    );

    try {
        const { data, error } = await userClient
            .from('organizations')
            .select('*')
            .eq('id', orgId)
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err: any) {
        logger.error('Error in getOrganization:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};

export const searchOrganizations = async (req: AuthRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    const { query, limit = 50 } = req.query;

    if (!authHeader) {
        return res.status(401).json({ error: 'Auth header required' });
    }

    const userClient = createClient(
        process.env.SUPABASE_URL || '',
        process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
        { global: { headers: { Authorization: authHeader } } }
    );

    try {
        let builder = userClient
            .from('organizations')
            .select('*')
            .order('name')
            .limit(Number(limit));

        if (query) {
            const searchStr = `%${(query as string).trim()}%`;
            let orFilter = `name.ilike.${searchStr}`;

            // Add ID search ONLY if query looks like a UUID
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (uuidRegex.test((query as string).trim())) {
                orFilter += `,id.eq.${(query as string).trim()}`;
            }

            builder = builder.or(orFilter);
        }

        const { data, error } = await builder;

        if (error) throw error;
        res.json(data);
    } catch (err: any) {
        logger.error('Error in searchOrganizations:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};

export const getOrganizationsByIds = async (req: AuthRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    const { ids } = req.query;

    if (!authHeader || !ids) {
        return res.status(400).json({ error: 'Auth header and IDs (comma separated) are required' });
    }

    const idList = (ids as string).split(',').filter(Boolean);

    if (idList.length === 0) return res.json([]);

    const userClient = createClient(
        process.env.SUPABASE_URL || '',
        process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
        { global: { headers: { Authorization: authHeader } } }
    );

    try {
        const { data, error } = await userClient
            .from('organizations')
            .select('*')
            .in('id', idList);

        if (error) throw error;
        res.json(data);
    } catch (err: any) {
        logger.error('Error in getOrganizationsByIds:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};

export const getTaskTemplates = async (req: AuthRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    const { orgId } = req.query;

    if (!authHeader || !orgId) {
        return res.status(400).json({ error: 'Auth header and Organization ID are required' });
    }

    const userClient = createClient(
        process.env.SUPABASE_URL || '',
        process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
        { global: { headers: { Authorization: authHeader } } }
    );

    try {
        const { data, error } = await userClient
            .from('task_templates')
            .select('*')
            .eq('organization_id', orgId);

        if (error) throw error;
        res.json(data);
    } catch (err: any) {
        logger.error('Error in getTaskTemplates:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};
