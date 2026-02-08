# Supabase DB Structure (Full Catalog)

Date: 2026‑02‑08
Source: Supabase MCP (schema: public)

This document lists **all tables**, their **columns**, **primary keys**, **RLS status**, and **foreign key dependencies** as currently reported by Supabase.

---

## Legend
- **RLS:** ON/OFF
- **PK:** Primary key column(s)
- **FK:** Foreign key dependencies (source → target)

---

## Table Catalog (public schema)

### organizations
- **RLS:** ON
- **PK:** id
- **Columns:**
  - id (uuid, default: gen_random_uuid)
  - name (text)
  - created_at (timestamptz, default: now)
  - invite_token (text, unique, nullable)
  - is_invite_link_active (bool, default: false)
  - invite_link_role (text, default: viewer)
  - invite_link_template_id (uuid, nullable)
  - battalion_id (uuid, nullable)
  - is_hq (bool, default: false)
  - tier (text, default: pro, check: lite|pro|battalion)
  - org_type (text, default: company, check: company|battalion)
  - engine_version (text, default: v1_legacy, check: v1_legacy|v2_write_based)
- **FKs (incoming):**
  - equipment_daily_checks.organization_id → organizations.id
  - profiles.organization_id → organizations.id
  - teams.organization_id → organizations.id
  - roles.organization_id → organizations.id
  - people.organization_id → organizations.id
  - task_templates.organization_id → organizations.id
  - shifts.organization_id → organizations.id
  - organization_invites.organization_id → organizations.id
  - organization_settings.organization_id → organizations.id
  - permission_templates.organization_id → organizations.id
  - audit_logs.organization_id → organizations.id
  - user_load_stats.organization_id → organizations.id
  - scheduling_constraints.organization_id → organizations.id
  - daily_presence.organization_id → organizations.id
  - acknowledged_warnings.organization_id → organizations.id
  - absences.organization_id → organizations.id
  - war_clock_items.organization_id → organizations.id
  - organization_activity_logs.organization_id → organizations.id
  - organizations.invite_link_template_id → permission_templates.id
  - organizations.battalion_id → battalions.id
  - system_messages.organization_id → organizations.id
  - hourly_blockages.organization_id → organizations.id
  - table_snapshots.organization_id → organizations.id
  - gate_authorized_vehicles.organization_id → organizations.id
  - gate_logs.organization_id → organizations.id
  - mission_reports.organization_id → organizations.id
  - rota_generation_history.organization_id → organizations.id
  - daily_attendance_snapshots.organization_id → organizations.id
  - unified_presence.organization_id → organizations.id
  - organization_snapshots.organization_id → organizations.id
  - carpool_rides.organization_id → organizations.id

### profiles
- **RLS:** ON
- **PK:** id
- **Columns:**
  - id (uuid)
  - email (text)
  - full_name (text, nullable)
  - organization_id (uuid, nullable)
  - created_at (timestamptz, default: now)
  - permissions (jsonb, default: {screens:{}, dataScope: organization, ...})
  - is_super_admin (bool, default: false)
  - permission_template_id (uuid, nullable)
  - terms_accepted_at (timestamptz, nullable)
  - can_switch_companies (bool, default: false)
  - battalion_id (uuid, nullable)
- **FKs:**
  - profiles.id → auth.users.id
  - profiles.organization_id → organizations.id
  - profiles.permission_template_id → permission_templates.id
  - profiles.battalion_id → battalions.id
  - organization_activity_logs.profile_id → profiles.id
  - daily_presence.last_editor_id → profiles.id
  - gate_logs.entry_reported_by → profiles.id
  - gate_logs.exit_reported_by → profiles.id
  - unified_presence.last_editor_id → profiles.id
  - system_messages.created_by → profiles.id
  - organization_snapshots.created_by → profiles.id
  - equipment.created_by → profiles.id
  - organization_invites.invited_by → profiles.id
  - equipment_daily_checks.checked_by → profiles.id
  - absences.approved_by → profiles.id
  - rota_generation_history.created_by → profiles.id

