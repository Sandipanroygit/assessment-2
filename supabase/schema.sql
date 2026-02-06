-- Extensions required by this schema
create extension if not exists "pgcrypto";

-- Core tables
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  role text check (role in ('admin', 'teacher', 'student', 'customer')) default 'student',
  grade text,
  created_at timestamp with time zone default now()
);

-- Bring existing tables in line with the newer profile shape
alter table public.profiles add column if not exists grade text;
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('admin', 'teacher', 'student', 'customer'));
alter table public.profiles alter column role set default 'student';

create table if not exists public.curriculum_modules (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  grade text not null,
  subject text not null,
  module text not null,
  description text,
  asset_urls jsonb default '[]',
  price_yearly numeric,
  published boolean default true,
  created_at timestamp with time zone default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  image_url text,
  gallery_urls jsonb default '[]',
  price numeric not null,
  stock integer default 0,
  delivery_eta text,
  featured boolean default false,
  created_at timestamp with time zone default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  status text check (status in ('pending', 'processing', 'shipped', 'delivered')) default 'pending',
  total numeric default 0,
  created_at timestamp with time zone default now()
);

create table if not exists public.order_items (
  id bigint generated always as identity primary key,
  order_id uuid references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  qty integer not null default 1,
  price numeric not null
);

create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles (id),
  event_type text not null,
  payload jsonb,
  created_at timestamp with time zone default now()
);

create table if not exists public.page_views (
  id bigint generated always as identity primary key,
  page text not null,
  created_at timestamp with time zone default now()
);

create table if not exists public.activity_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  module_id uuid references public.curriculum_modules (id) on delete set null,
  submission_number integer not null default 1,
  log_url text,
  log_name text,
  plot_url text,
  plot_name text,
  plot_type text,
  report_json jsonb,
  report_html text,
  report_status text default 'pending',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index if not exists activity_submissions_user_module_idx
  on public.activity_submissions (user_id, module_id, submission_number desc);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  module_id uuid references public.curriculum_modules (id) on delete set null,
  subject text,
  title text not null,
  message text not null,
  status text check (status in ('unread', 'read')) default 'unread',
  inserted_by uuid references public.profiles (id) on delete set null,
  created_at timestamp with time zone default now()
);

-- RLS
alter table public.profiles enable row level security;
alter table public.curriculum_modules enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.analytics_events enable row level security;
alter table public.page_views enable row level security;
alter table public.activity_submissions enable row level security;
alter table public.notifications enable row level security;

-- Helper: admin check (used by multiple policies)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- Helper: teacher check (used to allow limited curriculum edits)
create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'teacher'
  );
$$;

-- Profiles: users can read/update their own profile
drop policy if exists "Profiles are self-readable" on public.profiles;
drop policy if exists "Profiles are self-updatable" on public.profiles;
drop policy if exists "Profiles are self-insertable" on public.profiles;
drop policy if exists "Admins manage profiles" on public.profiles;
create policy "Profiles are self-readable" on public.profiles
  for select using (auth.uid() = id);
create policy "Profiles are self-updatable" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id and role in ('teacher', 'student', 'customer'));
create policy "Profiles are self-insertable" on public.profiles
  for insert with check (auth.uid() = id and role in ('teacher', 'student', 'customer'));
create policy "Admins manage profiles" on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- Curriculum: everyone can read published; only admins can write
drop policy if exists "Published curriculum readable" on public.curriculum_modules;
drop policy if exists "Admins manage curriculum" on public.curriculum_modules;
drop policy if exists "Teachers read curriculum" on public.curriculum_modules;
drop policy if exists "Teachers update curriculum grade" on public.curriculum_modules;
create policy "Published curriculum readable" on public.curriculum_modules
  for select using (published is true);
create policy "Teachers read curriculum" on public.curriculum_modules
  for select using (public.is_teacher());
