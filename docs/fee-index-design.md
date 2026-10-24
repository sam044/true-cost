# Blacksburg fee index: design

Oct 24, 2026 · design only, nothing here is built yet. Read `docs/PRD.md` and `CLAUDE.md` first; this doc adds one feature on top of them.

## What it is

When a student confirms an apartment's fees on Review ("Looks right") and has opted in, the reviewed fees are saved anonymously to a shared database, keyed by complex. The app then shows what other students found at the same complex: "4 people reported a $62/month utility fee at Brexx", including fees the current listing does not show. The database starts with the 8 hand-labelled eval cases, so the demo has real data before anyone submits.

Why it helps the pitch: it turns one student's review work into evidence for the next student (impact, stakeholder empathy), and catching a fee the listing omits is exactly the "hidden fee" story.

## Decision needed from sam first: the privacy promise

The PRD's privacy row says "No accounts, images never stored, data stays in the browser", and the landing page says "Your screenshots are never stored." The index breaks "data stays in the browser". This design keeps the other two promises and makes sharing explicit:

- Sharing is **opt-in**, an unchecked checkbox on Review: "Add these fees to the Blacksburg fee index (anonymous: only the complex name and fee amounts are shared)".
- Only fee facts about a public listing are sent. Nothing about the student (setup, roommate count, budget, needs), no images, no quotes, no IP address.
- The PRD privacy row and the landing privacy line change to: "No accounts. Screenshots are never stored. Fee amounts are shared only if you choose to, with nothing that identifies you."

If sam prefers checked by default, it is a one-line change, but unchecked scores better on the Privacy rubric item, and the seed data keeps the index useful for the demo either way.

## Storage choice: Neon Postgres through the Vercel Marketplace

The app runs on Vercel Hobby serverless functions, so a local SQLite file will not persist between invocations. Options compared (free tiers as published in 2026; check the vendor page before relying on a number):

| Option | Free tier | Fit for us |
| --- | --- | --- |
| **Neon Postgres** (Vercel Marketplace; what "Vercel Postgres" became) | 0.5 GB storage, about 100 compute hours a month, scales to zero, no card | One click in the Vercel dashboard creates the database and injects `DATABASE_URL` into all three Vercel environments. Real SQL with `percentile_cont` for medians. `@neondatabase/serverless` runs queries over HTTP, which suits serverless functions (no connection pool to manage). |
| Turso / libSQL | 100 databases, 5 GB, 500M rows read and 10M written a month | Generous and SQLite-compatible, but a separate account, CLI and token, and the env vars are copied into Vercel by hand. SQLite has no median function, so medians move into JS. Close second. |
| Supabase | 500 MB, 2 projects; **pauses after 7 days idle** | Brings auth, storage and row-level security we do not need. The pause would break the deployed app if judges look after the event. |
| Upstash Redis | 500K commands a month, 256 MB | A key-value store; aggregating by complex and category means hand-built counters. Good for rate limiting, not as the main store. |

**Pick: Neon.** It is the lowest-friction path on our exact stack (sam already has the Vercel project and the CLI linked, and the Marketplace sets the env vars for us), Postgres does the aggregation in one query, and free-tier limits are orders of magnitude above hackathon traffic. The only cost is a cold start of a few hundred milliseconds after the database scales to zero; the index loads after the page, so it never blocks the main flow. Rate limiting uses a Postgres query, so no Upstash is needed.

Fallback if the Marketplace step fails: Turso, with the same schema (types change to SQLite affinities and the median moves into JS).

## Data model

Three tables. The SQL lives in `lib/index/schema.sql` and is run once (see "What sam does by hand").

