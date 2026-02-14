import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Debug loaded paths
console.log('🔍 [env.ts] Checking for .env at:', path.resolve(__dirname, '../../.env'));
console.log('🔍 [env.ts] Checking for .env.local at:', path.resolve(__dirname, '../../.env.local'));

// Load from root
const result1 = dotenv.config({ path: path.join(__dirname, '../../.env') });
const result2 = dotenv.config({ path: path.join(__dirname, '../../.env.local'), override: true });

if (result1.error) console.log('⚠️ [env.ts] Failed to load .env:', result1.error.message);
if (result2.error) console.log('⚠️ [env.ts] Failed to load .env.local:', result2.error.message);

// Bypass SSL certificate issues (common in restricted/corporate networks)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Also try to set it via command line if needed, but for now we set it here.
// Note: In some Node 20+ versions with undici, we might need to be more explicit.
console.log('✅ Environment variables loaded (SSL bypass enabled)');
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL; // Fallback to VITE_
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
    console.warn('⚠️ SUPABASE_URL not found in environment');
} else {
    console.log('ℹ️ SUPABASE_URL:', supabaseUrl);
}

if (!supabaseKey) {
    console.warn('⚠️ SUPABASE_ANON_KEY not found in environment');
} else {
    // Log first few chars to verify it's the right key structure
    console.log('ℹ️ SUPABASE_ANON_KEY found:', supabaseKey.substring(0, 10) + '...');
}
