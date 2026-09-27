-- ============================================================
-- Witness Archive — migration 012: repeat detection + retellings
-- Run after 011. Three signals: same YouTube video, same opening text
-- (trigram fingerprint), same witness name. Plus a retelling_of link so
-- the same testimony told twice stays connected rather than duplicated.
-- ============================================================

create extension if not exists pg_trgm;

alter table public.testimonies
  add column if not exists video_id     text,
  add column if not exists fingerprint  text,
  add column if not exists retelling_of uuid references public.testimonies(id) on delete set null;

-- YouTube id from any URL shape (watch?v=, youtu.be/, shorts/, embed/, live/).
create or replace function public.wa_video_id(url text)
returns text language sql immutable as $$
  select coalesce(
    substring(url from '[?&]v=([A-Za-z0-9_-]{11})'),
    substring(url from 'youtu\.be/([A-Za-z0-9_-]{11})'),
    substring(url from '/(?:shorts|embed|live|v)/([A-Za-z0-9_-]{11})')
  );
$$;

-- Normalized opening of the text: lowercase, letters/digits only, first 1500 chars.
create or replace function public.wa_fingerprint(body text)
returns text language sql immutable as $$
  select nullif(left(regexp_replace(lower(coalesce(body, '')), '[^a-z0-9]+', ' ', 'g'), 1500), '');
$$;

create or replace function public.testimonies_dedupe_fields()
returns trigger language plpgsql as $$
begin
  new.video_id := public.wa_video_id(new.video_url);
  new.fingerprint := public.wa_fingerprint(new.content);
  return new;
end $$;

drop trigger if exists testimonies_dedupe_fields_trg on public.testimonies;
create trigger testimonies_dedupe_fields_trg
  before insert or update of video_url, content on public.testimonies
  for each row execute function public.testimonies_dedupe_fields();

update public.testimonies set video_id = public.wa_video_id(video_url), fingerprint = public.wa_fingerprint(content);

create index if not exists testimonies_video_id_idx on public.testimonies (video_id) where video_id is not null;
create index if not exists testimonies_fingerprint_trgm_idx on public.testimonies using gin (fingerprint gin_trgm_ops);
create index if not exists testimonies_witness_trgm_idx on public.testimonies using gin (lower(witness_name) gin_trgm_ops);
create index if not exists testimonies_retelling_idx on public.testimonies (retelling_of) where retelling_of is not null;

-- Candidates that may be the same testimony. Only published rows; never the row being edited.
create or replace function public.find_possible_duplicates(
  p_video_url text,
  p_content   text,
  p_witness   text,
  p_category  text,
  p_exclude   uuid default null,
  lim         integer default 5
)
returns table (id uuid, title text, witness_name text, creator text, is_anonymous boolean, category text, created_at timestamptz, reasons text[], score real)
language sql
stable
as $$
  with params as (
    select public.wa_video_id(p_video_url) as vid,
           public.wa_fingerprint(p_content) as fp,
           nullif(lower(trim(p_witness)), '') as wn
  ),
  scored as (
    select
      t.id, t.title, t.witness_name, t.creator, t.is_anonymous, t.category, t.created_at,
      (p.vid is not null and t.video_id = p.vid) as same_video,
      case when p.fp is not null and t.fingerprint is not null then similarity(t.fingerprint, p.fp) else 0 end as text_sim,
      case when p.wn is not null and t.witness_name is not null then similarity(lower(t.witness_name), p.wn) else 0 end as name_sim
    from public.testimonies t, params p
    where t.status = 'published'
      and (p_exclude is null or t.id <> p_exclude)
      and (
        (p.vid is not null and t.video_id = p.vid)
        or (p.fp is not null and t.fingerprint % p.fp)
        or (p.wn is not null and t.witness_name is not null and lower(t.witness_name) % p.wn)
      )
  )
  select
    id, title, witness_name, creator, is_anonymous, category, created_at,
    array_remove(array[
      case when same_video then 'same_video' end,
      case when text_sim >= 0.35 then 'same_text' end,
      case when name_sim >= 0.6 and category = p_category then 'same_witness' end,
      case when name_sim >= 0.6 and category <> p_category then 'same_witness_other_category' end
    ], null) as reasons,
    greatest(case when same_video then 1.0 else 0 end, text_sim, case when name_sim >= 0.6 then name_sim * 0.8 else 0 end)::real as score
  from scored
  where same_video or text_sim >= 0.35 or name_sim >= 0.6
  order by score desc
  limit greatest(1, least(lim, 10));
$$;

revoke all on function public.find_possible_duplicates(text, text, text, text, uuid, integer) from public;
grant execute on function public.find_possible_duplicates(text, text, text, text, uuid, integer) to authenticated;

-- Other tellings of the same testimony, in either direction.
create or replace function public.retellings_of(p_id uuid)
returns setof public.testimonies
language sql
stable
as $$
  with root as (
    select coalesce(t.retelling_of, t.id) as root_id from public.testimonies t where t.id = p_id
  )
  select t.* from public.testimonies t, root r
  where t.status = 'published'
    and t.id <> p_id
    and (t.id = r.root_id or t.retelling_of = r.root_id)
  order by t.created_at asc;
$$;

revoke all on function public.retellings_of(uuid) from public;
grant execute on function public.retellings_of(uuid) to anon, authenticated;
