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

-- ---------- 4. (Seed data removed — the archive is populated by members.) ----------

-- ---------- 5. Quick sanity check ----------
-- select id, title, category, created_at from public.testimonies order by created_at desc;
