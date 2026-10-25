// Builds lib/catalog/offcampus.json from data/complexes/offcampus/listings.json,
// the Blacksburg listings read from offcampus.vt.edu (see
// data/complexes/README.md). Owner: Sam (A).
//
//   node --experimental-strip-types scripts/complexes/offcampus.ts
import { readFileSync, writeFileSync } from "node:fs";
import { register } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CatalogEntry } from "../../lib/catalog/convert";
import type { OffcampusListing } from "./offcampus-convert";

register("../../eval/loader.mjs", import.meta.url);
const { checkPrices, offcampusToEntry, slugFor } = await import("./offcampus-convert");

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const readJson = <T>(file: string) => JSON.parse(readFileSync(path.join(root, file), "utf8")) as T;

const READ_ON = "2026-10-24";

// Listings that are already hand-checked complexes in seed.json.
const IN_SEED = new Set(["sbs6q75", "2wpj609", "edgcljq", "2hm6lvb", "fvqsq5t", "1nbe6l6", "z0frqbz", "ocpc2t2l1g"]);

// Listings for complexes already in auto.json (or tried in data/complexes/raw/):
// they keep that slug, and this richer entry replaces the auto-scanned one.
const SAME_AS: Record<string, string> = {
  "7pgnn3w": "tech-terrace",
  qyk0y5w: "reserve-at-knollwood",
  esvspwq: "vue",
  gfhtn2z: "highlands-at-huckleberry-ridge",
  "6vc9lrv": "summit-at-uptown",
  "1gptl24": "windsor-hills",
  v9cvgxg: "collegiate-court",
  mpzbe4k: "park-37",
  h6k7c71: "cedar-pointe",
  egltlfm: "the-mill",
  nn4efep: "shawnee",
  qtfq7sy: "chasewood-downs",
  bv6cxqb: "stonegate-carlton-scott",
  "6y68vyt": "old-row-on-north-main",
  d0d2e8j: "1711-apartments",
  c2yfr9e: "uptown-village",
  t6hcf29: "cedarfield",
  eqb2jwp: "smiths-landing",
  c93z2yf: "union-blacksburg",
  ocplytfq7g: "roanoke-street-apartments",
  ocpvr57e4g: "sundance-ridge",
};

const listings = readJson<OffcampusListing[]>("data/complexes/offcampus/listings.json");
const seedIds = new Set(readJson<CatalogEntry[]>("lib/catalog/seed.json").map((e) => e.id));
const autoIds = new Set(readJson<CatalogEntry[]>("lib/catalog/auto.json").map((e) => e.id));

const taken = new Set(seedIds);
const skipped: string[] = [];
const entries: CatalogEntry[] = [];
for (const listing of listings) {
  if (IN_SEED.has(listing.id)) continue;
  let id = SAME_AS[listing.id] ?? slugFor(listing);
  if (!SAME_AS[listing.id]) {
    for (let n = 2; taken.has(id) || autoIds.has(id); n++) id = `${slugFor(listing)}-${n}`;
  }
  const entry = offcampusToEntry(listing, id, READ_ON);
  if (!entry) {
    const prices = checkPrices(listing);
    skipped.push("problem" in prices ? `${listing.name} (${prices.problem})` : listing.name);
    continue;
  }
  taken.add(id);
  entries.push(entry);
}

// Apartment communities first (the auto-scanned ones from other sites follow
// them in getCatalog()), then single houses, townhouses and condos.
const isCommunity = (e: CatalogEntry) =>
  listings.find((l) => e.url.endsWith(l.path))?.type === "Apartment Community";
entries.sort((a, b) => Number(isCommunity(b)) - Number(isCommunity(a)) || a.name.localeCompare(b.name));

writeFileSync(path.join(root, "lib", "catalog", "offcampus.json"), `${JSON.stringify(entries, null, 2)}\n`);
const replaced = entries.filter((e) => autoIds.has(e.id)).length;
console.log(
  `${listings.length} listings: ${entries.length} catalog entries (${entries.filter(isCommunity).length} apartment communities, ${replaced} replace an auto-scanned entry), ${IN_SEED.size} already hand-checked, ${skipped.length} skipped`,
);
if (skipped.length) console.log(`Skipped: ${skipped.join("; ")}`);
