# Open Bible Translation (OBT) — English edition

An open English Bible translated directly from the Hebrew and Greek, drafted
with AI and reviewed by people, with every verse's history public. The
Spanish edition is the Versión Testigo (`translation/vt/`), made the same way
and independently from the same Hebrew and Greek — neither edition is
translated from the other.

**Status: pilot (Ruth), draft, not yet reviewed.**

- Book: `/bible/obt` · About: `/bible/obt/about` · Review: `/bible/obt/ruth/1`
- Reader: `/bible/ruth/1?ver=obt` (hidden from the translation picker until ready)

The pipeline is the same as the Spanish edition's (see `translation/vt/README.md`);
add `--t obt` to every command:

```
node scripts/vt/draft.mjs Ruth --t obt
node scripts/vt/check.mjs Ruth --t obt --ai
node scripts/vt/import.mjs Ruth --t obt
node scripts/vt/review.mjs Ruth 1:16 --t obt
```

## Copyrighted wording

The risk of echoing a copyrighted Bible is highest in English: models have
memorized the ESV, NIV, NASB and others. The Ruth draft was written with that
in mind, and the check compares it with the public-domain KJV, WEB and BSB
(shared wording there is allowed). To check against a modern copyrighted
version, put its text for the book in `translation/obt/reference/` (gitignored)
as described in the Spanish README. Once the ESV API key is approved, Ruth
(85 verses, within the API's 500-verse limit) can be fetched for that check.
