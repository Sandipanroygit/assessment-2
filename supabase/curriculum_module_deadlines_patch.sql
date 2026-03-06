-- Adds optional assignment deadline support for drone activities.
-- Run this in Supabase SQL Editor for existing deployments.

alter table public.curriculum_modules
  add column if not exists due_at timestamp with time zone;

update public.curriculum_modules
set due_at = coalesce(due_at, created_at + interval '7 day')
where published is true and due_at is null;

create index if not exists curriculum_modules_subject_due_idx
  on public.curriculum_modules (subject, due_at asc, created_at desc);
