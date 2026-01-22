-- Create Carpool Rides Table
CREATE TABLE IF NOT EXISTS public.carpool_rides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    creator_id TEXT NOT NULL REFERENCES public.people(id) ON DELETE CASCADE, -- Fixed: Changed to TEXT to match people.id
    driver_name TEXT NOT NULL,
    driver_phone TEXT,
    type TEXT CHECK (type IN ('offer', 'request')) DEFAULT 'offer',
    direction TEXT CHECK (direction IN ('to_base', 'to_home')),
    date DATE NOT NULL,
    time TEXT NOT NULL, -- Storing as text HH:MM for simplicity or TIME without time zone
    location TEXT NOT NULL,
    seats INTEGER DEFAULT 3,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_full BOOLEAN DEFAULT FALSE
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_carpool_rides_org_date ON public.carpool_rides(organization_id, date);

-- Enable RLS
ALTER TABLE public.carpool_rides ENABLE ROW LEVEL SECURITY;

-- Policy 1: View rides within the same organization
CREATE POLICY "View rides within organization"
ON public.carpool_rides FOR SELECT
USING (
    organization_id IN (
        SELECT organization_id FROM public.profiles 
        WHERE id = auth.uid()
    )
);

-- Policy 2: Insert rides (must belong to user's organization)
CREATE POLICY "Create rides in organization"
ON public.carpool_rides FOR INSERT
WITH CHECK (
    organization_id IN (
        SELECT organization_id FROM public.profiles 
        WHERE id = auth.uid()
    )
);

-- Policy 3: Delete own rides
CREATE POLICY "Delete own rides"
ON public.carpool_rides FOR DELETE
USING (
    creator_id IN (
        SELECT id FROM public.people 
        WHERE user_id = auth.uid()
    )
);

-- Policy 4: Update own rides
CREATE POLICY "Update own rides"
ON public.carpool_rides FOR UPDATE
USING (
    creator_id IN (
        SELECT id FROM public.people 
        WHERE user_id = auth.uid()
    )
)
WITH CHECK (
    creator_id IN (
        SELECT id FROM public.people 
        WHERE user_id = auth.uid()
    )
);

-- Realtime support
ALTER PUBLICATION supabase_realtime ADD TABLE public.carpool_rides;