### teams
- **RLS:** ON
- **PK:** id
- **Columns:**
  - id (text, default: gen_random_uuid)
  - name (text)
  - color (text)
  - organization_id (uuid, nullable)
- **FKs:**
  - teams.organization_id → organizations.id
  - people.team_id → teams.id
  - task_templates.assigned_team_id → teams.id
  - team_rotations.team_id → teams.id

### roles
- **RLS:** ON
- **PK:** id
- **Columns:**
  - id (text, default: gen_random_uuid)
  - name (text)
  - color (text)
  - icon (text, nullable)
  - organization_id (uuid, nullable)
- **FKs:**
  - roles.organization_id → organizations.id

### people
- **RLS:** ON
- **PK:** id
- **Columns:**
  - id (text, default: gen_random_uuid)
  - name (text)
  - team_id (text, nullable)
  - role_ids (text[], default: {})
  - max_hours_per_week (int4, default: 40)
  - unavailable_dates (text[], default: {})
  - preferences (jsonb, default: {preferNight:false, avoidWeekends:false})
  - color (text)
  - daily_availability (jsonb, default: {})
  - organization_id (uuid, nullable)
  - email (text, nullable)
  - user_id (uuid, nullable)
  - personal_rotation (jsonb, nullable)
  - max_shifts_per_week (int4, default: 5)
  - phone (text, nullable)
  - is_active (bool, default: true)
  - custom_fields (jsonb, default: {})
  - is_commander (bool, default: false)
- **FKs:**
  - people.organization_id → organizations.id
  - people.team_id → teams.id
  - people.user_id → auth.users.id
  - absences.person_id → people.id
  - daily_presence.person_id → people.id
  - unified_presence.person_id → people.id
  - daily_attendance_snapshots.person_id → people.id
  - hourly_blockages.person_id → people.id
  - user_load_stats.person_id → people.id
  - scheduling_constraints.person_id → people.id
  - carpool_rides.creator_id → people.id

### task_templates
- **RLS:** OFF
- **PK:** id
- **Columns:**
  - id (text, default: gen_random_uuid)
  - name (text)
  - duration_hours (int4, nullable)
  - required_people (int4, nullable)
  - required_role_ids (text[], default: {})
  - min_rest_hours_before (int4, default: 8)
  - difficulty (int4, default: 3)
  - color (text)
  - scheduling_type (text, default: continuous)
  - default_start_time (text, nullable)
  - specific_date (text, nullable)
  - organization_id (uuid)
  - is_24_7 (bool, default: false)
  - role_composition (jsonb, default: [])
  - segments (jsonb, default: [])
  - start_date (text, nullable)
  - end_date (text, nullable)
  - assigned_team_id (text, nullable)
  - icon (text, nullable)
  - created_at (timestamptz, default: now)
- **FKs:**
  - task_templates.organization_id → organizations.id
  - task_templates.assigned_team_id → teams.id
  - shifts.task_id → task_templates.id
  - scheduling_constraints.task_id → task_templates.id

### shifts
- **RLS:** ON
- **PK:** id
- **Columns:**
  - id (text, default: gen_random_uuid)
  - task_id (text, nullable)
  - start_time (timestamptz)
  - end_time (timestamptz)
  - assigned_person_ids (text[], default: {})
  - is_locked (bool, default: false)
  - organization_id (uuid, nullable)
  - is_cancelled (bool, default: false)
  - requirements (jsonb, nullable)
  - segment_id (text, nullable)
  - metadata (jsonb, default: {})
- **FKs:**
  - shifts.organization_id → organizations.id
  - shifts.task_id → task_templates.id
  - mission_reports.shift_id → shifts.id

### organization_invites
- **RLS:** OFF
- **PK:** id
- **Columns:**
  - id (uuid, default: uuid_generate_v4)
  - organization_id (uuid)
  - email (text)
  - invited_by (uuid, nullable)
  - created_at (timestamptz, default: now)
  - expires_at (timestamptz, default: now + 7 days)
  - accepted (bool, default: false)
  - template_id (uuid, nullable)
