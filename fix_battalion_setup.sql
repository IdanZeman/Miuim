-- Fix battalion setup for organization "גדוד 1871"

-- Step 1: Find the battalion (should exist)
-- Run this first to get the battalion_id
SELECT id, name, code FROM battalions WHERE name LIKE '%1871%' OR name LIKE '%גדוד%';

-- Step 2: After you get the battalion_id from above, update your organization
-- Replace 'BATTALION_ID_FROM_STEP_1' with the actual ID
UPDATE organizations 
SET 
    battalion_id = (SELECT id FROM battalions WHERE name LIKE '%1871%' OR name LIKE '%גדוד%' LIMIT 1),
    is_hq = true
WHERE id = '973b75d8-8c77-4126-ba20-286eccdb7c48';

-- Step 3: Verify the fix
SELECT 
    o.id,
    o.name,
    o.battalion_id,
    o.is_hq,
    b.name as battalion_name
FROM organizations o
LEFT JOIN battalions b ON o.battalion_id = b.id
WHERE o.id = '973b75d8-8c77-4126-ba20-286eccdb7c48';
