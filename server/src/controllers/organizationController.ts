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

export const createOrganization = async (req: AuthRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    const { name, type } = req.body;

    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const userClient = createClient(
        process.env.SUPABASE_URL || '',
        process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
        { global: { headers: { Authorization: authHeader } } }
    );

    try {
        const { data, error } = await userClient
            .from('organizations')
            .insert({
                name: name.trim(),
                org_type: type || 'company'
            })
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err: any) {
        logger.error('Error in createOrganization:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};

export const getPendingInvite = async (req: AuthRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    const { email } = req.query;

    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const userClient = createClient(
        process.env.SUPABASE_URL || '',
        process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
        { global: { headers: { Authorization: authHeader } } }
    );

    try {
        const { data, error } = await userClient
            .from('organization_invites')
            .select('*, organizations(name)')
            .eq('email', (email as string).toLowerCase())
            .eq('accepted', false)
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) throw error;
        res.json(data);
    } catch (err: any) {
        logger.error('Error in getPendingInvite:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};

export const acceptInvite = async (req: AuthRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    const { userId, orgId, templateId } = req.body;

    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
    if (!userId || !orgId) return res.status(400).json({ error: 'User ID and Org ID are required' });

    const userClient = createClient(
        process.env.SUPABASE_URL || '',
        process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
        { global: { headers: { Authorization: authHeader } } }
    );

    try {
        const { error } = await userClient
            .from('profiles')
            .update({
                organization_id: orgId,
                permission_template_id: templateId
            })
            .eq('id', userId);

        if (error) throw error;
        res.json({ success: true });
    } catch (err: any) {
        logger.error('Error in acceptInvite:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};

export const markInviteAccepted = async (req: AuthRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    const { inviteId } = req.body;

    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
    if (!inviteId) return res.status(400).json({ error: 'Invite ID is required' });

    const userClient = createClient(
        process.env.SUPABASE_URL || '',
        process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
        { global: { headers: { Authorization: authHeader } } }
    );

    try {
        const { error } = await userClient
            .from('organization_invites')
            .update({ accepted: true })
            .eq('id', inviteId);

        if (error) throw error;
        res.json({ success: true });
    } catch (err: any) {
        logger.error('Error in markInviteAccepted:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};
