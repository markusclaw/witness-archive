# Witness Archive

A curated archive of first-hand testimonies of the supernatural — heaven, hell, healing, angelic and divine encounters — gathered into one searchable place where they can be found, heard, and discussed.

## Stack

- **Next.js 16** (App Router, TypeScript) with **Tailwind CSS v4**
- **Supabase** for Postgres, auth (email/password), and row-level security
- Deployed on **Cloudflare** (builds from GitHub on push)

## Local setup

1. Create a Supabase project and run the migrations in order from the SQL Editor:
   - `supabase/migrations/001_initial_schema.sql` — tables, RLS, indexes, seed rows
   - `supabase/migrations/003_member_authoring.sql` — author fields, series, draft/published status, RLS for self-publishing
   - `supabase/migrations/004_profiles.sql` — member profiles (auto-created on sign-up) and the public `avatars` storage bucket
   - `supabase/migrations/005_languages.sql` — original-language column and the cached `testimony_translations` table
   - `supabase/migrations/006_comment_replies.sql` — one-level threaded replies on comments
   - `supabase/migrations/007_metadata.sql` — where it happened and how precise the date is
   - `supabase/migrations/008_follows_views.sql` — follows, view counts (total + per day) and the `record_view` function
   - `supabase/migrations/009_search_ask.sql` — full-text search column/function and the cached-answers table for Ask
