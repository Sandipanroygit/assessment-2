-- Activity logger schema
create extension if not exists "pgcrypto";

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  session_id uuid not null,
  anonymous_id uuid not null,
  event_name text not null,
  category text not null default 'custom',
  page_path text,
  page_title text,
  referrer text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

-- RLS: only service role can read/write
alter table public.activity_events enable row level security;
create policy if not exists "service-role-only" on public.activity_events
  for all using (auth.role() = 'service_role') with check (true);

-- Indexes for common filters
create index if not exists activity_events_created_at_idx on public.activity_events (created_at desc);
create index if not exists activity_events_user_id_idx on public.activity_events (user_id);
create index if not exists activity_events_event_idx on public.activity_events (event_name);
create index if not exists activity_events_page_path_idx on public.activity_events (page_path);

-- Daily rollup view
create or replace view public.activity_daily_metrics as
select
  date_trunc('day', created_at) as day,
  count(*) as events,
  count(distinct user_id) as users,
  count(distinct session_id) as sessions,
  count(*) filter (where event_name = 'page_view') as page_views
from public.activity_events
group by 1;
