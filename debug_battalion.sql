-- Debug queries to check battalion setup

-- 1. Check your profile and permissions
SELECT 
    id,
    email,
    full_name,
    organization_id,
    permissions,
    is_super_admin
FROM profiles 
WHERE email = 'idanzeman@mail.tau.ac.il';

-- 2. Check your organization
SELECT 
    id,
    name,
    battalion_id,
    is_hq,
    created_at
FROM organizations 
WHERE id IN (
    SELECT organization_id 
    FROM profiles 
    WHERE email = 'idanzeman@mail.tau.ac.il'
);

-- 3. Check battalion
SELECT 
    b.id,
    b.name,
    b.code,
    b.created_at,
    COUNT(o.id) as linked_organizations
FROM battalions b
LEFT JOIN organizations o ON o.battalion_id = b.id
GROUP BY b.id, b.name, b.code, b.created_at;

-- 4. If you need to fix it manually, run these:
-- (Replace the UUIDs with actual values from queries above)

-- Mark your organization as HQ:
-- UPDATE organizations 
-- SET is_hq = true 
-- WHERE id = 'YOUR_ORG_ID';

-- Link your organization to battalion:
-- UPDATE organizations 
-- SET battalion_id = 'YOUR_BATTALION_ID'
-- WHERE id = 'YOUR_ORG_ID';
