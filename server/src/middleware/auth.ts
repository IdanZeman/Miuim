import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../supabase.js';

export interface AuthRequest extends Request {
    user?: any;
}

import { logger } from '../utils/logger.js';

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        logger.warn('Auth middleware: No authorization header');
        return res.status(401).json({ error: 'No authorization header' });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
        logger.warn('Auth middleware: No token provided');
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

        if (error || !user) {
            logger.error(`Auth failed for token ending in ...${token.slice(-5)}`, { error, user });
            return res.status(401).json({ error: 'Invalid token or user not found', details: error?.message });
        }

        req.user = user;
        next();
    } catch (err) {
        logger.error('Auth middleware error:', err);
        return res.status(500).json({ error: 'Internal server error during authentication' });
    }
};
