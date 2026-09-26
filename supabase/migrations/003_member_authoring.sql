-- ============================================================
-- Witness Archive — migration 003: member authoring
-- Run after 001 (and 002 if you ran it; this retires that queue).
--
-- Members now write and publish testimonies themselves:
--   • author_id / is_anonymous / author_bio / experienced_on
--   • series support: parts share a series_id, ordered by part_number
--   • status: 'draft' (visible only to the author) or 'published'
--   • updated_at maintained by trigger
-- ============================================================

-- ---------- 1. Retire the review queue from 002 (never used in production) ----------
drop function if exists public.publish_submission(uuid);
drop table if exists public.submissions;

-- ---------- 2. New columns ----------
alter table public.testimonies
  add column if not exists author_id      uuid references auth.users(id) on delete set null,
  add column if not exists is_anonymous   boolean not null default false,
  add column if not exists author_bio     text,
  add column if not exists experienced_on date,
  add column if not exists series_id      uuid,
  add column if not exists part_number    integer not null default 1 check (part_number >= 1),
  add column if not exists status         text not null default 'published' check (status in ('draft', 'published')),
  add column if not exists updated_at     timestamptz not null default now();

-- Every testimony belongs to a series (its own id when it's standalone / Part 1).
update public.testimonies set series_id = id where series_id is null;
alter table public.testimonies alter column series_id set not null;
alter table public.testimonies alter column series_id set default gen_random_uuid();

create index if not exists testimonies_series_idx  on public.testimonies (series_id, part_number);
create index if not exists testimonies_author_idx  on public.testimonies (author_id, updated_at desc);
create index if not exists testimonies_status_idx  on public.testimonies (status, created_at desc);

-- Keep series_id = id for standalone rows inserted without one.
create or replace function public.testimonies_defaults()
returns trigger language plpgsql as $$
begin
  if new.series_id is null then new.series_id := new.id; end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists testimonies_defaults_trg on public.testimonies;
create trigger testimonies_defaults_trg
  before insert or update on public.testimonies
  for each row execute function public.testimonies_defaults();

-- ---------- 3. Row Level Security ----------
-- Public sees published rows only. Authors see and manage their own rows in any status.

drop policy if exists "testimonies_public_read" on public.testimonies;
create policy "testimonies_public_read"
  on public.testimonies for select
  to anon, authenticated
  using (status = 'published');

drop policy if exists "testimonies_author_read_own" on public.testimonies;
create policy "testimonies_author_read_own"
  on public.testimonies for select
  to authenticated
  using (auth.uid() = author_id);

drop policy if exists "testimonies_author_insert" on public.testimonies;
create policy "testimonies_author_insert"
  on public.testimonies for insert
  to authenticated
  with check (auth.uid() = author_id);

drop policy if exists "testimonies_author_update" on public.testimonies;
create policy "testimonies_author_update"
  on public.testimonies for update
  to authenticated
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

drop policy if exists "testimonies_author_delete" on public.testimonies;
create policy "testimonies_author_delete"
  on public.testimonies for delete
  to authenticated
  using (auth.uid() = author_id);

-- Comments on drafts would leak their existence; only allow commenting on published rows.
drop policy if exists "comments_insert_own" on public.comments;
create policy "comments_insert_own"
  on public.comments for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.testimonies t where t.id = testimony_id and t.status = 'published')
  );
