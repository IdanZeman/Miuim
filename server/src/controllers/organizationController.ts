import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { cacheService } from '../services/cacheService.js';

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
