-- ============================================================================
-- MANUAL SNAPSHOT GENERATOR
-- ============================================================================
-- Since you are on the limits of the free tier, this script generates
-- SQL commands to restore your system's LOGIC (Policies, Functions, Triggers).
--
-- INSTRUCTIONS:
-- 1. Run this script in standard SQL Editor.
-- 2. Switch to "Text" or "CSV" output view if possible, or just copy the "restore_command" column.
-- 3. Save the result to a file named 'logic_backup.sql' on your computer.
--
-- NOTE: This does NOT backup table data (rows). Use "Export to CSV" in the 
-- Table Editor for that.
-- ============================================================================

-- 1. FUNCTIONS
SELECT 
    'CREATE OR REPLACE ' || pg_get_functiondef(p.oid) || ';' as restore_command,
    1 as priority
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname != 'generate_logic_snapshot' -- Exclude this script if stored

UNION ALL

-- 2. POLICIES (DROP + CREATE)
SELECT 
    'DROP POLICY IF EXISTS "' || policyname || '" ON public.' || tablename || ';' || 
    'CREATE POLICY "' || policyname || '" ON public.' || tablename || 
    ' FOR ' || cmd || 
    ' TO ' || array_to_string(roles, ',') || 
    CASE 
        WHEN qual IS NOT NULL THEN ' USING (' || qual || ')'
        ELSE ''
    END ||
    CASE 
        WHEN with_check IS NOT NULL THEN ' WITH CHECK (' || with_check || ')'
        ELSE ''
    END || ';' as restore_command,
    2 as priority
FROM pg_policies
WHERE schemaname = 'public'

ORDER BY priority, restore_command;
