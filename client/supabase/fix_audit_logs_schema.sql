-- Add metadata column to audit_logs if it doesn't exist
alter table audit_logs 
add column if not exists metadata jsonb;

-- Add session_id column if it doesn't exist (also noticed in previous context it might be new)
alter table audit_logs
add column if not exists session_id uuid;

-- Add url column if it doesn't exist
alter table audit_logs
add column if not exists url text;