```sql
create table complexes (
  id          serial primary key,
  slug        text unique not null,        -- "brexx", "hub", "2001-christopher-drive"
  name        text not null,               -- display name, "Brexx at Blacksburg"
  aliases     text[] not null default '{}',-- normalized names that map here
  listing_url text,                        -- offcampus.vt.edu or similar, when known
  verified    boolean not null default false, -- true for seeded / hand-checked complexes
  created_at  timestamptz not null default now()
);

create table submissions (
  id               uuid primary key,       -- the apartment's id from the store; re-confirming replaces
  complex_id       int not null references complexes(id),
  source           text not null check (source in ('user', 'seed')),
  advertised       numeric(8,2),           -- advertised monthly rent as reviewed
  advertised_basis text check (advertised_basis in ('per_person', 'per_unit')),
  utilities        jsonb,                  -- the Utilities object
  client_hash      text,                   -- sha256(ip + INDEX_SALT + UTC date); null for seed rows
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index on submissions (complex_id);
create index on submissions (client_hash, created_at);

create table reported_fees (
  id            bigserial primary key,
  submission_id uuid not null references submissions(id) on delete cascade,
  category      text not null,             -- FeeCategory
  name          text not null,             -- as the student left it, trimmed, max 80 chars
  name_key      text not null,             -- normalized, for grouping "other" fees
  amount        numeric(8,2) not null,
  frequency     text,                      -- Frequency, null when unknown (seed rows)
  basis         text,                      -- Basis, null when unknown
  mandatory     text not null,             -- yes | no | unknown
  refundable    boolean not null default false
);
create index on reported_fees (submission_id);
```

Not stored, on purpose: fee quotes, fee ids, the `counted` toggle, `source`/`confidence`, anything from `Setup`, images, IP addresses. `base_rent` fees are skipped (the advertised rent is its own column).

`client_hash` uses a daily salt, so it can enforce "N submissions per day" but cannot link one student's submissions across days, and the IP itself is never written.

## When data is written

On **"Looks right"** in `app/compare/review/[id]/page.tsx` (`handleConfirm`), after validation passes and `reviewed` is set:

1. If the opt-in box is checked and the apartment is not a sample (`lib/mock.ts` ids are skipped), fire `POST /api/index/submit` without awaiting it. Navigation never waits on the database; a failure is silent apart from a `console.warn`.
2. The body is the apartment as reviewed: name, optional listing URL, advertised rent and basis, utilities, and fees with `counted` dropped.
3. `submissions.id` is the apartment's id, so going back to Review and confirming again replaces that submission (delete old fees, insert new) instead of double counting.

Only reviewed data is written, which is the point: the index holds human-checked fees, not raw model output.

The opt-in choice is remembered in the store (`shareToIndex: boolean` on the root state, default `false`) so the student is asked once per comparison.

## Normalizing complex names

Names reach us three ways: typed on Add, taken from the page title by the extension (`/compare/import`), or from samples. One pure function, `complexKey(name, url?)` in `lib/index/complex.ts`, with Vitest tests:

1. **URL first.** If a listing URL is known and matches a complex's `listing_url` (compare host and path, ignoring query strings), use that complex. offcampus.vt.edu property paths are stable ids.
2. **Name.** Lowercase, `&` to "and", strip punctuation, then drop filler words: `the`, `apartments`, `apartment homes`, `apartment`, `townhomes`, `and townhomes`, `at blacksburg`, `of blacksburg`, `blacksburg`, `va`, `virginia`, and a trailing ` - ` site suffix such as "Apartments for Rent". Collapse spaces, join with hyphens. "Brexx at Blacksburg" and "BREXX Apartments" both become `brexx`; "The Edge Apartments and Townhomes" becomes `edge`.
3. **Match** the key against `slug` and `aliases`. On a hit, use that complex.
4. **No hit:** create an unverified complex with that slug and the typed name. Unverified complexes appear in the index only once 2 different `client_hash` values have reported them, which keeps typos and junk out of the list.

The seed adds aliases by hand for the 8 known complexes (for example `hub` gets `hub-blacksburg`, `fourteen35` gets `1435`). Merging two complexes later is a SQL update of `complex_id` plus adding the alias.

## API routes

All in `app/api/index/`, Node runtime, zod-validated, using a small `lib/index/db.ts` that wraps `@neondatabase/serverless`. Server code only; `DATABASE_URL` never reaches the browser.

| Route | Does | Response |
| --- | --- | --- |
| `POST /api/index/submit` | Validates, rate-limits, resolves the complex, upserts the submission and its fees in one transaction | `201 { complex: slug }`, `400` bad body, `429` over limit |
| `GET /api/index/complex?name=…&url=…` | Resolves the name like submit does (without creating), returns the aggregate for that complex | `200 IndexSummary`, or `200 { found: false }` |
| `GET /api/index` | Every visible complex with report counts and its median one-time and monthly fees, for the index page | `200 { complexes: IndexRow[] }` |

GET responses set `Cache-Control: s-maxage=60, stale-while-revalidate=300` so Vercel's CDN absorbs repeat reads.

Aggregate, per complex, grouped by `category`, `frequency` and (for `other` only) `name_key`:

