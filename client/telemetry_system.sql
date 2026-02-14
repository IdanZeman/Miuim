-- ============================================================================
-- TELEMETRY SYSTEM FOR SNAPSHOT OPERATIONS
-- ============================================================================
-- Purpose: Track all snapshot operations for monitoring, debugging, and analytics
-- Features:
--   - Log every restore/create/delete operation
--   - Track success/failure rates
--   - Measure operation duration
--   - Store error details for debugging
--   - Enable performance monitoring

-- Operations Log Table
CREATE TABLE IF NOT EXISTS public.snapshot_operations_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,  -- Changed from text to uuid
  operation_type text NOT NULL CHECK (operation_type IN ('restore', 'create', 'delete')),
  snapshot_id uuid,
  snapshot_name text,
  user_id uuid NOT NULL,
  started_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  status text NOT NULL CHECK (status IN ('started', 'in_progress', 'success', 'failed')),
  error_message text,
  error_code text,
  duration_ms integer,
  pre_restore_backup_id uuid, -- For restore operations
  records_affected integer,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_snapshot_ops_org 
  ON public.snapshot_operations_log(organization_id);

CREATE INDEX IF NOT EXISTS idx_snapshot_ops_status 
  ON public.snapshot_operations_log(status);

CREATE INDEX IF NOT EXISTS idx_snapshot_ops_created 
  ON public.snapshot_operations_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_snapshot_ops_type 
  ON public.snapshot_operations_log(operation_type);

CREATE INDEX IF NOT EXISTS idx_snapshot_ops_user 
  ON public.snapshot_operations_log(user_id);

-- RLS Policies
ALTER TABLE public.snapshot_operations_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their organization's operation logs" ON public.snapshot_operations_log;
DROP POLICY IF EXISTS "System can insert operation logs" ON public.snapshot_operations_log;

-- Users can view logs for their organization
CREATE POLICY "Users can view their organization's operation logs"
  ON public.snapshot_operations_log
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Only system can insert logs (via RPC functions)
CREATE POLICY "System can insert operation logs"
  ON public.snapshot_operations_log
  FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to start logging an operation
CREATE OR REPLACE FUNCTION public.log_snapshot_operation_start(
  p_organization_id uuid,  -- Changed from text to uuid
  p_operation_type text,
  p_snapshot_id uuid,
  p_snapshot_name text,
  p_user_id uuid,
  p_metadata jsonb DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO public.snapshot_operations_log (
    organization_id,
    operation_type,
    snapshot_id,
    snapshot_name,
    user_id,
    status,
    metadata
  ) VALUES (
    p_organization_id,
    p_operation_type,
    p_snapshot_id,
    p_snapshot_name,
    p_user_id,
    'started',
    p_metadata
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to complete logging an operation
CREATE OR REPLACE FUNCTION public.log_snapshot_operation_complete(
  p_log_id uuid,
  p_status text,
  p_error_message text DEFAULT NULL,
  p_error_code text DEFAULT NULL,
  p_pre_restore_backup_id uuid DEFAULT NULL,
  p_records_affected integer DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_started_at timestamp with time zone;
  v_duration_ms integer;
BEGIN
  -- Get start time
  SELECT started_at INTO v_started_at
  FROM public.snapshot_operations_log
  WHERE id = p_log_id;
  
  -- Calculate duration
  v_duration_ms := EXTRACT(EPOCH FROM (now() - v_started_at)) * 1000;
  
  -- Update log
  UPDATE public.snapshot_operations_log
  SET 
    completed_at = now(),
    status = p_status,
    error_message = p_error_message,
    error_code = p_error_code,
    duration_ms = v_duration_ms,
    pre_restore_backup_id = p_pre_restore_backup_id,
    records_affected = p_records_affected
  WHERE id = p_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ANALYTICS VIEWS
-- ============================================================================

-- View: Recent operations summary
CREATE OR REPLACE VIEW public.snapshot_operations_summary AS
SELECT 
  organization_id,
  operation_type,
  status,
  COUNT(*) as operation_count,
  AVG(duration_ms) as avg_duration_ms,
  MAX(duration_ms) as max_duration_ms,
  MIN(duration_ms) as min_duration_ms,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failure_count,
  COUNT(CASE WHEN status = 'success' THEN 1 END) as success_count,
  ROUND(
    COUNT(CASE WHEN status = 'success' THEN 1 END)::numeric / 
    NULLIF(COUNT(*)::numeric, 0) * 100, 
    2
  ) as success_rate_percent
FROM public.snapshot_operations_log
WHERE created_at >= now() - interval '30 days'
GROUP BY organization_id, operation_type, status;

-- View: Recent failures for debugging
CREATE OR REPLACE VIEW public.snapshot_operations_recent_failures AS
SELECT 
  id,
  organization_id,
  operation_type,
  snapshot_name,
  user_id,
  started_at,
  error_message,
  error_code,
  duration_ms
FROM public.snapshot_operations_log
WHERE status = 'failed'
  AND created_at >= now() - interval '7 days'
ORDER BY created_at DESC
LIMIT 100;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.log_snapshot_operation_start TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_snapshot_operation_complete TO authenticated;
GRANT SELECT ON public.snapshot_operations_summary TO authenticated;
GRANT SELECT ON public.snapshot_operations_recent_failures TO authenticated;

-- ============================================================================
-- USAGE EXAMPLES
-- ============================================================================
/*
-- Start logging a restore operation
SELECT log_snapshot_operation_start(
  'org-123',
  'restore',
  'snapshot-uuid',
  'My Snapshot',
  'user-uuid',
  '{"reason": "manual restore"}'::jsonb
);

-- Complete with success
SELECT log_snapshot_operation_complete(
  'log-uuid',
  'success',
  NULL,
  NULL,
  'pre-restore-backup-uuid',
  1500
);

-- Complete with failure
SELECT log_snapshot_operation_complete(
  'log-uuid',
  'failed',
  'Column "optimization_mode" does not exist',
  '42703',
  NULL,
  NULL
);

-- View success rates
SELECT * FROM snapshot_operations_summary;

-- View recent failures
SELECT * FROM snapshot_operations_recent_failures;
*/
