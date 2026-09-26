-- ============================================================
-- Witness Archive — migration 007: richer metadata
-- Run after 006. Where it happened, and how precise the "when" is.
-- ============================================================

alter table public.testimonies
  add column if not exists experienced_precision text not null default 'day'
    check (experienced_precision in ('day', 'month', 'year', 'approx')),
  add column if not exists location_text         text,   -- as the author put it: "a hospital in Queens, New York"
  add column if not exists location_city         text,
  add column if not exists location_region       text,   -- state / province
  add column if not exists location_country      text,   -- display name
  add column if not exists location_country_code text check (location_country_code is null or location_country_code ~ '^[A-Z]{2}$');

create index if not exists testimonies_country_idx on public.testimonies (location_country_code);
create index if not exists testimonies_experienced_idx on public.testimonies (experienced_on);
