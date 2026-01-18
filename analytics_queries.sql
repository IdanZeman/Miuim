-- ==========================================
-- Admin Center Analytics Queries
-- ==========================================

-- 1. Function to get organization analytics summary
CREATE OR REPLACE FUNCTION public.get_org_analytics_summary(p_org_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
  v_deletions_30d integer;
  v_snapshots_30d integer;
  v_restores_30d integer;
  v_last_nightly_status text;
  v_active_people integer;
  v_avg_latency_ms integer;
  v_health_score integer;
BEGIN
  -- Calculate deletions
  SELECT COUNT(*)
  INTO v_deletions_30d
  FROM public.deleted_people_archive
  WHERE organization_id = p_org_id
  AND deleted_at >= now() - interval '30 days';

  -- Calculate snapshots_30d and avg_latency_ms
  SELECT
      COUNT(*) FILTER (WHERE created_at > (now() - interval '30 days')),
      COALESCE(AVG(duration_ms) FILTER (WHERE created_at > (now() - interval '7 days')), 0)
  INTO
      v_snapshots_30d,
      v_avg_latency_ms
  FROM public.snapshot_operations_log
  WHERE organization_id = p_org_id;

  -- Override snapshots_30d with actual total count from organization_snapshots if log is incomplete
  -- This ensures we count snapshots even if their operation log entry is missing or incomplete
  SELECT COUNT(*)
  INTO v_snapshots_30d
  FROM public.organization_snapshots
  WHERE organization_id = p_org_id
  AND created_at > (now() - interval '30 days');

  -- Calculate restores_30d
  SELECT COUNT(*)
  INTO v_restores_30d
  FROM public.snapshot_operations_log
  WHERE organization_id = p_org_id
  AND operation_type = 'restore'
  AND status = 'success'
  AND started_at >= now() - interval '30 days';

  -- Calculate last_nightly_status
  SELECT COALESCE(
     (
        -- Try to get from log first (most accurate for started/failed)
        SELECT status::text
        FROM public.snapshot_operations_log
        WHERE organization_id = p_org_id
        AND snapshot_name LIKE '%גיבוי אוטומטי%'
        ORDER BY started_at DESC
        LIMIT 1
     ),
     (
        -- Fallback: check if a snapshot exists from the last 24 hours
        SELECT CASE WHEN EXISTS (
          SELECT 1 FROM public.organization_snapshots
          WHERE organization_id = p_org_id
          AND name LIKE '%גיבוי אוטומטי%'
          AND created_at >= now() - interval '24 hours'
        ) THEN 'success' ELSE NULL END
     )
  ) INTO v_last_nightly_status;

  -- Calculate active_people
  SELECT COUNT(*)
  INTO v_active_people
  FROM public.people
  WHERE organization_id = p_org_id
  AND is_active = true;

  -- Calculate Health Score (0-100)
  -- Base 80 points. +10 if snapshots_30d > 0. +10 if last backup was successful. -10 if avg_latency > 2000ms.
  v_health_score := 80;

  IF v_snapshots_30d > 0 THEN
      v_health_score := v_health_score + 10;
  END IF;

  IF v_last_nightly_status = 'success' THEN
      v_health_score := v_health_score + 10;
  ELSIF v_last_nightly_status = 'failed' THEN
      v_health_score := v_health_score - 20;
  END IF;

  IF v_avg_latency_ms > 2000 THEN
      v_health_score := v_health_score - 10;
  END IF;

  -- Ensure within bounds
  v_health_score := LEAST(100, GREATEST(0, v_health_score));

  SELECT jsonb_build_object(
    'deletions_30d', v_deletions_30d,
    'snapshots_30d', v_snapshots_30d,
    'restores_30d', v_restores_30d,
    'last_nightly_status', v_last_nightly_status,
    'active_people', v_active_people,
    'avg_latency_ms', v_avg_latency_ms,
    'health_score', v_health_score
  ) INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Function to get recent system activity (Deletions + Snapshot Ops)
CREATE OR REPLACE FUNCTION public.get_recent_system_activity(p_org_id uuid, p_limit integer DEFAULT 20)
RETURNS TABLE (
  event_type text,
  event_name text,
  user_name text,
  occurred_at timestamp with time zone,
  status text,
  metadata jsonb
) AS $$
BEGIN
  RETURN QUERY
  WITH all_activity AS (
    -- 1. Deletions from archive
    SELECT 
      'deletion'::text as event_type,
      ('מחיקת אדם: ' || (dpa.person_data->>'name'))::text as event_name,
      COALESCE(p.full_name, 'לא ידוע')::text as user_name,
      dpa.deleted_at as occurred_at,
      'success'::text as status,
      jsonb_build_object(
        'reason', dpa.deletion_reason,
        'counts', dpa.related_data_counts
      ) as metadata
    FROM public.deleted_people_archive dpa
    LEFT JOIN public.profiles p ON dpa.deleted_by = p.id
    WHERE dpa.organization_id = p_org_id
    AND dpa.deleted_at > now() - interval '30 days'
    
    UNION ALL
    
    -- 2. Snapshot operations from log
    SELECT 
      sol.operation_type::text as event_type,
      sol.snapshot_name::text as event_name,
      COALESCE(p.full_name, 'מערכת')::text as user_name,
      sol.started_at as occurred_at,
      sol.status::text as status,
      sol.metadata
    FROM public.snapshot_operations_log sol
    LEFT JOIN public.profiles p ON sol.user_id = p.id
    WHERE sol.organization_id = p_org_id
    AND sol.started_at > now() - interval '30 days'
    
    UNION ALL
    
    -- 3. Automatic snapshots from organization_snapshots (if not already in log)
    -- This ensures existing tonightly backups show up in history even if log was empty
    SELECT 
      'create'::text as event_type,
      os.name::text as event_name,
      'מערכת'::text as user_name,
      os.created_at as occurred_at,
      'success'::text as status,
      os.metadata
    FROM public.organization_snapshots os
    WHERE os.organization_id = p_org_id
    AND os.created_at > now() - interval '30 days'
    AND os.name LIKE '%גיבוי אוטומטי%'
    AND NOT EXISTS (
      -- Avoid duplicates if the logging fix is already active
      SELECT 1 FROM public.snapshot_operations_log sol 
      WHERE sol.snapshot_id = OS.id
    )
  )
  SELECT * FROM all_activity
  ORDER BY occurred_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant permissions explicitly
GRANT EXECUTE ON FUNCTION public.get_org_analytics_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_recent_system_activity(uuid, integer) TO authenticated;
