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

console.log('✅ Environment variables loaded from root (SSL bypass enabled)');
if (!process.env.SUPABASE_URL) {
    console.warn('⚠️ SUPABASE_URL not found in environment');
}
