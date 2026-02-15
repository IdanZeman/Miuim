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

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (serviceKey) {
    logger.info('Supabase Admin initialized with SERVICE_ROLE_KEY (RLS Bypass enabled)');
} else {
    logger.warn('Supabase Admin falling back to ANON_KEY (RLS Bypass DISABLED)');
}

export const supabaseAdmin = createClient(supabaseUrl, serviceKey || supabaseAnonKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    },
    global: {
        fetch: fetchWithRetry
    }
});
