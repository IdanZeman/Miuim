import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
    },
    // Improve Realtime reliability
    realtime: {
        params: {
            eventsPerSecond: 10,
        },
    },
});

// For debugging/verification
if (typeof window !== 'undefined') {
    (window as any).supabaseClient = supabase;
}

export const isSupabaseConfigured = !!(supabaseUrl && supabaseKey);
