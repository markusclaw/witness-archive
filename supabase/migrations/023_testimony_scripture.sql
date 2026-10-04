-- ============================================================
-- Witness Archive — migration 023: scripture index
-- Run after 022. Which passages each published testimony mentions, so a
-- chapter in /bible can list the testimonies that lean on it. Rows are
-- written by the server (service role) when a testimony is viewed after
-- its text changed; readers only select.
-- ============================================================

create table if not exists public.testimony_scripture (
  testimony_id uuid     not null references public.testimonies(id) on delete cascade,
  ref_key      text     not null,              -- "42.3.16-18", as lib/scripture.ts referenceKey() writes it
  book         smallint not null check (book between 0 and 65),
  chapter      smallint not null check (chapter >= 1),
  verse_start  smallint,                       -- null = whole chapter
  verse_end    smallint,
  position     smallint not null default 0,   -- order of first mention in the text
  source_hash  text     not null,              -- hash of the text the row was built from
  created_at   timestamptz not null default now(),
  primary key (testimony_id, ref_key)
);
create index if not exists testimony_scripture_passage_idx on public.testimony_scripture (book, chapter);

alter table public.testimony_scripture enable row level security;

drop policy if exists "testimony_scripture_read" on public.testimony_scripture;
create policy "testimony_scripture_read"
  on public.testimony_scripture for select
  to anon, authenticated
  using (exists (select 1 from public.testimonies t where t.id = testimony_id and t.status = 'published'));
