-- Teacher-assigned STEAM-H tasks with deadlines, submissions, and reminders.
-- Run this in Supabase SQL Editor for existing deployments.

create table if not exists public.steamh_assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  teacher_name text not null,
  student_id uuid not null references public.profiles (id) on delete cascade,
  student_name text not null,
  title text not null,
  instructions text,
  subject text,
  grade text,
  due_at timestamp with time zone not null,
  status text check (status in ('assigned', 'submitted', 'closed')) default 'assigned',
  submitted_project_id uuid references public.steamh_projects (id) on delete set null,
  submitted_at timestamp with time zone,
  last_reminded_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.steamh_assignments add column if not exists teacher_name text;
alter table public.steamh_assignments add column if not exists student_name text;
alter table public.steamh_assignments add column if not exists title text;
alter table public.steamh_assignments add column if not exists instructions text;
alter table public.steamh_assignments add column if not exists subject text;
alter table public.steamh_assignments add column if not exists grade text;
alter table public.steamh_assignments add column if not exists due_at timestamp with time zone;
alter table public.steamh_assignments add column if not exists status text;
alter table public.steamh_assignments add column if not exists submitted_project_id uuid references public.steamh_projects (id) on delete set null;
alter table public.steamh_assignments add column if not exists submitted_at timestamp with time zone;
alter table public.steamh_assignments add column if not exists last_reminded_at timestamp with time zone;
alter table public.steamh_assignments add column if not exists created_at timestamp with time zone default now();
alter table public.steamh_assignments add column if not exists updated_at timestamp with time zone default now();

update public.steamh_assignments
set status = 'assigned'
where status is null or trim(status) = '';

do $$
begin
  begin
    alter table public.steamh_assignments alter column status set default 'assigned';
  exception when others then
    null;
  end;
  begin
    alter table public.steamh_assignments alter column teacher_name set not null;
  exception when others then
    null;
  end;
  begin
    alter table public.steamh_assignments alter column student_name set not null;
  exception when others then
    null;
  end;
  begin
    alter table public.steamh_assignments alter column title set not null;
  exception when others then
    null;
  end;
  begin
    alter table public.steamh_assignments alter column due_at set not null;
  exception when others then
    null;
  end;
end $$;

create index if not exists steamh_assignments_teacher_due_idx
  on public.steamh_assignments (teacher_id, due_at asc, created_at desc);

create index if not exists steamh_assignments_student_due_idx
  on public.steamh_assignments (student_id, due_at asc, created_at desc);

alter table public.steamh_assignments enable row level security;

drop policy if exists "Teachers manage own STEAM-H assignments" on public.steamh_assignments;
drop policy if exists "Students read own STEAM-H assignments" on public.steamh_assignments;
drop policy if exists "Admins manage STEAM-H assignments" on public.steamh_assignments;

create policy "Teachers manage own STEAM-H assignments"
  on public.steamh_assignments
  for all
  using (auth.uid() = teacher_id and public.is_teacher())
  with check (auth.uid() = teacher_id and public.is_teacher());

create policy "Students read own STEAM-H assignments"
  on public.steamh_assignments
  for select
  using (auth.uid() = student_id);

create policy "Admins manage STEAM-H assignments"
  on public.steamh_assignments
  for all
  using (public.is_admin())
  with check (public.is_admin());
