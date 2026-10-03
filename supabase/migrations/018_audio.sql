-- ============================================================
-- Witness Archive — migration 018: narrated audio
-- Run after 017. Each published testimony gets one narrated MP3 per
-- language, generated once with a neural voice (Google Cloud Text-to-Speech)
-- and stored in the public `audio` bucket. Generation is one chunk per
-- request, like translations: segments accumulate in `parts`, then the
-- final step stitches them into `path`.
-- ============================================================

create table if not exists public.testimony_audio (
  testimony_id   uuid not null references public.testimonies(id) on delete cascade,
  language       text not null check (language ~ '^[a-z]{2}(-[A-Za-z]{2})?$'),
  status         text not null default 'pending' check (status in ('pending', 'ready', 'failed')),
  voice          text,
  source_hash    text not null,                 -- hash of the narrated text; a changed text regenerates
  progress_done  integer not null default 0,
  progress_total integer not null default 0,
  parts          jsonb not null default '[]'::jsonb,  -- storage paths of finished segments
  path           text,                           -- final stitched file in the `audio` bucket
  bytes          integer,
  duration_s     integer,
  lock_until     timestamptz,
  error          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (testimony_id, language)
);

alter table public.testimony_audio enable row level security;

-- Finished audio of published testimonies is public; only the server (service role) writes.
drop policy if exists "audio_public_read" on public.testimony_audio;
create policy "audio_public_read"
  on public.testimony_audio for select
  to anon, authenticated
  using (exists (select 1 from public.testimonies t where t.id = testimony_id and t.status = 'published'));

-- ---------- storage bucket ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('audio', 'audio', true, 52428800, array['audio/mpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "audio_public_read_objects" on storage.objects;
create policy "audio_public_read_objects"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'audio');
