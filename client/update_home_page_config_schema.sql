-- Ensure home_page_config column exists in organization_settings
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organization_settings' AND column_name = 'home_page_config') THEN
        ALTER TABLE organization_settings ADD COLUMN home_page_config JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- Optional: Reset the column to empty object if it contains incompatible array data (only if strictly necessary, but JSONB overwrites are usually fine).
-- You don't usually need to migration data if you are okay with overwriting it from the UI.
