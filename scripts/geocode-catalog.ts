// Looks up each catalog complex's address once and saves its coordinates to
// lib/catalog/locations.json, so the catalog can sort by distance to campus
// without any API call at runtime. Owner: Andy (B). Safe to re-run: complexes
// already in the file are skipped. Uses OpenStreetMap Nominatim (free, 1
// request a second, identified by User-Agent, per its usage policy).
//
//   node --experimental-strip-types scripts/geocode-catalog.ts
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => JSON.parse(readFileSync(path.join(root, p), "utf8"));
const outFile = path.join(root, "lib", "catalog", "locations.json");

interface Entry { id: string; name: string; url: string }
interface Location { address: string; lat: number; lng: number }

const entries: Entry[] = [
  ...read("lib/catalog/seed.json"),
  ...read("lib/catalog/auto.json"),
  ...read("lib/catalog/offcampus.json"),
];

// Addresses for the 8 hand-checked complexes, from their listing text.
const SEED_ADDRESSES: Record<string, string> = {
  brexx: "1800 Redd Rd",
  "christopher-drive-house": "2001 Christopher Dr",
  "collegiate-suites": "1310 Henry Ln",
  fourteen35: "1435 Toms Creek Rd",
  foxridge: "750 Hethwood Blvd",
  hub: "1201 Snyder Ln",
  "tee-street": "203 Tee St",
  "the-edge": "321 Edge Way",
};

const offcampus = new Map<string, string>(
  (read("data/complexes/offcampus/listings.json") as { id: string; street?: string; zip?: string }[])
    .filter((l) => l.street)
    .map((l) => [l.id, `${l.street}, ${l.zip ?? ""}`]),
);
const scanned = new Map<string, string>(
  (read("data/complexes/list.json") as { slug: string; address?: string }[])
    .filter((l) => l.address)
    .map((l) => [l.slug, l.address!]),
);

function addressFor(e: Entry): string | null {
  const urlId = e.url.split("/").filter(Boolean).pop() ?? "";
  const street =
    offcampus.get(urlId) ??
    scanned.get(e.id) ??
    SEED_ADDRESSES[e.id] ??
    // "3 Bedroom House, 1477 Sandy Circle" -> "1477 Sandy Circle"
    e.name.match(/,\s*(\d[^,]*)$/)?.[1] ??
    null;
  if (!street) return null;
  return /blacksburg/i.test(street) ? `${street}, VA` : `${street}, Blacksburg, VA`;
}

async function geocode(q: string): Promise<{ lat: number; lng: number } | null> {
  const url =
    "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=" +
    encodeURIComponent(q);
  const res = await fetch(url, {
    headers: { "User-Agent": "TrueCost/0.1 (hackathon project, github.com/sam044/true-cost)" },
  });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const [hit] = (await res.json()) as { lat: string; lon: string }[];
  return hit ? { lat: Number(hit.lat), lng: Number(hit.lon) } : null;
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
const out: Record<string, Location> = existsSync(outFile) ? JSON.parse(readFileSync(outFile, "utf8")) : {};
const missing: string[] = [];

for (const e of entries) {
  if (out[e.id]) continue;
  const address = addressFor(e);
  // Fallbacks, roughest last: no unit or zip, first number of a range, the
  // street alone (its middle is close enough for "about X mi"), the name.
  const simpler = (address ?? "")
    .replace(/\s*(apt\.?|unit|ste|suite|building|#)\s*[\w-]+/gi, "")
    .replace(/\b\d{5}\b,?\s*/g, "")
    .replace(/\b(\d+)[a-z]?-\d+[a-z]?\b/gi, "$1")
    .replace(/\s+-\s+\d+/g, "")
    .replace(/\.(?=,|\s)/g, "")
    .replace(/\s*,\s*,/g, ",");
  // "Progress Street NW", "Clay Street Southeast": drop the direction.
  const noDirection = simpler.replace(
    /\s+(north|south|east|west|northeast|northwest|southeast|southwest|ne|nw|se|sw|n|s|e|w)(?=,)/gi,
    "",
  );
  const streetOnly = noDirection.replace(/^\s*\d+[a-z]?\s+/i, "");
  const plainName = e.name.replace(/\(.*?\)/g, "").split(",")[0].trim();
  const tries = [address, simpler, noDirection, streetOnly, `${plainName}, Blacksburg, VA`].filter(
    (q): q is string => Boolean(q && q.trim()),
  );
  let hit = null;
  for (const q of [...new Set(tries)]) {
    hit = await geocode(q);
    await pause(1100);
    if (hit) break;
  }
  // Blacksburg is small: anything more than 15 miles from campus is a bad match.
  if (hit && Math.abs(hit.lat - 37.2284) < 0.22 && Math.abs(hit.lng + 80.4234) < 0.27) {
    out[e.id] = { address: address ?? plainName, ...hit };
    console.log(`${e.id}: ${hit.lat.toFixed(4)}, ${hit.lng.toFixed(4)}`);
  } else {
    missing.push(`${e.id} (${address ?? "no address"})`);
  }
}

const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(outFile, `${JSON.stringify(sorted, null, 2)}\n`);
console.log(`Located ${Object.keys(out).length} of ${entries.length}; not found: ${missing.length}`);
for (const m of missing) console.log(`  ${m}`);
