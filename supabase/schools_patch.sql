-- Schools master directory for signup dropdown and admin branch management.
create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  network_name text not null,
  branch_name text not null,
  display_name text not null,
  sort_order integer not null default 100,
  active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamp with time zone default now(),
  unique (network_name, branch_name),
  unique (display_name)
);

create index if not exists schools_active_sort_idx
  on public.schools (active, sort_order asc, display_name asc);

alter table public.schools enable row level security;

drop policy if exists "Public read active schools" on public.schools;
drop policy if exists "Admins manage schools" on public.schools;

create policy "Public read active schools" on public.schools
  for select using (active is true);

create policy "Admins manage schools" on public.schools
  for all using (public.is_admin()) with check (public.is_admin());

insert into public.schools (network_name, branch_name, display_name, sort_order, active)
values
  ('Indus International Schools', 'Bangalore', 'Indus International School, Bangalore', 10, true),
  ('Indus International Schools', 'Hyderabad', 'Indus International School, Hyderabad', 20, true),
  ('Indus International Schools', 'Pune', 'Indus International School, Pune', 30, true),
  ('Indus International Schools', 'Belgavi', 'Indus International School, Belgavi', 40, true),
  ('10X International Schools', 'Bangalore', '10X International School, Bangalore', 50, true),
  ('10X International Schools', 'Mysuru', '10X International School, Mysuru', 60, true)
on conflict (network_name, branch_name) do nothing;

notify pgrst, 'reload schema';
