-- ============================================================
-- Witness Archive — migration 013: "same text" means verbatim overlap
-- Run after 012. Character-trigram similarity confused same-genre
-- transcripts (same vocabulary, same caption style) with the same testimony.
-- Now "same text" is measured as shared 5-word phrases: two different
-- testimonies share almost none; a re-upload shares most.
-- ============================================================

-- Normalized word 5-grams from the first ~600 words.
create or replace function public.wa_shingles(body text)
returns text[] language sql immutable as $$
  with w as (
    select array_remove(regexp_split_to_array(lower(regexp_replace(coalesce(body, ''), '[^a-z0-9''\s]+', ' ', 'gi')), '\s+'), '') as words
  ),
  lim as (select words[1:600] as words from w),
  g as (
    select array_to_string(words[i:i+4], ' ') as sh
    from lim, generate_series(1, greatest(array_length(words, 1) - 4, 0)) as i
  )
  select coalesce(array_agg(distinct sh), '{}'::text[]) from g;
$$;

-- Fraction of the shorter text's phrases that appear verbatim in the other.
create or replace function public.wa_phrase_overlap(a text, b text)
returns real language sql immutable as $$
  with sa as (select public.wa_shingles(a) as s), sb as (select public.wa_shingles(b) as s),
  inter as (select count(*) as n from sa, sb, unnest(sa.s) x where x = any(sb.s))
  select case
    when least(cardinality(sa.s), cardinality(sb.s)) < 20 then 0
    else (inter.n::real / least(cardinality(sa.s), cardinality(sb.s)))
  end
  from sa, sb, inter;
$$;

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
  -- Cheap prefilter (index-backed); the trigram match is only a candidate gate here.
  cand as (
    select t.id, t.title, t.witness_name, t.creator, t.is_anonymous, t.category, t.created_at, t.content, t.video_id,
      (p.vid is not null and t.video_id = p.vid) as same_video,
      case when p.wn is not null and t.witness_name is not null then similarity(lower(t.witness_name), p.wn) else 0 end as name_sim,
      (p.fp is not null and t.fingerprint is not null and t.fingerprint % p.fp) as text_candidate
    from public.testimonies t, params p
    where t.status = 'published'
      and (p_exclude is null or t.id <> p_exclude)
      and (
        (p.vid is not null and t.video_id = p.vid)
        or (p.fp is not null and t.fingerprint % p.fp)
        or (p.wn is not null and t.witness_name is not null and lower(t.witness_name) % p.wn)
      )
    limit 40
  ),
  scored as (
    select c.*,
      case when c.text_candidate then public.wa_phrase_overlap(c.content, p_content) else 0 end as text_sim
    from cand c
  )
  select
    id, title, witness_name, creator, is_anonymous, category, created_at,
    array_remove(array[
      case when same_video then 'same_video' end,
      case when text_sim >= 0.3 then 'same_text' end,
      case when name_sim >= 0.6 and category = p_category then 'same_witness' end,
      case when name_sim >= 0.6 and category <> p_category then 'same_witness_other_category' end
    ], null) as reasons,
    greatest(case when same_video then 1.0 else 0 end, text_sim, case when name_sim >= 0.6 then name_sim * 0.8 else 0 end)::real as score
  from scored
  where same_video or text_sim >= 0.3 or name_sim >= 0.6
  order by score desc
  limit greatest(1, least(lim, 10));
$$;

revoke all on function public.find_possible_duplicates(text, text, text, text, uuid, integer) from public;
grant execute on function public.find_possible_duplicates(text, text, text, text, uuid, integer) to authenticated;
