-- ==========================================
-- Dashboard Performance Optimization RPCs
-- ==========================================

-- 1. Get Dashboard KPIs (Counters)
-- Returns a single JSON object with all the counts to avoid multiple round-trips.
create or replace function get_dashboard_kpis()
returns json
language plpgsql
security definer
as $$
declare
    result json;
begin
    select json_build_object(
        'total_orgs', (select count(*) from organizations),
        'total_users', (select count(*) from profiles),
        'active_users_now', (
            select count(distinct user_id) 
            from audit_logs 
            where created_at > (now() - interval '15 minutes')
        ),
        'new_users_today', (select count(*) from profiles where created_at >= current_date),
        'new_users_week', (select count(*) from profiles where created_at >= (current_date - interval '7 days')),
        'new_users_month', (select count(*) from profiles where created_at >= (current_date - interval '30 days')),
        'new_orgs_today', (select count(*) from organizations where created_at >= current_date),
        'new_orgs_week', (select count(*) from organizations where created_at >= (current_date - interval '7 days')),
        'new_orgs_month', (select count(*) from organizations where created_at >= (current_date - interval '30 days')),
        'actions_24h', (select count(*) from audit_logs where created_at >= (now() - interval '24 hours'))
    ) into result;
    
    return result;
end;
$$;

-- 2. Get System Activity Chart
-- Aggregates log counts by time bucket (hour for 'today', day for 'week'/'month')
create or replace function get_system_activity_chart(time_range text)
returns table (
    date_label text,
    action_count bigint
)
language plpgsql
security definer
as $$
begin
    if time_range = 'today' then
        return query
        select 
            to_char(created_at, 'HH24:00') as date_label,
            count(*) as action_count
        from audit_logs
        where created_at >= current_date
        group by 1
        order by 1;
    else
        return query
        select 
            to_char(created_at, 'DD/MM'),
            count(*)
        from audit_logs
        where created_at >= (
            case 
                when time_range = 'week' then (current_date - interval '7 days')
                else (current_date - interval '30 days')
            end
        )
        group by 1
        order by min(created_at);
    end if;
end;
$$;

-- 3. Get Top Users
-- aggregates user activity efficiently
create or replace function get_top_users(time_range text, limit_count int default 10)
returns table (
    user_id uuid,
    email text,
    full_name text,
    org_name text,
    activity_count bigint
)
language plpgsql
security definer
as $$
declare
    start_date timestamp;
begin
    -- Determine start date
    if time_range = 'today' then
        start_date := current_date;
    elsif time_range = 'week' then
        start_date := current_date - interval '7 days';
    elsif time_range = 'month' then
        start_date := current_date - interval '30 days';
    else
        start_date := '1970-01-01'::timestamp; -- All time
    end if;

    return query
    select 
        al.user_id,
        al.user_email as email,
        al.user_name as full_name,
        coalesce(o.name, 'N/A') as org_name,
        count(*) as activity_count
    from audit_logs al
    left join organizations o on al.organization_id = o.id
    where al.created_at >= start_date
    and al.user_id is not null
    group by 1, 2, 3, 4
    order by 5 desc
    limit limit_count;
end;
$$;

-- 4. Get Top Organizations
-- Aggregates organization activity
create or replace function get_top_organizations(time_range text default 'month', limit_count int default 10)
returns table (
    org_id uuid,
    org_name text,
    shifts_count bigint,
    users_count bigint
)
language plpgsql
security definer
as $$
declare
    start_date timestamp;
begin
    start_date := current_date - interval '30 days'; -- Default to 30 days relevance

    return query
    with org_activity as (
        select organization_id, count(*) as acts
        from audit_logs
        where created_at >= start_date
        and organization_id is not null
        group by organization_id
    ),
    org_users as (
        select organization_id, count(*) as usrs
        from profiles
        where organization_id is not null
        group by organization_id
    )
    select 
        o.id,
        o.name,
        coalesce(oa.acts, 0) as shifts_count,
        coalesce(ou.usrs, 0) as users_count
    from organizations o
    left join org_activity oa on o.id = oa.organization_id
    left join org_users ou on o.id = ou.organization_id
    order by 3 desc, 4 desc
    limit limit_count;
end;
$$;
