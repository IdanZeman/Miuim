-- Check which organizations are marked as HQ
SELECT 
    id,
    name,
    battalion_id,
    is_hq,
    created_at
FROM organizations
WHERE battalion_id IS NOT NULL
ORDER BY is_hq DESC, name;

-- If you see organizations that shouldn't be HQ, fix them:
-- UPDATE organizations 
-- SET is_hq = false 
-- WHERE name = 'NAME_OF_REGULAR_COMPANY';

-- Only the HQ organization should have is_hq = true
