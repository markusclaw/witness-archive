-- ============================================================
-- Witness Archive — migration 019: prayer wall
-- Run after 018. Members post prayer requests (optionally anonymous),
-- others press "I prayed" (one per person) and may leave a short word.
-- Every post goes through the server (/api/prayer), which screens it with
-- Claude and either publishes it or holds it for an admin to review —
-- so there is deliberately NO client insert policy on these tables.
-- ============================================================

-- ---------- 1. admins ----------
alter table public.profiles
  add column if not exists role text not null default 'member' check (role in ('member', 'admin'));

-- Promote yourself once (replace the email):
--   update public.profiles p set role = 'admin'
--   from auth.users u where u.id = p.id and u.email = 'you@example.com';

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------- 2. requests ----------
create table if not exists public.prayer_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  display_name  text,                                  -- null when anonymous
  anonymous     boolean not null default false,
  title         text not null check (char_length(btrim(title)) between 3 and 120),
  body          text not null check (char_length(btrim(body)) between 10 and 3000),
  category      text not null default 'other',
  language      text not null default 'en' check (language ~ '^[a-z]{2}(-[A-Za-z]{2})?$'),
  status        text not null default 'open' check (status in ('open', 'answered', 'closed')),
  answer        text check (answer is null or char_length(answer) <= 3000),
  answered_at   timestamptz,
  review        text not null default 'clear' check (review in ('clear', 'held', 'removed')),
  review_note   text,                                  -- why the screener held it (admins only, in practice)
  prayed_count  integer not null default 0,
  reply_count   integer not null default 0,
  last_prayed_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists prayer_requests_wall_idx on public.prayer_requests (review, status, created_at desc);
create index if not exists prayer_requests_user_idx on public.prayer_requests (user_id, created_at desc);
create index if not exists prayer_requests_category_idx on public.prayer_requests (category);

alter table public.prayer_requests enable row level security;

-- Readers see cleared requests; authors see their own whatever the state; admins see all.
drop policy if exists "prayer_requests_read" on public.prayer_requests;
create policy "prayer_requests_read"
  on public.prayer_requests for select
  to anon, authenticated
  using (review = 'clear' or user_id = auth.uid() or public.is_admin());

-- Authors may close their own request or delete it; text changes go through the server (screened).
drop policy if exists "prayer_requests_delete_own" on public.prayer_requests;
create policy "prayer_requests_delete_own"
  on public.prayer_requests for delete
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ---------- 3. "I prayed" ----------
create table if not exists public.prayers (
  request_id uuid not null references public.prayer_requests(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (request_id, user_id)
);
create index if not exists prayers_user_idx on public.prayers (user_id);

alter table public.prayers enable row level security;

drop policy if exists "prayers_read" on public.prayers;
create policy "prayers_read" on public.prayers for select to anon, authenticated using (true);

drop policy if exists "prayers_insert_own" on public.prayers;
create policy "prayers_insert_own" on public.prayers for insert to authenticated
  with check (auth.uid() = user_id and exists (select 1 from public.prayer_requests r where r.id = request_id and r.review = 'clear'));

drop policy if exists "prayers_delete_own" on public.prayers;
create policy "prayers_delete_own" on public.prayers for delete to authenticated using (auth.uid() = user_id);

create or replace function public.prayers_sync()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.prayer_requests set prayed_count = prayed_count + 1, last_prayed_at = now() where id = new.request_id;
    return new;
  else
    update public.prayer_requests set prayed_count = greatest(0, prayed_count - 1) where id = old.request_id;
    return old;
  end if;
end $$;

drop trigger if exists prayers_sync_trg on public.prayers;
create trigger prayers_sync_trg after insert or delete on public.prayers
  for each row execute function public.prayers_sync();

-- ---------- 4. replies (a word after praying) ----------
create table if not exists public.prayer_replies (
  id         uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.prayer_requests(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  author     text not null,
  content    text not null check (char_length(btrim(content)) between 1 and 1000),
  review     text not null default 'clear' check (review in ('clear', 'held', 'removed')),
  created_at timestamptz not null default now()
);
create index if not exists prayer_replies_request_idx on public.prayer_replies (request_id, created_at);

alter table public.prayer_replies enable row level security;

drop policy if exists "prayer_replies_read" on public.prayer_replies;
create policy "prayer_replies_read"
  on public.prayer_replies for select
  to anon, authenticated
  using (review = 'clear' or user_id = auth.uid() or public.is_admin());

drop policy if exists "prayer_replies_delete_own" on public.prayer_replies;
create policy "prayer_replies_delete_own"
  on public.prayer_replies for delete
  to authenticated
  using (user_id = auth.uid() or public.is_admin() or exists (select 1 from public.prayer_requests r where r.id = request_id and r.user_id = auth.uid()));

create or replace function public.prayer_replies_sync()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.review = 'clear' then update public.prayer_requests set reply_count = reply_count + 1 where id = new.request_id; end if;
    return new;
  elsif tg_op = 'UPDATE' then
    if old.review <> 'clear' and new.review = 'clear' then update public.prayer_requests set reply_count = reply_count + 1 where id = new.request_id; end if;
    if old.review = 'clear' and new.review <> 'clear' then update public.prayer_requests set reply_count = greatest(0, reply_count - 1) where id = new.request_id; end if;
    return new;
  else
    if old.review = 'clear' then update public.prayer_requests set reply_count = greatest(0, reply_count - 1) where id = old.request_id; end if;
    return old;
  end if;
end $$;

drop trigger if exists prayer_replies_sync_trg on public.prayer_replies;
create trigger prayer_replies_sync_trg after insert or update or delete on public.prayer_replies
  for each row execute function public.prayer_replies_sync();

-- ---------- 5. updated_at ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists prayer_requests_touch on public.prayer_requests;
create trigger prayer_requests_touch before update on public.prayer_requests
  for each row execute function public.touch_updated_at();
