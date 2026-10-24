// Catalog of pre-scanned Blacksburg complexes (F21). Owner: Sam (A).
// The app reads the catalog only through getCatalog(), which returns the static
// seed today (built from eval/cases/ by scripts/build-catalog.ts) and can merge
// fee index (F20) data later without changing the UI. Never writes to the index.
import type { Apartment } from "../types";
import { withUtilityEstimates } from "../utilities";
import type { CatalogEntry } from "./convert";
import seed from "./seed.json";

export type { CatalogEntry } from "./convert";

const entries: CatalogEntry[] = (seed as CatalogEntry[]).map((entry) => ({
  ...entry,
  // Utilities a listing says aren't included get Blacksburg estimate rows, the
  // same as an extracted apartment would.
  apartment: withUtilityEstimates(entry.apartment),
}));

export function getCatalog(): CatalogEntry[] {
  return entries;
}

// Store ids for catalog apartments are "catalog-<entry id>--<random>", so adding
// the same complex again never collides and the card can tell it was added.
const PREFIX = "catalog-";
const SEPARATOR = "--";

export function catalogIdOf(apartmentId: string): string | null {
  if (!apartmentId.startsWith(PREFIX)) return null;
  const rest = apartmentId.slice(PREFIX.length);
  const end = rest.indexOf(SEPARATOR);
  return end > 0 ? rest.slice(0, end) : null;
}

// A fresh copy of the entry's apartment, ready for the store.
export function catalogApartment(entry: CatalogEntry): Apartment {
  return {
    ...structuredClone(entry.apartment),
    id: `${PREFIX}${entry.id}${SEPARATOR}${crypto.randomUUID()}`,
  };
}

// Fees the listing shows, not counting utility estimates.
export function listingFeeCount(entry: CatalogEntry): number {
  return entry.apartment.fees.filter((f) => f.source !== "estimate").length;
}
