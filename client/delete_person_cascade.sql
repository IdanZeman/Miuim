-- ============================================================================
-- CASCADE DELETE SYSTEM WITH IMPACT PREVIEW
-- ============================================================================
--
-- PURPOSE:
-- Safely delete people and all their related data while respecting foreign key
-- constraints and providing transparency about what will be deleted.
--
-- FEATURES:
-- 1. Preview deletion impact before execution
-- 2. Cascade delete in correct dependency order
-- 3. Handle inconsistent organization_id values
-- 4. Support both single and batch operations
--
-- ============================================================================
-- DELETION STRATEGY: Two-Phase Approach
-- ============================================================================
--
-- PHASE 1: Target ID Collection
-- ------------------------------
-- Problem: Some records may have inconsistent organization_id but valid FK refs
-- 
-- Example Scenario:
--   person.organization_id = 'org-A'
--   shift.organization_id = 'org-B' (inconsistent!)
--   BUT shift.assigned_person_ids contains person.id (valid FK!)
--
-- Solution: Collect ALL related IDs by following FK relationships, not just
-- by matching organization_id.
--
-- Implementation:
--   - Query each dependent table using person_id FK
--   - Build a complete list of affected records
--   - Ensures nothing is left behind
--
-- PHASE 2: Perfect Order Deletion
-- --------------------------------
-- Problem: FK constraints prevent deleting parent before children
--
-- Solution: Delete in strict dependency order (leaves → root)
--
-- FK Dependency Tree:
--   people (ROOT)
--     ├── mission_reports (via shifts.assigned_person_ids)
--     ├── user_load_stats (via person_id)
--     ├── daily_attendance_snapshots (via person_id)
--     ├── daily_presence (via person_id)
--     ├── unified_presence (via person_id)
--     ├── absences (via person_id)
--     ├── hourly_blockages (via person_id)
--     ├── scheduling_constraints (via person_id)
--     ├── shifts (via assigned_person_ids array)
--     └── equipment (via assigned_to_id)
--
-- Deletion Order (11 steps):
--   1. mission_reports       - LEAF (references shifts)
--   2. user_load_stats       - LEAF (references person)
--   3. daily_attendance_snapshots - LEAF (references person)
--   4. daily_presence        - LEAF (references person)
--   5. unified_presence      - LEAF (references person)
--   6. absences              - LEAF (references person)
--   7. hourly_blockages      - LEAF (references person)
--   8. scheduling_constraints - LEAF (references person)
--   9. shifts                - UPDATE (remove person from array, don't delete)
--   10. equipment            - UPDATE (unassign person, don't delete)
--   11. people               - ROOT (final deletion)
--
-- Why This Order:
--   - mission_reports first because it references shifts
--   - All other tables reference people directly
--   - shifts and equipment are updated, not deleted (preserve records)
--   - people deleted last after all dependencies cleared
--
-- ============================================================================
-- USAGE EXAMPLES
-- ============================================================================
--
-- Preview what will be deleted:
--   SELECT * FROM preview_person_deletion('person-123');
--
-- Delete single person:
--   SELECT delete_person_cascade('person-123');
--
-- Delete multiple people:
--   SELECT delete_people_cascade(ARRAY['person-1', 'person-2', 'person-3']);
--
-- ============================================================================

CREATE OR REPLACE FUNCTION public.preview_person_deletion(p_person_id text)
RETURNS TABLE(
  category text,
  count bigint,
  description text
) AS $$
BEGIN
  RETURN QUERY
  
  -- Count shifts assigned to this person
  SELECT 
    'shifts'::text,
    COUNT(*)::bigint,
    'משמרות שבהן החייל משובץ'::text
  FROM public.shifts 
  WHERE p_person_id = ANY(assigned_person_ids);
  
  RETURN QUERY
  SELECT 
    'daily_presence'::text,
    COUNT(*)::bigint,
    'רשומות נוכחות יומית'::text
  FROM public.daily_presence 
  WHERE person_id = p_person_id;
  
  RETURN QUERY
  SELECT 
    'absences'::text,
    COUNT(*)::bigint,
    'בקשות יציאה'::text
  FROM public.absences 
  WHERE person_id = p_person_id;
  
  RETURN QUERY
  SELECT 
    'hourly_blockages'::text,
    COUNT(*)::bigint,
    'חסימות שעתיות'::text
  FROM public.hourly_blockages 
  WHERE person_id = p_person_id;
  
  RETURN QUERY
  SELECT 
    'scheduling_constraints'::text,
    COUNT(*)::bigint,
    'אילוצי שיבוץ'::text
  FROM public.scheduling_constraints 
  WHERE person_id = p_person_id;
  
  RETURN QUERY
  SELECT 
    'equipment'::text,
    COUNT(*)::bigint,
    'פריטי ציוד מוקצים'::text
  FROM public.equipment 
  WHERE assigned_to_id = p_person_id;
  
  RETURN QUERY
  SELECT 
    'daily_attendance_snapshots'::text,
    COUNT(*)::bigint,
    'צילומי נוכחות'::text
  FROM public.daily_attendance_snapshots 
  WHERE person_id = p_person_id;

  RETURN QUERY
  SELECT 
    'unified_presence'::text,
    COUNT(*)::bigint,
    'רשומות נוכחות מאוחדת'::text
  FROM public.unified_presence 
  WHERE person_id = p_person_id;
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to completely delete a person and all related data
-- This bypasses foreign key constraints by deleting in the correct order

CREATE OR REPLACE FUNCTION public.delete_person_cascade(p_person_id text)
RETURNS void AS $$
BEGIN
  -- Delete in order from dependent tables to parent table
  -- We use explicit text casting for robustness against type mismatches
  
  -- 1. Delete mission reports (references shifts)
  DELETE FROM public.mission_reports 
  WHERE shift_id IN (
    SELECT id FROM public.shifts 
    WHERE p_person_id::text = ANY(assigned_person_ids::text[])
  );
  
  -- 2. Delete user load stats
  DELETE FROM public.user_load_stats 
  WHERE person_id::text = p_person_id::text;
  
  -- 3. Delete daily attendance snapshots
  DELETE FROM public.daily_attendance_snapshots 
  WHERE person_id::text = p_person_id::text;
  
  -- 4. Delete daily presence records
  DELETE FROM public.daily_presence 
  WHERE person_id::text = p_person_id::text;
  
  -- 5. Delete absences
  DELETE FROM public.absences 
  WHERE person_id::text = p_person_id::text;
  
  -- 6. Delete hourly blockages
  DELETE FROM public.hourly_blockages 
  WHERE person_id::text = p_person_id::text;
  
  -- 7. Delete scheduling constraints
  DELETE FROM public.scheduling_constraints 
  WHERE person_id::text = p_person_id::text;
  
  -- 8. Remove person from shifts (don't delete shifts, just unassign)
  UPDATE public.shifts 
  SET assigned_person_ids = array_remove(assigned_person_ids, p_person_id::text)
  WHERE p_person_id::text = ANY(assigned_person_ids::text[]);
  
  -- 9. Unassign equipment
  UPDATE public.equipment 
  SET assigned_to_id = NULL 
  WHERE assigned_to_id::text = p_person_id::text;
  
  -- 10. Delete unified presence records (CRITICAL: References people(id))
  -- We do this as late as possible because other deletions might trigger re-inserts
  DELETE FROM public.unified_presence 
  WHERE person_id::text = p_person_id::text;
  
  -- 11. Finally, delete the person
  DELETE FROM public.people 
  WHERE id::text = p_person_id::text;
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Batch version for deleting multiple people at once
CREATE OR REPLACE FUNCTION public.delete_people_cascade(p_person_ids text[])
RETURNS void AS $$
DECLARE
  person_id text;
BEGIN
  -- Loop through each person and delete
  FOREACH person_id IN ARRAY p_person_ids
  LOOP
    PERFORM delete_person_cascade(person_id);
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.preview_person_deletion(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_person_cascade(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_people_cascade(text[]) TO authenticated;
