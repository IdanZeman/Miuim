-- Add metadata column to shifts table to support commander assignment
ALTER TABLE public.shifts 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Comment on column
COMMENT ON COLUMN public.shifts.metadata IS 'Flexible metadata for the shift, e.g. commanderId';
