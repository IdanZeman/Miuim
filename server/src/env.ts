import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load from root
dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../../.env.local'), override: true });

// Bypass SSL certificate issues (common in restricted/corporate networks)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Also try to set it via command line if needed, but for now we set it here.
// Note: In some Node 20+ versions with undici, we might need to be more explicit.
console.log('✅ Environment variables loaded from root (SSL bypass enabled)');
if (!process.env.SUPABASE_URL) {
    console.warn('⚠️ SUPABASE_URL not found in environment');
}
