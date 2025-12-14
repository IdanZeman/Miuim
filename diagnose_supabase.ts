import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://rfqkkzhhvytkkgrnyarm.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_ANON_KEY) {
    console.error('Missing VITE_SUPABASE_ANON_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function diagnose() {
    console.log('Starting diagnosis...');

    // 1. Fetch one task to see structure
    const { data: tasks, error: fetchError } = await supabase
        .from('task_templates')
        .select('*')
        .limit(1);

    if (fetchError) {
        console.error('Error fetching tasks:', fetchError);
        return;
    }

    if (!tasks || tasks.length === 0) {
        console.log('No tasks found. Cannot test update.');
        return;
    }

    const task = tasks[0];
    console.log('Fetched task keys:', Object.keys(task));
    console.log('Task segments type:', typeof task.segments);
    console.log('Is "segments" in task?', 'segments' in task);
    
    // 2. Try Update with Object (Standard JSONB)
    console.log('Testing Update with Object...');
    const { error: updateObjError } = await supabase
        .from('task_templates')
        .update({ segments: [{ name: "Test Object", id: "test-1" }] })
        .eq('id', task.id);
    
    if (updateObjError) {
        console.error('Update with Object FAILED:', updateObjError);
    } else {
        console.log('Update with Object SUCCESS');
    }

    // 3. Try Update with String (If Object failed)
    console.log('Testing Update with String...');
    const { error: updateStrError } = await supabase
        .from('task_templates')
        .update({ segments: JSON.stringify([{ name: "Test String", id: "test-2" }]) as any })
        .eq('id', task.id);
    
    if (updateStrError) {
        console.error('Update with String FAILED:', updateStrError);
    } else {
        console.log('Update with String SUCCESS');
    }
}

diagnose();
