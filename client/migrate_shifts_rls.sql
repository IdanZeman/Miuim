-- ============================================================================
-- MIGRATION: SECURE RLS FOR 'shifts'
-- ============================================================================
-- This script updates the Row Level Security (RLS) policies for the 'shifts' table.
-- It replaces unsecured or basic policies with a strictly scoped policy using
-- the "check_user_organization" SECURITY DEFINER function.
-- ============================================================================

-- 1. Drop existing policies (Clean Slate)
DROP POLICY IF EXISTS "Users can view own org shifts" ON public.shifts;
DROP POLICY IF EXISTS "Users can manage own org shifts" ON public.shifts;
DROP POLICY IF EXISTS "Enable read access for users in the same organization" ON public.shifts;
DROP POLICY IF EXISTS "Enable insert for users in the same organization" ON public.shifts;
DROP POLICY IF EXISTS "Enable update for users in the same organization" ON public.shifts;
DROP POLICY IF EXISTS "Enable delete for users in the same organization" ON public.shifts;

-- 2. Create new SECURE policies using the helper function

-- POLICY: View (SELECT)
-- Users can see shifts that belong to their organization.
CREATE POLICY "Users can view own org shifts" 
ON public.shifts 
FOR SELECT 
USING ( check_user_organization(organization_id) );

-- POLICY: Manage (INSERT, UPDATE, DELETE)
-- Users can manage shifts in their organization.
-- (Note: Application logic handles role-based restricting, this checks Tenant Boundary)
CREATE POLICY "Users can manage own org shifts" 
ON public.shifts 
FOR ALL 
USING ( check_user_organization(organization_id) )
WITH CHECK ( check_user_organization(organization_id) );

-- 3. Verify
-- Use the inspect_security.sql script to verify the new policies apply.
