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
2. Copy `.env.example` to `.env.local` and fill in the URL and anon key from *Project Settings → API*. Add an `ANTHROPIC_API_KEY` to enable the formatting assistant (the site works without it; the button just reports it isn't configured).
3. `npm install && npm run dev`, then open http://localhost:3000.

Optional: set `NEXT_PUBLIC_SITE_URL` to the production origin so Open Graph URLs resolve correctly.

## Deploying to Cloudflare

The app runs on Cloudflare Workers via the OpenNext adapter (`wrangler.jsonc`, `open-next.config.ts`). In a Git-connected Worker:

- Build command: `npm run build:cf` · Deploy command: `npx wrangler deploy`
- Build variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (and optionally `NEXT_PUBLIC_SITE_URL`)
- Runtime secret (Settings → Variables and Secrets, type *Secret*): `ANTHROPIC_API_KEY`

## How it's organized

| Path | What it is |
| --- | --- |
| `app/page.tsx` | Homepage — hero, latest entries, collections, submission CTA |
| `app/archive/` | Server-rendered list + client-side search, category filter, and sort (`?category=slug&q=term`) |
| `app/testimony/[id]/` | Testimony detail: click-to-play video, written account, comments, related entries, OG + JSON-LD metadata |
| `app/submit/` | The editor: write, polish with the assistant (diff review), save draft, publish; `?series=<id>` adds the next part |
| `app/testimony/[id]/edit/` | Same editor, prefilled, for the author |
| `app/me/` | The member's drafts and published testimonies, grouped by series: publish/unpublish, edit, delete, add part |
| `app/api/format/` | Server route calling the Claude API with a strict "readability only" prompt; requires a signed-in member |
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

## Roadmap

- Stored, high-quality audio (hosted TTS → Supabase Storage) as an upgrade over browser voices
- Report button + admin moderation view inside the site
- Public author pages (`/author/<id>`) listing a member's published testimonies
- Realtime comment updates (the `comments` table is ready for `supabase_realtime`)
