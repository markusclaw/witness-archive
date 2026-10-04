-- ============================================================
-- Witness Archive — migration 020: listening progress
-- Run after 019. Where a signed-in member left off in a narration, per
-- testimony and language, so it resumes on any device. Anonymous visitors
-- get the same from their browser's storage.
-- ============================================================

create table if not exists public.listening_progress (
  user_id      uuid not null references auth.users(id) on delete cascade,
  testimony_id uuid not null references public.testimonies(id) on delete cascade,
  language     text not null,
  position_s   integer not null default 0,
  duration_s   integer,
  completed    boolean not null default false,
  updated_at   timestamptz not null default now(),
  primary key (user_id, testimony_id, language)
);

alter table public.listening_progress enable row level security;

drop policy if exists "listening_progress_own" on public.listening_progress;
create policy "listening_progress_own"
  on public.listening_progress for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
