// Sorting the catalog for students choosing housing (F21). Owner: Andy (B).
// Prices are per person for the current Setup, from lib/cost.ts; distance is a
// straight line to the Drillfield from coordinates looked up once by
// scripts/geocode-catalog.ts. Entries missing the value a sort needs go last;
// whole-unit prices with unknown bedrooms go after the prices we're sure of.
import { summarize } from "../cost";
import type { Setup } from "../types";
import { bedroomsFromText } from "./bedrooms";
import bedrooms from "./bedrooms.json";
import type { CatalogEntry } from "./convert";
import locations from "./locations.json";

export { bedroomsFromText };

export type SortKey =
  | "recommended"
  | "true-asc"
  | "true-desc"
  | "price-asc"
  | "price-desc"
  | "distance"
  | "hidden-asc";

export const SORT_LABELS: Record<SortKey, string> = {
  recommended: "Recommended",
  "true-asc": "True cost: low to high",
  "true-desc": "True cost: high to low",
  "price-asc": "Advertised price: low to high",
  "price-desc": "Advertised price: high to low",
  distance: "Closest to campus",
  "hidden-asc": "Fewest hidden fees",
};

interface Point {
  lat: number;
  lng: number;
}

// The Drillfield, the middle of Virginia Tech's campus.
export const CAMPUS: Point = { lat: 37.2284, lng: -80.4234 };

export function distanceMiles(a: Point, b: Point): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 3958.8 * Math.asin(Math.sqrt(h));
}

const LOCATIONS = locations as Record<string, Point & { address: string }>;

export function milesToCampus(entryId: string): number | null {
  const loc = LOCATIONS[entryId];
  return loc ? distanceMiles(CAMPUS, loc) : null;
}

const BEDROOMS = bedrooms as Record<string, number>;

// How many people a listing's price is split between. A whole-unit price is
// never split more ways than the unit has bedrooms; when we don't know the
// bedrooms, it's split by the roommate count and the card says so.
export function sharersFor(e: CatalogEntry, setup: Setup): { people: number; bedroomsKnown: boolean } {
  if (e.apartment.advertised.basis !== "per_unit") return { people: setup.people, bedroomsKnown: true };
  const beds = BEDROOMS[e.id] ?? bedroomsFromText(e.name);
  return beds
    ? { people: Math.min(setup.people, beds), bedroomsKnown: true }
    : { people: setup.people, bedroomsKnown: false };
}

// summarize() with the split above, for catalog cards and sorting.
export function catalogSummary(e: CatalogEntry, setup: Setup) {
  return summarize(e.apartment, { ...setup, people: sharersFor(e, setup).people });
}

const listingFees = (e: CatalogEntry) => e.apartment.fees.filter((f) => f.source !== "estimate").length;

// The number a sort orders by, or null when the entry doesn't have it.
function valueFor(e: CatalogEntry, key: SortKey, setup: Setup): number | null {
  if (key === "distance") return milesToCampus(e.id);
  if (e.apartment.advertised.amount <= 0) return null; // price unknown
  const s = catalogSummary(e, setup);
  if (key === "price-asc" || key === "price-desc") return s.advertisedMonthly;
  if (key === "true-asc" || key === "true-desc") return s.trueMonthly;
  // No fees found isn't the same as no hidden fees, so those go last.
  if (key === "hidden-asc") return listingFees(e) > 0 ? s.hiddenPerYear : null;
  return 0;
}

export function sortCatalog(entries: CatalogEntry[], key: SortKey, setup: Setup): CatalogEntry[] {
  if (key === "recommended") return [...entries];
  const sign = key.endsWith("-desc") ? -1 : 1;
  const byPrice = key !== "distance" && key !== "hidden-asc";
  // Tier 0: a value we're sure of. Tier 1: a whole-unit price split by the
  // roommate count because bedrooms are unknown. Tier 2: no value at all.
  const tier = (entry: CatalogEntry, value: number | null) =>
    value == null ? 2 : byPrice && !sharersFor(entry, setup).bedroomsKnown ? 1 : 0;
  return entries
    .map((entry, index) => {
      const value = valueFor(entry, key, setup);
      return { entry, index, value, tier: tier(entry, value) };
    })
    .sort(
      (a, b) =>
        a.tier - b.tier ||
        (a.value != null && b.value != null ? sign * (a.value - b.value) : 0) ||
        a.index - b.index,
    )
    .map((x) => x.entry);
}
