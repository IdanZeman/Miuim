import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.local or .env
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyNewRPCs() {
    console.log('Verifying New Admin RPC functions...');

    const rpcsToCheck = [
        { name: 'get_active_users_stats', params: { time_range: 'today', limit_count: 5 } },
        { name: 'get_new_users_list', params: { time_range: 'month', limit_count: 5 } },
        { name: 'get_new_orgs_list', params: { time_range: 'month', limit_count: 5 } }
    ];

    for (const rpc of rpcsToCheck) {
        console.log(`Checking ${rpc.name}...`);
        const { data, error } = await supabase.rpc(rpc.name, rpc.params);
        if (error) {
            console.error(`❌ ${rpc.name} failed:`, error.message);
        } else {
            console.log(`✅ ${rpc.name} returned ${data?.length} records.`);
        }
    }
}

verifyNewRPCs();
