import { createClient } from '@supabase/supabase-js';
// Environment variables are loaded in index.ts

import { logger } from './utils/logger.js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('⚠️ Supabase credentials missing in server environment variables');
    logger.warn('Supabase credentials missing in server environment variables');
} else {
    logger.info(`Initializing Supabase Admin with URL: ${supabaseUrl}`);
}

import { fetchWithRetry } from './utils/fetchWithRetry.js';

export const supabaseAdmin = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    },
    global: {
        fetch: fetchWithRetry
    }
});
