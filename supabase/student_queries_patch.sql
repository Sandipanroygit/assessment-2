-- Student-to-teacher doubt queries
create table if not exists public.student_queries (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.profiles (id) on delete cascade,
  teacher_id uuid references public.profiles (id) on delete cascade,
  student_name text not null,
  teacher_name text not null,
  subject text,
  grade text,
  query_text text not null,
  status text check (status in ('new', 'read')) default 'new',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index if not exists student_queries_teacher_created_idx
  on public.student_queries (teacher_id, created_at desc);

create index if not exists student_queries_student_created_idx
  on public.student_queries (student_id, created_at desc);

create table if not exists public.student_query_messages (
  id uuid primary key default gen_random_uuid(),
  query_id uuid not null references public.student_queries (id) on delete cascade,
  sender_id uuid not null,
  sender_role text check (sender_role in ('student', 'teacher')) not null,
  sender_name text not null,
  message_text text not null,
  created_at timestamp with time zone default now()
);

create index if not exists student_query_messages_query_created_idx
  on public.student_query_messages (query_id, created_at asc);

alter table public.student_queries enable row level security;
alter table public.student_query_messages enable row level security;

drop policy if exists "Students read own student queries" on public.student_queries;
drop policy if exists "Students insert own student queries" on public.student_queries;
drop policy if exists "Teachers read assigned student queries" on public.student_queries;
drop policy if exists "Teachers update assigned student queries" on public.student_queries;
drop policy if exists "Admins manage student queries" on public.student_queries;

create policy "Students read own student queries"
  on public.student_queries for select using (auth.uid() = student_id);

create policy "Students insert own student queries"
  on public.student_queries for insert with check (auth.uid() = student_id);

create policy "Teachers read assigned student queries"
  on public.student_queries for select using (auth.uid() = teacher_id and public.is_teacher());

create policy "Teachers update assigned student queries"
  on public.student_queries for update
  using (auth.uid() = teacher_id and public.is_teacher())
  with check (auth.uid() = teacher_id and public.is_teacher());

create policy "Admins manage student queries"
  on public.student_queries for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Students read own query messages" on public.student_query_messages;
drop policy if exists "Students insert own query messages" on public.student_query_messages;
drop policy if exists "Teachers read assigned query messages" on public.student_query_messages;
drop policy if exists "Teachers insert assigned query messages" on public.student_query_messages;
drop policy if exists "Admins manage query messages" on public.student_query_messages;

create policy "Students read own query messages"
  on public.student_query_messages for select using (
    exists (
      select 1
      from public.student_queries q
      where q.id = query_id and q.student_id = auth.uid()
    )
  );

create policy "Students insert own query messages"
  on public.student_query_messages for insert with check (
    sender_role = 'student'
    and sender_id = auth.uid()
    and exists (
      select 1
      from public.student_queries q
      where q.id = query_id and q.student_id = auth.uid()
    )
  );

create policy "Teachers read assigned query messages"
  on public.student_query_messages for select using (
    public.is_teacher()
    and exists (
      select 1
      from public.student_queries q
      where q.id = query_id and q.teacher_id = auth.uid()
    )
  );

create policy "Teachers insert assigned query messages"
  on public.student_query_messages for insert with check (
    public.is_teacher()
    and sender_role = 'teacher'
    and sender_id = auth.uid()
    and exists (
      select 1
      from public.student_queries q
      where q.id = query_id and q.teacher_id = auth.uid()
    )
  );

create policy "Admins manage query messages"
  on public.student_query_messages for all
  using (public.is_admin())
  with check (public.is_admin());

notify pgrst, 'reload schema';
