-- Create the enum type for constraint types (if not exists)
DO $$ BEGIN
    CREATE TYPE constraint_type AS ENUM ('always_assign', 'never_assign', 'time_block');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create the scheduling_constraints table
create table if not exists scheduling_constraints (
  id uuid default gen_random_uuid() primary key,
  person_id text not null references people(id) on delete cascade, -- Changed to text
  type constraint_type not null,
  task_id text references task_templates(id) on delete cascade, -- Changed to text
  start_time timestamptz,
  end_time timestamptz,
  organization_id uuid not null references organizations(id) on delete cascade,
  created_at timestamptz default now()
);

-- Enable RLS
alter table scheduling_constraints enable row level security;

-- Create policies
create policy "Users can view constraints for their organization"
  on scheduling_constraints for select
  using (organization_id = (select organization_id from profiles where id = auth.uid()));

create policy "Admins and Editors can manage constraints"
  on scheduling_constraints for all
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
      and organization_id = scheduling_constraints.organization_id
      and role in ('admin', 'editor')
    )
  );
