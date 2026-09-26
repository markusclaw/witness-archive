-- ============================================================
-- Witness Archive — Supabase setup
-- Paste the whole file into Supabase → SQL Editor → Run.
-- Safe to re-run (uses IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS).
-- Column names match exactly what the Next.js code queries:
--   testimonies: id, title, description, video_url, creator, category, content, created_at
--   comments:    id, testimony_id, user_id, author, content, created_at
-- ============================================================

-- ---------- 1. Tables ----------

create extension if not exists "pgcrypto";

create table if not exists public.testimonies (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text not null default '',
  video_url   text,                         -- full YouTube URL (watch?v= or youtu.be/)
  creator     text not null default 'Unknown',
  category    text not null default 'Other',
  content     text,                         -- long-form write-up / transcript
  created_at  timestamptz not null default now()
);

create table if not exists public.comments (
  id           uuid primary key default gen_random_uuid(),
  testimony_id uuid not null references public.testimonies(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  author       text not null,               -- the app stores user.email here
  content      text not null check (char_length(btrim(content)) between 1 and 5000),
  created_at   timestamptz not null default now()
);

-- Indexes for the two hot queries (archive list + comments per testimony)
create index if not exists testimonies_created_at_idx on public.testimonies (created_at desc);
create index if not exists testimonies_category_idx   on public.testimonies (category);
create index if not exists comments_testimony_id_idx  on public.comments (testimony_id, created_at);

-- ---------- 2. Row Level Security ----------

alter table public.testimonies enable row level security;
alter table public.comments    enable row level security;

-- Testimonies: anyone can read; nobody writes via the anon key.
-- (You add/edit testimonies from the Supabase dashboard or a service-role
--  script. When you build the submissions/moderation feature later, add an
--  insert policy then.)
drop policy if exists "testimonies_public_read" on public.testimonies;
create policy "testimonies_public_read"
  on public.testimonies for select
  to anon, authenticated
  using (true);

-- Comments: anyone can read; signed-in users can post as themselves;
-- users can edit/delete only their own.
drop policy if exists "comments_public_read" on public.comments;
create policy "comments_public_read"
  on public.comments for select
  to anon, authenticated
  using (true);

drop policy if exists "comments_insert_own" on public.comments;
create policy "comments_insert_own"
  on public.comments for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "comments_update_own" on public.comments;
create policy "comments_update_own"
  on public.comments for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "comments_delete_own" on public.comments;
create policy "comments_delete_own"
  on public.comments for delete
  to authenticated
  using (auth.uid() = user_id);

-- ---------- 3. Realtime (optional, for live comment updates later) ----------
-- Uncomment if you want to subscribe to comment inserts from the client.
-- alter publication supabase_realtime add table public.comments;

-- ---------- 4. Seed data ----------
-- PLACEHOLDER rows so the archive grid and detail pages render immediately.
-- Replace the video_url values with the real YouTube links you want to feature;
-- the thumbnail on the archive grid is pulled from the video ID automatically.
-- Delete this block (or the rows) once you've added real testimonies.

insert into public.testimonies (title, description, video_url, creator, category, content) values
(
  'Twenty Minutes in Heaven',
  'A near-death experience during cardiac arrest, and the encounter that followed.',
  'https://www.youtube.com/watch?v=REPLACE_ME_1',
  'Witness Archive',
  'Heaven',
  'Full write-up goes here. This field supports multiple paragraphs — line breaks are preserved on the page.'
),
(
  'I Saw the Other Side',
  'A former skeptic describes what he saw during a coma and how it changed his life.',
  'https://www.youtube.com/watch?v=REPLACE_ME_2',
  'Witness Archive',
  'Hell',
  'Full write-up goes here.'
),
(
  'A Voice in the Hospital Room',
  'A nurse recounts a divine encounter at a patient''s bedside.',
  'https://www.youtube.com/watch?v=REPLACE_ME_3',
  'Witness Archive',
  'Divine Encounter',
  'Full write-up goes here.'
),
(
  'Healed on the Operating Table',
  'A surgeon''s account of an unexplained recovery mid-procedure.',
  'https://www.youtube.com/watch?v=REPLACE_ME_4',
  'Witness Archive',
  'Healing',
  'Full write-up goes here.'
),
(
  'The Dream That Came True',
  'A prophetic dream, and the events that unfolded exactly as shown.',
  'https://www.youtube.com/watch?v=REPLACE_ME_5',
  'Witness Archive',
  'Visions & Dreams',
  'Full write-up goes here.'
),
(
  'Angels on the Highway',
  'A family''s account of being pulled from a wreck by strangers who vanished.',
  'https://www.youtube.com/watch?v=REPLACE_ME_6',
  'Witness Archive',
  'Angelic Encounter',
  'Full write-up goes here.'
);

-- ---------- 5. Quick sanity check ----------
-- select id, title, category, created_at from public.testimonies order by created_at desc;
