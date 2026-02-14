-- ============================================================================
-- DELETED PEOPLE ARCHIVE SYSTEM
-- ============================================================================
-- Purpose: Archive deleted people and their data for audit trail and recovery
-- Features:
--   - Store full person record before deletion
--   - Track deletion metadata (who, when, why)
--   - Store counts of related data that was deleted
--   - Enable recovery from archive
--   - Audit compliance

-- Archive Table
CREATE TABLE IF NOT EXISTS public.deleted_people_archive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id text NOT NULL,
  person_data jsonb NOT NULL, -- Full person record
  organization_id uuid NOT NULL,  -- Changed from text to uuid
  deleted_by uuid NOT NULL,
  deleted_at timestamp with time zone DEFAULT now(),
  deletion_reason text,
  related_data_counts jsonb, -- Counts from preview_person_deletion
  can_restore boolean DEFAULT true,
  restored_at timestamp with time zone,
  restored_by uuid,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_deleted_people_org 
  ON public.deleted_people_archive(organization_id);

CREATE INDEX IF NOT EXISTS idx_deleted_people_deleted_at 
  ON public.deleted_people_archive(deleted_at DESC);

CREATE INDEX IF NOT EXISTS idx_deleted_people_person_id 
  ON public.deleted_people_archive(person_id);

CREATE INDEX IF NOT EXISTS idx_deleted_people_can_restore 
  ON public.deleted_people_archive(can_restore) 
  WHERE can_restore = true;

-- RLS Policies
ALTER TABLE public.deleted_people_archive ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to allow re-running script)
DROP POLICY IF EXISTS "Users can view their organization's deleted people archive" ON public.deleted_people_archive;
DROP POLICY IF EXISTS "System can insert deleted people archive" ON public.deleted_people_archive;
DROP POLICY IF EXISTS "System can update deleted people archive" ON public.deleted_people_archive;

-- Users can view their organization's archive
CREATE POLICY "Users can view their organization's deleted people archive"
  ON public.deleted_people_archive
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Only system can insert (via RPC functions)
CREATE POLICY "System can insert deleted people archive"
  ON public.deleted_people_archive
  FOR INSERT
  WITH CHECK (true);

-- Only system can update (for restore tracking)
CREATE POLICY "System can update deleted people archive"
  ON public.deleted_people_archive
  FOR UPDATE
  USING (true);

