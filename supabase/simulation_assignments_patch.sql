-- Grade-based simulation assignments (teacher -> students) with deadlines and progress.
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
  due_at timestamp with time zone not null,
  assessment_questions jsonb,
  assessment_generated_at timestamp with time zone,
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
alter table public.simulation_assignments add column if not exists due_at timestamp with time zone;
alter table public.simulation_assignments add column if not exists assessment_questions jsonb;
alter table public.simulation_assignments add column if not exists assessment_generated_at timestamp with time zone;
alter table public.simulation_assignments add column if not exists created_at timestamp with time zone default now();
alter table public.simulation_assignments add column if not exists updated_at timestamp with time zone default now();

update public.simulation_assignments
set due_at = coalesce(due_at, created_at, now() + interval '7 day')
where due_at is null;

do $$
begin
  begin
    alter table public.simulation_assignments alter column teacher_name set not null;
  exception when others then
    null;
  end;
  begin
    alter table public.simulation_assignments alter column target_grade set not null;
  exception when others then
    null;
  end;
  begin
    alter table public.simulation_assignments alter column target_grade_key set not null;
  exception when others then
    null;
  end;
  begin
    alter table public.simulation_assignments alter column simulation_title set not null;
  exception when others then
    null;
  end;
  begin
    alter table public.simulation_assignments alter column simulation_url set not null;
  exception when others then
    null;
  end;
  begin
    alter table public.simulation_assignments alter column due_at set not null;
  exception when others then
    null;
  end;
end $$;

create index if not exists simulation_assignments_teacher_due_idx
  on public.simulation_assignments (teacher_id, due_at asc, created_at desc);

create index if not exists simulation_assignments_grade_due_idx
  on public.simulation_assignments (target_grade_key, due_at asc, created_at desc);

create table if not exists public.simulation_assignment_progress (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.simulation_assignments (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  student_name text,
  student_grade text,
  status text check (status in ('assigned', 'viewed')) default 'assigned',
  viewed_at timestamp with time zone,
  assessment_score integer,
  assessment_total integer,
  assessment_submitted_at timestamp with time zone,
  assessment_answers jsonb,
  last_reminded_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique (assignment_id, student_id)
);

alter table public.simulation_assignment_progress add column if not exists assignment_id uuid references public.simulation_assignments (id) on delete cascade;
alter table public.simulation_assignment_progress add column if not exists student_id uuid references public.profiles (id) on delete cascade;
alter table public.simulation_assignment_progress add column if not exists student_name text;
alter table public.simulation_assignment_progress add column if not exists student_grade text;
alter table public.simulation_assignment_progress add column if not exists status text;
alter table public.simulation_assignment_progress add column if not exists viewed_at timestamp with time zone;
alter table public.simulation_assignment_progress add column if not exists assessment_score integer;
alter table public.simulation_assignment_progress add column if not exists assessment_total integer;
alter table public.simulation_assignment_progress add column if not exists assessment_submitted_at timestamp with time zone;
alter table public.simulation_assignment_progress add column if not exists assessment_answers jsonb;
alter table public.simulation_assignment_progress add column if not exists last_reminded_at timestamp with time zone;
alter table public.simulation_assignment_progress add column if not exists created_at timestamp with time zone default now();
alter table public.simulation_assignment_progress add column if not exists updated_at timestamp with time zone default now();

update public.simulation_assignment_progress
set status = 'assigned'
where status is null or trim(status) = '';

do $$
begin
  begin
    alter table public.simulation_assignment_progress alter column status set default 'assigned';
  exception when others then
    null;
  end;
  begin
    alter table public.simulation_assignment_progress alter column assignment_id set not null;
  exception when others then
    null;
  end;
  begin
    alter table public.simulation_assignment_progress alter column student_id set not null;
  exception when others then
    null;
  end;
end $$;

create unique index if not exists simulation_assignment_progress_assignment_student_uidx
  on public.simulation_assignment_progress (assignment_id, student_id);

create index if not exists simulation_assignment_progress_assignment_idx
  on public.simulation_assignment_progress (assignment_id, status, updated_at desc);

create index if not exists simulation_assignment_progress_student_idx
  on public.simulation_assignment_progress (student_id, assignment_id);

alter table public.simulation_assignments enable row level security;
alter table public.simulation_assignment_progress enable row level security;

drop policy if exists "Teachers manage own simulation assignments" on public.simulation_assignments;
drop policy if exists "Admins manage simulation assignments" on public.simulation_assignments;
drop policy if exists "Teachers manage simulation assignment progress" on public.simulation_assignment_progress;
drop policy if exists "Students read own simulation assignment progress" on public.simulation_assignment_progress;
drop policy if exists "Students update own simulation assignment progress" on public.simulation_assignment_progress;
drop policy if exists "Admins manage simulation assignment progress" on public.simulation_assignment_progress;

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

create policy "Teachers manage simulation assignment progress"
  on public.simulation_assignment_progress
  for all
  using (
    public.is_teacher()
    and exists (
      select 1
      from public.simulation_assignments a
      where a.id = assignment_id and a.teacher_id = auth.uid()
    )
  )
  with check (
    public.is_teacher()
    and exists (
      select 1
      from public.simulation_assignments a
      where a.id = assignment_id and a.teacher_id = auth.uid()
    )
  );

create policy "Students read own simulation assignment progress"
  on public.simulation_assignment_progress
  for select
  using (auth.uid() = student_id);

create policy "Students update own simulation assignment progress"
  on public.simulation_assignment_progress
  for update
  using (auth.uid() = student_id)
  with check (auth.uid() = student_id);

create policy "Admins manage simulation assignment progress"
  on public.simulation_assignment_progress
  for all
  using (public.is_admin())
  with check (public.is_admin());