```sql
select category, frequency, min(name) as name,
       count(distinct submission_id) as reports,
       percentile_cont(0.5) within group (order by amount) as median,
       min(amount) as low, max(amount) as high,
       bool_or(source = 'seed') as includes_seed,
       max(s.updated_at) as last_seen
from reported_fees f join submissions s on s.id = f.submission_id
where s.complex_id = $1
group by category, frequency, case when category = 'other' then name_key end;
```

New shared types go in `lib/types.ts` in their own commit:

```ts
export interface IndexFee {
  category: FeeCategory;
  frequency: Frequency | null;
  name: string;          // shown only for "other" when 2+ reports agree; else the category label
  reports: number;
  median: number;
  low: number;
  high: number;
}
export interface IndexSummary {
  found: true;
  complex: { slug: string; name: string; verified: boolean };
  reports: number;       // submissions, seed included
  medianAdvertised: number | null;
  fees: IndexFee[];
  lastSeen: string;      // ISO date
}
```

## How the UI shows it

In priority order; the cut line is in the task list.

1. **Compare column panel (P1, Andy).** Under each apartment's breakdown in `components/compare/apartment-column.tsx`, a "Fee index" section fetched with `GET /api/index/complex`. It leads with fees others reported that this apartment does not have, matched by category and frequency: "Not on your list: Utility service fee, $62/month, reported 3 times". Then a one-line summary: "Based on 5 reports, last seen Oct 24". Loading is a skeleton, not found is "No one has shared fees for this complex yet", an error hides the panel. These are hints only: they never change the totals, because the PRD says only reviewed fees count and money math lives in `lib/cost.ts`.
2. **Review hint (P1, Sam).** On Review, the same "Not on your list" fees with an **Add** button that inserts the fee with `source: "estimate"`, `quote: null`. This puts the index into the totals only when the student chooses to.
3. **Opt-in checkbox (P0 for the feature, Sam).** Next to "Looks right", with the wording in the privacy section and a link to a short explanation.
4. **Index page `/index` (Stretch, either).** A table of complexes with report counts and median monthly and one-time fees, sortable, linked from the header. Good for the demo if time allows.

Accessibility rules from `CLAUDE.md` apply: the panel is a labelled `section`, report counts are text (not only bars), the checkbox has a real `<Label>`, theme tokens only.

## Abuse and spam guarding

Proportionate to a weekend demo, all in the submit route:

- **Shape limits (zod):** at most 30 fees; amounts 0 to 10,000; names 1 to 80 characters with control characters stripped; enums from `lib/types.ts`; complex name 1 to 120 characters.
- **Rate limit:** at most 10 submissions per `client_hash` per day, counted with one query on `submissions`. Over the limit returns 429 and the client ignores it.
- **One vote per device per complex per day:** a second submission from the same `client_hash` for the same complex on the same day replaces the first.
- **Same-origin only:** reject requests whose `Origin` header is not the app's own host (the extension does not call this route; Review does).
- **Robust stats:** medians, not means, so one fake $9,000 fee does not move the number; low and high are shown, so outliers are visible.
- **Display gate:** unverified complexes and free-text `other` names appear only with 2 or more distinct reporters, so a single troll cannot publish text.
- **Cleanup:** delete rows by hand in the Neon SQL editor; `on delete cascade` removes their fees.

No captcha or accounts; they would cost more time and privacy than they save this weekend.

## Seeding with the 8 eval cases

`scripts/seed-index.ts` (run with `node --experimental-strip-types`, like `eval/run.ts`) reads each `eval/cases/<slug>/case.json` and `expected.json` and inserts:

- one verified `complexes` row per case: slug is the folder name, name and `listing_url` from `case.json`, plus hand-written aliases;
- one `submissions` row with `source = 'seed'`, a fixed UUID derived from the slug (so re-running is idempotent), advertised rent = the low end of `advertisedPrice` with its basis, and utilities where given;
- one `reported_fees` row per expected fee: 33 fees across the 8 cases (Brexx 11, Foxridge 7, Fourteen35, Hub and Tee Street 3 each, the others 2). `null` frequency or basis stays null. Foxridge's fee with an `amountRange` of 400 to 1500 uses the low end and keeps its name, so the panel can say "from $400".

The UI says "includes data checked by the True Cost team on Oct 24" when `includes_seed` is true, so seeded and student data are never confused.

