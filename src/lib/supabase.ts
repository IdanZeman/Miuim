import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Create client
const supabaseInstance = createClient(supabaseUrl, supabaseKey);

// Expose on window for Cypress/Playwright testing
if (typeof window !== 'undefined') {
    (window as any).supabase = supabaseInstance;
}

export const isSupabaseConfigured = !!(supabaseUrl && supabaseKey);

export const supabase = supabaseInstance;
