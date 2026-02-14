-- Add home_page_config column to organization_settings table
ALTER TABLE organization_settings 
ADD COLUMN IF NOT EXISTS home_page_config JSONB DEFAULT '[]'::jsonb;

-- Comment on column
COMMENT ON COLUMN organization_settings.home_page_config IS 'Configuration for the home page layout and visibility of widgets.';
