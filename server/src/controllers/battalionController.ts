import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { createClient } from '@supabase/supabase-js';

export const getBattalionPeople = async (req: AuthRequest, res: Response) => {
    const user = req.user;
    const authHeader = req.headers.authorization;
    const { battalionId } = req.query;

    if (!user || !authHeader) {
        return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!battalionId) {
        return res.status(400).json({ error: 'Battalion ID is required' });
    }

    const userClient = createClient(
        process.env.SUPABASE_URL || '',
        process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
        {
            global: {
                headers: {
                    Authorization: authHeader
                }
            }
        }
    );

    try {
        const { data, error } = await userClient
            .from('people')
            .select(`
                *,
                organizations!inner(battalion_id)
            `)
            .eq('organizations.battalion_id', battalionId);

        if (error) throw error;
        res.json(data);
    } catch (err: any) {
        console.error('Error in getBattalionPeople:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};

export const getBattalionPresenceSummary = async (req: AuthRequest, res: Response) => {
    const user = req.user;
    const authHeader = req.headers.authorization;
    const { battalionId, date } = req.query;

    if (!user || !authHeader) {
        return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!battalionId || !date) {
        return res.status(400).json({ error: 'Battalion ID and date are required' });
    }

    const userClient = createClient(
        process.env.SUPABASE_URL || '',
        process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
        {
            global: {
                headers: {
                    Authorization: authHeader
                }
            }
        }
    );

    try {
        const { data, error } = await userClient
            .from('daily_presence')
            .select(`
                *,
                people!inner(name),
                organizations!inner(battalion_id)
            `)
            .eq('organizations.battalion_id', battalionId)
            .eq('date', date);

        if (error) throw error;

        // Flatten the response to match the RPC structure
        const flattenedData = data.map((item: any) => ({
            ...item,
            person_name: item.people?.name
        }));

        res.json(flattenedData);
    } catch (err: any) {
        console.error('Error in getBattalionPresenceSummary:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};

export const getBattalionStats = async (req: AuthRequest, res: Response) => {
    const user = req.user;
    const authHeader = req.headers.authorization;
    const { battalionId } = req.query;

    if (!user || !authHeader) {
        return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!battalionId) {
        return res.status(400).json({ error: 'Battalion ID is required' });
    }

    const userClient = createClient(
        process.env.SUPABASE_URL || '',
        process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
        {
            global: {
                headers: {
                    Authorization: authHeader
                }
            }
        }
    );

    try {
        // This is a complex aggregation. In the short term, we keep calling the RPC from the backend 
        // to ensure identical logic, but we move the endpoint to our server.
        const { data, error } = await userClient.rpc('get_battalion_stats', {
            target_battalion_id: battalionId
        });

        if (error) throw error;
        res.json(data);
    } catch (err: any) {
        console.error('Error in getBattalionStats:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};
