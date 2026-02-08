# סטטוס העברת Backend ל‑Supabase וסידור RLS

תאריך סיכום: 2026‑02‑07

## מקורות שנבדקו
- תיקיות שירותים: src/services/
- מודולים/עמודים: src/features/
- SQL/Migrations: supabase/migrations/*.sql + קבצי SQL ברוט

> הסיכום מבוסס על קריאות Supabase שנמצאו בקוד ועל קבצי SQL קיימים. אם משהו קיים מחוץ למאגר – זה לא נכלל כאן.

---

## 1) מה בוצע (נמצא בקוד וב‑SQL)

### פונקציות RPC קיימות/בשימוש
**RPCs עבור אפליקציה (כולל SECURITY DEFINER):**
- upsert_person, upsert_team, upsert_role, upsert_people, insert_teams, insert_roles
- delete_person_secure, delete_person_cascade, delete_people_cascade
- delete_team_secure, delete_role_secure
- deactivate_personnel
- upsert_task_template, delete_task_template_secure
- upsert_constraint, upsert_absence
- get_org_data_bundle
- get_org_analytics_summary, get_recent_system_activity
- get_global_stats_aggregated, get_system_activity_chart, get_top_organizations,
  get_system_users_chart, get_system_orgs_chart, get_org_top_users,
  get_org_top_pages, get_org_top_actions, get_org_activity_graph,
  get_dashboard_kpis, get_new_orgs_stats, get_top_users,
  get_new_orgs_list, get_new_users_list, get_active_users_stats
- get_org_name_by_token, join_organization_by_token
- claim_person_profile
- delete_custom_field_data
- log_snapshot_operation_start, log_snapshot_operation_complete, restore_snapshot
- update_organization_settings (נוסף לאחרונה)
- upsert_equipment (נוסף לאחרונה)

> רוב ה‑RPCs האדמיניסטרטיביים מוגדרים במיגרציות תחת supabase/migrations/.

### קבצי SQL עם RLS/אבטחה
נמצאו קבצי SQL שמכילים הפעלה של RLS ופוליסיז:
- security_patch_rls_v2.sql — חיזוק אבטחה + פונקציות מאובטחות + GRANTs
- create_snapshot_tables.sql — RLS + פוליסיז לטבלאות snapshots
- deleted_people_archive.sql — RLS + פוליסיז לארכיון מחיקות
- telemetry_system.sql — RLS + פוליסיז ללוגי טלמטריה
- enable_realtime.sql — הפעלת realtime לטבלאות מסוימות

---

## 2) מה לא הושלם / עדיין נשאר

### קריאות ישירות ל‑Supabase מה‑UI
נמצאו קריאות ישירות ל‑supabase בתוך רכיבי UI (src/features), למשל:
- features/personnel/PersonnelManager.tsx
- features/stats/*
- features/admin/*
- features/core/* (Home, Landing, Contact, Announcements)
- features/landing/*
- features/scheduling/AttendanceManager.tsx (כולל invoke ל‑Edge Function)

זה אומר שה‑“front‑to‑back” לא הושלם במלואו: עדיין יש קריאות ישירות מה‑UI.

### שירותים שעובדים ישירות מול טבלאות (בלי RPC)
ב‑src/services קיימים מודולים רבים שמשתמשים ב‑supabase.from() ישירות:
- attendanceService, attendanceReportService (daily_presence)
- shiftService (shifts)
- equipmentService (equipment, equipment_daily_checks)
- schedulingService (absences, hourly_blockages, team_rotations, delete constraints)
- personnelService (people/teams/roles + onboarding import)
- organizationService (organization_settings / organizations / invites)
- authService (profiles/people/organizations)
- gateService, battalionService, carpoolService, lotteryService
- auditService (audit_logs)
- snapshotService (snapshot tables) — מלבד RPC ל‑logging/restore

כלומר: גם אם קיימים RLS policies, עדיין יש חלקים שלא עברו לרכבת RPC/Edge ונתמכים רק ע״י RLS.

### RLS Coverage (לא סגור עד הסוף)
נמצאו פוליסיז מפורשות עבור snapshots, deleted_people_archive, telemetry.
**לא נמצא** (בבדיקה הזו) קובץ שמצהיר בבירור על פוליסיז עבור כל הטבלאות המרכזיות:
people, teams, roles, shifts, absences, equipment, etc.

ייתכן שקיים קובץ נוסף או ש‑RLS הוגדר ידנית ב‑Supabase ולא נשמר בריפו.

---

## 3) מפת מודולים לפי תחום (Frontend ↔ Backend)

### Auth & Profiles
- שירות: authService
- RPC: get_my_profile, join_organization_by_token, claim_person_profile
- עדיין יש כתיבה ישירה ל‑profiles / people / organizations
- סטטוס: **חלקי**

### Personnel (אנשים/צוותים/תפקידים)
- שירות: personnelService
- RPC: upsert_person, upsert_team, upsert_role, upsert_people, insert_teams, insert_roles, delete_team_secure, delete_role_secure, delete_person_*, deactivate_personnel
- ✅ **כל ה-CRUD עבר ל-RPCs** (תאריך: 2026-02-08)
- UI: PersonnelManager.tsx משתמש ב-RPCs בלבד
- סטטוס: **הושלם** ✅

### Tasks & Scheduling Module (Phase 3)
- שירותים: taskService, shiftService, schedulingService
- RPC: upsert_task_template, delete_task_template_secure, update_task_segments
- RPC: upsert_shift, upsert_shifts, update_shift_assignments, delete_shift_secure, delete_shifts_by_task, toggle_shift_cancellation, clear_shift_assignments_in_range
- RPC: delete_constraint_secure, delete_constraints_by_role, delete_absence_secure
- RPC: upsert_hourly_blockage, delete_hourly_blockage_secure
- RPC: upsert_team_rotation, delete_team_rotation_secure
- ✅ **כל ה-CRUD עבר ל-RPCs** (תאריך: 2026-02-08)
  - taskService: updateTaskSegments → update_task_segments RPC
  - shiftService: כל 9 פונקציות הכתיבה עברו ל-RPCs
  - schedulingService: כל 9 פונקציות הכתיבה עברו ל-RPCs
  - כולל hourly_blockages (start_time/end_time) ו-team_rotations (days_on_base/days_at_home)
- סטטוס: **הושלם** ✅

### Attendance
- שירות: attendanceService, attendanceReportService
- CRUD ישיר על daily_presence
- AttendanceManager invoke ל‑Edge Function (update-availability-v2)
- סטטוס: **חלקי**

### Equipment
- שירות: equipmentService (CRUD ישיר)
- RPC חדש: upsert_equipment (עדיין לא מחובר בשירות)
- סטטוס: **טרם הושלם**

### Gate / Battalion / Carpool / Lottery
- שירותים: gateService, battalionService, carpoolService, lotteryService
- הכל ישיר ל‑Supabase
- סטטוס: **טרם הושלם**

### Admin / Stats
- שירות: adminService
- RPCs רבים לסטטיסטיקות
- עדיין קריאות ישירות ל‑profiles/organizations/teams/permission_templates/audit_logs
- UI אדמיניסטרטיבי משתמש ב‑supabase ישירות
- סטטוס: **חלקי**

### Snapshots
- שירות: snapshotService
- RPC ל‑logging + restore_snapshot
- אך יצירה/קריאה של snapshots עדיין ישירה (organization_snapshots, snapshot_table_data)
- יש RLS מפורט בקובץ create_snapshot_tables.sql
- סטטוס: **חלקי**

### Organization Settings
- שירות: organizationService (CRUD ישיר על organization_settings)
- UI: OrganizationSettings משתמש ב‑RPC update_organization_settings
- סטטוס: **חלקי**

---

## 4) סיכום מצב כולל
- **RLS וחיזוק אבטחה קיימים חלקית** (בעיקר סביב snapshots/telemetry ודוחות אדמין).
- **יש עדיין שימוש רחב ב‑supabase.from()** ב‑services וב‑features.
- **RPCs קיימים, אבל לא מכסים את כל ה‑CRUD** של מודולי הליבה.
- **Front‑to‑Back לא הושלם**: יש קריאות ישירות ב‑UI.

---

## 5) מה נשאר לבצע (תכל'ס)
1. **סגירת RLS לכל הטבלאות המרכזיות**: people, teams, roles, shifts, absences, equipment, daily_presence, gate_*, carpool_*, lottery_*, etc.
2. **העברה מלאה של CRUD לשירותים בלבד** (ללא קריאות ישירות מה‑UI).
3. **המרת CRUD קריטי ל‑RPC** במקומות רגישים:
   - people / teams / roles
   - shifts / absences / constraints
   - equipment / daily checks
   - gate logs / authorized vehicles
   - organization_settings / invites
4. **ניקוי קריאות ישירות ב‑features** והחלפה ב‑services.
5. **תיעוד טבלאות + פוליסיז** בקובץ SQL אחד או מיגרציות כדי לשמור היסטוריה.

---

אם תרצה, אוכל להמשיך לשלב הבא: ליצור רשימת משימות ממופה לפי טבלאות עם RPCs + פוליסיז שצריך לכתוב, ואז ליישם בפועל.

---

## 6) מיפוי ישיר מה‑DB (Supabase MCP)
תאריך בדיקה: 2026‑02‑08
**עדכון אחרון: 2026‑02‑08 (RLS הופעל על כל הטבלאות)**

### RLS — סטטוס לפי טבלאות (public)
**RLS פעיל:**
organizations, profiles, teams, roles, people, shifts, organization_settings, audit_logs, contact_messages,
scheduling_constraints, team_rotations, daily_presence, absences, war_clock_items, permission_templates,
user_load_stats, organization_activity_logs, battalions, system_messages, hourly_blockages, table_snapshots,
gate_authorized_vehicles, gate_logs, mission_reports, equipment_daily_checks, rota_generation_history,
daily_attendance_snapshots, unified_presence, organization_snapshots, snapshot_table_data, snapshot_operations_log,
deleted_people_archive, carpool_rides, **task_templates, organization_invites, acknowledged_warnings, lottery_history, equipment** ✅

**RLS כבוי (ישיר מה‑DB):**
אין (כל הטבלאות מוגנות) ✅

### RLS Policies (public) — לפי טבלה
> הרשימה מתבססת על pg_policies.

- **absences**
   - Open Org Access: Absences (ALL, authenticated)
   - Users can view own org absences (SELECT, public)
- **acknowledged_warnings**
   - Org Member Manage Warnings (ALL, authenticated)
- **audit_logs**
   - Allow users to read their own organization logs (SELECT, authenticated)
   - HQ can view battalion audit_logs (SELECT, authenticated)
   - HQ can view battalion logs (SELECT, authenticated)
   - Select: Super Admins only (SELECT, authenticated)
   - audit_logs_insert_secure (INSERT, authenticated)
- **battalions**
   - God Mode: Battalions (ALL, authenticated)
- **carpool_rides**
   - View rides within organization (SELECT, authenticated)
   - Create rides in organization (INSERT, authenticated)
   - Update own rides (UPDATE, authenticated)
   - Delete own rides (DELETE, authenticated)
- **contact_messages**
   - contact_messages_insert_unified (INSERT, public)
   - Super Admins Only: View Contact Messages (SELECT, authenticated)
   - Allow admin update access_v18 (UPDATE, authenticated)
- **daily_attendance_snapshots**
   - Users can view snapshots (SELECT, authenticated)
   - Battalion View daily_attendance_snapshots (SELECT, authenticated)
   - HQ users can insert snapshots (INSERT, authenticated)
   - HQ users can delete snapshots (DELETE, authenticated)
- **daily_presence**
   - Open Org Access: Daily Presence (ALL, authenticated)
- **deleted_people_archive**
   - Users can view their organization's deleted people archive (SELECT, authenticated)
   - archive_insert_secure (INSERT, authenticated)
   - Authenticated only update archive_v18 (UPDATE, authenticated)
- **gate_authorized_vehicles**
   - Gate authorized vehicles management policy (ALL, authenticated)
   - Users can view authorized vehicles of their organization (SELECT, authenticated)
   - Users can insert authorized vehicles for their organization (INSERT, authenticated)
   - Users can update authorized vehicles of their organization (UPDATE, authenticated)
   - Users can delete authorized vehicles of their organization (DELETE, authenticated)
- **gate_logs**
   - Gate logs management policy (ALL, authenticated)
   - Users can insert gate logs for their organization (INSERT, authenticated)
   - Users can update gate logs of their organization (UPDATE, authenticated)
   - Users can view gate logs of their entire battalion (SELECT, authenticated)
- **hourly_blockages**
   - hourly_blockages_all_v18 (ALL, authenticated)
   - hourly_blockages_select_v18 (SELECT, authenticated)
- **mission_reports**
   - Open Org Access: Mission Reports (ALL, authenticated)
- **organization_activity_logs**
   - System can insert logs (INSERT, authenticated)
- **organization_settings**
   - Open Org Access: Settings (ALL, authenticated)
- **organization_snapshots**
   - Users can view snapshots for their organization (SELECT, authenticated)
   - Admins can create snapshots (INSERT, authenticated)
   - Admins can delete snapshots (DELETE, authenticated)
   - snapshots_all_policy (ALL, authenticated)
   - snapshots_select_policy (SELECT, authenticated)
- **organizations**
   - God Mode: Organizations (ALL, authenticated)
- **people**
   - people_read_only (SELECT, public)
- **permission_templates**
   - permission_templates_select_org (SELECT, authenticated)
   - permission_templates_select_service (SELECT, service_role)
- **profiles**
   - God Mode: Read Profiles (SELECT, authenticated)
   - Open Access: Read Profiles (SELECT, authenticated)
   - Open Access: Update Own Profile (UPDATE, authenticated)
   - Rescue: Update Own Profile (UPDATE, authenticated)
   - profiles_update_own (UPDATE, authenticated)
   - profiles_update_same_org (UPDATE, authenticated)
   - profiles_update_super_admin (UPDATE, authenticated)
- **roles**
   - roles_read_only (SELECT, public)
- **rota_generation_history**
   - Users can view their organization's rota history (SELECT, authenticated)
   - Users can view history for their organization (SELECT, authenticated)
   - Users can create rota history for their organization (INSERT, authenticated)
   - Users can delete their organization's rota history (DELETE, authenticated)
- **scheduling_constraints**
   - Open Org Access: Constraints (ALL, authenticated)
   - Users can view own org scheduling constraints (SELECT, public)
- **shifts**
   - Open Org Access: Shifts (ALL, authenticated)
- **snapshot_operations_log**
   - Users can view their organization's operation logs (SELECT, authenticated)
   - System can insert operation logs (INSERT, authenticated)
- **snapshot_table_data**
   - Users can view snapshot data for their organization (SELECT, authenticated)
   - Admins can insert snapshot data (INSERT, authenticated)
   - Admins can delete snapshot data (DELETE, authenticated)
   - snapshot_data_all_policy (ALL, authenticated)
   - snapshot_data_select_policy (SELECT, authenticated)
- **system_messages**
   - Users can view active system messages (SELECT, authenticated)
   - Admins can manage system messages (ALL, authenticated)
- **table_snapshots**
   - RBAC: View Snapshots (SELECT, authenticated)
   - RBAC: Manage Snapshots (DELETE, authenticated)
- **task_templates**
   - Open Org Access: Task Templates (ALL, authenticated)
   - Users can view own org task templates (SELECT, public)
- **team_rotations**
   - team_rotations_all_v18 (ALL, authenticated)
   - team_rotations_select_v18 (SELECT, authenticated)
- **teams**
   - God Mode: Teams (ALL, authenticated)
   - Users can view own org teams (SELECT, public)
- **unified_presence**
   - unified_presence_all_org_members (ALL, authenticated)
- **user_load_stats**
   - Users can view load stats in their organization (SELECT, authenticated)
   - Users can view stats for their organization (SELECT, authenticated)
- **war_clock_items**
   - Users can view their own organization items (SELECT, authenticated)
   - Users can view relevant war clock items (SELECT, authenticated)
   - Users can insert their own organization items (INSERT, authenticated)
   - Users can update their own organization items (UPDATE, authenticated)
   - Users can delete their own organization items (DELETE, authenticated)

### Functions (public) — מיפוי מה‑DB
> הרשימה כוללת את כל הפונקציות ב‑public, עם סימון SECURITY DEFINER.

- archive_people_before_delete (SECURITY DEFINER)
- archive_person_before_delete (SECURITY DEFINER)
- capture_daily_snapshots (SECURITY DEFINER)
- check_can_switch_companies_v5 (SECURITY DEFINER)
- check_permission_update_auth (SECURITY DEFINER)
- check_task_access (SECURITY DEFINER)
- check_template_update_auth (SECURITY DEFINER)
- check_user_access_to_org_v5 (SECURITY DEFINER)
- check_user_organization(uuid) (SECURITY DEFINER)
- check_user_organization(text) (SECURITY DEFINER)
- check_v2_migration_readiness (SECURITY DEFINER)
- claim_person_profile (SECURITY DEFINER)
- create_battalion_with_admin (SECURITY DEFINER)
- create_company_under_battalion (SECURITY DEFINER)
- delete_absence_secure (SECURITY DEFINER)
- delete_constraint_secure (SECURITY DEFINER)
- delete_custom_field_data (SECURITY DEFINER)
- delete_old_activity_logs (SECURITY DEFINER)
- delete_people_cascade (SECURITY DEFINER)
- delete_person_cascade (SECURITY DEFINER)
- delete_person_secure (SECURITY DEFINER)
- delete_task_template_secure (SECURITY DEFINER)
- delete_team_secure (SECURITY DEFINER)
- diagnose_user_join_state (SECURITY DEFINER)
- enforce_lite_role_limit
- enforce_lite_soldier_limit
- enforce_lite_team_limit
- enforce_snapshot_limit
- execute_bot_command (SECURITY DEFINER)
- generate_invite_token (SECURITY DEFINER)
- get_active_users_stats (SECURITY DEFINER)
- get_auth_battalion_id (SECURITY DEFINER)
- get_auth_org_id (SECURITY DEFINER)
- get_auth_user_org_id (SECURITY DEFINER)
- get_auth_user_role (SECURITY DEFINER)
- get_battalion_stats(uuid) (SECURITY DEFINER)
- get_battalion_stats(text) (SECURITY DEFINER)
- get_battalion_trends(uuid, date, date) (SECURITY DEFINER)
- get_battalion_trends(text, date, date) (SECURITY DEFINER)
- get_dashboard_kpis (SECURITY DEFINER)
- get_feature_adoption (SECURITY DEFINER)
- get_global_stats_aggregated (SECURITY DEFINER)
- get_manpower_stats (SECURITY DEFINER)
- get_my_email (SECURITY DEFINER)
- get_my_org_id (SECURITY DEFINER)
- get_my_org_id_safe (SECURITY DEFINER)
- get_my_profile (SECURITY DEFINER)
- get_new_orgs_list (SECURITY DEFINER)
- get_new_orgs_stats (SECURITY DEFINER)
- get_new_users_list (SECURITY DEFINER)
- get_org_activity_graph (SECURITY DEFINER)
- get_org_analytics_summary (SECURITY DEFINER)
- get_org_data_bundle (SECURITY DEFINER)
- get_org_name_by_token (SECURITY DEFINER)
- get_org_top_actions (SECURITY DEFINER)
- get_org_top_pages (SECURITY DEFINER)
- get_org_top_users (SECURITY DEFINER)
- get_organization_retention (SECURITY DEFINER)
- get_person_availability
- get_person_rotation_ratio
- get_recent_system_activity (SECURITY DEFINER)
- get_rotation_status_for_date
- get_snapshot_data_bundle (SECURITY DEFINER)
- get_system_activity_chart (SECURITY DEFINER)
- get_system_health (SECURITY DEFINER)
- get_system_orgs_chart (SECURITY DEFINER)
- get_system_users_chart (SECURITY DEFINER)
- get_top_organizations (SECURITY DEFINER)
- get_top_users (SECURITY DEFINER)
- get_unified_presence_logic
- get_user_battalion_id (SECURITY DEFINER)
- get_viewer_battalion_id (SECURITY DEFINER)
- get_viewer_can_switch (SECURITY DEFINER)
- handle_audit_log_ip (SECURITY DEFINER)
- handle_daily_presence_metadata (SECURITY DEFINER)
- handle_new_organization_settings (SECURITY DEFINER)
- handle_new_user (SECURITY DEFINER)
- handle_updated_at
- has_battalion_access (SECURITY DEFINER)
- internal_create_snapshot_for_org (SECURITY DEFINER)
- invalidate_load_cache_on_shift_change (SECURITY DEFINER)
- is_battalion_admin (SECURITY DEFINER)
- is_battalion_commander_of_org (SECURITY DEFINER)
- is_person_available
- is_same_battalion (SECURITY DEFINER)
- is_super_admin (SECURITY DEFINER)
- is_super_admin_v2 (SECURITY DEFINER)
- is_super_admin_v3 (SECURITY DEFINER)
- join_battalion_by_id (SECURITY DEFINER)
- join_organization_by_token (SECURITY DEFINER)
- jsonb_recursive_merge
- log_snapshot_operation_complete (SECURITY DEFINER)
- log_snapshot_operation_start (SECURITY DEFINER)
- perform_smart_assignment (SECURITY DEFINER)
- preview_person_deletion (SECURITY DEFINER)
- refresh_person_presence
- restore_person_from_archive (SECURITY DEFINER)
- restore_snapshot (SECURITY DEFINER) — multiple signatures
- rls_auto_enable (SECURITY DEFINER)
- run_nightly_snapshots_all_orgs (SECURITY DEFINER)
- safe_check_can_switch (SECURITY DEFINER)
- safe_check_is_super_admin (SECURITY DEFINER)
- safe_get_battalion_id (SECURITY DEFINER)
- safe_get_my_battalion_id (SECURITY DEFINER)
- safe_get_my_org_id (SECURITY DEFINER)
- safe_get_org_id (SECURITY DEFINER)
- safe_has_switcher_access (SECURITY DEFINER)
- safe_is_super_admin (SECURITY DEFINER)
- sync_legacy_json_to_unified
- sync_profile_metadata_v11 (SECURITY DEFINER)
- sync_unified_to_legacy_json
- trg_sync_presence_absence
- trg_sync_presence_manual
- unlink_company_from_battalion (SECURITY DEFINER)
- update_equipment_checks_updated_at
- update_organization_settings (SECURITY DEFINER)
- update_updated_at_column
- upsert_absence (SECURITY DEFINER)
- upsert_constraint (SECURITY DEFINER) — multiple signatures
- upsert_person (SECURITY DEFINER)
- upsert_role (SECURITY DEFINER)
- upsert_task_template (SECURITY DEFINER)
- upsert_team (SECURITY DEFINER)