## Ownership

Per `CLAUDE.md`, extraction and Review are Sam's and Compare is Andy's. The index's data layer sits on Sam's side because the write starts on Review.

| Path | Owner |
| --- | --- |
| `lib/index/` (db client, schema, `complexKey`, aggregate query, tests) | Sam |
| `app/api/index/` (all three routes) | Sam |
| `scripts/seed-index.ts` | Sam |
| Review checkbox, submit call and "Not on your list" hint | Sam |
| `components/compare/index-panel.tsx` and its place in `apartment-column.tsx` | Andy |
| `/index` page (stretch) | Whoever finishes first; say so in chat |
| Shared: `IndexSummary`/`IndexFee` in `lib/types.ts`, `shareToIndex` in `lib/store.ts`, `@neondatabase/serverless` in `package.json`, PRD privacy wording | Sam lands each in its own small commit and tells Andy |

Andy can build the panel against a mocked `IndexSummary` before the route exists, as long as the types land first.

## Task breakdown

It is about 4 PM Saturday. `CLAUDE.md` freezes features at **8:30 PM Saturday** (fixes and polish only after), with submission at 12:30 PM Sunday. That leaves roughly 4.5 hours, shared with the P0/P1 work already planned, so the index is scoped as a small add-on with a hard cut line.

| # | Task | Owner | Size | Depends on |
| --- | --- | --- | --- | --- |
| 0 | Accounts and env vars (next section) | sam by hand | 15 min | none |
| 1 | Shared commit: types, `shareToIndex` in store, Neon package | Sam | 15 min | none |
| 2 | `lib/index/`: db client, `schema.sql`, `complexKey` with tests | Sam | 45 min | 0 |
| 3 | Seed script; run it against the database | Sam | 30 min | 2 |
| 4 | `POST /api/index/submit` with limits | Sam | 45 min | 2 |
| 5 | `GET /api/index/complex` with the aggregate query | Sam | 30 min | 2, 3 |
| 6 | Review: opt-in checkbox and submit on "Looks right" | Sam | 20 min | 1, 4 |
| 7 | Compare panel (mock first, then live) | Andy | 60 min | 1, then 5 |
| 8 | PRD and landing privacy wording; README section | Sam | 15 min | decision above |
| — | **Cut line: below here only if 0 to 8 are merged by 8:30 PM** | | | |
| 9 | Review "Not on your list" hint with Add | Sam | 40 min | 5 |
| 10 | `GET /api/index` and the `/index` page | either | 60 min | 5 |

Sam's critical path (tasks 1 to 6 and 8) is about 3.5 hours. If it is not on main by 8:30 PM, ship the read-only version instead: seed data plus the Compare panel (tasks 0, 1, 2, 3, 5, 7), with no student writes and no privacy change.

Every task follows the `CLAUDE.md` git flow: own branch, `npm run lint && npm test && npm run build`, rebase, fast-forward onto main.

## What sam does by hand

1. **Create the database.** Vercel dashboard → the `true-cost` project → Storage → Create Database → Neon (Postgres) → free plan, region `us-east-1` (Washington, D.C., closest to the functions) → connect to all environments (Production, Preview, Development). This adds `DATABASE_URL` (and related `POSTGRES_*` variables) to the project. If it asks to create a Neon account, accept the Vercel-managed option.
2. **Add the salt.** In the same project's Environment Variables, add `INDEX_SALT` = any long random string, for all environments.
3. **Get the vars locally.** Back up `.env.local` first, then run `vercel env pull .env.local` from the repo (with the CLI from the scratchpad install, as before). Check `GEMINI_API_KEY` is still in the file.
4. **Share with Andy.** Hobby projects cannot add team members, so send Andy `DATABASE_URL` and `INDEX_SALT` privately (not in the repo or a public channel) for his `.env.local`. Alternatively Andy builds against the mocked summary and never needs them.
5. **Create the tables** once: paste `lib/index/schema.sql` into the Neon SQL editor (Vercel dashboard → Storage → the database → Open in Neon), or run the script task 2 adds.
6. **Seed** once: run the seed script from task 3 locally.
7. **Redeploy** after the env vars exist, so production picks them up (deploys still need sam's OK, and the Hobby commit-author rule still applies).
8. **Decide** the privacy wording and default (top of this doc).

`.env.example` gains `DATABASE_URL=` and `INDEX_SALT=` lines with no values.
