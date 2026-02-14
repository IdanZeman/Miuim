-- Find the actual custom field key name
-- This will show ALL custom fields for people in "מסייעת 1871"

SELECT 
    p.id,
    p.name,
    t.name as team_name,
    p.custom_fields,
    jsonb_object_keys(p.custom_fields) as custom_field_keys
FROM people p
LEFT JOIN teams t ON p.team_id = t.id
WHERE t.name = 'מסייעת 1871'
  AND p.custom_fields IS NOT NULL
  AND p.custom_fields != '{}'::jsonb
ORDER BY p.name
LIMIT 20;

-- Alternative: Show all unique custom field keys in this company
SELECT DISTINCT
    jsonb_object_keys(p.custom_fields) as field_key,
    COUNT(*) as people_count
FROM people p
LEFT JOIN teams t ON p.team_id = t.id
WHERE t.name = 'מסייעת 1871'
  AND p.custom_fields IS NOT NULL
  AND p.custom_fields != '{}'::jsonb
GROUP BY field_key
ORDER BY people_count DESC;
