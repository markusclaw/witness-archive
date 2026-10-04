-- ============================================================
-- Witness Archive — migration 021: prayer wall translations
-- Run after 020. Requests and replies are short, so each is translated in
-- one call on first request per language and cached here. `source_hash`
-- lets an edited request (or a newly added answer) be re-translated.
-- ============================================================

create table if not exists public.prayer_translations (
  kind        text not null check (kind in ('request', 'reply')),
  target_id   uuid not null,
  language    text not null check (language ~ '^[a-z]{2}$'),
  source_hash text not null,
  text        jsonb not null,            -- request: {title, body, answer?}; reply: {content}
  created_at  timestamptz not null default now(),
  primary key (kind, target_id, language)
);

alter table public.prayer_translations enable row level security;

-- Readable by everyone; only the server writes (service role).
drop policy if exists "prayer_translations_read" on public.prayer_translations;
create policy "prayer_translations_read" on public.prayer_translations for select to anon, authenticated using (true);
