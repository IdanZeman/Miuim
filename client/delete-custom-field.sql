-- SQL Script to delete custom field "מ.א" from all people in company "מסייעת 1871"
-- Run this in Supabase SQL Editor or your PostgreSQL client

-- STEP 1: Preview what will be affected (SAFE - READ ONLY)
-- Uncomment to see which records will be updated:
/*
SELECT 
    p.id,
    p.name,
    t.name as team_name,
    p.custom_fields,
    p.custom_fields->'cf_מא' as field_to_delete
FROM people p
LEFT JOIN teams t ON p.team_id = t.id
WHERE t.name = 'מסייעת 1871'
  AND p.custom_fields ? 'cf_מא';
*/

-- STEP 2: Backup the data before deletion (RECOMMENDED)
-- Uncomment to create a backup:
/*
CREATE TABLE IF NOT EXISTS people_custom_fields_backup AS
SELECT 
    p.id,
    p.name,
    t.name as team_name,
    p.custom_fields,
    now() as backup_timestamp
FROM people p
LEFT JOIN teams t ON p.team_id = t.id
WHERE t.name = 'מסייעת 1871'
  AND p.custom_fields ? 'cf_מא';
*/

-- STEP 3: Delete the custom field "cf_מא" from all people in "מסייעת 1871"
-- WARNING: This will permanently modify the data!
UPDATE people p
SET 
    custom_fields = p.custom_fields - 'cf_מא',
    -- Also try alternative key names in case it's stored differently
    custom_fields = (p.custom_fields - 'cf_מא') - 'cf_ma' - 'מא' - 'ma'
FROM teams t
WHERE p.team_id = t.id
  AND t.name = 'מסייעת 1871'
  AND (
    p.custom_fields ? 'cf_מא' 
    OR p.custom_fields ? 'cf_ma'
    OR p.custom_fields ? 'מא'
    OR p.custom_fields ? 'ma'
  );

-- STEP 4: Verify the deletion (SAFE - READ ONLY)
-- Check that the field was removed:
SELECT 
    p.id,
    p.name,
    t.name as team_name,
    p.custom_fields,
    CASE 
        WHEN p.custom_fields ? 'cf_מא' THEN 'Still exists!'
        ELSE 'Deleted ✓'
    END as status
FROM people p
LEFT JOIN teams t ON p.team_id = t.id
WHERE t.name = 'מסייעת 1871'
ORDER BY p.name;

-- STEP 5: Optional - Remove the field from the schema definition
-- If you also want to remove it from organization_settings.custom_fields_schema:
/*
UPDATE organization_settings os
SET custom_fields_schema = (
    SELECT jsonb_agg(field)
    FROM jsonb_array_elements(os.custom_fields_schema) field
    WHERE field->>'key' NOT IN ('cf_מא', 'cf_ma', 'מא', 'ma')
)
WHERE os.organization_id IN (
    SELECT DISTINCT o.id
    FROM organizations o
    JOIN teams t ON t.organization_id = o.id
    WHERE t.name = 'מסייעת 1871'
);
*/

-- Summary of affected rows:
-- This will show you how many people were updated
SELECT COUNT(*) as affected_people_count
FROM people p
JOIN teams t ON p.team_id = t.id
WHERE t.name = 'מסייעת 1871';
