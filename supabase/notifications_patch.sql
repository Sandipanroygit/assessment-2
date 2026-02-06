-- Notifications table and policies
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  module_id uuid references public.curriculum_modules (id) on delete set null,
  subject text,
  title text not null,
  message text not null,
  status text check (status in ('unread','read')) default 'unread',
  inserted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz default now()
);

alter table public.notifications enable row level security;

drop policy if exists "Users read own notifications" on public.notifications;
drop policy if exists "Users update own notifications" on public.notifications;
drop policy if exists "Teachers insert notifications" on public.notifications;
drop policy if exists "Admins manage notifications" on public.notifications;

create policy "Users read own notifications"
  on public.notifications for select using (auth.uid() = user_id);

create policy "Users update own notifications"
  on public.notifications for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Teachers insert notifications"
  on public.notifications for insert with check (public.is_teacher());

create policy "Admins manage notifications"
  on public.notifications for all using (public.is_admin())
  with check (public.is_admin());

notify pgrst, 'reload schema';
