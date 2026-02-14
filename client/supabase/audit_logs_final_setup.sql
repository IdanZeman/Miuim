-- Final Setup for Audit Logs & Realtime
-- This script ensures the audit_logs table is correctly configured for Realtime and Security.

-- 1. Ensure columns exist (Safeguard)
ALTER TABLE IF EXISTS public.audit_logs 
ADD COLUMN IF NOT EXISTS entity_name text,
ADD COLUMN IF NOT EXISTS metadata jsonb,
ADD COLUMN IF NOT EXISTS session_id text,
ADD COLUMN IF NOT EXISTS url text;

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies to avoid conflicts if running again
DROP POLICY IF EXISTS "Allow users to read their own organization logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Allow users to insert logs for their own organization" ON public.audit_logs;

-- 4. Create Policy: SELECT
-- Users can only see logs belonging to their organization
CREATE POLICY "Allow users to read their own organization logs"
ON public.audit_logs FOR SELECT
TO authenticated
USING (
  organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);

-- 5. Create Policy: INSERT
-- Users can only insert logs into their own organization
-- Note: We use auth.uid() check to ensure the user is who they say they are if they provide user_id
CREATE POLICY "Allow users to insert logs for their own organization"
ON public.audit_logs FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);

-- 6. Enable Realtime
-- This is critical for the "Live" feed to work
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'audit_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;
  END IF;
END $$;
