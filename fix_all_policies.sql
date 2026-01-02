-- Complete cleanup of old battalion policies and recreation
-- Run this to fix the "created_by does not exist" error

-- 1. Drop ALL old policies that might reference created_by or old structure
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Drop all policies on daily_presence
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'daily_presence') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON daily_presence';
    END LOOP;
    
    -- Drop all policies on people  
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'people') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON people';
    END LOOP;
    
    -- Drop all policies on organizations
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'organizations') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON organizations';
    END LOOP;
    
    -- Drop all policies on shifts
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'shifts') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON shifts';
    END LOOP;
END $$;

-- 2. Recreate basic policies for daily_presence
CREATE POLICY "Users can view own org presence"
ON daily_presence FOR SELECT
USING (
  organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "Users can manage own org presence"
ON daily_presence FOR ALL
USING (
  organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
);

-- 3. Recreate basic policies for people
CREATE POLICY "Users can view own org people"
ON people FOR SELECT
USING (
  organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "Users can manage own org people"
ON people FOR ALL
USING (
  organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
);

-- 4. Recreate basic policies for organizations
CREATE POLICY "Users can view own organization"
ON organizations FOR SELECT
USING (
  id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "Users can update own organization"
ON organizations FOR UPDATE
USING (
  id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
);

-- 5. Recreate basic policies for shifts
CREATE POLICY "Users can view own org shifts"
ON shifts FOR SELECT
USING (
  organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "Users can manage own org shifts"
ON shifts FOR ALL
USING (
  organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
);

-- 6. Add battalion-level viewing for HQ (without using helper functions that might not exist)
CREATE POLICY "HQ can view battalion presence"
ON daily_presence FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM organizations o1
    WHERE o1.id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND o1.is_hq = true
    AND o1.battalion_id IS NOT NULL
    AND daily_presence.organization_id IN (
      SELECT id FROM organizations o2 WHERE o2.battalion_id = o1.battalion_id
    )
  )
);

CREATE POLICY "HQ can view battalion people"
ON people FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM organizations o1
    WHERE o1.id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND o1.is_hq = true
    AND o1.battalion_id IS NOT NULL
    AND people.organization_id IN (
      SELECT id FROM organizations o2 WHERE o2.battalion_id = o1.battalion_id
    )
  )
);

CREATE POLICY "HQ can view battalion organizations"
ON organizations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM organizations o1
    WHERE o1.id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND o1.is_hq = true
    AND o1.battalion_id IS NOT NULL
    AND organizations.battalion_id = o1.battalion_id
  )
);

CREATE POLICY "HQ can view battalion shifts"
ON shifts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM organizations o1
    WHERE o1.id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND o1.is_hq = true
    AND o1.battalion_id IS NOT NULL
    AND shifts.organization_id IN (
      SELECT id FROM organizations o2 WHERE o2.battalion_id = o1.battalion_id
    )
  )
);
