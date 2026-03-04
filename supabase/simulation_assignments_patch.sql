-- Grade-based simulation assignments (teacher -> students).
-- Run this in Supabase SQL Editor for existing deployments.

create table if not exists public.simulation_assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  teacher_name text not null,
  target_grade text not null,
  target_grade_key text not null,
  subject text,
  simulation_title text not null,
  simulation_url text not null,
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.simulation_assignments add column if not exists teacher_name text;
alter table public.simulation_assignments add column if not exists target_grade text;
alter table public.simulation_assignments add column if not exists target_grade_key text;
alter table public.simulation_assignments add column if not exists subject text;
alter table public.simulation_assignments add column if not exists simulation_title text;
alter table public.simulation_assignments add column if not exists simulation_url text;
alter table public.simulation_assignments add column if not exists notes text;
alter table public.simulation_assignments add column if not exists created_at timestamp with time zone default now();
alter table public.simulation_assignments add column if not exists updated_at timestamp with time zone default now();

create index if not exists simulation_assignments_teacher_idx
  on public.simulation_assignments (teacher_id, created_at desc);

create index if not exists simulation_assignments_grade_idx
  on public.simulation_assignments (target_grade_key, created_at desc);

alter table public.simulation_assignments enable row level security;

drop policy if exists "Teachers manage own simulation assignments" on public.simulation_assignments;
drop policy if exists "Admins manage simulation assignments" on public.simulation_assignments;

create policy "Teachers manage own simulation assignments"
  on public.simulation_assignments
  for all
  using (auth.uid() = teacher_id and public.is_teacher())
  with check (auth.uid() = teacher_id and public.is_teacher());

create policy "Admins manage simulation assignments"
  on public.simulation_assignments
  for all
  using (public.is_admin())
  with check (public.is_admin());
