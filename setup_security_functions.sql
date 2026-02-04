-- ============================================================================
-- STEP 1: DEPLOY SECURITY HELPER FUNCTIONS
-- ============================================================================
-- This script creates the "check_user_organization" function.
-- It is SAFE to run on production as it does not change any tables or policies yet.
-- ============================================================================

-- Function: check_user_organization
-- Purpose:  Securely checks if the current user belongs to the specified organization.
--           uses SECURITY DEFINER to bypass RLS recursion on the 'profiles' table.
-- Returns:  BOOLEAN
CREATE OR REPLACE FUNCTION public.check_user_organization(p_org_id uuid)
RETURNS boolean AS $$
BEGIN
  -- 1. If the p_org_id is null, access is denied (fail-safe)
  IF p_org_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 2. Check existence of link between auth.uid() and valid profile with matching org
  RETURN EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE id = auth.uid() 
      AND organization_id = p_org_id
      -- AND is_active = true -- Removed: Column does not exist in profiles table
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant permissions needed for authenticated users to run this check
GRANT EXECUTE ON FUNCTION public.check_user_organization(uuid) TO authenticated;

-- Verification Query (Run this manually to test)
-- SELECT check_user_organization('YOUR-ORG-ID-HERE');
