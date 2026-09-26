-- ============================================================
-- Witness Archive — migration 005: languages and translations
-- Run after 004. Every testimony has an original language; translations
-- are generated on demand (by the server, once per language) and cached.
-- ============================================================

alter table public.testimonies
  add column if not exists language text not null default 'en' check (language ~ '^[a-z]{2}(-[A-Za-z]{2})?$');

create index if not exists testimonies_language_idx on public.testimonies (language);

create table if not exists public.testimony_translations (
  testimony_id uuid not null references public.testimonies(id) on delete cascade,
  language     text not null check (language ~ '^[a-z]{2}(-[A-Za-z]{2})?$'),
  title        text not null,
  description  text not null default '',
  content      text,
  source       text not null default 'machine' check (source in ('machine', 'author', 'reviewed')),
  model        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (testimony_id, language)
);

alter table public.testimony_translations enable row level security;

-- Translations of published testimonies are public; nobody writes them from
-- the browser. The server route inserts them with the service role key.
drop policy if exists "translations_public_read" on public.testimony_translations;
create policy "translations_public_read"
  on public.testimony_translations for select
  to anon, authenticated
  using (exists (select 1 from public.testimonies t where t.id = testimony_id and t.status = 'published'));

-- Authors may replace the machine translation of their own testimony with their own words.
drop policy if exists "translations_author_write" on public.testimony_translations;
create policy "translations_author_write"
  on public.testimony_translations for all
  to authenticated
  using (exists (select 1 from public.testimonies t where t.id = testimony_id and t.author_id = auth.uid()))
  with check (exists (select 1 from public.testimonies t where t.id = testimony_id and t.author_id = auth.uid()));
