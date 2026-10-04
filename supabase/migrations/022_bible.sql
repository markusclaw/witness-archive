-- ============================================================
-- Witness Archive — migration 022: scripture
-- Run after 021. Public-domain Bible texts, one row per verse, so that
-- references in testimonies, prayers and replies can show the verse in the
-- reader's language. Rows are loaded by scripts/seed-bible.mjs (service
-- role); readers only ever select.
-- ============================================================

create table if not exists public.bible_translations (
  code        text primary key,                               -- 'web', 'kjv', 'rv1909', 'aa'
  language    text not null check (language ~ '^[a-z]{2}$'),
  name        text not null,
  license     text not null,
  verse_count integer not null default 0,
  seeded_at   timestamptz
);

create table if not exists public.bible_verses (
  translation text     not null references public.bible_translations(code) on delete cascade,
  book        smallint not null check (book between 0 and 65),   -- canonical order, Genesis = 0
  chapter     smallint not null check (chapter >= 1),
  verse       smallint not null check (verse >= 1),
  text        text     not null,
  primary key (translation, book, chapter, verse)
);

alter table public.bible_translations enable row level security;
alter table public.bible_verses enable row level security;

drop policy if exists "bible_translations_read" on public.bible_translations;
create policy "bible_translations_read" on public.bible_translations for select to anon, authenticated using (true);

drop policy if exists "bible_verses_read" on public.bible_verses;
create policy "bible_verses_read" on public.bible_verses for select to anon, authenticated using (true);

insert into public.bible_translations (code, language, name, license) values
  ('web',    'en', 'World English Bible', 'Public domain'),
  ('kjv',    'en', 'King James Version', 'Public domain'),
  ('rv1909', 'es', 'Reina-Valera 1909', 'Public domain'),
  ('aa',     'pt', 'Almeida Atualizada', 'Public domain')
on conflict (code) do nothing;
