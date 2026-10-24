// Creates the fee index tables (if missing) and loads the 8 hand-labelled eval
// cases as verified seed data (F20). Owner: Andy (B). Safe to re-run: each
// complex is upserted and its seed submission replaced.
//
//   node --env-file=.env.local --experimental-strip-types scripts/seed-index.ts
import { readFileSync } from "node:fs";
import { register } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";

// Same resolve hook as the eval, so lib/ loads without a bundler.
register("../eval/loader.mjs", import.meta.url);
const { seedRecords } = await import("../lib/index/seed");

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set: add it to .env.local");
const sql = neon(url);

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// The HTTP driver runs one statement per call.
const schema = readFileSync(path.join(root, "lib", "index", "schema.sql"), "utf8")
  .replace(/--.*$/gm, "")
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);
for (const statement of schema) await sql.query(statement);
console.log(`Schema ready (${schema.length} statements)`);

let fees = 0;
for (const r of seedRecords(path.join(root, "eval", "cases"))) {
  const [{ id }] = (await sql.query(
    `insert into complexes (slug, name, aliases, listing_url, verified)
     values ($1, $2, $3, $4, true)
     on conflict (slug) do update
       set name = excluded.name, aliases = excluded.aliases,
           listing_url = excluded.listing_url, verified = true
     returning id`,
    [r.complex.slug, r.complex.name, r.complex.aliases, r.complex.listingUrl],
  )) as { id: number }[];

  await sql.query(`delete from submissions where id = $1`, [r.submission.id]);
  await sql.query(
    `insert into submissions (id, complex_id, source, advertised, advertised_basis, utilities)
     values ($1, $2, 'seed', $3, $4, $5)`,
    [r.submission.id, id, r.submission.advertised, r.submission.basis, r.submission.utilities],
  );
  for (const f of r.fees) {
    await sql.query(
      `insert into reported_fees
         (submission_id, category, name, name_key, amount, frequency, basis, mandatory, refundable)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [r.submission.id, f.category, f.name, f.nameKey, f.amount, f.frequency, f.basis, f.mandatory, f.refundable],
    );
  }
  fees += r.fees.length;
  console.log(`${r.complex.slug}: ${r.fees.length} fees`);
}
console.log(`Seeded ${fees} fees`);
