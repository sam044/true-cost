-- Blacksburg fee index (F20). Owner: Andy (B). Safe to run more than once:
-- scripts/seed-index.ts applies it before seeding. Only human-checked fees are
-- stored, never images, quotes or anything that identifies a student.

create table if not exists complexes (
  id serial primary key,
  slug text unique not null,               -- "brexx", "hub", "2001-christopher-drive"
  name text not null,                      -- "Brexx at Blacksburg"
  aliases text[] not null default '{}',    -- other normalized names that map here
  listing_url text,
  verified boolean not null default false, -- true for seeded complexes
  created_at timestamptz not null default now()
);

create table if not exists submissions (
  id uuid primary key,                     -- the apartment id; re-confirming replaces
  complex_id int not null references complexes(id),
  source text not null check (source in ('user', 'seed')),
  advertised numeric(8,2),
  advertised_basis text check (advertised_basis in ('per_person', 'per_unit')),
  utilities jsonb,
  client_hash text,                        -- null for seed rows
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists submissions_complex_idx on submissions (complex_id);
create index if not exists submissions_client_idx on submissions (client_hash, created_at);

create table if not exists reported_fees (
  id bigserial primary key,
  submission_id uuid not null references submissions(id) on delete cascade,
  category text not null,
  name text not null,                      -- trimmed, max 80 chars
  name_key text not null,                  -- normalized, groups "other" fees
  amount numeric(8,2) not null,
  frequency text,                          -- null when unknown (seed rows)
  basis text,
  mandatory text not null,
  refundable boolean not null default false
);

create index if not exists reported_fees_submission_idx on reported_fees (submission_id);
