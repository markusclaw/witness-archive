-- Word maps for the Open Bible Translation: which word(s) of the original
-- each word or phrase of a verse translates. A list in reading order:
--   [{ "w": "famine", "h": [6] }, { "w": "came over", "h": [5] }, …]
-- where "w" is text from the verse and "h" are word positions in the Hebrew
-- or Greek verse. Words in the verse with no entry were supplied by the
-- translator.
alter table public.translation_verses add column if not exists alignment jsonb;
alter table public.translation_revisions add column if not exists alignment jsonb;
