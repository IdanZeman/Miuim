-- ============================================================================
-- MIGRATION: SECURE RLS FOR 'people'
-- ============================================================================
-- This script updates the Row Level Security (RLS) policies for the 'people' table.
-- The 'people' table contains the personnel/soldiers data.
-- We enforce strictly that users can only view and manage people within their own organization.
-- ============================================================================

-- 1. Drop existing policies to ensure a clean slate
DROP POLICY IF EXISTS "Enable read access for users in the same organization" ON public.people;
DROP POLICY IF EXISTS "Enable insert for users in the same organization" ON public.people;
DROP POLICY IF EXISTS "Enable update for users in the same organization" ON public.people;
DROP POLICY IF EXISTS "Enable delete for users in the same organization" ON public.people;
DROP POLICY IF EXISTS "Users can view own org people" ON public.people;
DROP POLICY IF EXISTS "Users can manage own org people" ON public.people;

-- 2. Create new SECURE policies using the "check_user_organization" helper

-- POLICY: View (SELECT)
-- Users can see all people in their organization
CREATE POLICY "Users can view own org people" 
ON public.people 
FOR SELECT 
USING ( check_user_organization(organization_id) );

-- POLICY: Manage (INSERT, UPDATE, DELETE)
-- Users can add/edit/delete people in their organization
-- (Finer grained permissions, e.g., 'viewer' vs 'admin', are handled by App Login in PersonManager/Services)
CREATE POLICY "Users can manage own org people" 
ON public.people 
FOR ALL 
USING ( check_user_organization(organization_id) )
WITH CHECK ( check_user_organization(organization_id) );

-- 3. Verify
-- Run inspect_security.sql to confirm policies are active.
