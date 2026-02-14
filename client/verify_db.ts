import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load env manually
const envPath = path.resolve(process.cwd(), '.env.local');
let env: Record<string, string> = {};
if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            env[key.trim()] = value.trim();
        }
    });
}

const SUPABASE_URL = env.VITE_SUPABASE_URL || 'https://rfqkkzhhvytkkgrnyarm.supabase.co';
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_ANON_KEY) {
    console.error('Missing VITE_SUPABASE_ANON_KEY in .env.local');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function verify() {
    console.log('--- Verifying Database Schema ---');

    console.log('1. Checking task_templates.segments column...');
    const { data: tasks, error: tasksError } = await supabase
        .from('task_templates')
        .select('id, segments')
        .limit(1);

    if (tasksError) {
        console.error('FAIL: Could not select "segments" column. The migration likely did NOT run.', tasksError.message);
    } else {
        console.log('SUCCESS: Column "segments" exists.');
        if (tasks.length > 0) {
            console.log('Sample segment data:', typeof tasks[0].segments, tasks[0].segments);
        }
    }

    console.log('\n2. Checking shifts.requirements column...');
    const { data: shifts, error: shiftsError } = await supabase
        .from('shifts')
        .select('id, requirements, segment_id')
        .limit(1);
    
    if (shiftsError) {
        console.error('FAIL: Could not select "requirements" or "segment_id" columns. Migration needed.', shiftsError.message);
    } else {
        console.log('SUCCESS: Columns "requirements" and "segment_id" exist.');
    }

    console.log('\n3. Testing Task Insert (to check 400 Bad Request)...');
    // Minimal task
    const testTask = {
        name: "Test Task " + Date.now(),
        difficulty: 1,
        color: 'border-l-blue-500',
        organization_id: (await supabase.auth.getUser()).data.user?.id || 'org-id-placeholder', // This might fail if no org
        is_24_7: false,
        segments: [{ name: "Test Seg", id: "seg-1", startTime: "08:00", durationHours: 4, requiredPeople: 1 }]
    };

    // We need a valid organization_id usually. 
    // Fetch one from DB if possible
    const { data: orgs } = await supabase.from('organizations').select('id').limit(1);
    const orgId = orgs?.[0]?.id;

    if (orgId) {
        testTask.organization_id = orgId;
        const { data, error } = await supabase.from('task_templates').insert(testTask).select();
        if (error) {
            console.error('FAIL: Task Insert Error:', error);
        } else {
            console.log('SUCCESS: Task inserted successfully with segments.');
            // Clean up
            if (data?.[0]?.id) await supabase.from('task_templates').delete().eq('id', data[0].id);
        }
    } else {
        console.log('SKIPPING Insert Test: No Organization found to test with.');
    }
}

verify();
