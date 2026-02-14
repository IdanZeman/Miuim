-- Sample Data for Miuim - Matanya Team
-- Run this AFTER running organization-management-schema.sql
-- Make sure to replace YOUR_ORG_ID with your actual organization ID from the organizations table

-- First, get your organization ID:
-- SELECT id FROM organizations WHERE name = 'Your Organization Name';
-- Then replace 'YOUR_ORG_ID' below with that ID

-- ============================================
-- 1. CREATE TEAM
-- ============================================
INSERT INTO teams (id, name, color, organization_id) VALUES
('team-matanya', 'מתניה', 'border-emerald-500', 'YOUR_ORG_ID');

-- ============================================
-- 2. CREATE ROLES
-- ============================================
INSERT INTO roles (id, name, color, icon, organization_id) VALUES
('role-commander', 'מפקד', 'bg-yellow-500', 'Shield', 'YOUR_ORG_ID'),
('role-driver', 'נהג', 'bg-blue-500', 'Truck', 'YOUR_ORG_ID'),
('role-fighter', 'לוחם', 'bg-green-500', 'User', 'YOUR_ORG_ID'),
('role-medic', 'חובש', 'bg-red-500', 'Heart', 'YOUR_ORG_ID'),
('role-paramedic', 'חמליסט', 'bg-red-600', 'Stethoscope', 'YOUR_ORG_ID'),
('role-sniper', 'צלף', 'bg-purple-500', 'Target', 'YOUR_ORG_ID'),
('role-machine-gunner', 'מקלען', 'bg-orange-500', 'Zap', 'YOUR_ORG_ID'),
('role-drone', 'רחפן', 'bg-sky-500', 'Plane', 'YOUR_ORG_ID'),
('role-matalist', 'מטוליסט', 'bg-indigo-500', 'Radio', 'YOUR_ORG_ID'),
('role-rifleman', 'קלע', 'bg-slate-500', 'Crosshair', 'YOUR_ORG_ID');

