-- Fix for absences, hourly_blockages, teams, and team_rotations policies
-- This script cleans up old, potentially broken policies and adds battalion-level visibility for HQ
-- Double-sided text casting (::text) added to definitively fix "operator does not exist: text = uuid" error

-- 1. Absences Policy Cleanup
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'absences') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON absences';
    END LOOP;
END $$;

-- Basic policies for absences
CREATE POLICY "Users can view own org absences"
ON absences FOR SELECT
USING (
  organization_id::text = (SELECT organization_id::text FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "Users can manage own org absences"
ON absences FOR ALL
USING (
  organization_id::text = (SELECT organization_id::text FROM profiles WHERE id = auth.uid())
);

-- Battalion-level viewing for HQ (Absences)
CREATE POLICY "HQ can view battalion absences"
ON absences FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM organizations o1
    WHERE o1.id::text = (SELECT organization_id::text FROM profiles WHERE id = auth.uid())
    AND o1.is_hq = true
    AND o1.battalion_id IS NOT NULL
    AND absences.organization_id::text IN (
      SELECT id::text FROM organizations o2 WHERE o2.battalion_id::text = o1.battalion_id::text
    )
  )
);


-- 2. Hourly Blockages Policy Cleanup
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'hourly_blockages') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON hourly_blockages';
    END LOOP;
END $$;

-- Basic policies for hourly_blockages
CREATE POLICY "Users can view own org hourly_blockages"
ON hourly_blockages FOR SELECT
USING (
  organization_id::text = (SELECT organization_id::text FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "Users can manage own org hourly_blockages"
ON hourly_blockages FOR ALL
USING (
  organization_id::text = (SELECT organization_id::text FROM profiles WHERE id = auth.uid())
);

-- Battalion-level viewing for HQ (Hourly Blockages)
CREATE POLICY "HQ can view battalion hourly_blockages"
ON hourly_blockages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM organizations o1
    WHERE o1.id::text = (SELECT organization_id::text FROM profiles WHERE id = auth.uid())
    AND o1.is_hq = true
    AND o1.battalion_id IS NOT NULL
    AND hourly_blockages.organization_id::text IN (
      SELECT id::text FROM organizations o2 WHERE o2.battalion_id::text = o1.battalion_id::text
    )
  )
);


-- 3. Teams Policy Cleanup
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'teams') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON teams';
    END LOOP;
END $$;

-- Basic policies for teams
CREATE POLICY "Users can view own org teams"
ON teams FOR SELECT
USING (
  organization_id::text = (SELECT organization_id::text FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "Users can manage own org teams"
ON teams FOR ALL
USING (
  organization_id::text = (SELECT organization_id::text FROM profiles WHERE id = auth.uid())
);

-- Battalion-level viewing for HQ (Teams)
CREATE POLICY "HQ can view battalion teams"
ON teams FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM organizations o1
    WHERE o1.id::text = (SELECT organization_id::text FROM profiles WHERE id = auth.uid())
    AND o1.is_hq = true
    AND o1.battalion_id IS NOT NULL
    AND teams.organization_id::text IN (
      SELECT id::text FROM organizations o2 WHERE o2.battalion_id::text = o1.battalion_id::text
    )
  )
);


-- 4. Team Rotations Policy Cleanup
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'team_rotations') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON team_rotations';
    END LOOP;
END $$;

-- Basic policies for team_rotations
CREATE POLICY "Users can view own org team_rotations"
ON team_rotations FOR SELECT
USING (
  organization_id::text = (SELECT organization_id::text FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "Users can manage own org team_rotations"
ON team_rotations FOR ALL
USING (
  organization_id::text = (SELECT organization_id::text FROM profiles WHERE id = auth.uid())
);

-- Battalion-level viewing for HQ (Team Rotations)
CREATE POLICY "HQ can view battalion team_rotations"
ON team_rotations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM organizations o1
    WHERE o1.id::text = (SELECT organization_id::text FROM profiles WHERE id = auth.uid())
    AND o1.is_hq = true
    AND o1.battalion_id IS NOT NULL
    AND team_rotations.organization_id::text IN (
      SELECT id::text FROM organizations o2 WHERE o2.battalion_id::text = o1.battalion_id::text
    )
  )
);
