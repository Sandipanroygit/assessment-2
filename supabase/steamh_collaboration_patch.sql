create table if not exists public.steamh_collaboration_requests (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  project_title text not null,
  requester_id uuid references public.profiles (id) on delete set null,
  requester_name text not null,
  requester_email text,
  requester_role text,
  requester_grade text,
  publisher_profile_id uuid references public.profiles (id) on delete set null,
  publisher_name text not null,
  publisher_grade text not null,
  message text not null,
  status text check (status in ('new', 'read', 'closed')) default 'new',
  created_at timestamp with time zone default now()
);

create index if not exists steamh_collab_requester_created_idx
  on public.steamh_collaboration_requests (requester_id, created_at desc);

create index if not exists steamh_collab_publisher_created_idx
  on public.steamh_collaboration_requests (publisher_profile_id, created_at desc);

alter table public.steamh_collaboration_requests enable row level security;

drop policy if exists "Requesters read own collaboration requests" on public.steamh_collaboration_requests;
drop policy if exists "Requesters insert collaboration requests" on public.steamh_collaboration_requests;
drop policy if exists "Publishers read collaboration requests" on public.steamh_collaboration_requests;
drop policy if exists "Publishers update collaboration requests" on public.steamh_collaboration_requests;
drop policy if exists "Admins manage collaboration requests" on public.steamh_collaboration_requests;

create policy "Requesters read own collaboration requests"
  on public.steamh_collaboration_requests
  for select using (auth.uid() = requester_id);

create policy "Requesters insert collaboration requests"
  on public.steamh_collaboration_requests
  for insert with check (auth.uid() = requester_id);

create policy "Publishers read collaboration requests"
  on public.steamh_collaboration_requests
  for select using (auth.uid() = publisher_profile_id);

create policy "Publishers update collaboration requests"
  on public.steamh_collaboration_requests
  for update
  using (auth.uid() = publisher_profile_id)
  with check (auth.uid() = publisher_profile_id);

create policy "Admins manage collaboration requests"
  on public.steamh_collaboration_requests
  for all using (public.is_admin())
  with check (public.is_admin());

