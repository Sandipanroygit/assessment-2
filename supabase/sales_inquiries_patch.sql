-- Sales inquiries table and policies
create table if not exists public.sales_inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  school text,
  message text not null,
  status text check (status in ('new', 'reviewed', 'closed')) default 'new',
  source_page text default 'home',
  created_at timestamptz default now()
);

alter table public.sales_inquiries enable row level security;

drop policy if exists "Public insert sales inquiries" on public.sales_inquiries;
drop policy if exists "Admins read sales inquiries" on public.sales_inquiries;
drop policy if exists "Admins update sales inquiries" on public.sales_inquiries;

create policy "Public insert sales inquiries"
  on public.sales_inquiries for insert with check (true);

create policy "Admins read sales inquiries"
  on public.sales_inquiries for select using (public.is_admin());

create policy "Admins update sales inquiries"
  on public.sales_inquiries for update using (public.is_admin())
  with check (public.is_admin());

notify pgrst, 'reload schema';