- **FKs:**
  - organization_invites.organization_id → organizations.id
  - organization_invites.invited_by → profiles.id
  - organization_invites.template_id → permission_templates.id

### organization_settings
- **RLS:** ON
- **PK:** organization_id
- **Columns:**
  - organization_id (uuid)
  - night_shift_start (time, default: 22:00)
  - night_shift_end (time, default: 06:00)
  - created_at (timestamptz, default: now)
  - updated_at (timestamptz, default: now)
  - viewer_schedule_days (int4, default: 2)
  - rotation_cycle_days (int4, default: 14)
  - rotation_start_date (date, nullable)
  - min_daily_staff (int4, default: 0)
  - default_days_on (int4, default: 11)
  - default_days_off (int4, default: 3)
  - custom_fields_schema (jsonb, default: [])
  - home_forecast_days (int4, default: 30)
  - inter_person_constraints (jsonb, default: [])
  - morning_report_time (text, default: 09:00)
  - attendance_reporting_enabled (bool, default: false)
  - authorized_locations (jsonb, default: [])
  - home_page_config (jsonb, default: {})
- **FKs:**
  - organization_settings.organization_id → organizations.id

### acknowledged_warnings
- **RLS:** OFF
- **PK:** id
- **Columns:**
  - id (uuid, default: gen_random_uuid)
  - organization_id (uuid)
  - warning_id (text)
  - acknowledged_at (timestamptz, default: now)
- **FKs:**
  - acknowledged_warnings.organization_id → organizations.id

### audit_logs
- **RLS:** ON
- **PK:** id
- **Columns:**
  - id (uuid, default: gen_random_uuid)
  - organization_id (uuid, nullable)
  - user_id (uuid, nullable)
  - user_email (text, nullable)
  - user_name (text, nullable)
  - event_type (text)
  - event_category (text)
  - action_description (text)
  - entity_type (text, nullable)
  - entity_id (text, nullable)
  - entity_name (text, nullable)
  - before_data (jsonb, nullable)
  - after_data (jsonb, nullable)
  - ip_address (text, nullable)
  - user_agent (text, nullable)
  - session_id (text, nullable)
  - created_at (timestamptz, default: now)
  - log_level (varchar, default: INFO)
  - performance_ms (int4, nullable)
  - component_name (varchar, nullable)
  - stack_trace (text, nullable)
  - metadata (jsonb, nullable)
  - url (text, nullable)
  - client_timestamp (timestamptz, nullable)
  - device_type (text, nullable)
  - city (text, nullable)
  - country (text, nullable)
- **FKs:**
  - audit_logs.organization_id → organizations.id
  - audit_logs.user_id → auth.users.id

### contact_messages
- **RLS:** ON
- **PK:** id
- **Columns:**
  - id (uuid, default: gen_random_uuid)
  - name (text)
  - phone (text, nullable)
  - message (text)
  - image_url (text, nullable)
  - created_at (timestamptz, default: timezone('utc', now()))
  - user_id (uuid, nullable)
  - status (text, default: new)
  - admin_notes (text, nullable)
  - updated_at (timestamptz, default: now)
  - email (text, nullable)
- **FKs:**
  - contact_messages.user_id → auth.users.id

### scheduling_constraints
- **RLS:** ON
- **PK:** id
- **Columns:**
  - id (uuid, default: gen_random_uuid)
  - person_id (text, nullable)
  - type (constraint_type enum: always_assign|never_assign|time_block)
  - task_id (text, nullable)
  - start_time (timestamptz, nullable)
  - end_time (timestamptz, nullable)
  - organization_id (uuid)
  - created_at (timestamptz, default: now)
  - team_id (text, nullable)
  - role_id (text, nullable)
  - description (text, nullable)
- **FKs:**
  - scheduling_constraints.organization_id → organizations.id
  - scheduling_constraints.person_id → people.id
  - scheduling_constraints.task_id → task_templates.id

