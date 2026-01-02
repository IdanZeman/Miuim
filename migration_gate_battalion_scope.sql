-- 1. Add battalion_id to gate_logs if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gate_logs' AND column_name = 'battalion_id') THEN
        ALTER TABLE public.gate_logs ADD COLUMN battalion_id UUID REFERENCES public.battalions(id);
    END IF;
END $$;

-- 2. Add battalion_id to gate_authorized_vehicles if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gate_authorized_vehicles' AND column_name = 'battalion_id') THEN
        ALTER TABLE public.gate_authorized_vehicles ADD COLUMN battalion_id UUID REFERENCES public.battalions(id);
    END IF;
END $$;

-- 3. Update RLS for gate_logs
ALTER TABLE public.gate_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Battalion visibility for gate_logs" ON gate_logs;
DROP POLICY IF EXISTS "Battalion commander management for gate_logs" ON gate_logs;
DROP POLICY IF EXISTS "Battalion member management for gate_logs" ON gate_logs;

CREATE POLICY "Battalion member management for gate_logs"
ON gate_logs FOR ALL
USING (
    battalion_id IN (
        SELECT battalion_id FROM profiles WHERE id = auth.uid()
    ) OR 
    organization_id IN (
        SELECT id FROM organizations WHERE battalion_id IN (
            SELECT battalion_id FROM profiles WHERE id = auth.uid()
        )
    )
)
WITH CHECK (
    battalion_id IN (
        SELECT battalion_id FROM profiles WHERE id = auth.uid()
    ) OR 
    organization_id IN (
        SELECT id FROM organizations WHERE battalion_id IN (
            SELECT battalion_id FROM profiles WHERE id = auth.uid()
        )
    )
);

-- 4. Update RLS for gate_authorized_vehicles
ALTER TABLE public.gate_authorized_vehicles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Battalion visibility for gate_authorized_vehicles" ON gate_authorized_vehicles;
DROP POLICY IF EXISTS "Battalion commander management for gate_authorized_vehicles" ON gate_authorized_vehicles;
DROP POLICY IF EXISTS "Battalion member management for gate_authorized_vehicles" ON gate_authorized_vehicles;

CREATE POLICY "Battalion member management for gate_authorized_vehicles"
ON gate_authorized_vehicles FOR ALL
USING (
    battalion_id IN (
        SELECT battalion_id FROM profiles WHERE id = auth.uid()
    ) OR 
    organization_id IN (
        SELECT id FROM organizations WHERE battalion_id IN (
            SELECT battalion_id FROM profiles WHERE id = auth.uid()
        )
    )
)
WITH CHECK (
    battalion_id IN (
        SELECT battalion_id FROM profiles WHERE id = auth.uid()
    ) OR 
    organization_id IN (
        SELECT id FROM organizations WHERE battalion_id IN (
            SELECT battalion_id FROM profiles WHERE id = auth.uid()
        )
    )
);
