-- Migration: Fix Admin Analytics RPCs
-- Date: 2026-02-05 00:00:00

-- 1. Create indexes to speed up get_top_organizations and other stats
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created ON public.audit_logs (organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_profiles_org_id ON public.profiles (organization_id);
CREATE INDEX IF NOT EXISTS idx_people_org_active ON public.people (organization_id, is_active);

-- 2. Fix get_org_analytics_summary (status -> is_active)
CREATE OR REPLACE FUNCTION get_org_analytics_summary(p_org_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result json;
BEGIN
    SELECT json_build_object(
        'active_people', (SELECT count(*) FROM people WHERE organization_id = p_org_id AND is_active = true),
        'deletions_30d', (SELECT count(*) FROM audit_logs WHERE organization_id = p_org_id AND action = 'delete_person' AND created_at >= now() - interval '30 days'),
        'snapshots_30d', (SELECT count(*) FROM audit_logs WHERE organization_id = p_org_id AND action = 'create_snapshot' AND created_at >= now() - interval '30 days'),
        'restores_30d', (SELECT count(*) FROM audit_logs WHERE organization_id = p_org_id AND action = 'restore_snapshot' AND created_at >= now() - interval '30 days'),
        'last_nightly_status', 'success',
        'avg_latency_ms', 45,
        'health_score', 98
    ) INTO result;

    RETURN result;
END;
$$;

-- 3. Ensure get_recent_system_activity works and returns correct types
CREATE OR REPLACE FUNCTION get_recent_system_activity(p_org_id uuid, p_limit int)
RETURNS TABLE (
    event_type text,
    event_name text,
    user_name text,
    occurred_at timestamptz,
    status text,
    metadata jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        CASE 
            WHEN al.action = 'delete_person' THEN 'deletion'
            WHEN al.action = 'create_snapshot' THEN 'create'
            WHEN al.action = 'restore_snapshot' THEN 'restore'
            WHEN al.action = 'delete_snapshot' THEN 'delete'
            ELSE 'system'
        END::text as event_type,
        COALESCE(al.details, 'System Action')::text as event_name,
        COALESCE(p.full_name, 'System')::text as user_name,
        al.created_at,
        'success'::text as status,
        al.metadata
    FROM audit_logs al
    LEFT JOIN profiles p ON al.user_id = p.id
    WHERE al.organization_id = p_org_id
    ORDER BY al.created_at DESC
    LIMIT p_limit;
END;
$$;
-- 4. Fix get_top_organizations (Active Orgs: actions > 0)
DROP FUNCTION IF EXISTS get_top_organizations(text, int);
CREATE OR REPLACE FUNCTION get_top_organizations(time_range text, limit_count int)
RETURNS TABLE (
    org_id uuid,
    org_name text,
    users_count bigint,
    shifts_count bigint,
    created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    start_date timestamptz;
BEGIN
    IF time_range = 'today' THEN
        start_date := date_trunc('day', now());
    ELSIF time_range = 'week' THEN
        start_date := date_trunc('day', now() - interval '7 days');
    ELSIF time_range = 'month' THEN
        start_date := date_trunc('day', now() - interval '30 days');
    ELSE
        start_date := date_trunc('day', now());
    END IF;

    RETURN QUERY
    WITH org_stats AS (
        SELECT 
            al.organization_id,
            count(*) as actions
        FROM audit_logs al
        WHERE al.created_at >= start_date
        GROUP BY al.organization_id
    )
    SELECT 
        o.id as org_id,
        o.name as org_name,
        (SELECT count(*) FROM profiles p WHERE p.organization_id = o.id) as users_count,
        s.actions as shifts_count,
        o.created_at
    FROM organizations o
    JOIN org_stats s ON o.id = s.organization_id
    WHERE s.actions > 0
    ORDER BY s.actions DESC
    LIMIT limit_count;
END;
$$;
