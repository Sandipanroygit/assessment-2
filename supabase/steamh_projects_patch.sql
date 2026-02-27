-- Open-access STEAM-H student showcase
create extension if not exists "pgcrypto";

create table if not exists public.steamh_projects (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.profiles (id) on delete set null,
  student_name text not null,
  school_name text,
  grade text,
  subject text,
  title text not null,
  summary text not null,
  description text not null,
  challenge text,
  solution text,
  tools_used text[] default '{}'::text[],
  tags text[] default '{}'::text[],
  image_urls jsonb default '[]',
  video_urls jsonb default '[]',
  attachment_urls jsonb default '[]',
  external_links jsonb default '[]',
  published boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.steamh_projects add column if not exists student_id uuid references public.profiles (id) on delete set null;
alter table public.steamh_projects add column if not exists student_name text;
alter table public.steamh_projects add column if not exists school_name text;
alter table public.steamh_projects add column if not exists grade text;
alter table public.steamh_projects add column if not exists subject text;
alter table public.steamh_projects add column if not exists title text;
alter table public.steamh_projects add column if not exists summary text;
alter table public.steamh_projects add column if not exists description text;
alter table public.steamh_projects add column if not exists challenge text;
alter table public.steamh_projects add column if not exists solution text;
alter table public.steamh_projects add column if not exists tools_used text[] default '{}'::text[];
alter table public.steamh_projects add column if not exists tags text[] default '{}'::text[];
alter table public.steamh_projects add column if not exists image_urls jsonb default '[]';
alter table public.steamh_projects add column if not exists video_urls jsonb default '[]';
alter table public.steamh_projects add column if not exists attachment_urls jsonb default '[]';
alter table public.steamh_projects add column if not exists external_links jsonb default '[]';
alter table public.steamh_projects add column if not exists published boolean default true;
alter table public.steamh_projects add column if not exists created_at timestamptz default now();
alter table public.steamh_projects add column if not exists updated_at timestamptz default now();

update public.steamh_projects
set student_name = coalesce(student_name, 'Student'),
    title = coalesce(title, 'Untitled project'),
    summary = coalesce(summary, 'No summary provided.'),
    description = coalesce(description, 'No description provided.');

alter table public.steamh_projects
  alter column student_name set not null,
  alter column title set not null,
  alter column summary set not null,
  alter column description set not null;

create index if not exists steamh_projects_published_created_idx
  on public.steamh_projects (published, created_at desc);

create index if not exists steamh_projects_student_created_idx
  on public.steamh_projects (student_id, created_at desc);

alter table public.steamh_projects enable row level security;

drop policy if exists "Public read published STEAM-H projects" on public.steamh_projects;
drop policy if exists "Students read own STEAM-H projects" on public.steamh_projects;
drop policy if exists "Students insert own STEAM-H projects" on public.steamh_projects;
drop policy if exists "Students update own STEAM-H projects" on public.steamh_projects;
drop policy if exists "Students delete own STEAM-H projects" on public.steamh_projects;
drop policy if exists "Admins manage STEAM-H projects" on public.steamh_projects;

create policy "Public read published STEAM-H projects"
  on public.steamh_projects for select using (published is true);

create policy "Students read own STEAM-H projects"
  on public.steamh_projects for select using (
    auth.uid() = student_id
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid() and p.role in ('student', 'customer')
    )
  );

create policy "Students insert own STEAM-H projects"
  on public.steamh_projects for insert with check (
    auth.uid() = student_id
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid() and p.role in ('student', 'customer')
    )
  );

create policy "Students update own STEAM-H projects"
  on public.steamh_projects for update
  using (
    auth.uid() = student_id
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid() and p.role in ('student', 'customer')
    )
  )
  with check (
    auth.uid() = student_id
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid() and p.role in ('student', 'customer')
    )
  );

create policy "Students delete own STEAM-H projects"
  on public.steamh_projects for delete using (
    auth.uid() = student_id
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid() and p.role in ('student', 'customer')
    )
  );

create policy "Admins manage STEAM-H projects"
  on public.steamh_projects for all
  using (public.is_admin())
  with check (public.is_admin());

notify pgrst, 'reload schema';
