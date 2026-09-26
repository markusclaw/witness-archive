-- ============================================================
-- Witness Archive — migration 008: follows and view counts
-- Run after 007.
-- ============================================================

-- ---------- Views ----------
alter table public.testimonies add column if not exists view_count integer not null default 0;
create index if not exists testimonies_views_idx on public.testimonies (view_count desc);

create table if not exists public.testimony_views_daily (
  testimony_id uuid not null references public.testimonies(id) on delete cascade,
  day          date not null,
  views        integer not null default 0,
  primary key (testimony_id, day)
);
alter table public.testimony_views_daily enable row level security;

drop policy if exists "views_daily_public_read" on public.testimony_views_daily;
create policy "views_daily_public_read"
  on public.testimony_views_daily for select
  to anon, authenticated
  using (true);

-- The only way to write a view: a function the page calls once per visitor per day.
create or replace function public.record_view(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.testimonies set view_count = view_count + 1
  where id = p_id and status = 'published';
  if found then
    insert into public.testimony_views_daily (testimony_id, day, views)
    values (p_id, (now() at time zone 'utc')::date, 1)
    on conflict (testimony_id, day) do update set views = public.testimony_views_daily.views + 1;
  end if;
end $$;

revoke all on function public.record_view(uuid) from public;
grant execute on function public.record_view(uuid) to anon, authenticated;

-- Keep view_count from being edited through the normal update path.
create or replace function public.testimonies_protect_views()
returns trigger language plpgsql as $$
begin
  if new.view_count is distinct from old.view_count and current_setting('role', true) <> 'service_role' then
    new.view_count := old.view_count;
  end if;
  return new;
end $$;
-- (record_view runs as the function owner, not the caller, so its update still applies.)
drop trigger if exists testimonies_protect_views_trg on public.testimonies;
create trigger testimonies_protect_views_trg before update on public.testimonies
  for each row when (pg_trigger_depth() = 0) execute function public.testimonies_protect_views();

-- ---------- Follows ----------
create table if not exists public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  followee_id uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index if not exists follows_followee_idx on public.follows (followee_id);

alter table public.follows enable row level security;

drop policy if exists "follows_public_read" on public.follows;
create policy "follows_public_read"
  on public.follows for select
  to anon, authenticated
  using (true);

drop policy if exists "follows_insert_own" on public.follows;
create policy "follows_insert_own"
  on public.follows for insert
  to authenticated
  with check (auth.uid() = follower_id);

drop policy if exists "follows_delete_own" on public.follows;
create policy "follows_delete_own"
  on public.follows for delete
  to authenticated
  using (auth.uid() = follower_id);
