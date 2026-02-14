-- 5. Get New Organizations with Stats
-- Returns recent organizations with user counts, avoiding full profile table scan on client
create or replace function get_new_orgs_stats(limit_count int default 5)
returns table (
    id uuid,
    name text,
    created_at timestamp with time zone,
    users_count bigint
)
language plpgsql
security definer
as $$
begin
    return query
    select 
        o.id,
        o.name,
        o.created_at,
        count(p.id) as users_count
    from organizations o
    left join profiles p on o.id = p.organization_id
    group by o.id, o.name, o.created_at
    order by o.created_at desc
    limit limit_count;
end;
$$;
