-- Versión Testigo: an open translation drafted from the Hebrew and Greek,
-- with every verse's history public.
--
--   translation_verses     the current text of each verse and its status
--   translation_revisions  every version of every verse: AI drafts, human
--                          edits (with the reason), reviews and approvals
--   translation_checks     automatic checks run against a revision
--
-- Everything is readable by anyone (transparency is the point). Writes go
-- through the service role only — the scripts in scripts/vt/ for now, a
-- reviewer screen later.

create table if not exists public.translation_verses (
  translation text not null,
  book smallint not null check (book between 0 and 65),
  chapter smallint not null check (chapter > 0),
  verse smallint not null check (verse > 0),
  text text not null,
  notes jsonb not null default '[]',
  status text not null default 'draft' check (status in ('draft', 'reviewed', 'approved')),
  revision_id uuid,
  updated_at timestamptz not null default now(),
  primary key (translation, book, chapter, verse)
);

create table if not exists public.translation_revisions (
  id uuid primary key default gen_random_uuid(),
  translation text not null,
  book smallint not null,
  chapter smallint not null,
  verse smallint not null,
  text text not null,
  notes jsonb not null default '[]',
  kind text not null check (kind in ('ai_draft', 'edit', 'review', 'approval')),
  -- "ai:<model>" for machine drafts, otherwise the reviewer's name
  author text not null,
  -- why this revision exists: the reason for an edit, a reviewer's comment
  comment text,
  -- anything else worth keeping: inputs, prompt version, alternatives
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists translation_revisions_verse on public.translation_revisions (translation, book, chapter, verse, created_at);

create table if not exists public.translation_checks (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null references public.translation_revisions (id) on delete cascade,
  translation text not null,
  book smallint not null,
  chapter smallint not null,
  verse smallint not null,
  kind text not null check (kind in ('glossary', 'names', 'style', 'echo', 'benchmark', 'backtranslation')),
  severity text not null check (severity in ('info', 'warn', 'error')),
  message text not null,
  data jsonb not null default '{}',
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists translation_checks_verse on public.translation_checks (translation, book, chapter, verse);

alter table public.translation_verses enable row level security;
alter table public.translation_revisions enable row level security;
alter table public.translation_checks enable row level security;

drop policy if exists "translation verses are public" on public.translation_verses;
create policy "translation verses are public" on public.translation_verses for select using (true);
drop policy if exists "translation revisions are public" on public.translation_revisions;
create policy "translation revisions are public" on public.translation_revisions for select using (true);
drop policy if exists "translation checks are public" on public.translation_checks;
create policy "translation checks are public" on public.translation_checks for select using (true);