### team_rotations
- **RLS:** ON
- **PK:** id
- **Columns:**
  - id (uuid, default: uuid_generate_v4)
  - organization_id (text)
  - team_id (text)
  - days_on_base (int4, default: 11)
  - days_at_home (int4, default: 3)
  - cycle_length (int4, default: 14)
  - start_date (date)
  - end_date (date, nullable)
  - arrival_time (time, default: 10:00)
  - departure_time (time, default: 14:00)
  - created_at (timestamptz, default: now)
  - updated_at (timestamptz, default: now)
- **FKs:**
  - team_rotations.team_id → teams.id

### lottery_history
- **RLS:** OFF
- **PK:** id
- **Columns:**
  - id (uuid, default: uuid_generate_v4)
  - created_at (timestamptz, default: timezone('utc', now()))
  - organization_id (text)
  - winners (jsonb)
  - mode (text)
  - context (text, nullable)
  - user_id (uuid, nullable)
- **FKs:**
  - lottery_history.user_id → auth.users.id

### daily_presence
- **RLS:** ON
- **PK:** id
- **Columns:**
  - id (uuid, default: gen_random_uuid)
  - date (date)
  - person_id (text)
  - organization_id (uuid)
  - status (text, check: home|base|unavailable|leave)
  - source (text, default: algorithm)
  - created_at (timestamptz, default: now)
  - updated_at (timestamptz, default: now)
  - start_time (text, nullable)
  - end_time (text, nullable)
  - arrival_date (timestamptz, nullable)
  - departure_date (timestamptz, nullable)
  - last_editor_id (uuid, nullable)
  - home_status_type (text, nullable, check: leave_shamp|gimel|absent|organization_days|not_in_shamp)
  - actual_arrival_at (timestamptz, nullable)
  - actual_departure_at (timestamptz, nullable)
  - reported_location_id (text, nullable)
  - reported_location_name (text, nullable)
- **FKs:**
  - daily_presence.organization_id → organizations.id
  - daily_presence.person_id → people.id
  - daily_presence.last_editor_id → profiles.id

### absences
- **RLS:** ON
- **PK:** id
- **Columns:**
  - id (uuid, default: gen_random_uuid)
  - person_id (text)
  - organization_id (uuid)
  - start_date (text)
  - end_date (text)
  - reason (text, nullable)
  - created_at (timestamptz, default: now)
  - start_time (text, default: 00:00)
  - end_time (text, default: 23:59)
  - status (text, default: pending)
  - approved_by (uuid, nullable)
  - approved_at (timestamptz, nullable)
- **FKs:**
  - absences.organization_id → organizations.id
  - absences.person_id → people.id
  - absences.approved_by → profiles.id

### war_clock_items
- **RLS:** ON
- **PK:** id
- **Columns:**
  - id (uuid, default: gen_random_uuid)
  - organization_id (uuid)
  - start_time (text)
  - end_time (text)
  - description (text)
  - target_type (text, check: all|team|role)
  - target_id (text, nullable)
  - created_at (timestamptz, default: now)
  - days_of_week (int4[], default: {0..6})
  - start_date (date, nullable)
  - end_date (date, nullable)
- **FKs:**
  - war_clock_items.organization_id → organizations.id

### equipment
- **RLS:** OFF
- **PK:** id
- **Columns:**
  - id (text)
  - organization_id (text, nullable)
  - type (text)
  - serial_number (text)
  - assigned_to_id (text, nullable)
  - signed_at (timestamptz, nullable)
  - last_verified_at (timestamptz, nullable)
  - status (text, default: present)
  - notes (text, nullable)
  - created_at (timestamptz, default: now)
  - updated_at (timestamptz, default: now)
  - created_by (uuid, nullable)
- **FKs:**
  - equipment.created_by → profiles.id
  - equipment_daily_checks.equipment_id → equipment.id

### permission_templates
- **RLS:** ON
- **PK:** id
- **Columns:**
  - id (uuid, default: gen_random_uuid)
  - organization_id (uuid, nullable)
  - name (text)
  - permissions (jsonb, default: {})
  - created_at (timestamptz, default: now)
  - updated_at (timestamptz, default: now)
  - description (text, nullable)
