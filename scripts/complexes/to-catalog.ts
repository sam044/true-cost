// Builds lib/catalog/auto.json (the auto-scanned catalog entries) and
// data/complexes/coverage.json from the raw and scanned files. Owner: Sam (A).
//
//   node --experimental-strip-types scripts/complexes/to-catalog.ts
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { register } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { RawComplex, ScannedComplex } from "./types";

register("../../eval/loader.mjs", import.meta.url);
const { scannedToEntry } = await import("./convert");

const dir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "data",
  "complexes",
);
const readJson = <T>(file: string) =>
  JSON.parse(readFileSync(file, "utf8")) as T;

const raws = readdirSync(path.join(dir, "raw"))
  .filter((f) => f.endsWith(".json"))
  .map((f) => readJson<RawComplex>(path.join(dir, "raw", f)))
  .sort((a, b) => a.slug.localeCompare(b.slug));

const rows = raws.map((raw) => {
  const file = path.join(dir, "scanned", `${raw.slug}.json`);
  const scanned =
    raw.status === "fetched" && !raw.notComplex && existsSync(file)
      ? readJson<ScannedComplex>(file)
      : null;
  const entry = scanned ? scannedToEntry(scanned) : null;
  return { raw, scanned, entry };
});

const entries = rows.flatMap((r) => (r.entry ? [r.entry] : []));
writeFileSync(
  path.join(dir, "..", "..", "lib", "catalog", "auto.json"),
  `${JSON.stringify(entries, null, 2)}\n`,
);

const coverage = rows.map(({ raw, scanned, entry }) => ({
  slug: raw.slug,
  name: raw.name,
  fetch: raw.status,
  notComplex: raw.notComplex ?? false,
  sourceUrl: raw.sourceUrl,
  scan: !scanned ? null : scanned.error ? `failed: ${scanned.error}` : "ok",
  fees: entry?.apartment.fees.length ?? null,
  lowConfidence:
    entry?.apartment.fees.filter((f) => f.confidence === "low").length ?? null,
  price: entry ? entry.priceRange : null,
  inCatalog: Boolean(entry),
}));
writeFileSync(
  path.join(dir, "coverage.json"),
  `${JSON.stringify(coverage, null, 2)}\n`,
);

const count = (fetch: string) => raws.filter((r) => r.status === fetch).length;
console.log(
  `${raws.length} complexes: ${count("fetched")} fetched, ${count("blocked")} blocked, ${count("no_fees_found")} no fees on page, ${count("not_found")} not found`,
);
console.log(
  `${entries.length} catalog entries, ${entries.reduce((n, e) => n + e.apartment.fees.length, 0)} fees`,
);