-- ============================================================================
-- ARCHIVE FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.archive_person_before_delete(
  p_person_id text,
  p_deleted_by uuid,
  p_reason text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_archive_id uuid;
  v_person_data jsonb;
  v_preview_data jsonb;
  v_org_id uuid;
BEGIN
  -- Get full person record
  SELECT to_jsonb(p.*) INTO v_person_data
  FROM public.people p 
  WHERE id = p_person_id;
  
  IF v_person_data IS NULL THEN
    RAISE EXCEPTION 'Person not found: %', p_person_id;
  END IF;
  
  v_org_id := (v_person_data->>'organization_id')::uuid;
  
  -- Get preview counts (what will be deleted)
  SELECT jsonb_object_agg(category, row_to_json(r.*))
  INTO v_preview_data
  FROM (
    SELECT category, count, description
    FROM public.preview_person_deletion(p_person_id)
  ) r;
  
  -- Archive
  INSERT INTO public.deleted_people_archive (
    person_id,
    person_data,
    organization_id,
    deleted_by,
    deletion_reason,
    related_data_counts
  ) VALUES (
    p_person_id,
    v_person_data,
    v_org_id,
    p_deleted_by,
    p_reason,
    v_preview_data
  ) RETURNING id INTO v_archive_id;
  
  RETURN v_archive_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- BATCH ARCHIVE FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.archive_people_before_delete(
  p_person_ids text[],
  p_deleted_by uuid,
  p_reason text DEFAULT NULL
)
RETURNS uuid[] AS $$
DECLARE
  person_id text;
  archive_ids uuid[] := ARRAY[]::uuid[];
  archive_id uuid;
BEGIN
  FOREACH person_id IN ARRAY p_person_ids
  LOOP
    archive_id := archive_person_before_delete(person_id, p_deleted_by, p_reason);
    archive_ids := array_append(archive_ids, archive_id);
  END LOOP;
  
  RETURN archive_ids;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- RECOVERY FUNCTION (Future Enhancement)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.restore_person_from_archive(
  p_archive_id uuid,
  p_restored_by uuid
)
RETURNS text AS $$
DECLARE
  v_person_data jsonb;
  v_person_id text;
  v_can_restore boolean;
BEGIN
  -- Get archive record
  SELECT person_data, person_id, can_restore
  INTO v_person_data, v_person_id, v_can_restore
  FROM public.deleted_people_archive
  WHERE id = p_archive_id;
  
  IF v_person_data IS NULL THEN
    RAISE EXCEPTION 'Archive record not found: %', p_archive_id;
  END IF;
  
  IF NOT v_can_restore THEN
    RAISE EXCEPTION 'This person cannot be restored (can_restore = false)';
  END IF;
  
  -- Check if person already exists
  IF EXISTS (SELECT 1 FROM public.people WHERE id = v_person_id) THEN
    RAISE EXCEPTION 'Person already exists: %', v_person_id;
  END IF;
  
  -- Restore person (only the person record, not related data)
  INSERT INTO public.people
  SELECT * FROM jsonb_populate_record(null::public.people, v_person_data);
  
  -- Mark as restored
  UPDATE public.deleted_people_archive
  SET 
    restored_at = now(),
    restored_by = p_restored_by,
    can_restore = false
  WHERE id = p_archive_id;
  
  RETURN v_person_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- ANALYTICS VIEWS
-- ============================================================================

-- View: Recent deletions summary
CREATE OR REPLACE VIEW public.deleted_people_summary AS
SELECT 
  organization_id,
  COUNT(*) as total_deleted,
  COUNT(CASE WHEN restored_at IS NOT NULL THEN 1 END) as restored_count,
  COUNT(CASE WHEN can_restore = true THEN 1 END) as can_restore_count,
  MAX(deleted_at) as last_deletion_date
FROM public.deleted_people_archive
WHERE deleted_at >= now() - interval '90 days'
GROUP BY organization_id;

-- View: Deletion details for audit
CREATE OR REPLACE VIEW public.deleted_people_audit AS
SELECT 
  dpa.id as archive_id,
  dpa.person_id,
  dpa.person_data->>'name' as person_name,
  dpa.person_data->>'personal_id' as personal_id,
  dpa.organization_id,
  p.full_name as deleted_by_name,
  dpa.deleted_at,
  dpa.deletion_reason,
  dpa.related_data_counts,
  dpa.can_restore,
  dpa.restored_at,
  r.full_name as restored_by_name
FROM public.deleted_people_archive dpa
LEFT JOIN public.profiles p ON dpa.deleted_by = p.id
LEFT JOIN public.profiles r ON dpa.restored_by = r.id
ORDER BY dpa.deleted_at DESC;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.archive_person_before_delete TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_people_before_delete TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_person_from_archive TO authenticated;
GRANT SELECT ON public.deleted_people_summary TO authenticated;
GRANT SELECT ON public.deleted_people_audit TO authenticated;

-- ============================================================================
-- USAGE EXAMPLES
-- ============================================================================
/*
-- Archive a person before deletion
SELECT archive_person_before_delete(
  'person-123',
  'user-uuid',
  'Inactive for 6 months'
);

-- Archive multiple people
SELECT archive_people_before_delete(
  ARRAY['person-1', 'person-2', 'person-3'],
  'user-uuid',
  'Batch cleanup of inactive personnel'
);

-- Restore a person from archive
SELECT restore_person_from_archive(
  'archive-uuid',
  'user-uuid'
);

-- View deletion summary
SELECT * FROM deleted_people_summary;

-- View audit trail
SELECT * FROM deleted_people_audit
WHERE deleted_at >= now() - interval '30 days';
*/
