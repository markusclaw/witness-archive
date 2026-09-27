-- ============================================================
-- Witness Archive — migration 011: the witness is not always the contributor
-- Run after 010. Separates the person the experience happened to (witness)
-- from the member who published it here (contributor / author_id, creator).
-- ============================================================

alter table public.testimonies
  add column if not exists witness_name text,                         -- the person it happened to, as they should be credited
  add column if not exists witness_relationship text not null default 'self'
    check (witness_relationship in ('self', 'shared')),               -- self: contributor is the witness; shared: contributor is passing it on
  add column if not exists source_credit text;                        -- ministry, channel, book, interview it came from (optional)

-- Everything published so far was assumed to be first-hand.
update public.testimonies
set witness_name = case when is_anonymous then null else creator end
where witness_name is null and witness_relationship = 'self';

create index if not exists testimonies_witness_idx on public.testimonies (witness_name);
