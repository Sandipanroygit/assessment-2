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
  instruction_links jsonb default '[]'::jsonb,
  instruction_attachments jsonb default '[]'::jsonb,
  subject text,
  grade text,
  due_at timestamp with time zone not null,
  assignment_mode text check (assignment_mode in ('individual', 'group')) default 'individual',
  group_id uuid,
  group_name text,
  group_size integer check (group_size is null or group_size > 0),
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
alter table public.steamh_assignments add column if not exists instruction_links jsonb;
alter table public.steamh_assignments add column if not exists instruction_attachments jsonb;
alter table public.steamh_assignments add column if not exists subject text;
alter table public.steamh_assignments add column if not exists grade text;
alter table public.steamh_assignments add column if not exists due_at timestamp with time zone;
alter table public.steamh_assignments add column if not exists assignment_mode text;
alter table public.steamh_assignments add column if not exists group_id uuid;
alter table public.steamh_assignments add column if not exists group_name text;
alter table public.steamh_assignments add column if not exists group_size integer;
alter table public.steamh_assignments add column if not exists status text;
alter table public.steamh_assignments add column if not exists submitted_project_id uuid references public.steamh_projects (id) on delete set null;
alter table public.steamh_assignments add column if not exists submitted_at timestamp with time zone;
alter table public.steamh_assignments add column if not exists last_reminded_at timestamp with time zone;
alter table public.steamh_assignments add column if not exists created_at timestamp with time zone default now();
alter table public.steamh_assignments add column if not exists updated_at timestamp with time zone default now();

update public.steamh_assignments
set status = 'assigned'
where status is null or trim(status) = '';

update public.steamh_assignments
set assignment_mode = 'individual'
where assignment_mode is null or trim(assignment_mode) = '';

update public.steamh_assignments
set instruction_links = '[]'::jsonb
where instruction_links is null;

update public.steamh_assignments
set instruction_attachments = '[]'::jsonb
where instruction_attachments is null;

update public.steamh_assignments
set group_size = 1
where group_size is null and assignment_mode = 'individual';

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
  begin
    alter table public.steamh_assignments alter column assignment_mode set default 'individual';
  exception when others then
    null;
  end;
  begin
    alter table public.steamh_assignments alter column instruction_links set default '[]'::jsonb;
  exception when others then
    null;
  end;
  begin
    alter table public.steamh_assignments alter column instruction_attachments set default '[]'::jsonb;
  exception when others then
    null;
  end;
end $$;

create index if not exists steamh_assignments_teacher_due_idx
  on public.steamh_assignments (teacher_id, due_at asc, created_at desc);

create index if not exists steamh_assignments_student_due_idx
  on public.steamh_assignments (student_id, due_at asc, created_at desc);

create index if not exists steamh_assignments_group_idx
  on public.steamh_assignments (group_id);

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
