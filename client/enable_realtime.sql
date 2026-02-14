-- Run this in Supabase SQL Editor to enable Realtime for ALL relevant tables

BEGIN;
  -- 1. Enable Realtime for 'people' (Attendance status) - ALREADY DONE?
  -- ALTER PUBLICATION supabase_realtime ADD TABLE people;

  -- 2. Enable Realtime for 'absences' & 'blockages' - ALREADY DONE?
  -- ALTER PUBLICATION supabase_realtime ADD TABLE absences;
  -- ALTER PUBLICATION supabase_realtime ADD TABLE hourly_blockages;

  -- 3. NEW: Enable Realtime for Equipment
  ALTER PUBLICATION supabase_realtime ADD TABLE equipment;
  ALTER PUBLICATION supabase_realtime ADD TABLE equipment_daily_checks;

  -- 4. NEW: Enable Realtime for Schedule/Shifts (S.G)
  ALTER PUBLICATION supabase_realtime ADD TABLE shifts;
  ALTER PUBLICATION supabase_realtime ADD TABLE task_templates;
  ALTER PUBLICATION supabase_realtime ADD TABLE mission_reports;

  -- 5. NEW: Enable Realtime for Structure (Teams/Roles)
  ALTER PUBLICATION supabase_realtime ADD TABLE teams;
  ALTER PUBLICATION supabase_realtime ADD TABLE roles;
  
  -- 6. Gate Logs (Usually handled by separate hook, but good to have)
  ALTER PUBLICATION supabase_realtime ADD TABLE gate_logs;

COMMIT;

-- Verification: Check enabled tables
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
