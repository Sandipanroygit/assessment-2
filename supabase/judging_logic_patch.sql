-- Adds per-activity AI judging logic storage and keeps teacher update scope limited to grade only.
alter table public.curriculum_modules
  add column if not exists judging_logic text;

drop policy if exists "Teachers update curriculum grade" on public.curriculum_modules;
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
        and old.judging_logic is not distinct from curriculum_modules.judging_logic
        and old.asset_urls is not distinct from curriculum_modules.asset_urls
        and old.price_yearly is not distinct from curriculum_modules.price_yearly
        and old.published is not distinct from curriculum_modules.published
    )
  );
