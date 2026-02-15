-- Run this SQL in your Supabase project to store client state centrally.
-- Table keeps simple key/value blobs per user and deduplicates on (user_id, key).

create table if not exists public.client_state (
  user_id uuid references auth.users not null,
  key text not null,
  value jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

create index if not exists client_state_user_idx on public.client_state (user_id);
