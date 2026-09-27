-- ============================================================
-- Witness Archive — migration 014: link the source credit
-- Run after 013. source_url lets "via <channel>" link to the channel.
-- ============================================================
alter table public.testimonies add column if not exists source_url text;
