-- Add client_timestamp column to audit_logs
ALTER TABLE audit_logs 
ADD COLUMN IF NOT EXISTS client_timestamp timestamp with time zone;