-- ============================================
-- 3. CREATE PEOPLE (Matanya Team)
-- ============================================
INSERT INTO people (id, name, team_id, role_ids, max_hours_per_week, unavailable_dates, preferences, color, organization_id) VALUES
('person-uri', 'אורי בנג''ו', 'team-matanya', ARRAY['role-commander', 'role-paramedic', 'role-fighter'], 168, ARRAY[]::text[], '{"preferNight": false, "avoidWeekends": false}', '#10b981', 'YOUR_ORG_ID'),
('person-itamar', 'איתמר אילשטיין', 'team-matanya', ARRAY['role-medic', 'role-fighter'], 168, ARRAY[]::text[], '{"preferNight": false, "avoidWeekends": false}', '#3b82f6', 'YOUR_ORG_ID'),
('person-elior', 'אליאור וקרולקר', 'team-matanya', ARRAY['role-sniper', 'role-fighter'], 168, ARRAY[]::text[], '{"preferNight": false, "avoidWeekends": false}', '#8b5cf6', 'YOUR_ORG_ID'),
('person-elad', 'אלעד אביצור', 'team-matanya', ARRAY['role-medic', 'role-paramedic', 'role-fighter'], 168, ARRAY[]::text[], '{"preferNight": false, "avoidWeekends": false}', '#ef4444', 'YOUR_ORG_ID'),
('person-asaf', 'אסף עידן', 'team-matanya', ARRAY['role-drone', 'role-fighter'], 168, ARRAY[]::text[], '{"preferNight": false, "avoidWeekends": false}', '#0ea5e9', 'YOUR_ORG_ID'),
('person-ben', 'בן דוידיאן', 'team-matanya', ARRAY['role-machine-gunner', 'role-paramedic', 'role-driver', 'role-fighter'], 168, ARRAY[]::text[], '{"preferNight": false, "avoidWeekends": false}', '#f97316', 'YOUR_ORG_ID'),
('person-jaret', 'ג''רת גורנו', 'team-matanya', ARRAY['role-machine-gunner', 'role-fighter'], 168, ARRAY[]::text[], '{"preferNight": false, "avoidWeekends": false}', '#f59e0b', 'YOUR_ORG_ID'),
('person-dvir', 'דביר משיקלר', 'team-matanya', ARRAY['role-commander', 'role-matalist', 'role-driver', 'role-fighter'], 168, ARRAY[]::text[], '{"preferNight": false, "avoidWeekends": false}', '#eab308', 'YOUR_ORG_ID'),
('person-danny', 'דני קאהן', 'team-matanya', ARRAY['role-rifleman', 'role-paramedic', 'role-fighter'], 168, ARRAY[]::text[], '{"preferNight": false, "avoidWeekends": false}', '#64748b', 'YOUR_ORG_ID'),
('person-hillel-a', 'הלל אבירן', 'team-matanya', ARRAY['role-commander', 'role-paramedic', 'role-fighter'], 168, ARRAY[]::text[], '{"preferNight": false, "avoidWeekends": false}', '#84cc16', 'YOUR_ORG_ID'),
('person-hillel-h', 'הלל חרץ', 'team-matanya', ARRAY['role-commander', 'role-matalist', 'role-fighter'], 168, ARRAY[]::text[], '{"preferNight": false, "avoidWeekends": false}', '#a3e635', 'YOUR_ORG_ID'),
('person-valery', 'ולרי', 'team-matanya', ARRAY['role-fighter'], 168, ARRAY[]::text[], '{"preferNight": false, "avoidWeekends": false}', '#22c55e', 'YOUR_ORG_ID'),
('person-tal', 'טל רובין', 'team-matanya', ARRAY['role-rifleman', 'role-fighter'], 168, ARRAY[]::text[], '{"preferNight": false, "avoidWeekends": false}', '#475569', 'YOUR_ORG_ID'),
('person-yehali', 'יהלי ברונר', 'team-matanya', ARRAY['role-rifleman', 'role-fighter'], 168, ARRAY[]::text[], '{"preferNight": false, "avoidWeekends": false}', '#334155', 'YOUR_ORG_ID'),
('person-yoav', 'יואב רווח', 'team-matanya', ARRAY['role-rifleman', 'role-driver', 'role-fighter'], 168, ARRAY[]::text[], '{"preferNight": false, "avoidWeekends": false}', '#1e293b', 'YOUR_ORG_ID'),
('person-yehiel', 'יחיאל רמר', 'team-matanya', ARRAY['role-machine-gunner', 'role-fighter'], 168, ARRAY[]::text[], '{"preferNight": false, "avoidWeekends": false}', '#fb923c', 'YOUR_ORG_ID'),
('person-matan', 'מתן כהן', 'team-matanya', ARRAY['role-drone', 'role-rifleman', 'role-sniper', 'role-fighter'], 168, ARRAY[]::text[], '{"preferNight": false, "avoidWeekends": false}', '#06b6d4', 'YOUR_ORG_ID'),
('person-salomon', 'סלמון בלאי', 'team-matanya', ARRAY['role-rifleman', 'role-fighter'], 168, ARRAY[]::text[], '{"preferNight": false, "avoidWeekends": false}', '#71717a', 'YOUR_ORG_ID'),
('person-oded', 'עודד צפקי', 'team-matanya', ARRAY['role-machine-gunner', 'role-fighter'], 168, ARRAY[]::text[], '{"preferNight": false, "avoidWeekends": false}', '#fdba74', 'YOUR_ORG_ID'),
('person-omer-y', 'עומר יום טוב', 'team-matanya', ARRAY['role-commander', 'role-paramedic', 'role-fighter'], 168, ARRAY[]::text[], '{"preferNight": false, "avoidWeekends": false}', '#4ade80', 'YOUR_ORG_ID'),
('person-omri', 'עומרי באום', 'team-matanya', ARRAY['role-medic', 'role-rifleman', 'role-paramedic', 'role-fighter'], 168, ARRAY[]::text[], '{"preferNight": false, "avoidWeekends": false}', '#dc2626', 'YOUR_ORG_ID'),
('person-idan-z', 'עידן זימן', 'team-matanya', ARRAY['role-paramedic', 'role-fighter'], 168, ARRAY[]::text[], '{"preferNight": false, "avoidWeekends": false}', '#b91c1c', 'YOUR_ORG_ID'),
('person-idan-p', 'עידן פיקדו', 'team-matanya', ARRAY['role-commander', 'role-paramedic', 'role-fighter'], 168, ARRAY[]::text[], '{"preferNight": false, "avoidWeekends": false}', '#65a30d', 'YOUR_ORG_ID'),
('person-roi', 'רועי רוזנשטיין', 'team-matanya', ARRAY['role-rifleman', 'role-sniper', 'role-fighter'], 168, ARRAY[]::text[], '{"preferNight": false, "avoidWeekends": false}', '#7c3aed', 'YOUR_ORG_ID'),
('person-raz', 'רז מרשנסקי', 'team-matanya', ARRAY['role-machine-gunner', 'role-paramedic', 'role-fighter'], 168, ARRAY[]::text[], '{"preferNight": false, "avoidWeekends": false}', '#ea580c', 'YOUR_ORG_ID'),
('person-shai', 'שי קפלן', 'team-matanya', ARRAY['role-paramedic', 'role-fighter'], 168, ARRAY[]::text[], '{"preferNight": false, "avoidWeekends": false}', '#991b1b', 'YOUR_ORG_ID'),
('person-srael', 'שראל אביעד', 'team-matanya', ARRAY['role-matalist', 'role-fighter'], 168, ARRAY[]::text[], '{"preferNight": false, "avoidWeekends": false}', '#6366f1', 'YOUR_ORG_ID');

