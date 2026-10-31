-- ============================================================
-- Witness Archive — migration 029: API tokens + YouTube import queue
-- Run after 028. Lets an outside agent (e.g. Muse) import testimonies from
-- YouTube with a personal API token instead of a browser session.
--   • api_tokens: hashed bearer tokens that act as one member
--   • import_jobs: one row per YouTube video (dedup by video id), with the
--     result of each attempt and anything flagged for human review
-- Both tables are server-only (RLS on, no policies): the API routes use the
-- service role after checking the token.
-- ============================================================

-- ---------- 1. API tokens ----------
create table if not exists public.api_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null default 'api',
  token_hash   text not null unique,          -- sha256 hex of the full token; the token itself is never stored
  prefix       text not null,                 -- first characters, to recognise a token in lists
  scopes       text[] not null default array['imports'],
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);
create index if not exists api_tokens_user_idx on public.api_tokens (user_id);
alter table public.api_tokens enable row level security;

-- ---------- 2. Import jobs ----------
create table if not exists public.import_jobs (
  id                   uuid primary key default gen_random_uuid(),
  youtube_id           text not null,
  url                  text not null,
  -- queued → processing → published | duplicate | skipped | failed | blocked
  --   skipped   = YouTube (or the transcript service) confirmed the video has no transcript
  --   blocked   = the fetch was refused; retried automatically, or send a transcript
  --   duplicate = the video was already in the archive
  status               text not null default 'queued'
                       check (status in ('queued', 'processing', 'published', 'duplicate', 'skipped', 'failed', 'blocked')),
  reason               text,                  -- human-readable explanation of the last outcome
  reason_code          text,                  -- machine code: no_transcript, blocked, unavailable, ai_error, …
  testimony_id         uuid references public.testimonies(id) on delete set null,
  supplied_transcript  text,                  -- transcript sent with the request (used instead of fetching)
  transcript_source    text check (transcript_source in ('supplied', 'youtube', 'paid')),
  language             text,                  -- optional hint from the caller
  flags                text[] not null default '{}',   -- things for Greg to review
  flag_notes           jsonb not null default '{}'::jsonb,
  reviewed_at          timestamptz,
  attempts             integer not null default 0,
  next_attempt_at      timestamptz not null default now(),
  batch_id             uuid,
  requested_by         uuid references auth.users(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  started_at           timestamptz,
  finished_at          timestamptz
);
create unique index if not exists import_jobs_youtube_id_key on public.import_jobs (youtube_id);
create index if not exists import_jobs_status_idx on public.import_jobs (status, next_attempt_at);
create index if not exists import_jobs_batch_idx on public.import_jobs (batch_id) where batch_id is not null;
create index if not exists import_jobs_review_idx on public.import_jobs (created_at desc) where cardinality(flags) > 0 and reviewed_at is null;
alter table public.import_jobs enable row level security;

-- Claim the next job atomically, so two runners never process the same video.
-- Picks queued jobs, blocked jobs whose retry time has come (up to 6 attempts),
-- and jobs stuck in processing for 15 minutes (a runner that died).
create or replace function public.claim_import_job()
returns setof public.import_jobs
language sql
as $$
  update public.import_jobs j
     set status = 'processing', attempts = j.attempts + 1, started_at = now(), updated_at = now()
   where j.id = (
     select id from public.import_jobs
      where (status = 'queued' and next_attempt_at <= now())
         or (status = 'blocked' and attempts < 6 and next_attempt_at <= now())
         or (status = 'processing' and started_at < now() - interval '15 minutes')
      order by (status = 'queued') desc, created_at
      limit 1
      for update skip locked
   )
  returning j.*;
$$;
revoke all on function public.claim_import_job() from public, anon, authenticated;
grant execute on function public.claim_import_job() to service_role;

-- The import runner checks for near-duplicates (same text / same witness) as the service role.
grant execute on function public.find_possible_duplicates(text, text, text, text, uuid, integer) to service_role;
