-- Adds group-assignment support to STEAM-H tasks.
-- Run this in Supabase SQL Editor for existing deployments.

alter table public.steamh_assignments
  add column if not exists assignment_mode text;

alter table public.steamh_assignments
  add column if not exists group_id uuid;

alter table public.steamh_assignments
  add column if not exists group_name text;

alter table public.steamh_assignments
  add column if not exists group_size integer;

update public.steamh_assignments
set assignment_mode = 'individual'
where assignment_mode is null or trim(assignment_mode) = '';

update public.steamh_assignments
set group_size = 1
where group_size is null and assignment_mode = 'individual';

do $$
begin
  begin
    alter table public.steamh_assignments
      add constraint steamh_assignments_assignment_mode_check
      check (assignment_mode in ('individual', 'group'));
  exception when duplicate_object then
    null;
  end;
  begin
    alter table public.steamh_assignments
      alter column assignment_mode set default 'individual';
  exception when others then
    null;
  end;
end $$;

create index if not exists steamh_assignments_group_idx
  on public.steamh_assignments (group_id);