- **FKs:**
  - permission_templates.organization_id → organizations.id
  - organizations.invite_link_template_id → permission_templates.id
  - organization_invites.template_id → permission_templates.id
  - profiles.permission_template_id → permission_templates.id

### user_load_stats
- **RLS:** ON
- **PK:** id
- **Columns:**
  - id (uuid, default: gen_random_uuid)
  - organization_id (uuid)
  - person_id (text)
  - total_load_score (numeric, default: 0)
  - shifts_count (int4, default: 0)
  - critical_shift_count (int4, default: 0)
  - calculation_period_start (timestamptz)
  - calculation_period_end (timestamptz)
  - last_updated (timestamptz, default: now)
  - created_at (timestamptz, default: now)
- **FKs:**
  - user_load_stats.organization_id → organizations.id
  - user_load_stats.person_id → people.id

### organization_activity_logs
- **RLS:** ON
- **PK:** id
- **Columns:**
  - id (uuid, default: uuid_generate_v4)
  - organization_id (uuid)
  - user_id (uuid, nullable)
  - profile_id (uuid, nullable)
  - action_type (text)
  - resource_type (text, nullable)
  - resource_id (text, nullable)
  - details (jsonb, nullable)
  - ip_address (inet, nullable)
  - user_agent (text, nullable)
  - created_at (timestamptz, default: now)
- **FKs:**
  - organization_activity_logs.organization_id → organizations.id
  - organization_activity_logs.user_id → auth.users.id
  - organization_activity_logs.profile_id → profiles.id

### battalions
- **RLS:** ON
- **PK:** id
- **Columns:**
  - id (uuid, default: gen_random_uuid)
  - name (text)
  - created_at (timestamptz, default: now)
  - code (text, nullable, unique)
  - morning_report_time (text, default: 09:00)
  - is_company_switcher_enabled (bool, default: false)
- **FKs:**
  - profiles.battalion_id → battalions.id
  - organizations.battalion_id → battalions.id
  - gate_authorized_vehicles.battalion_id → battalions.id
  - gate_logs.battalion_id → battalions.id

### system_messages
- **RLS:** ON
- **PK:** id
- **Columns:**
  - id (uuid, default: gen_random_uuid)
  - organization_id (uuid)
  - title (text, nullable)
  - message (text)
  - is_active (bool, default: true)
  - created_at (timestamptz, default: timezone('utc', now()))
  - created_by (uuid, nullable)
  - target_team_ids (uuid[], nullable)
  - target_role_ids (uuid[], nullable)
  - message_type (text, default: POPUP, check: POPUP|BULLETIN)
- **FKs:**
  - system_messages.organization_id → organizations.id
  - system_messages.created_by → profiles.id

### hourly_blockages
- **RLS:** ON
- **PK:** id
- **Columns:**
  - id (uuid, default: gen_random_uuid)
  - organization_id (uuid)
  - person_id (text)
  - date (date)
  - start_time (text)
  - end_time (text)
  - reason (text, nullable)
  - created_at (timestamptz, default: timezone('utc', now()))
- **FKs:**
  - hourly_blockages.organization_id → organizations.id
  - hourly_blockages.person_id → people.id

### table_snapshots
- **RLS:** ON
- **PK:** id
- **Columns:**
  - id (uuid, default: gen_random_uuid)
  - organization_id (uuid)
  - table_name (text)
  - data (jsonb)
  - created_at (timestamptz, default: now)
- **FKs:**
  - table_snapshots.organization_id → organizations.id

### gate_authorized_vehicles
- **RLS:** ON
- **PK:** id
- **Columns:**
  - id (uuid, default: gen_random_uuid)
  - organization_id (uuid)
  - plate_number (text)
  - owner_name (text)
  - vehicle_type (text)
  - is_permanent (bool, default: false)
  - expiry_date (timestamptz, nullable)
  - notes (text, nullable)
  - created_at (timestamptz, default: now)
  - updated_at (timestamptz, default: now)
  - valid_from (timestamptz, nullable)
  - valid_until (timestamptz, nullable)
  - battalion_id (uuid, nullable)
