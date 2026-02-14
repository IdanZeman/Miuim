-- Migration: Add More Admin RPCs for Lists and Active Users
-- Date: 2026-02-04 21:00:00

-- 1. get_active_users_stats
-- Returns list of users sorted by activity count in the given time range
CREATE OR REPLACE FUNCTION get_active_users_stats(time_range text, limit_count int DEFAULT 100)
RETURNS TABLE (
    user_id uuid,
    full_name text,
    email text,
    org_name text,
    activity_count bigint
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
    SELECT 
        p.id as user_id,
        p.full_name,
        p.email,
        o.name as org_name,
        count(al.id) as activity_count
    FROM audit_logs al
    JOIN profiles p ON al.user_id = p.id
    LEFT JOIN organizations o ON p.organization_id = o.id
    WHERE al.created_at >= start_date
    GROUP BY p.id, p.full_name, p.email, o.name
    ORDER BY activity_count DESC
    LIMIT limit_count;
END;
$$;

-- 2. get_new_users_list
-- Returns list of users created in the given time range
CREATE OR REPLACE FUNCTION get_new_users_list(time_range text, limit_count int DEFAULT 100)
RETURNS TABLE (
    id uuid,
    full_name text,
    email text,
    created_at timestamptz,
    org_name text
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
    SELECT 
        p.id,
        p.full_name,
        p.email,
        p.created_at,
        o.name as org_name
    FROM profiles p
    LEFT JOIN organizations o ON p.organization_id = o.id
    WHERE p.created_at >= start_date
    ORDER BY p.created_at DESC
    LIMIT limit_count;
END;
$$;

-- 3. get_new_orgs_list
-- Returns list of organizations created in the given time range
CREATE OR REPLACE FUNCTION get_new_orgs_list(time_range text, limit_count int DEFAULT 100)
RETURNS TABLE (
    id uuid,
    name text,
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
    SELECT 
        o.id,
        o.name,
        o.created_at
    FROM organizations o
    WHERE o.created_at >= start_date
    ORDER BY o.created_at DESC
    LIMIT limit_count;
END;
$$;
