-- ============================================================
-- Witness Archive — migration 015: video details from the link
-- Run after 014. Filled by the editor from YouTube's Data API (when a key is
-- configured) or oEmbed: when the video was published, how long it is, and
-- its description (kept for the extractor and for search).
-- ============================================================
alter table public.testimonies
  add column if not exists video_title        text,
  add column if not exists video_published_at timestamptz,
  add column if not exists video_duration_s   integer,
  add column if not exists video_description  text;
