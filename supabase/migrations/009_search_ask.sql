-- ============================================================
-- Witness Archive — migration 009: full-text search + cached answers
-- Run after 008.
-- ============================================================

-- ---------- Full-text search ----------
alter table public.testimonies
  add column if not exists search tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(creator, '') || ' ' || coalesce(category, '') || ' ' || coalesce(location_city, '') || ' ' || coalesce(location_region, '') || ' ' || coalesce(location_country, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(content, '')), 'D')
  ) stored;

create index if not exists testimonies_search_idx on public.testimonies using gin (search);

-- Ranked search with highlighted fragments. Only published rows.
create or replace function public.search_testimonies(q text, lim integer default 8)
returns table (id uuid, rank real, headline text)
language sql
stable
as $$
  select
    t.id,
    ts_rank_cd(t.search, websearch_to_tsquery('english', q)) as rank,
    ts_headline('english', coalesce(t.content, t.description), websearch_to_tsquery('english', q),
      'MaxFragments=3, MaxWords=45, MinWords=20, FragmentDelimiter= … , StartSel=«, StopSel=»') as headline
  from public.testimonies t
  where t.status = 'published'
    and t.search @@ websearch_to_tsquery('english', q)
  order by rank desc
  limit greatest(1, least(lim, 20));
$$;

revoke all on function public.search_testimonies(text, integer) from public;
grant execute on function public.search_testimonies(text, integer) to anon, authenticated;

-- ---------- Cached answers ----------
create table if not exists public.archive_answers (
  id          uuid primary key default gen_random_uuid(),
  question    text not null,
  normalized  text not null unique,
  answer      text not null,
  sources     jsonb not null default '[]'::jsonb,
  model       text,
  hits        integer not null default 1,
  created_at  timestamptz not null default now()
);

alter table public.archive_answers enable row level security;

drop policy if exists "answers_public_read" on public.archive_answers;
create policy "answers_public_read"
  on public.archive_answers for select
  to anon, authenticated
  using (true);
-- Writes happen server-side with the service role.

create or replace function public.bump_answer_hits(p_normalized text)
returns void language sql security definer set search_path = public as $$
  update public.archive_answers set hits = hits + 1 where normalized = p_normalized;
$$;
revoke all on function public.bump_answer_hits(text) from public;
grant execute on function public.bump_answer_hits(text) to anon, authenticated;
