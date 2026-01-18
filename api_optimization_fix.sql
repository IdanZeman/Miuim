-- ==========================================
-- API Optimization & Deletion Type Fix
-- ==========================================

-- 1. Clear old function signatures to prevent ambiguity (PGRST203)
DROP FUNCTION IF EXISTS public.restore_snapshot(uuid, uuid);

-- 2. New Bundle Function to resolve net::ERR_INSUFFICIENT_RESOURCES
-- Consolidated 13 requests into 1 request
CREATE OR REPLACE FUNCTION public.get_org_data_bundle(p_org_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
BEGIN
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

-- 3. Consolidated Snapshot Preview Data Fetcher
CREATE OR REPLACE FUNCTION public.get_snapshot_data_bundle(p_snapshot_id uuid, p_table_names text[])
RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_object_agg(table_name, data)
  INTO v_result
  FROM public.snapshot_table_data
  WHERE snapshot_id = p_snapshot_id
  AND table_name = ANY(p_table_names);
  
  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Redefine restore_snapshot with explicit casting to solve operator does not exist (uuid = text)
CREATE OR REPLACE FUNCTION public.restore_snapshot(
  p_snapshot_id uuid, 
  p_organization_id uuid,
  p_table_names text[] DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_table_record record;
  v_table_name text;
  v_data jsonb;
  v_restore_all boolean;
BEGIN
  v_restore_all := (p_table_names IS NULL OR array_length(p_table_names, 1) IS NULL);

  -- 1. Security Check
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND organization_id::text = p_organization_id::text
      AND (is_super_admin = true OR (permissions->>'canManageSettings')::boolean = true)
  ) THEN
    RAISE EXCEPTION 'אין לך הרשאה לשחזר גרסאות.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.organization_snapshots WHERE id = p_snapshot_id AND organization_id::text = p_organization_id::text) THEN
    RAISE EXCEPTION 'הגרסה לא שייכת לארגון זה.';
  END IF;

  -- 2. Performance: Target ID Collection (Using explicit casts)
  CREATE TEMP TABLE target_teams AS SELECT id::text FROM public.teams WHERE organization_id::text = p_organization_id::text;
  CREATE TEMP TABLE target_roles AS SELECT id::text FROM public.roles WHERE organization_id::text = p_organization_id::text;
  CREATE TEMP TABLE target_tasks AS SELECT id::text FROM public.task_templates WHERE organization_id::text = p_organization_id::text;
  CREATE TEMP TABLE target_people AS SELECT id::text FROM public.people WHERE organization_id::text = p_organization_id::text OR team_id::text IN (SELECT id FROM target_teams);
  CREATE TEMP TABLE target_shifts AS SELECT id::text FROM public.shifts WHERE organization_id::text = p_organization_id::text OR task_id::text IN (SELECT id FROM target_tasks);
  CREATE TEMP TABLE target_equipment AS SELECT id::text FROM public.equipment WHERE organization_id::text = p_organization_id::text;

  -- 3. Ordered Deletion with explicit casts
  IF v_restore_all OR 'mission_reports' = ANY(p_table_names) THEN DELETE FROM public.mission_reports WHERE organization_id::text = p_organization_id::text OR shift_id::text IN (SELECT id FROM target_shifts); END IF;
  IF v_restore_all OR 'user_load_stats' = ANY(p_table_names) THEN DELETE FROM public.user_load_stats WHERE organization_id::text = p_organization_id::text OR person_id::text IN (SELECT id FROM target_people); END IF;
  IF v_restore_all OR 'daily_attendance_snapshots' = ANY(p_table_names) THEN DELETE FROM public.daily_attendance_snapshots WHERE organization_id::text = p_organization_id::text OR person_id::text IN (SELECT id FROM target_people); END IF;
  IF v_restore_all OR 'daily_presence' = ANY(p_table_names) THEN DELETE FROM public.daily_presence WHERE organization_id::text = p_organization_id::text OR person_id::text IN (SELECT id FROM target_people); END IF;
  IF v_restore_all OR 'absences' = ANY(p_table_names) THEN DELETE FROM public.absences WHERE organization_id::text = p_organization_id::text OR person_id::text IN (SELECT id FROM target_people); END IF;
  IF v_restore_all OR 'hourly_blockages' = ANY(p_table_names) THEN DELETE FROM public.hourly_blockages WHERE organization_id::text = p_organization_id::text OR person_id::text IN (SELECT id FROM target_people); END IF;
  IF v_restore_all OR 'scheduling_constraints' = ANY(p_table_names) THEN DELETE FROM public.scheduling_constraints WHERE organization_id::text = p_organization_id::text OR person_id::text IN (SELECT id FROM target_people); END IF;
  IF v_restore_all OR 'equipment_daily_checks' = ANY(p_table_names) THEN DELETE FROM public.equipment_daily_checks WHERE organization_id::text = p_organization_id::text OR equipment_id::text IN (SELECT id FROM target_equipment); END IF;
  
  IF v_restore_all OR 'daily_presence' = ANY(p_table_names) OR 'absences' = ANY(p_table_names) THEN
    DELETE FROM public.unified_presence WHERE organization_id::text = p_organization_id::text OR person_id::text IN (SELECT id FROM target_people);
  END IF;
  
  IF v_restore_all OR 'shifts' = ANY(p_table_names) THEN DELETE FROM public.shifts WHERE organization_id::text = p_organization_id::text OR task_id::text IN (SELECT id FROM target_tasks); END IF;
  IF v_restore_all OR 'task_templates' = ANY(p_table_names) THEN DELETE FROM public.task_templates WHERE organization_id::text = p_organization_id::text OR assigned_team_id::text IN (SELECT id FROM target_teams); END IF;
  IF v_restore_all OR 'equipment' = ANY(p_table_names) THEN UPDATE public.equipment SET assigned_to_id = NULL WHERE assigned_to_id::text IN (SELECT id FROM target_people); DELETE FROM public.equipment WHERE id::text IN (SELECT id FROM target_equipment); END IF;
  IF v_restore_all OR 'team_rotations' = ANY(p_table_names) THEN DELETE FROM public.team_rotations WHERE organization_id::text = p_organization_id::text OR team_id::text IN (SELECT id FROM target_teams); END IF;
  IF v_restore_all OR 'people' = ANY(p_table_names) THEN DELETE FROM public.people WHERE id::text IN (SELECT id FROM target_people); END IF;
  IF v_restore_all OR 'roles' = ANY(p_table_names) THEN DELETE FROM public.roles WHERE id::text IN (SELECT id FROM target_roles); END IF;
  IF v_restore_all OR 'teams' = ANY(p_table_names) THEN DELETE FROM public.teams WHERE id::text IN (SELECT id FROM target_teams); END IF;
  IF v_restore_all OR 'organization_settings' = ANY(p_table_names) THEN DELETE FROM public.organization_settings WHERE organization_id::text = p_organization_id::text; END IF;

  DROP TABLE target_teams; DROP TABLE target_roles; DROP TABLE target_tasks; DROP TABLE target_people; DROP TABLE target_shifts; DROP TABLE target_equipment;

  -- 4. Restore data loop
  FOR v_table_record IN (
    SELECT table_name, data FROM public.snapshot_table_data 
    WHERE snapshot_id = p_snapshot_id AND (v_restore_all OR table_name = ANY(p_table_names))
    ORDER BY 
      CASE table_name
        WHEN 'teams' THEN 1 WHEN 'roles' THEN 2 WHEN 'organization_settings' THEN 3
        WHEN 'people' THEN 4 WHEN 'task_templates' THEN 5 WHEN 'team_rotations' THEN 6
        WHEN 'shifts' THEN 7 WHEN 'absences' THEN 8 WHEN 'daily_presence' THEN 9
        WHEN 'hourly_blockages' THEN 10 WHEN 'scheduling_constraints' THEN 11
        WHEN 'equipment' THEN 12 WHEN 'equipment_daily_checks' THEN 13
        WHEN 'daily_attendance_snapshots' THEN 14 WHEN 'user_load_stats' THEN 15
        WHEN 'mission_reports' THEN 16 ELSE 99
      END
  ) LOOP
    v_table_name := v_table_record.table_name;
    v_data := v_table_record.data;

    IF v_table_name = 'teams' THEN
      INSERT INTO public.teams (id, name, color, organization_id)
      SELECT (x->>'id')::text, (x->>'name')::text, (x->>'color')::text, p_organization_id
      FROM jsonb_array_elements(v_data) AS x;
    ELSIF v_table_name = 'roles' THEN
      INSERT INTO public.roles (id, name, color, icon, organization_id)
      SELECT (x->>'id')::text, (x->>'name')::text, (x->>'color')::text, (x->>'icon')::text, p_organization_id
      FROM jsonb_array_elements(v_data) AS x;
    ELSIF v_table_name = 'people' THEN
      INSERT INTO public.people (id, name, team_id, role_ids, max_hours_per_week, unavailable_dates, preferences, color, daily_availability, organization_id, email, user_id, personal_rotation, max_shifts_per_week, phone, is_active, custom_fields, is_commander)
      SELECT (x->>'id')::text, (x->>'name')::text, (x->>'team_id')::text, ARRAY(SELECT jsonb_array_elements_text(x->'role_ids')), (x->>'max_hours_per_week')::integer, ARRAY(SELECT jsonb_array_elements_text(x->'unavailable_dates')), (x->'preferences'), (x->>'color')::text, (x->'daily_availability'), p_organization_id, (x->>'email')::text, (x->>'user_id')::uuid, (x->'personal_rotation'), (x->>'max_shifts_per_week')::integer, (x->>'phone')::text, (x->>'is_active')::boolean, (x->'custom_fields'), (x->>'is_commander')::boolean
      FROM jsonb_array_elements(v_data) AS x;
    ELSIF v_table_name = 'task_templates' THEN
      INSERT INTO public.task_templates (id, name, duration_hours, required_people, required_role_ids, min_rest_hours_before, difficulty, color, scheduling_type, default_start_time, specific_date, organization_id, is_24_7, role_composition, segments, start_date, end_date, assigned_team_id)
      SELECT (x->>'id')::text, (x->>'name')::text, (x->>'duration_hours')::integer, (x->>'required_people')::integer, ARRAY(SELECT jsonb_array_elements_text(x->'required_role_ids')), (x->>'min_rest_hours_before')::integer, (x->>'difficulty')::integer, (x->>'color')::text, (x->>'scheduling_type')::text, (x->>'default_start_time')::text, (x->>'specific_date')::text, p_organization_id, (x->>'is_24_7')::boolean, (x->'role_composition'), (x->'segments'), (x->>'start_date')::text, (x->>'end_date')::text, (x->>'assigned_team_id')::text
      FROM jsonb_array_elements(v_data) AS x;
    ELSIF v_table_name = 'shifts' THEN
      INSERT INTO public.shifts (id, task_id, start_time, end_time, assigned_person_ids, is_locked, organization_id, is_cancelled, requirements, segment_id)
      SELECT (x->>'id')::text, (x->>'task_id')::text, (x->>'start_time')::timestamp with time zone, (x->>'end_time')::timestamp with time zone, ARRAY(SELECT jsonb_array_elements_text(x->'assigned_person_ids')), (x->>'is_locked')::boolean, p_organization_id, (x->>'is_cancelled')::boolean, (x->'requirements'), (x->>'segment_id')::text
      FROM jsonb_array_elements(v_data) AS x;
    ELSIF v_table_name = 'absences' THEN
      INSERT INTO public.absences (id, person_id, organization_id, start_date, end_date, reason, created_at, start_time, end_time, status, approved_by, approved_at)
      SELECT (x->>'id')::uuid, (x->>'person_id')::text, p_organization_id, (x->>'start_date')::text, (x->>'end_date')::text, (x->>'reason')::text, (x->>'created_at')::timestamp with time zone, (x->>'start_time')::text, (x->>'end_time')::text, (x->>'status')::text, (x->>'approved_by')::uuid, (x->>'approved_at')::timestamp with time zone
      FROM jsonb_array_elements(v_data) AS x;
    ELSIF v_table_name = 'daily_presence' THEN
      INSERT INTO public.daily_presence (id, date, person_id, organization_id, status, source, created_at, updated_at, start_time, end_time, arrival_date, departure_date, last_editor_id, home_status_type)
      SELECT (x->>'id')::uuid, (x->>'date')::date, (x->>'person_id')::text, p_organization_id, (x->>'status')::text, (x->>'source')::text, (x->>'created_at')::timestamp with time zone, (x->>'updated_at')::timestamp with time zone, (x->>'start_time')::text, (x->>'end_time')::text, (x->>'arrival_date')::timestamp with time zone, (x->>'departure_date')::timestamp with time zone, (x->>'last_editor_id')::uuid, (x->>'home_status_type')::text
      FROM jsonb_array_elements(v_data) AS x;
    ELSIF v_table_name = 'equipment' THEN
      INSERT INTO public.equipment (id, organization_id, type, serial_number, assigned_to_id, signed_at, last_verified_at, status, notes, created_at, updated_at)
      SELECT (x->>'id')::text, p_organization_id::text, (x->>'type')::text, (x->>'serial_number')::text, (x->>'assigned_to_id')::text, (x->>'signed_at')::timestamp with time zone, (x->>'last_verified_at')::timestamp with time zone, (x->>'status')::text, (x->>'notes')::text, (x->>'created_at')::timestamp with time zone, (x->>'updated_at')::timestamp with time zone
      FROM jsonb_array_elements(v_data) AS x;
    ELSIF v_table_name = 'equipment_daily_checks' THEN
      INSERT INTO public.equipment_daily_checks (id, equipment_id, organization_id, check_date, status, checked_by, created_at, updated_at)
      SELECT (x->>'id')::text, (x->>'equipment_id')::text, p_organization_id, (x->>'check_date')::date, (x->>'status')::text, (x->>'checked_by')::uuid, (x->>'created_at')::timestamp with time zone, (x->>'updated_at')::timestamp with time zone
      FROM jsonb_array_elements(v_data) AS x;
    ELSIF v_table_name = 'hourly_blockages' THEN
      INSERT INTO public.hourly_blockages (id, person_id, organization_id, date, start_time, end_time, reason, created_at)
      SELECT (x->>'id')::uuid, (x->>'person_id')::text, p_organization_id, (x->>'date')::date, (x->>'start_time')::text, (x->>'end_time')::text, (x->>'reason')::text, (x->>'created_at')::timestamp with time zone
      FROM jsonb_array_elements(v_data) AS x;
    ELSIF v_table_name = 'daily_attendance_snapshots' THEN
      INSERT INTO public.daily_attendance_snapshots (id, organization_id, person_id, date, status, start_time, end_time, captured_at, snapshot_definition_time)
      SELECT (x->>'id')::uuid, p_organization_id, (x->>'person_id')::text, (x->>'date')::date, (x->>'status')::text, (x->>'start_time')::text, (x->>'end_time')::text, (x->>'captured_at')::timestamp with time zone, (x->>'snapshot_definition_time')::text
      FROM jsonb_array_elements(v_data) AS x;
    ELSIF v_table_name = 'user_load_stats' THEN
      INSERT INTO public.user_load_stats (organization_id, person_id, total_load_score, shifts_count, critical_shift_count, calculation_period_start, calculation_period_end, last_updated, created_at)
      SELECT p_organization_id, (x->>'person_id')::text, (x->>'total_load_score')::numeric, (x->>'shifts_count')::integer, (x->>'critical_shift_count')::integer, (x->>'calculation_period_start')::timestamp with time zone, (x->>'calculation_period_end')::timestamp with time zone, (x->>'last_updated')::timestamp with time zone, (x->>'created_at')::timestamp with time zone
      FROM jsonb_array_elements(v_data) AS x;
    ELSIF v_table_name = 'mission_reports' THEN
      INSERT INTO public.mission_reports (id, organization_id, shift_id, summary, exceptional_events, points_to_preserve, points_to_improve, cumulative_info, ongoing_log, submitted_by, last_editor_id, submitted_at, created_at, updated_at)
      SELECT (x->>'id')::uuid, p_organization_id, (x->>'shift_id')::text, (x->>'summary')::text, (x->>'exceptional_events')::text, (x->>'points_to_preserve')::text, (x->>'points_to_improve')::text, (x->>'cumulative_info')::text, (x->'ongoing_log'), (x->>'submitted_by')::uuid, (x->>'last_editor_id')::uuid, (x->>'submitted_at')::timestamp with time zone, (x->>'created_at')::timestamp with time zone, (x->>'updated_at')::timestamp with time zone
      FROM jsonb_array_elements(v_data) AS x;
    ELSIF v_table_name = 'scheduling_constraints' THEN
      INSERT INTO public.scheduling_constraints (id, person_id, type, task_id, start_time, end_time, organization_id, created_at, team_id, role_id, description)
      SELECT (x->>'id')::uuid, (x->>'person_id')::text, (x->>'type')::public.constraint_type, (x->>'task_id')::text, (x->>'start_time')::timestamp with time zone, (x->>'end_time')::timestamp with time zone, p_organization_id, (x->>'created_at')::timestamp with time zone, (x->>'team_id')::text, (x->>'role_id')::text, (x->>'description')::text
      FROM jsonb_array_elements(v_data) AS x;
    ELSIF v_table_name = 'team_rotations' THEN
      INSERT INTO public.team_rotations (id, organization_id, team_id, days_on_base, days_at_home, cycle_length, start_date, end_date, arrival_time, departure_time, created_at, updated_at)
      SELECT (x->>'id')::uuid, (x->>'organization_id')::text, (x->>'team_id')::text, (x->>'days_on_base')::integer, (x->>'days_at_home')::integer, (x->>'cycle_length')::integer, (x->>'start_date')::date, (x->>'end_date')::date, (x->>'arrival_time')::time, (x->>'departure_time')::time, (x->>'created_at')::timestamp with time zone, (x->>'updated_at')::timestamp with time zone
      FROM jsonb_array_elements(v_data) AS x;
    ELSIF v_table_name = 'organization_settings' THEN
      INSERT INTO public.organization_settings (organization_id, night_shift_start, night_shift_end, created_at, updated_at, viewer_schedule_days, rotation_cycle_days, rotation_start_date, min_daily_staff, default_days_on, default_days_off, custom_fields_schema, home_forecast_days, inter_person_constraints, morning_report_time)
      SELECT p_organization_id, (x->>'night_shift_start')::time, (x->>'night_shift_end')::time, (x->>'created_at')::timestamp with time zone, (x->>'updated_at')::timestamp with time zone, (x->>'viewer_schedule_days')::integer, (x->>'rotation_cycle_days')::integer, (x->>'rotation_start_date')::date, (x->>'min_daily_staff')::integer, (x->>'default_days_on')::integer, (x->>'default_days_off')::integer, (x->'custom_fields_schema'), (x->>'home_forecast_days')::integer, (x->'inter_person_constraints'), (x->>'morning_report_time')::text
      FROM jsonb_array_elements(v_data) AS x;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Increase snapshot limit to 10
CREATE OR REPLACE FUNCTION public.enforce_snapshot_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.organization_snapshots WHERE organization_id = NEW.organization_id) >= 10 THEN
    RAISE EXCEPTION 'מגבלת 10 גרסאות לארגון הושגה. נא למחוק גרסה ישנה לפני יצירת חדשה.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Granting permissions
GRANT EXECUTE ON FUNCTION public.get_org_data_bundle(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_snapshot_data_bundle(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_snapshot(uuid, uuid, text[]) TO authenticated;