-- ============================================
-- 4. CREATE TASK TEMPLATES
-- ============================================
INSERT INTO task_templates (id, name, duration_hours, required_people, required_role_ids, min_rest_hours_before, difficulty, color, scheduling_type, default_start_time, organization_id) VALUES
-- סיור - 8 שעות, 4 אנשים (מפקד, נהג, 2 לוחמים)
('task-patrol', 'סיור', 8, 4, ARRAY['role-commander', 'role-driver', 'role-fighter', 'role-fighter'], 8, 4, 'bg-blue-600', 'continuous', '08:00', 'YOUR_ORG_ID'),

-- מנוחה - 16 שעות
('task-rest', 'מנוחה', 16, 0, ARRAY[]::text[], 0, 1, 'bg-green-500', 'continuous', '16:00', 'YOUR_ORG_ID'),

-- חמל - 3 שעות, חמליסט
('task-hamal', 'חמל', 3, 1, ARRAY['role-paramedic'], 0, 2, 'bg-red-500', 'continuous', '09:00', 'YOUR_ORG_ID'),

-- שג"ג - כולם
('task-shagag', 'שג"ג', 2, 26, ARRAY['role-fighter'], 0, 3, 'bg-purple-600', 'one-time', '07:00', 'YOUR_ORG_ID');

-- ============================================
-- INSTRUCTIONS
-- ============================================
-- 1. First, run the organization-management-schema.sql
-- 2. Get your organization ID by running:
--    SELECT id FROM organizations;
-- 3. Replace ALL instances of 'YOUR_ORG_ID' in this file with your actual organization ID
-- 4. Run this entire script in Supabase SQL Editor
-- 5. Refresh your application and you should see all the data!

-- To find and replace YOUR_ORG_ID:
-- In most text editors: Ctrl+H (Windows) or Cmd+H (Mac)
-- Find: YOUR_ORG_ID
-- Replace with: your-actual-organization-id-here
