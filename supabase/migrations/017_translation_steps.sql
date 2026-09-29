-- ============================================================
-- Witness Archive — migration 017: resumable translation steps
-- Run after 016. Cloudflare Workers can't keep working in the background
-- for more than ~30s after replying, so a translation is now produced one
-- chunk per request: the translated parts accumulate in `parts`, and a short
-- lock stops two visitors from translating the same chunk at once.
-- ============================================================

alter table public.testimony_translations
  add column if not exists parts      jsonb not null default '[]'::jsonb,
  add column if not exists lock_until timestamptz;

-- Anything left half-done by the old background jobs starts over cleanly.
update public.testimony_translations
   set status = 'failed', error = 'restarted after migration 017', lock_until = null
 where status = 'pending';
