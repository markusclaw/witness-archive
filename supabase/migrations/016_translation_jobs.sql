-- ============================================================
-- Witness Archive — migration 016: background translation jobs
-- Run after 015. Translations used to be generated inside the page request,
-- which timed out on long testimonies. They now run in the background: the
-- row is created as 'pending' with a progress counter, the browser polls,
-- and the row flips to 'ready' when every chunk has been translated.
-- ============================================================

alter table public.testimony_translations
  add column if not exists status         text not null default 'ready' check (status in ('pending', 'ready', 'failed')),
  add column if not exists progress_done  integer not null default 0,
  add column if not exists progress_total integer not null default 0,
  add column if not exists started_at     timestamptz,
  add column if not exists error          text;

-- Everything that existed before this migration is a finished translation.
update public.testimony_translations set status = 'ready' where status is distinct from 'ready' and content is not null;

create index if not exists testimony_translations_status_idx on public.testimony_translations (status);