2. Copy `.env.example` to `.env.local` and fill in the URL and anon key from *Project Settings → API*. Add an `ANTHROPIC_API_KEY` to enable the formatting assistant (the site works without it; the button just reports it isn't configured).
3. `npm install && npm run dev`, then open http://localhost:3000.

Optional: set `NEXT_PUBLIC_SITE_URL` to the production origin so Open Graph URLs resolve correctly.

## Deploying to Cloudflare

The app runs on Cloudflare Workers via the OpenNext adapter (`wrangler.jsonc`, `open-next.config.ts`). In a Git-connected Worker:

- Build command: `npm run build:cf` · Deploy command: `npx wrangler deploy`
- Build variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (and optionally `NEXT_PUBLIC_SITE_URL`)
- Runtime secrets (Settings → Variables and Secrets, type *Secret*): `ANTHROPIC_API_KEY` (Polish + translations) and `SUPABASE_SERVICE_ROLE_KEY` (lets the translate route write to the cache)

## How it's organized

| Path | What it is |
| --- | --- |
| `app/page.tsx` | Homepage — hero, latest entries, collections, submission CTA |
| `app/archive/` | Server-rendered list + client-side search, category filter, and sort (`?category=slug&q=term`) |
| `app/testimony/[id]/` | Testimony detail: click-to-play video, written account, comments, related entries, OG + JSON-LD metadata |
| `app/submit/` | The editor: write, polish with the assistant (diff review), save draft, publish; `?series=<id>` adds the next part |
| `app/testimony/[id]/edit/` | Same editor, prefilled, for the author |
| `app/settings/` | Display name, bio, avatar upload (resized in the browser to 256px), password reset |
| `app/author/[id]/` | Public author page: bio, follower count, Follow button, their published testimonies |
| `app/following/` | Feed of the latest testimonies from people you follow |
| `app/me/` | The member's drafts and published testimonies, grouped by series: publish/unpublish, edit, delete, add part |
| `app/api/format/` | Server route calling the Claude API with a strict "readability only" prompt; requires a signed-in member |
| `app/ask/` + `app/api/ask/` | Ask the archive: full-text retrieval → Claude answers only from the matched testimonies, every sentence cited; answers cached per question |
| `app/api/extract/` | Reads a testimony and proposes title, category, when (with precision) and where, each with its supporting quote; nothing is applied without the author |
| `app/about/` | Mission, collections, curation policy |
| `app/auth/` | Sign in / sign up (with display name) / password reset |
| `components/` | UI: cards, header/footer, comments, video facade, forms |
| `lib/categories.ts` | The fixed taxonomy (slug ↔ name); add a category here and it appears everywhere |
| `lib/queries.ts` | All server-side reads from Supabase |
| `lib/youtube.ts` | Parses every YouTube URL shape into an id / embed / thumbnail |
| `lib/diff.ts` | Word-level diff used to show exactly what the assistant changed |
| `components/TestimonyBody.tsx` | Read / Listen toggle — browser speech synthesis with paragraph highlighting |

## How publishing works

Members write at `/submit`. The content goes through an optional **Polish** pass: the server sends it to Claude with a prompt that only permits grammar, punctuation, and paragraph fixes — no rewording, no additions — and returns the edited text plus a few notes. The editor shows a word-level diff; the author accepts the polished version or keeps their original. Nothing is applied without approval.

A testimony is saved as a **draft** (private, visible only to its author) or **published** (live immediately). Long testimonies can be split into a **series**: every part shares a `series_id` and has a `part_number`; the detail page shows Part 1 → Part 2 navigation. Authors can publish anonymously; their account is still linked so they can edit later, but no name is shown.

Moderation is by hand for now: any row can be flipped to `draft` (hidden) or deleted from the Supabase dashboard. The `status` column is there so an approval step can be added later without a migration.

## Ask the archive

The hero search box goes to `/ask?q=…`. The route ranks published testimonies with Postgres full-text search (`search_testimonies`, with an ILIKE fallback before the migration is run), sends the top matches as numbered excerpts to Claude under a prompt that forbids outside knowledge and requires a citation on every paragraph, and returns the answer with the cited sources and the keyword matches. Answers are cached in `archive_answers` by normalized question (service role writes; `hits` counts repeat asks). If nothing matches, no model call is made. Without `ANTHROPIC_API_KEY` the page still works as plain search.

## Views and follows

A view is counted once per visitor per testimony per day, by a small client ping (`ViewPing`) that calls the `record_view` function 1.5s after render — so crawlers and bounces don't count. Totals live on `testimonies.view_count`; per-day rows in `testimony_views_daily` power "Most read this week" on the homepage and can be aggregated for any window. The archive can sort by most viewed. Follows are a simple `(follower, followee)` table with public counts; anonymous testimonies never link to an author page.

## Languages

Every testimony has an original `language` (chosen in the editor; English, Spanish, and Portuguese today — add one in `lib/languages.ts`). Readers switch language on the testimony page; the translated version lives at `/<lang>/testimony/<slug>-<uuid>` with `hreflang` alternates, and Listen picks a voice for that language. The first request for a language sends the testimony to Claude with a faithful-translation prompt and caches the result in `testimony_translations`; everyone after that gets it instantly. Translated pages are labeled as machine translations and link to the original. Authors can replace a machine translation with their own (`source = author`) via the table's RLS.

## SEO and discoverability

- **URLs**: testimonies live at `/testimony/<title-slug>-<uuid>`; bare-UUID or stale-slug links 308 to the canonical form. Categories are real pages at `/collections/<slug>` (`/archive?category=` redirects there).
- **Metadata**: canonical, Open Graph and Twitter tags on every page; a default social image at `/og-default.png` for pages without a video; private pages (`/submit`, `/me`, `/auth`, edit) are `noindex`.
- **Structured data**: `Organization` + `WebSite` (with `SearchAction`) site-wide; `Article` + `VideoObject` + `BreadcrumbList` on testimonies (with `CreativeWorkSeries` for parts); `CollectionPage` + `ItemList` on collections; `FAQPage` on About.
- **Crawl files**: `/robots.txt`, `/sitemap.xml` (generated from the database), and `/llms.txt` — a plain-text site summary for AI assistants and answer engines.
- **Set `NEXT_PUBLIC_SITE_URL`** to the production origin in Cloudflare; canonical URLs, the sitemap and structured data are all built from it.

## Roadmap

- Stored, high-quality audio (hosted TTS → Supabase Storage) as an upgrade over browser voices
- Report button + admin moderation view inside the site
- Public author pages (`/author/<id>`) listing a member's published testimonies
- Realtime comment updates (the `comments` table is ready for `supabase_realtime`)
