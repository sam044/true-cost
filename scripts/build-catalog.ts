// Rebuilds lib/catalog/seed.json from the hand-labelled eval cases (F21).
// Owner: Sam (A). Run after changing anything in eval/cases/:
//
//   node --experimental-strip-types scripts/build-catalog.ts
//
// The seed is committed; lib/catalog/seed.test.ts fails if it is out of date.
import { writeFileSync } from "node:fs";
import { register } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Same resolve hook as the eval, so lib/ loads without a bundler.
register("../eval/loader.mjs", import.meta.url);
const { entriesFromCases } = await import("../lib/catalog/cases");

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const entries = entriesFromCases(path.join(root, "eval", "cases"));
const out = path.join(root, "lib", "catalog", "seed.json");
writeFileSync(out, `${JSON.stringify(entries, null, 2)}\n`);

for (const e of entries) {
  const missing = e.apartment.fees.filter((f) => f.quote === null).length;
  console.log(
    `${e.id}: ${e.apartment.fees.length} fees${missing ? `, ${missing} without a quote` : ""}`,
  );
}
console.log(`Wrote ${entries.length} complexes to ${path.relative(root, out)}`);
