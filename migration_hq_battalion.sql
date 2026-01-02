-- Migration: HQ-Centric Battalion Management
-- This migration implements the new HQ-based battalion architecture

-- 1. Add is_hq column to organizations table
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_hq BOOLEAN DEFAULT false;

-- 2. Drop all policies that depend on created_by column before removing it
DROP POLICY IF EXISTS "Users can create battalions" ON battalions;
DROP POLICY IF EXISTS "Commanders can view their own battalion" ON battalions;
DROP POLICY IF EXISTS "Commanders can update their own battalion" ON battalions;
DROP POLICY IF EXISTS "Battalion commanders can view linked organizations" ON organizations;
DROP POLICY IF EXISTS "Battalion commanders can view people in linked organizations" ON people;
DROP POLICY IF EXISTS "Battalion commanders can view profiles in linked organizations" ON profiles;
DROP POLICY IF EXISTS "Battalion commanders can view presence" ON daily_presence;
DROP POLICY IF EXISTS "Battalion commanders can view shifts" ON shifts;
DROP POLICY IF EXISTS "Battalion commanders can update linked organizations" ON organizations;

-- 3. Remove created_by from battalions
ALTER TABLE battalions DROP COLUMN IF EXISTS created_by;

-- 4. Drop all policies that depend on profiles.battalion_id before removing it
DROP POLICY IF EXISTS "Users can view their own battalion" ON battalions;
DROP POLICY IF EXISTS "Battalion commanders can update their battalion" ON battalions;
DROP POLICY IF EXISTS "Battalion members can view people" ON people;
DROP POLICY IF EXISTS "Battalion members can view daily_presence" ON daily_presence;
DROP POLICY IF EXISTS "Battalion members can view shifts" ON shifts;
DROP POLICY IF EXISTS "Battalion member management for gate_logs" ON gate_logs;
DROP POLICY IF EXISTS "Battalion member management for gate_authorized_vehicles" ON gate_authorized_vehicles;

-- 5. Remove battalion_id and battalion_role from profiles (if they exist)
ALTER TABLE profiles DROP COLUMN IF EXISTS battalion_id;

-- 6. Drop all policies that depend on profiles.battalion_role before removing it
DROP POLICY IF EXISTS "Battalion users can view sibling organizations" ON organizations;
DROP POLICY IF EXISTS "Battalion commanders can view all profiles in battalion" ON profiles;
DROP POLICY IF EXISTS "Battalion commanders can view all shifts in battalion" ON shifts;
DROP POLICY IF EXISTS "Users can view daily_presence for their organization" ON daily_presence;

-- 7. Remove battalion_role from profiles
ALTER TABLE profiles DROP COLUMN IF EXISTS battalion_role;

-- 8. Create helper function to check if user is in HQ with battalion scope
CREATE OR REPLACE FUNCTION is_battalion_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM profiles p
    JOIN organizations o ON p.organization_id = o.id
    WHERE p.id = auth.uid()
    AND o.is_hq = true
    AND (p.permissions->>'dataScope' = 'battalion' OR p.is_super_admin = true)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create helper function to get user's battalion_id
CREATE OR REPLACE FUNCTION get_user_battalion_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT o.battalion_id
    FROM profiles p
    JOIN organizations o ON p.organization_id = o.id
    WHERE p.id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Battalion table policies
-- Allow any authenticated user to create a battalion
DROP POLICY IF EXISTS "Authenticated users can create battalions" ON battalions;
CREATE POLICY "Authenticated users can create battalions"
ON battalions FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Allow users to view battalions their organization is linked to
DROP POLICY IF EXISTS "Users can view their battalion" ON battalions;
CREATE POLICY "Users can view their battalion"
ON battalions FOR SELECT
USING (
  id IN (
    SELECT battalion_id 
    FROM organizations 
    WHERE id IN (
      SELECT organization_id 
      FROM profiles 
      WHERE id = auth.uid()
    )
  )
);

-- 10. Update RLS policies for battalion-wide access

-- Organizations: Battalion admins can view all orgs in their battalion
DROP POLICY IF EXISTS "Battalion admins can view linked organizations" ON organizations;
CREATE POLICY "Battalion admins can view linked organizations"
ON organizations FOR SELECT
USING (
  battalion_id = get_user_battalion_id()
  AND is_battalion_admin()
);

-- People: Battalion admins can view all people in their battalion
DROP POLICY IF EXISTS "Battalion admins can view people in linked organizations" ON people;
CREATE POLICY "Battalion admins can view people in linked organizations"
ON people FOR SELECT
USING (
  organization_id IN (
    SELECT id 
    FROM organizations 
    WHERE battalion_id = get_user_battalion_id()
  )
  AND is_battalion_admin()
);

-- Profiles: Battalion admins can view all profiles in their battalion
DROP POLICY IF EXISTS "Battalion admins can view profiles in linked organizations" ON profiles;
CREATE POLICY "Battalion admins can view profiles in linked organizations"
ON profiles FOR SELECT
USING (
  organization_id IN (
    SELECT id 
    FROM organizations 
    WHERE battalion_id = get_user_battalion_id()
  )
  AND is_battalion_admin()
);

-- Daily Presence: Battalion admins can view all presence data
DROP POLICY IF EXISTS "Battalion admins can view presence" ON daily_presence;
CREATE POLICY "Battalion admins can view presence"
ON daily_presence FOR SELECT
USING (
  organization_id IN (
    SELECT id 
    FROM organizations 
    WHERE battalion_id = get_user_battalion_id()
  )
  AND is_battalion_admin()
);

-- Shifts: Battalion admins can view all shifts
DROP POLICY IF EXISTS "Battalion admins can view shifts" ON shifts;
CREATE POLICY "Battalion admins can view shifts"
ON shifts FOR SELECT
USING (
  organization_id IN (
    SELECT id 
    FROM organizations 
    WHERE battalion_id = get_user_battalion_id()
  )
  AND is_battalion_admin()
);

-- 7. Management policies for HQ admins
DROP POLICY IF EXISTS "HQ admins can manage battalion data" ON people;
CREATE POLICY "HQ admins can manage battalion data"
ON people FOR ALL
USING (
  organization_id IN (
    SELECT id 
    FROM organizations 
    WHERE battalion_id = get_user_battalion_id()
  )
  AND is_battalion_admin()
);
