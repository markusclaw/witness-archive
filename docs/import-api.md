# Witness Archive import API (v1)

For agents (e.g. Muse) that bring testimonies in from YouTube. Every call needs
an API token, sent as `Authorization: Bearer wa_…`. A token acts as the
account it was made for; imported testimonies are published under that
account as *shared* testimonies, credited to the channel.

Base URL: `https://witness-archive.org/api/v1`

## How an import works

1. `POST /imports` queues videos. Videos already in the archive come back
   right away as `"result": "exists"` with the existing testimony.
2. `POST /imports/run` processes the queue. Call it repeatedly until
   `remaining.queued` is 0. Each video takes roughly 30 seconds to 2 minutes.
3. `GET /imports` shows the queue and every result.

For each video the server:

- **Gets the transcript.** It uses the transcript you sent, if you sent one.
  Otherwise it fetches from YouTube, and if YouTube refuses, from a paid
  transcript service.
- **Formats the text** for reading and extracts the details: title,
  description, category, witness, date and place.
- **Fills the date and place only when the witness clearly states them** for
  their own experience. A guess is left blank and flagged for review.
- **Publishes.**

## Job statuses

| status | meaning | what to do |
|---|---|---|
| `queued` | waiting | call `/imports/run` |
| `processing` | being imported now | wait |
| `published` | live; `testimony.url` is the page | check `flags` |
| `duplicate` | the video was added by someone else meanwhile | nothing |
| `skipped` | **confirmed** the video has no transcript | send a transcript to import it anyway |
| `blocked` | YouTube refused the fetch, so we don't know yet | retried automatically (up to 6×), or re-POST with a `transcript` |
| `failed` | e.g. video private/removed, or an AI error | re-POST to retry |

`blocked` never means "no transcript". Only `skipped` does.

## Review flags (on published jobs)

`date_uncertain`, `place_uncertain` (left blank; `flag_notes` holds the
assistant's guess and the quoted evidence), `category_uncertain` (set to
Other), `witness_unknown`, `possible_duplicate` (`flag_notes` lists the
similar testimonies), `language_unsupported`, `short_transcript`.
`needs_review` is true until someone marks the job reviewed.

## Endpoints

### POST /imports

```json
{ "url": "https://youtu.be/VIDEOID", "transcript": "optional full transcript", "language": "en", "process": true }
```

`process: true` (single video only) imports before responding.

Bulk forms:

- `{ "videos": [{ "url": "…", "transcript": "…" }, …] }`
- `{ "urls": ["…", "…"] }`
- CSV or plain text: one URL per line, with an optional `,language` column.

Up to 500 videos per request.

Response (202):

```json
{
  "batch_id": "…",
  "summary": { "queued": 3, "exists": 1 },
  "results": [
    { "input": "…", "youtube_id": "…", "result": "queued|requeued|in_queue|exists|invalid", "message": null, "job": { … }, "testimony": { "id": "…", "title": "…", "url": "…" } }
  ]
}
```

Results:

- `exists`: already in the archive. `testimony` is set.
- `in_queue`: already imported or waiting. `job.status` says which.
- `requeued`: a `failed` or `blocked` job, or a `skipped` one sent with a transcript, was queued again.

### POST /imports/run

```json
{ "max": 3, "seconds": 240 }
```

Both fields are optional. Returns `processed` (one entry per video) and `remaining`.

### GET /imports

Query parameters:

- `status=published,failed`
- `batch=<batch_id>`
- `youtube_id=…`
- `needs_review=true`
- `limit=50`
- `before=<next_cursor>`

Returns `counts` per status (plus `needs_review`), `jobs`, and `next_cursor`.

### GET /imports/{job id or YouTube id}

One job.

### PATCH /imports/{id}

Body: `{ "reviewed": true }`. Clears the job from the review list.

### GET /testimonies

Query parameters:

- `page=1`
- `limit=50` (at most 100)
- `category=Healing`
- `youtube_id=…`
- `since=2026-10-01`
- `mine=true` (your own testimonies, including drafts)

Each item has `id`, `title`, `category`, `status`, `language`, `witness_name`,
`url`, `youtube_id`, `video_url` and `created_at`. The response also carries
`total`, `pages` and `next_page`.

## Errors

Errors look like `{ "error": { "code": "…", "message": "…" } }`.

- 401: bad token
- 403: the account has no import access
- 413: too many videos in one request
- 503: the server isn't configured

## Admin

- Tokens: `node scripts/api-token.mjs create --email … --name muse`, plus `list` and `revoke <id>`.
- Status and review page: `/me/imports`, for site admins and token owners.