create policy "Admins manage curriculum" on public.curriculum_modules
  for all using (public.is_admin()) with check (public.is_admin());
create policy "Teachers update curriculum grade" on public.curriculum_modules
  for update using (public.is_teacher())
  with check (
    public.is_teacher()
    and exists (
      select 1
      from public.curriculum_modules as old
      where old.id = curriculum_modules.id
        and old.title is not distinct from curriculum_modules.title
        and old.subject is not distinct from curriculum_modules.subject
        and old.module is not distinct from curriculum_modules.module
        and old.description is not distinct from curriculum_modules.description
        and old.asset_urls is not distinct from curriculum_modules.asset_urls
        and old.price_yearly is not distinct from curriculum_modules.price_yearly
        and old.published is not distinct from curriculum_modules.published
    )
  );

-- Products: everyone can read; only admins can write
drop policy if exists "Products readable" on public.products;
drop policy if exists "Admins manage products" on public.products;
create policy "Products readable" on public.products
  for select using (true);
create policy "Admins manage products" on public.products
  for all using (public.is_admin()) with check (public.is_admin());

-- Orders: users see their own; admins see all
drop policy if exists "Users read own orders" on public.orders;
drop policy if exists "Admins read orders" on public.orders;
drop policy if exists "Customers insert orders" on public.orders;
create policy "Users read own orders" on public.orders
  for select using (auth.uid() = user_id);
create policy "Admins read orders" on public.orders
  for select using (public.is_admin());
create policy "Customers insert orders" on public.orders
  for insert with check (auth.role() = 'authenticated');

-- Order items follow parent orders
drop policy if exists "Order items readable via orders" on public.order_items;
create policy "Order items readable via orders" on public.order_items
  for select using (
    exists (
      select 1
      from public.orders o
      where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())
    )
  );

-- Analytics: admins only
drop policy if exists "Admins manage analytics" on public.analytics_events;
create policy "Admins manage analytics" on public.analytics_events
  for all using (public.is_admin()) with check (public.is_admin());

-- Page views: public read/insert for footfall
drop policy if exists "Public read page views" on public.page_views;
drop policy if exists "Public insert page views" on public.page_views;
create policy "Public read page views" on public.page_views
  for select using (true);
create policy "Public insert page views" on public.page_views
  for insert with check (true);

-- Activity submissions: students manage their own; admins can read all
drop policy if exists "Students read own submissions" on public.activity_submissions;
drop policy if exists "Students insert own submissions" on public.activity_submissions;
drop policy if exists "Students update own submissions" on public.activity_submissions;
drop policy if exists "Admins read submissions" on public.activity_submissions;
drop policy if exists "Students delete own submissions" on public.activity_submissions;
drop policy if exists "Admins delete submissions" on public.activity_submissions;
create policy "Students read own submissions" on public.activity_submissions
  for select using (auth.uid() = user_id);
create policy "Students insert own submissions" on public.activity_submissions
  for insert with check (auth.uid() = user_id);
create policy "Students update own submissions" on public.activity_submissions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Admins read submissions" on public.activity_submissions
  for select using (public.is_admin());
create policy "Students delete own submissions" on public.activity_submissions
  for delete using (auth.uid() = user_id);
create policy "Admins delete submissions" on public.activity_submissions
  for delete using (public.is_admin());

drop policy if exists "Users read own notifications" on public.notifications;
drop policy if exists "Users update own notifications" on public.notifications;
drop policy if exists "Teachers insert notifications" on public.notifications;
drop policy if exists "Admins manage notifications" on public.notifications;
create policy "Users read own notifications" on public.notifications
  for select using (auth.uid() = user_id);
create policy "Users update own notifications" on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Teachers insert notifications" on public.notifications
  for insert with check (public.is_teacher());
create policy "Admins manage notifications" on public.notifications
  for all using (public.is_admin()) with check (public.is_admin());

-- Hint PostgREST to refresh its schema cache
notify pgrst, 'reload schema';
