-- Check for any remaining policies that reference created_by
SELECT 
    schemaname,
    tablename,
    policyname,
    definition
FROM pg_policies
WHERE definition LIKE '%created_by%'
ORDER BY tablename, policyname;

-- If you find any, drop them with:
-- DROP POLICY IF EXISTS "policy_name" ON table_name;
