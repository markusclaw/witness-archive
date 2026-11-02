-- ============================================================
-- Witness Archive — migration 031: questions
-- Run after 030. Each testimony can speak to up to three of the archive's
-- questions ("What happens when we die?", "Is hell real?", …). The list of
-- questions lives in lib/questions.ts; here we only store the slugs.
--   testimonies.questions: null = not tagged yet, '{}' = tagged, none apply
--   question_summaries: the "What witnesses report" text per question,
--   written by the assistant from the tagged testimonies and refreshed on demand.
-- ============================================================

alter table public.testimonies add column if not exists questions text[];
create index if not exists testimonies_questions_idx on public.testimonies using gin (questions);

create table if not exists public.question_summaries (
  slug            text primary key,
  patterns        jsonb not null default '[]'::jsonb,   -- [{ "text": "...", "testimony_ids": ["uuid", …] }]
  testimony_count integer not null default 0,
  source_ids      uuid[] not null default '{}',
  model           text,
  generated_at    timestamptz not null default now()
);
alter table public.question_summaries enable row level security;
drop policy if exists "question_summaries_public_read" on public.question_summaries;
create policy "question_summaries_public_read" on public.question_summaries for select to anon, authenticated using (true);
