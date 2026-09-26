-- ============================================================
-- Witness Archive — migration 010: hearts
-- Run after 009. One heart per member per testimony; count denormalized.
-- ============================================================

alter table public.testimonies add column if not exists heart_count integer not null default 0;
create index if not exists testimonies_hearts_idx on public.testimonies (heart_count desc);

create table if not exists public.hearts (
  testimony_id uuid not null references public.testimonies(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (testimony_id, user_id)
);
create index if not exists hearts_user_idx on public.hearts (user_id);

alter table public.hearts enable row level security;

drop policy if exists "hearts_public_read" on public.hearts;
create policy "hearts_public_read" on public.hearts for select to anon, authenticated using (true);

drop policy if exists "hearts_insert_own" on public.hearts;
create policy "hearts_insert_own" on public.hearts for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "hearts_delete_own" on public.hearts;
create policy "hearts_delete_own" on public.hearts for delete to authenticated using (auth.uid() = user_id);

-- Keep heart_count in sync (runs as owner, bypasses the client-protection trigger depth check).
create or replace function public.hearts_sync()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.testimonies set heart_count = heart_count + 1 where id = new.testimony_id;
    return new;
  else
    update public.testimonies set heart_count = greatest(0, heart_count - 1) where id = old.testimony_id;
    return old;
  end if;
end $$;

drop trigger if exists hearts_sync_trg on public.hearts;
create trigger hearts_sync_trg after insert or delete on public.hearts
  for each row execute function public.hearts_sync();

-- Extend the client-update guard so heart_count can't be edited directly either.
create or replace function public.testimonies_protect_views()
returns trigger language plpgsql as $$
begin
  if current_setting('role', true) <> 'service_role' then
    if new.view_count is distinct from old.view_count then new.view_count := old.view_count; end if;
    if new.heart_count is distinct from old.heart_count then new.heart_count := old.heart_count; end if;
  end if;
  return new;
end $$;
