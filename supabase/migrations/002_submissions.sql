-- ============================================================
-- Witness Archive — migration 002: submissions queue
-- Run this in Supabase → SQL Editor after 001_initial_schema.sql.
-- Members submit testimonies here; you review in the dashboard and copy
-- approved rows into `testimonies`. This table is also where a future
-- Claude-assisted formatting step will read raw transcripts from.
-- ============================================================

create table if not exists public.submissions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null check (char_length(title) between 3 and 120),
  video_url   text,
  creator     text not null,
  category    text not null,
  transcript  text not null default '',
  notes       text,
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at  timestamptz not null default now()
);

create index if not exists submissions_status_idx on public.submissions (status, created_at desc);

alter table public.submissions enable row level security;

-- Members can create submissions as themselves and see their own.
drop policy if exists "submissions_insert_own" on public.submissions;
create policy "submissions_insert_own"
  on public.submissions for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "submissions_select_own" on public.submissions;
create policy "submissions_select_own"
  on public.submissions for select
  to authenticated
  using (auth.uid() = user_id);

-- No update/delete policies: once submitted, only you (dashboard / service role) can change it.

-- Helper: publish an approved submission into the archive in one step.
--   select public.publish_submission('<submission-id>');
create or replace function public.publish_submission(submission_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  insert into public.testimonies (title, description, video_url, creator, category, content)
  select
    s.title,
    coalesce(nullif(left(regexp_replace(s.transcript, '\s+', ' ', 'g'), 180), ''), s.title),
    s.video_url,
    s.creator,
    s.category,
    nullif(s.transcript, '')
  from public.submissions s
  where s.id = submission_id
  returning id into new_id;

  update public.submissions set status = 'approved' where id = submission_id;
  return new_id;
end;
$$;

-- Only the service role / dashboard should call this; keep it away from the anon and authenticated roles.
revoke execute on function public.publish_submission(uuid) from public, anon, authenticated;
