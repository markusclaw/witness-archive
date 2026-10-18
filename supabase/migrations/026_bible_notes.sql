-- ============================================================
-- Witness Archive — migration 026: verse notes
-- Run after 025. A reader's own notes on a verse or passage in the Bible
-- reader. Private: only the author can read or change them. Visitors who
-- aren't signed in keep notes in the browser; the first time they sign in,
-- those are moved here.
-- ============================================================

create table if not exists public.bible_notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid     not null references auth.users(id) on delete cascade,
  book        smallint not null check (book between 0 and 65),
  chapter     smallint not null check (chapter >= 1),
  verse_start smallint not null check (verse_start >= 1),
  verse_end   smallint not null check (verse_end >= verse_start),
  body        text     not null check (char_length(btrim(body)) between 1 and 10000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists bible_notes_chapter_idx on public.bible_notes (user_id, book, chapter);
create index if not exists bible_notes_recent_idx on public.bible_notes (user_id, updated_at desc);

alter table public.bible_notes enable row level security;

drop policy if exists "bible_notes_own" on public.bible_notes;
create policy "bible_notes_own"
  on public.bible_notes for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists bible_notes_touch on public.bible_notes;
create trigger bible_notes_touch before update on public.bible_notes
  for each row execute function public.touch_updated_at();
