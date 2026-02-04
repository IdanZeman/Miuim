import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env
dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectLogs() {
  console.log('Inspecting Audit Logs event types...');
  
  const { data, error } = await supabase
    .from('audit_logs')
    .select('event_type, action_description')
    .limit(50);

  if (error) {
    console.error('Error fetching logs:', error.message);
    return;
  }

  const types = [...new Set(data.map(l => l.event_type))];
  console.log('Found event types:', types);
  
  console.log('\nSample logs:');
  data.slice(0, 10).forEach(l => console.log(`- Type: ${l.event_type} | Description: ${l.action_description}`));
}

inspectLogs();
