-- ==========================================
-- Nightly Automatic Snapshots for All Organizations
-- ==========================================

-- 1. Enable the cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Create the internal snapshot creation function
CREATE OR REPLACE FUNCTION public.internal_create_snapshot_for_org(p_org_id uuid)
RETURNS void AS $$
DECLARE
    v_snapshot_id uuid;
    v_record_counts jsonb;
    v_org_name text;
    v_tables text[] := ARRAY[
        'teams', 'roles', 'people', 'task_templates', 'shifts', 
        'absences', 'daily_presence', 
        'hourly_blockages', 'equipment', 'equipment_daily_checks',
        'daily_attendance_snapshots', 'user_load_stats', 'mission_reports',
        'scheduling_constraints', 'team_rotations', 'organization_settings'
    ];
    v_table_name text;
    v_data jsonb;
    v_row_count integer;
    v_counts_map jsonb := '{}'::jsonb;
    v_log_id uuid;
BEGIN
    -- Get org name for backup title
    SELECT name INTO v_org_name FROM public.organizations WHERE id = p_org_id;

    -- Start telemetry logging
    v_log_id := public.log_snapshot_operation_start(
        p_org_id,
        'create',
        NULL,
        'גיבוי אוטומטי - ' || v_org_name,
        '00000000-0000-0000-0000-000000000000'::uuid, -- System user ID
        jsonb_build_object('trigger', 'nightly_cron')
    );

    -- A. Enforce 5-snapshot limit (KEEP only the 4 newest, so we have room for 1 more)
    DELETE FROM public.organization_snapshots
    WHERE organization_id = p_org_id
    AND id NOT IN (
        SELECT id FROM public.organization_snapshots
        WHERE organization_id = p_org_id
        ORDER BY created_at DESC
        LIMIT 4
    );

    -- B. Create the snapshot header
    INSERT INTO public.organization_snapshots (
        organization_id, 
        name, 
        description, 
        created_by, 
        tables_included,
        record_counts
    )
    VALUES (
        p_org_id, 
        'גיבוי אוטומטי - ' || v_org_name || ' - ' || to_char(now() AT TIME ZONE 'Asia/Jerusalem', 'DD/MM/YYYY'),
        'מערכת: גיבוי יומי אוטומטי',
        NULL, -- System generated, no specific user
        v_tables,
        '{}'::jsonb
    )
    RETURNING id INTO v_snapshot_id;

    -- Update log with the new snapshot ID
    UPDATE public.snapshot_operations_log SET snapshot_id = v_snapshot_id WHERE id = v_log_id;

    -- C. Loop through tables and copy data
    FOREACH v_table_name IN ARRAY v_tables LOOP
        -- Generate dynamic query to get data as JSON and count
        EXECUTE format(
            'SELECT jsonb_agg(t), count(*) FROM (SELECT * FROM public.%I WHERE %s::text = %L) t',
            v_table_name,
            CASE 
                WHEN v_table_name = 'equipment' THEN 'organization_id' 
                WHEN v_table_name = 'organizations' THEN 'id' 
                ELSE 'organization_id' 
            END,
            p_org_id::text
        ) INTO v_data, v_row_count;

        -- Insert into snapshot_table_data
        IF v_row_count > 0 THEN
            INSERT INTO public.snapshot_table_data (snapshot_id, table_name, data, row_count)
            VALUES (v_snapshot_id, v_table_name, v_data, v_row_count);
            
            -- Update counts map
            v_counts_map := v_counts_map || jsonb_build_object(v_table_name, v_row_count);
        ELSE
            v_counts_map := v_counts_map || jsonb_build_object(v_table_name, 0);
        END IF;
    END LOOP;

    -- D. Update the final record counts in the header
    UPDATE public.organization_snapshots 
    SET record_counts = v_counts_map 
    WHERE id = v_snapshot_id;

    -- Complete telemetry logging
    PERFORM public.log_snapshot_operation_complete(
        v_log_id,
        'success',
        NULL,
        NULL,
        NULL,
        (SELECT SUM(row_count) FROM public.snapshot_table_data WHERE snapshot_id = v_snapshot_id)::integer
    );

EXCEPTION WHEN OTHERS THEN
    -- Log failure if telemetry ID exists
    IF v_log_id IS NOT NULL THEN
        PERFORM public.log_snapshot_operation_complete(
            v_log_id,
            'failed',
            SQLERRM,
            SQLSTATE
        );
    END IF;
    -- Re-raise exception
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create the master function to loop through all organizations
CREATE OR REPLACE FUNCTION public.run_nightly_snapshots_all_orgs()
RETURNS void AS $$
DECLARE
    org_rec record;
BEGIN
    FOR org_rec IN SELECT id FROM public.organizations LOOP
        BEGIN
            PERFORM public.internal_create_snapshot_for_org(org_rec.id);
        EXCEPTION WHEN OTHERS THEN
            -- Log error and continue to next organization
            RAISE WARNING 'Failed to create snapshot for organization %: %', org_rec.id, SQLERRM;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Schedule the job
-- '0 23 * * *' is 23:00 UTC, which is 01:00 Israel Time (Standard Time UTC+2)
-- Note: If it's Daylight Savings (UTC+3), 01:00 is 22:00 UTC. 
DO $$
BEGIN
    -- Remove existing job if it exists to allow re-running this script
    PERFORM cron.unschedule('auto-snapshot-01am');
EXCEPTION WHEN OTHERS THEN
    -- If job doesn't exist, just ignore the error
    NULL;
END $$;

SELECT cron.schedule('auto-snapshot-01am', '0 23 * * *', 'SELECT public.run_nightly_snapshots_all_orgs()');
