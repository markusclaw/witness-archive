# Versión Testigo (VT) — Spanish edition of the Open Bible Translation

An open Spanish translation of the Bible made directly from the Hebrew and
Greek, drafted with AI and reviewed by people, with every verse's history
public. **Status: pilot (Ruth), draft, not yet reviewed.**

- Project page: `/bible/vt` (unlisted, not indexed)
- Review pages: `/bible/vt/ruth/1` … — text, notes, Hebrew, BSB reference,
  automatic checks and full history for each verse
- Reader: `/bible/ruth/1?lang=es&ver=vt` (VT is hidden from the translation
  picker until it's ready; reachable by link)

## Principles

1. **From the original languages.** The drafter works from the Westminster
   Leningrad Codex (OT) and the SBL Greek New Testament (NT), word by word,
   with Strong's numbers, grammar tags and dictionary glosses. It is never
   shown a published translation.
2. **Written rules.** `STYLE.md` (approach, register, names of God, names,
   punctuation) and `glossary.json` (how key terms are always rendered) are
   given to the drafter verbatim and enforced by the checks.
3. **Checked before people see it.** Glossary, names and style rules; shared
   wording with other translations; back-translation and comparison with the
   Berean Standard Bible.
4. **Accountable people decide.** Every edit records who made it and why.
   Reviewed and approved are separate steps.
5. **Nothing changes silently.** All revisions and checks are public.

## Pipeline

All scripts read `.env.local` (Supabase URL + service role key; Anthropic key
for the AI steps). Run them from the repo root.

```
node scripts/vt/draft.mjs Ruth            # AI draft → translation/vt/drafts/ruth.json
node scripts/vt/check.mjs Ruth --ai       # checks → translation/vt/reports/ruth.md
node scripts/vt/align.mjs Ruth            # word map → translation/vt/alignments/ruth.json
node scripts/vt/import.mjs Ruth           # upload draft, checks and word map to Supabase
node scripts/vt/review.mjs Ruth 1:16      # show a verse and its history
node scripts/vt/review.mjs Ruth 1:16 --by "Nombre" --edit "…" --why "…"
node scripts/vt/review.mjs Ruth 2 --by "Nombre" --reviewed
node scripts/vt/review.mjs Ruth all --by "Comité" --approved
```

`VT_MODEL` chooses the drafting model (use the strongest available; it is
recorded on every verse). `VT_CHECK_MODEL` can pick a different model for
the back-translation check, which makes the comparison more independent.

## The echo check (copyrighted wording)

Models have memorized modern Bibles, so a "fresh" draft can reproduce their
wording. `check.mjs` flags any run of 8+ identical words shared with another
translation:

- Public-domain texts in `scripts/bible-data/` (Reina-Valera 1909) are always
  compared. Matches there are allowed and reported as notes.
- Modern copyrighted versions can't be shipped in this repo. To check against
  them, put a JSON file per version in `translation/vt/reference/` (gitignored):
  `{ "name": "…", "copyrighted": true, "verses": { "7.1.1": "…", … } }`
  where keys are `book.chapter.verse` with our 0-based book numbers (Ruth = 7).
  Only use texts you're entitled to use for comparison.

## Open decisions

- License (public domain vs. CC BY-SA) — must be settled before publishing.
- Review committee: who, credentials, theological position.
- Style guide v0.1 sign-off (especially «el SEÑOR», «amor leal», «de valía»).
- Final name check against existing Spanish Bibles.
