-- ============================================================
-- Witness Archive — migration 025: words of the originals
-- Run after 024. Every Hebrew and Greek word with its Strong's number and
-- parsing (OpenScriptures morphhb, MorphGNT), and the Strong's lexicon for
-- the glosses, so a reader can tap a word in the Bible reader and see its
-- root, meaning and where else it appears. Loaded by
-- scripts/seed-bible-words.mjs; readers only select.
-- ============================================================

create table if not exists public.bible_lexicon (
  id            text primary key,            -- 'H1254', 'G26'
  lemma         text not null,
  translit      text not null default '',
  pronunciation text not null default '',
  definition    text not null default '',
  kjv_def       text not null default '',
  derivation    text not null default '',
  occurrences   integer not null default 0
);

create table if not exists public.bible_words (
  translation text     not null references public.bible_translations(code) on delete cascade,
  book        smallint not null check (book between 0 and 65),
  chapter     smallint not null check (chapter >= 1),
  verse       smallint not null check (verse >= 1),
  position    smallint not null check (position >= 0),
  text        text     not null,
  strongs     text,                           -- null for a few forms the sources leave untagged
  morph       text     not null default '',
  lemma       text,                           -- Greek dictionary form (Hebrew uses the lexicon's)
  primary key (translation, book, chapter, verse, position)
);
create index if not exists bible_words_strongs_idx on public.bible_words (strongs, book, chapter, verse) where strongs is not null;

alter table public.bible_lexicon enable row level security;
alter table public.bible_words enable row level security;

drop policy if exists "bible_lexicon_read" on public.bible_lexicon;
create policy "bible_lexicon_read" on public.bible_lexicon for select to anon, authenticated using (true);

drop policy if exists "bible_words_read" on public.bible_words;
create policy "bible_words_read" on public.bible_words for select to anon, authenticated using (true);
