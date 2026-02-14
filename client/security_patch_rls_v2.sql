-- =================================================================
-- Security Patch v2.1: Robust RLS & Dashboard Isolation
-- =================================================================

-- 1. Secure get_org_data_bundle
CREATE OR REPLACE FUNCTION public.get_org_data_bundle(p_org_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
  v_is_super_admin boolean;
  v_user_org_id uuid;
BEGIN
  -- Security Check
  SELECT is_super_admin, organization_id INTO v_is_super_admin, v_user_org_id
  FROM public.profiles
  WHERE id = auth.uid();

  -- Safety: If profile not found or nulls
  IF v_user_org_id IS NULL AND v_is_super_admin IS NULL THEN
     RAISE EXCEPTION 'Access Denied: User profile not found.';
  END IF;

  -- Validation: Must be super admin OR belong to the requested org
  IF NOT (COALESCE(v_is_super_admin, false) OR v_user_org_id = p_org_id) THEN
    RAISE EXCEPTION 'Access Denied: You do not belong to this organization.';
  END IF;

  -- Original Logic
  SELECT jsonb_build_object(
    'people', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM public.people t WHERE organization_id::text = p_org_id::text),
    'teams', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM public.teams t WHERE organization_id::text = p_org_id::text),
    'rotations', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM public.team_rotations t WHERE organization_id::text = p_org_id::text),
    'absences', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM public.absences t WHERE organization_id::text = p_org_id::text),
    'hourly_blockages', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM public.hourly_blockages t WHERE organization_id::text = p_org_id::text),
    'roles', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM public.roles t WHERE organization_id::text = p_org_id::text),
    'shifts', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM public.shifts t WHERE organization_id::text = p_org_id::text),
    'task_templates', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM public.task_templates t WHERE organization_id::text = p_org_id::text),
    'scheduling_constraints', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM public.scheduling_constraints t WHERE organization_id::text = p_org_id::text),
    'settings', (SELECT to_jsonb(t) FROM public.organization_settings t WHERE organization_id::text = p_org_id::text),
    'mission_reports', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM public.mission_reports t WHERE organization_id::text = p_org_id::text),
    'equipment', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM public.equipment t WHERE organization_id::text = p_org_id::text),
    'equipment_daily_checks', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM public.equipment_daily_checks t WHERE organization_id::text = p_org_id::text)
  ) INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Secure get_org_analytics_summary
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
  v_is_super_admin boolean;
  v_user_org_id uuid;
BEGIN
  -- Security Check
  SELECT is_super_admin, organization_id INTO v_is_super_admin, v_user_org_id
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_user_org_id IS NULL AND v_is_super_admin IS NULL THEN
     RAISE EXCEPTION 'Access Denied: User profile not found.';
  END IF;

  IF NOT (COALESCE(v_is_super_admin, false) OR v_user_org_id = p_org_id) THEN
    RAISE EXCEPTION 'Access Denied: You do not belong to this organization.';
  END IF;

  -- Calculate deletions
  SELECT COUNT(*) INTO v_deletions_30d
  FROM public.deleted_people_archive
  WHERE organization_id = p_org_id AND deleted_at >= now() - interval '30 days';

  -- Calculate snapshot metrics
  SELECT
      COUNT(*) FILTER (WHERE created_at > (now() - interval '30 days')),
      COALESCE(AVG(duration_ms) FILTER (WHERE created_at > (now() - interval '7 days')), 0)
  INTO v_snapshots_30d, v_avg_latency_ms
  FROM public.snapshot_operations_log
  WHERE organization_id = p_org_id;

  -- Fallback snapshot count
  SELECT COUNT(*) INTO v_snapshots_30d
  FROM public.organization_snapshots
  WHERE organization_id = p_org_id AND created_at > (now() - interval '30 days');

  -- Calculate restores
  SELECT COUNT(*) INTO v_restores_30d
  FROM public.snapshot_operations_log
  WHERE organization_id = p_org_id AND operation_type = 'restore' AND status = 'success' AND started_at >= now() - interval '30 days';

  -- Calculate last_nightly_status
  SELECT COALESCE(
     (SELECT status::text FROM public.snapshot_operations_log WHERE organization_id = p_org_id AND snapshot_name LIKE '%גיבוי אוטומטי%' ORDER BY started_at DESC LIMIT 1),
     (SELECT CASE WHEN EXISTS (SELECT 1 FROM public.organization_snapshots WHERE organization_id = p_org_id AND name LIKE '%גיבוי אוטומטי%' AND created_at >= now() - interval '24 hours') THEN 'success' ELSE NULL END)
  ) INTO v_last_nightly_status;

  -- Calculate active_people
  SELECT COUNT(*) INTO v_active_people
  FROM public.people
  WHERE organization_id = p_org_id AND is_active = true;

  -- Calculate Health Score
  v_health_score := 80;
  IF v_snapshots_30d > 0 THEN v_health_score := v_health_score + 10; END IF;
  IF v_last_nightly_status = 'success' THEN v_health_score := v_health_score + 10;
  ELSIF v_last_nightly_status = 'failed' THEN v_health_score := v_health_score - 20; END IF;
  IF v_avg_latency_ms > 2000 THEN v_health_score := v_health_score - 10; END IF;
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