- **FKs:**
  - gate_authorized_vehicles.organization_id → organizations.id
  - gate_authorized_vehicles.battalion_id → battalions.id

### gate_logs
- **RLS:** ON
- **PK:** id
- **Columns:**
  - id (uuid, default: gen_random_uuid)
  - organization_id (uuid)
  - plate_number (text)
  - driver_name (text)
  - entry_time (timestamptz, default: now)
  - exit_time (timestamptz, nullable)
  - status (text, default: inside)
  - notes (text, nullable)
  - created_at (timestamptz, default: now)
  - updated_at (timestamptz, default: now)
  - battalion_id (uuid, nullable)
  - entry_type (text, default: vehicle, check: vehicle|pedestrian)
  - is_exceptional (bool, default: false)
  - entry_reported_by (uuid, nullable)
  - exit_reported_by (uuid, nullable)
- **FKs:**
  - gate_logs.organization_id → organizations.id
  - gate_logs.battalion_id → battalions.id
  - gate_logs.entry_reported_by → profiles.id
  - gate_logs.exit_reported_by → profiles.id

### mission_reports
- **RLS:** ON
- **PK:** id
- **Columns:**
  - id (uuid, default: gen_random_uuid)
  - organization_id (uuid)
  - shift_id (text, unique)
  - summary (text, nullable)
  - exceptional_events (text, nullable)
  - points_to_preserve (text, nullable)
  - points_to_improve (text, nullable)
  - ongoing_log (jsonb, default: [])
  - submitted_by (uuid, nullable)
  - submitted_at (timestamptz, nullable)
  - created_at (timestamptz, default: now)
  - updated_at (timestamptz, default: now)
  - last_editor_id (uuid, nullable)
  - cumulative_info (text, nullable)
- **FKs:**
  - mission_reports.organization_id → organizations.id
  - mission_reports.shift_id → shifts.id
  - mission_reports.submitted_by → auth.users.id
  - mission_reports.last_editor_id → auth.users.id

### equipment_daily_checks
- **RLS:** ON
- **PK:** id
- **Columns:**
  - id (text, default: check-<epoch>-<rand>)
  - equipment_id (text)
  - organization_id (uuid)
  - check_date (date)
  - status (text, check: present|missing|damaged|lost)
  - checked_by (uuid, nullable)
  - created_at (timestamptz, default: now)
  - updated_at (timestamptz, default: now)
- **FKs:**
  - equipment_daily_checks.equipment_id → equipment.id
  - equipment_daily_checks.organization_id → organizations.id
  - equipment_daily_checks.checked_by → profiles.id

### rota_generation_history
- **RLS:** ON
- **PK:** id
- **Columns:**
  - id (uuid, default: uuid_generate_v4)
  - organization_id (uuid)
  - created_at (timestamptz, default: now)
  - config (jsonb)
  - roster_data (jsonb)
  - manual_overrides (jsonb, nullable)
  - created_by (uuid, nullable)
  - title (text, nullable)
- **FKs:**
  - rota_generation_history.organization_id → organizations.id
  - rota_generation_history.created_by → profiles.id

### daily_attendance_snapshots
- **RLS:** ON
- **PK:** id
- **Columns:**
  - id (uuid, default: gen_random_uuid)
  - organization_id (uuid)
  - person_id (text)
  - date (date)
  - status (text)
  - start_time (text, nullable)
  - end_time (text, nullable)
  - captured_at (timestamptz, default: now)
  - snapshot_definition_time (text)
- **FKs:**
  - daily_attendance_snapshots.organization_id → organizations.id
  - daily_attendance_snapshots.person_id → people.id

