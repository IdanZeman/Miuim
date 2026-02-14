import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../supabase.js';

export interface AuthRequest extends Request {
    user?: any;
}

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ error: 'No authorization header' });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({ error: 'Invalid token or user not found' });
        }

        req.user = user;
        next();
    } catch (err) {
        console.error('Auth middleware error:', err);
        return res.status(500).json({ error: 'Internal server error during authentication' });
    }
};
