-- VR modules catalog for admin uploads and teacher request options.
create table if not exists public.vr_modules (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  module_name text not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz default now(),
  unique (subject, module_name)
);

alter table public.vr_modules enable row level security;

drop policy if exists "Teachers read VR modules" on public.vr_modules;
drop policy if exists "Admins manage VR modules" on public.vr_modules;

create policy "Teachers read VR modules"
  on public.vr_modules for select using (public.is_teacher());

create policy "Admins manage VR modules"
  on public.vr_modules for all using (public.is_admin())
  with check (public.is_admin());

notify pgrst, 'reload schema';
