-- ============================================================
-- Witness Archive — migration 024: verse highlights
-- Run after 023. A member's own highlighter marks in the Bible reader,
-- one row per verse. Visitors who aren't signed in keep theirs in the
-- browser; the first time they sign in, those are moved here.
-- ============================================================

create table if not exists public.bible_highlights (
  user_id    uuid     not null references auth.users(id) on delete cascade,
  book       smallint not null check (book between 0 and 65),
  chapter    smallint not null check (chapter >= 1),
  verse      smallint not null check (verse >= 1),
  color      text     not null check (color in ('yellow', 'green', 'blue', 'pink', 'violet')),
  created_at timestamptz not null default now(),
  primary key (user_id, book, chapter, verse)
);
create index if not exists bible_highlights_user_idx on public.bible_highlights (user_id, created_at desc);

alter table public.bible_highlights enable row level security;

drop policy if exists "bible_highlights_own" on public.bible_highlights;
create policy "bible_highlights_own"
  on public.bible_highlights for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
