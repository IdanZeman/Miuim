-- Enable RLS on war_clock_items
ALTER TABLE war_clock_items ENABLE ROW LEVEL SECURITY;

-- Policy for users to see and manage items in their own organization
CREATE POLICY "Users can manage items in their own organization"
ON war_clock_items
FOR ALL
USING (
    organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
)
WITH CHECK (
    organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
);

-- Policy for battalion commanders to see and manage items across their battalion's organizations
CREATE POLICY "Battalion commanders can manage items in their battalion"
ON war_clock_items
FOR ALL
USING (
    organization_id IN (
        SELECT id FROM organizations WHERE battalion_id IN (
            SELECT battalion_id FROM profiles WHERE id = auth.uid()
        )
    )
)
WITH CHECK (
    organization_id IN (
        SELECT id FROM organizations WHERE battalion_id IN (
            SELECT battalion_id FROM profiles WHERE id = auth.uid()
        )
    )
);