### unified_presence
- **RLS:** ON
- **PK:** id
- **Columns:**
  - id (uuid, default: gen_random_uuid)
  - organization_id (uuid)
  - person_id (text)
  - date (date)
  - status (text, check: home|base|full|unavailable|leave|arrival|departure)
  - start_time (text, default: 00:00)
  - end_time (text, default: 23:59)
  - source (text)
  - source_id (text, nullable)
  - created_at (timestamptz, default: now)
  - updated_at (timestamptz, default: now)
  - reason (text, nullable)
  - last_editor_id (uuid, nullable)
  - arrival_date (timestamptz, nullable)
  - departure_date (timestamptz, nullable)
  - home_status_type (text, nullable, check: leave_shamp|gimel|absent|organization_days|not_in_shamp)
- **FKs:**
  - unified_presence.organization_id → organizations.id
  - unified_presence.person_id → people.id
  - unified_presence.last_editor_id → profiles.id

### organization_snapshots
- **RLS:** ON
- **PK:** id
- **Columns:**
  - id (uuid, default: gen_random_uuid)
  - organization_id (uuid)
  - name (text)
  - description (text, nullable)
  - created_by (uuid, nullable)
  - created_at (timestamptz, default: now)
  - snapshot_date (timestamptz, default: now)
  - tables_included (text[])
  - record_counts (jsonb)
  - metadata (jsonb, default: {})
- **FKs:**
  - organization_snapshots.organization_id → organizations.id
  - organization_snapshots.created_by → profiles.id
  - snapshot_table_data.snapshot_id → organization_snapshots.id

### snapshot_table_data
- **RLS:** ON
- **PK:** id
- **Columns:**
  - id (uuid, default: gen_random_uuid)
  - snapshot_id (uuid)
  - table_name (text)
  - data (jsonb)
  - row_count (int4)
  - created_at (timestamptz, default: now)
- **FKs:**
  - snapshot_table_data.snapshot_id → organization_snapshots.id

### snapshot_operations_log
- **RLS:** ON
- **PK:** id
- **Columns:**
  - id (uuid, default: gen_random_uuid)
  - organization_id (uuid)
  - operation_type (text, check: restore|create|delete)
  - snapshot_id (uuid, nullable)
  - snapshot_name (text, nullable)
  - user_id (uuid)
  - started_at (timestamptz, default: now)
  - completed_at (timestamptz, nullable)
  - status (text, check: started|in_progress|success|failed)
  - error_message (text, nullable)
  - error_code (text, nullable)
  - duration_ms (int4, nullable)
  - pre_restore_backup_id (uuid, nullable)
  - records_affected (int4, nullable)
  - metadata (jsonb, nullable)
  - created_at (timestamptz, default: now)

### deleted_people_archive
- **RLS:** ON
- **PK:** id
- **Columns:**
  - id (uuid, default: gen_random_uuid)
  - person_id (text)
  - person_data (jsonb)
  - organization_id (uuid)
  - deleted_by (uuid)
  - deleted_at (timestamptz, default: now)
  - deletion_reason (text, nullable)
  - related_data_counts (jsonb, nullable)
  - can_restore (bool, default: true)
  - restored_at (timestamptz, nullable)
  - restored_by (uuid, nullable)
  - notes (text, nullable)
  - created_at (timestamptz, default: now)

### carpool_rides
- **RLS:** ON
- **PK:** id
- **Columns:**
  - id (uuid, default: gen_random_uuid)
  - organization_id (uuid)
  - creator_id (text)
  - driver_name (text)
  - driver_phone (text, nullable)
  - type (text, default: offer, check: offer|request)
  - direction (text, nullable, check: to_base|to_home)
  - date (date)
  - time (text)
  - location (text)
  - seats (int4, default: 3)
  - notes (text, nullable)
  - created_at (timestamptz, default: now)
  - is_full (bool, default: false)
- **FKs:**
  - carpool_rides.organization_id → organizations.id
  - carpool_rides.creator_id → people.id

---

## Notes
- Tables with **RLS OFF** should be reviewed for exposure: task_templates, organization_invites, acknowledged_warnings, lottery_history, equipment.
- Some columns include **CHECK** constraints (listed above) that enforce allowed values.

If you want, I can add indexes, triggers, and views in a follow‑up.