-- 3. Secure get_recent_system_activity
CREATE OR REPLACE FUNCTION public.get_recent_system_activity(p_org_id uuid, p_limit integer DEFAULT 20)
RETURNS TABLE (
  event_type text, event_name text, user_name text, occurred_at timestamp with time zone, status text, metadata jsonb
) AS $$
DECLARE
  v_is_super_admin boolean;
  v_user_org_id uuid;
BEGIN
  -- Security Check
  SELECT is_super_admin, organization_id INTO v_is_super_admin, v_user_org_id
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_user_org_id IS NULL AND v_is_super_admin IS NULL THEN
     RAISE EXCEPTION 'Access Denied: User profile not found.';
  END IF;

  IF NOT (COALESCE(v_is_super_admin, false) OR v_user_org_id = p_org_id) THEN
    RAISE EXCEPTION 'Access Denied: You do not belong to this organization.';
  END IF;

  RETURN QUERY
  WITH all_activity AS (
    SELECT 'deletion'::text, ('מחיקת אדם: ' || (dpa.person_data->>'name'))::text, COALESCE(p.full_name, 'לא ידוע')::text, dpa.deleted_at, 'success'::text, jsonb_build_object('reason', dpa.deletion_reason, 'counts', dpa.related_data_counts)
    FROM public.deleted_people_archive dpa LEFT JOIN public.profiles p ON dpa.deleted_by = p.id
    WHERE dpa.organization_id = p_org_id AND dpa.deleted_at > now() - interval '30 days'
    UNION ALL
    SELECT sol.operation_type::text, sol.snapshot_name::text, COALESCE(p.full_name, 'מערכת')::text, sol.started_at, sol.status::text, sol.metadata
    FROM public.snapshot_operations_log sol LEFT JOIN public.profiles p ON sol.user_id = p.id
    WHERE sol.organization_id = p_org_id AND sol.started_at > now() - interval '30 days'
    UNION ALL
    SELECT 'create'::text, os.name::text, 'מערכת'::text, os.created_at, 'success'::text, os.metadata
    FROM public.organization_snapshots os
    WHERE os.organization_id = p_org_id AND os.created_at > now() - interval '30 days' AND os.name LIKE '%גיבוי אוטומטי%'
    AND NOT EXISTS (SELECT 1 FROM public.snapshot_operations_log sol WHERE sol.snapshot_id = OS.id)
  )
  SELECT * FROM all_activity ORDER BY occurred_at DESC LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant permissions explicitly
GRANT EXECUTE ON FUNCTION public.get_org_data_bundle(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_org_analytics_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_recent_system_activity(uuid, integer) TO authenticated;
