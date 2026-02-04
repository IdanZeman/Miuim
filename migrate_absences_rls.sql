-- ============================================================================
-- MIGRATION: SECURE RLS FOR 'ABSENCES' TABLE
-- ============================================================================
-- This script replaces the potentially recursive policies on 'absences' 
-- with the new 'check_user_organization' security definer function.
--
-- TARGET: public.absences
-- ============================================================================

-- 1. Drop existing "standard user" policies (identified from inspection)
DROP POLICY IF EXISTS "Users can manage own org absences" ON public.absences;
DROP POLICY IF EXISTS "Users can view own org absences" ON public.absences;

-- Note: We are keeping "HQ can view battalion absences" for now as it handles 
-- cross-organization logic which 'check_user_organization' covers differently.

-- 2. Create new SECURE policies using the helper function

-- POLICY: View (SELECT)
CREATE POLICY "Users can view own org absences" 
ON public.absences 
FOR SELECT 
USING ( check_user_organization(organization_id) );

-- POLICY: Insert (INSERT)
CREATE POLICY "Users can insert own org absences" 
ON public.absences 
FOR INSERT 
WITH CHECK ( check_user_organization(organization_id) );

-- POLICY: Update (UPDATE)
CREATE POLICY "Users can update own org absences" 
ON public.absences 
FOR UPDATE 
USING ( check_user_organization(organization_id) )
WITH CHECK ( check_user_organization(organization_id) );

-- POLICY: Delete (DELETE)
CREATE POLICY "Users can delete own org absences" 
ON public.absences 
FOR DELETE 
USING ( check_user_organization(organization_id) );

-- 3. Verification hint
-- Try to fetch absences: SELECT * FROM absences;
