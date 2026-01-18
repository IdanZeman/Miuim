-- SQL Script to delete the "___" custom field from all people
-- This field was created by mistake during Excel import

-- STEP 1: Preview what will be affected (SAFE - READ ONLY)
SELECT 
    p.id,
    p.name,
    t.name as team_name,
    p.custom_fields,
    p.custom_fields->'___' as field_to_delete
FROM people p
LEFT JOIN teams t ON p.team_id = t.id
WHERE p.custom_fields ? '___'
ORDER BY t.name, p.name
LIMIT 50;

-- STEP 2: Count how many people will be affected
SELECT COUNT(*) as affected_people_count
FROM people p
WHERE p.custom_fields ? '___';

-- STEP 3: Delete the "___" field from ALL people who have it
-- WARNING: This will permanently modify the data!
UPDATE people
SET custom_fields = custom_fields - '___'
WHERE custom_fields ? '___';

-- STEP 4: Verify the deletion (SAFE - READ ONLY)
-- This should return 0 rows if successful
SELECT 
    p.id,
    p.name,
    t.name as team_name,
    p.custom_fields
FROM people p
LEFT JOIN teams t ON p.team_id = t.id
WHERE p.custom_fields ? '___';

-- STEP 5: Optional - Remove from organization schema if it exists
UPDATE organization_settings
SET custom_fields_schema = (
    SELECT jsonb_agg(field)
    FROM jsonb_array_elements(custom_fields_schema) field
    WHERE field->>'key' != 'cf____' 
      AND field->>'key' != '___'
)
WHERE custom_fields_schema IS NOT NULL
  AND (
    custom_fields_schema::text LIKE '%"___"%' 
    OR custom_fields_schema::text LIKE '%"cf____"%'
  );
