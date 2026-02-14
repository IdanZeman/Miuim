-- ============================================================================
-- BACKUP SCRIPT: GENERATE RESTORE COMMANDS FOR CURRENT POLICIES
-- ============================================================================
-- Run this script in the Supabase SQL Editor.
-- Copy the OUTPUT results and save them to a file named 'policies_backup.sql'.
-- ============================================================================

SELECT 
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
    END || ';' as restore_command
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
