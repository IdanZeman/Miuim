import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';
import { upsert_person_handler, upsert_team_handler, upsert_role_handler } from '../services/rpcHandlers/personnelHandlers.js';

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

        const data = await upsert_person_handler(userClient, {
            p_id, p_name, p_email, p_team_id, p_role_ids,
            p_phone, p_is_active, p_custom_fields, p_color
        });

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

        const data = await upsert_team_handler(userClient, {
            p_id, p_name, p_color
        });

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

        const data = await upsert_role_handler(userClient, {
            p_id, p_name, p_color, p_icon
        });

        res.json(data);
    } catch (err: any) {
        logger.error('Error in upsertRole:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};

export const getPeople = async (req: AuthRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    const { organizationId, unlinkedOnly } = req.query;

    if (!authHeader || !organizationId) {
        return res.status(400).json({ error: 'Auth header and Organization ID are required' });
    }

    const userClient = createClient(
        process.env.SUPABASE_URL || '',
        process.env.SUPABASE_ANON_KEY || '',
        { global: { headers: { Authorization: authHeader } } }
    );

    try {
        let query = userClient
            .from('people')
            .select('*')
            .eq('organization_id', organizationId);

        if (unlinkedOnly === 'true') {
            query = query.is('user_id', null);
        }

        const { data, error } = await query;
        if (error) throw error;
        res.json(data);
    } catch (err: any) {
        logger.error('Error in getPeople:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};

export const getTeams = async (req: AuthRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    const { organizationId } = req.query;

    if (!authHeader || !organizationId) {
        return res.status(400).json({ error: 'Auth header and Organization ID are required' });
    }

    const userClient = createClient(
        process.env.SUPABASE_URL || '',
        process.env.SUPABASE_ANON_KEY || '',
        { global: { headers: { Authorization: authHeader } } }
    );

    try {
        const { data, error } = await userClient
            .from('teams')
            .select('*')
            .eq('organization_id', organizationId);

        if (error) throw error;
        res.json(data);
    } catch (err: any) {
        logger.error('Error in getTeams:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};

export const getRoles = async (req: AuthRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    const { organizationId } = req.query;

    if (!authHeader || !organizationId) {
        return res.status(400).json({ error: 'Auth header and Organization ID are required' });
    }

    const userClient = createClient(
        process.env.SUPABASE_URL || '',
        process.env.SUPABASE_ANON_KEY || '',
        { global: { headers: { Authorization: authHeader } } }
    );

    try {
        const { data, error } = await userClient
            .from('roles')
            .select('*')
            .eq('organization_id', organizationId);

        if (error) throw error;
        res.json(data);
    } catch (err: any) {
        logger.error('Error in getRoles:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};

export const getAuthorizedVehicles = async (req: AuthRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    const { organizationId, orgIds, battalionId } = req.query;

    if (!authHeader) return res.status(401).json({ error: 'Auth header required' });

    const userClient = createClient(
        process.env.SUPABASE_URL || '',
        process.env.SUPABASE_ANON_KEY || '',
        { global: { headers: { Authorization: authHeader } } }
    );

    try {
        let q = userClient
            .from('gate_authorized_vehicles')
            .select('*, organizations(name, battalion_id)');

        if (battalionId && orgIds) {
            const ids = (orgIds as string).split(',');
            if (ids.length > 0) q = q.in('organization_id', ids);
        } else if (organizationId) {
            q = q.eq('organization_id', organizationId);
        }

        const { data, error } = await q;
        if (error) throw error;
        res.json(data);
    } catch (err: any) {
        logger.error('Error in getAuthorizedVehicles:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};

export const getGateOrganizations = async (req: AuthRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    const { battalionId } = req.query;

    if (!authHeader) return res.status(401).json({ error: 'Auth header required' });

    const userClient = createClient(
        process.env.SUPABASE_URL || '',
        process.env.SUPABASE_ANON_KEY || '',
        { global: { headers: { Authorization: authHeader } } }
    );

    try {
        let query = userClient.from('organizations').select('id, name');
        if (battalionId) {
            query = query.eq('battalion_id', battalionId);
        }
        const { data, error } = await query;
        if (error) throw error;
        res.json(data);
    } catch (err: any) {
        logger.error('Error in getGateOrganizations:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};
