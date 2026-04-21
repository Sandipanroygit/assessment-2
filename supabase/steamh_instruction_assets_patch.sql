-- Adds instruction links and attachments metadata to STEAM-H assignments.
-- Run this in Supabase SQL Editor for existing deployments.

alter table public.steamh_assignments
  add column if not exists instruction_links jsonb;

alter table public.steamh_assignments
  add column if not exists instruction_attachments jsonb;

update public.steamh_assignments
set instruction_links = '[]'::jsonb
where instruction_links is null;

update public.steamh_assignments
set instruction_attachments = '[]'::jsonb
where instruction_attachments is null;

do $$
begin
  begin
    alter table public.steamh_assignments
      alter column instruction_links set default '[]'::jsonb;
  exception when others then
    null;
  end;

  begin
    alter table public.steamh_assignments
      alter column instruction_attachments set default '[]'::jsonb;
  exception when others then
    null;
  end;
end $$;
