# Witness Archive

A curated archive of first-hand testimonies of the supernatural — heaven, hell, healing, angelic and divine encounters — gathered into one searchable place where they can be found, heard, and discussed.

## Stack

- **Next.js 16** (App Router, TypeScript) with **Tailwind CSS v4**
- **Supabase** for Postgres, auth (email/password), and row-level security
- Deployed on **Cloudflare** (builds from GitHub on push)

## Local setup

1. Create a Supabase project and run the migrations in order from the SQL Editor:
   - `supabase/migrations/001_initial_schema.sql` — tables, RLS, indexes, seed rows
   - `supabase/migrations/002_submissions.sql` — the member submission queue
2. Copy `.env.example` to `.env.local` and fill in the URL and anon key from *Project Settings → API*.
3. `npm install && npm run dev`, then open http://localhost:3000.

Optional: set `NEXT_PUBLIC_SITE_URL` to the production origin so Open Graph URLs resolve correctly.

## How it's organized

| Path | What it is |
| --- | --- |
| `app/page.tsx` | Homepage — hero, latest entries, collections, submission CTA |
| `app/archive/` | Server-rendered list + client-side search, category filter, and sort (`?category=slug&q=term`) |
| `app/testimony/[id]/` | Testimony detail: click-to-play video, written account, comments, related entries, OG + JSON-LD metadata |
| `app/submit/` | Member submission form → `submissions` table (pending review) |
| `app/about/` | Mission, collections, curation policy |
| `app/auth/` | Sign in / sign up (with display name) / password reset |
| `components/` | UI: cards, header/footer, comments, video facade, forms |
| `lib/categories.ts` | The fixed taxonomy (slug ↔ name); add a category here and it appears everywhere |
| `lib/queries.ts` | All server-side reads from Supabase |
| `lib/youtube.ts` | Parses every YouTube URL shape into an id / embed / thumbnail |

## Editorial workflow

Members submit via `/submit`. Review rows in the Supabase dashboard (`submissions`, status `pending`). To publish one:

```sql
select public.publish_submission('<submission-id>');
```

That copies it into `testimonies` (auto-generating a description from the transcript) and marks it approved. Edit the published row afterwards as needed. To add a testimony directly, insert into `testimonies` from the dashboard.

## Roadmap

- Claude-assisted formatting: a route handler that takes a raw transcript from `submissions` and returns a cleaned, paragraphed version for the reviewer to accept before publishing
- Moderation UI (approve / edit / reject) inside the site instead of the Supabase dashboard
- User profiles and per-user submission history
- Realtime comment updates (the `comments` table is ready for `supabase_realtime`)
