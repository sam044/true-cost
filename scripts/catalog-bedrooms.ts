// Saves bedroom counts for whole-unit catalog listings to
// lib/catalog/bedrooms.json, from the listing name, the VT Off-Campus "beds"
// field and the auto-scan extraction. Owner: Andy (B).
//
//   node --experimental-strip-types scripts/catalog-bedrooms.ts
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { register } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

register("../eval/loader.mjs", import.meta.url);
const { bedroomsFromText } = await import("../lib/catalog/bedrooms");

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => JSON.parse(readFileSync(path.join(root, p), "utf8"));

interface Entry { id: string; name: string; url: string; apartment: { advertised: { basis: string } } }
const entries: Entry[] = [
  ...read("lib/catalog/seed.json"),
  ...read("lib/catalog/auto.json"),
  ...read("lib/catalog/offcampus.json"),
];
const listings = new Map<string, string>(
  (read("data/complexes/offcampus/listings.json") as { id: string; beds?: string }[])
    .filter((l) => l.beds)
    .map((l) => [l.id, l.beds!]),
);
const scanned = new Map<string, number>();
for (const f of readdirSync(path.join(root, "data/complexes/scanned"))) {
  const d = read(`data/complexes/scanned/${f}`);
  if (d.extraction?.bedrooms) scanned.set(d.slug, d.extraction.bedrooms);
}

const out: Record<string, number> = {};
let unknown = 0;
for (const e of entries) {
  if (e.apartment.advertised.basis !== "per_unit" || out[e.id]) continue;
  const urlId = e.url.split("/").filter(Boolean).pop() ?? "";
  const beds =
    bedroomsFromText(e.name) ??
    (listings.has(urlId) ? bedroomsFromText(listings.get(urlId)!) : null) ??
    scanned.get(e.id) ??
    null;
  if (beds) out[e.id] = beds;
  else unknown++;
}
const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(path.join(root, "lib/catalog/bedrooms.json"), `${JSON.stringify(sorted, null, 2)}\n`);
console.log(`Bedrooms known for ${Object.keys(out).length} whole-unit listings; unknown for ${unknown}`);
