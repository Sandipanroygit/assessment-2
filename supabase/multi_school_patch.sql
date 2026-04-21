-- Add school-level partition key for multi-school support.
alter table public.profiles
  add column if not exists school_name text;

-- Backfill from auth metadata where available.
update public.profiles p
set school_name = nullif(trim(u.raw_user_meta_data ->> 'school_name'), '')
from auth.users u
where u.id = p.id
  and (p.school_name is null or btrim(p.school_name) = '')
  and nullif(trim(u.raw_user_meta_data ->> 'school_name'), '') is not null;

notify pgrst, 'reload schema';
