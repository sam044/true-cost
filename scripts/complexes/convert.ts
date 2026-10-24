// Turns one scanned complex into a catalog entry. Owner: Sam (A). Pure, so
// to-catalog.ts and the Vitest test share it.
//
// Differences from the hand-labelled seed: reviewed is false and autoScanned is
// true, because no person has checked these fees, and fee confidence is the
// model's own rather than "high".
import { defaultCounted } from "../../lib/cost";
import type { Fee } from "../../lib/types";
import type { CatalogEntry } from "../../lib/catalog/convert";
import type { ScannedComplex } from "./types";

const NO_NEEDS = { people: 1, leaseMonths: 12 };

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// "$1,069 - $1,399" gives 1069 to 1399; a single price gives min = max.
export function priceRangeFrom(
  quote: string | null,
  amount: number,
): { min: number; max: number } {
  const amounts = Array.from(
    (quote ?? "").matchAll(/\$\s?(\d[\d,]*(?:\.\d+)?)/g),
    (m) => Number(m[1].replace(/,/g, "")),
  ).filter((n) => n > 0);
  if (amounts.length < 2 || !amounts.includes(amount))
    return { min: amount, max: amount };
  return { min: Math.min(...amounts), max: Math.max(...amounts) };
}

// Null when there is nothing worth showing: a failed scan or no advertised price
// (Compare needs a rent to start from).
export function scannedToEntry(s: ScannedComplex): CatalogEntry | null {
  const x = s.extraction;
  if (!x || !s.sourceUrl) return null;
  const price = x.advertisedPrice.amount ?? 0;
  if (price === 0) return null;

  const used = new Set<string>();
  const fees: Fee[] = x.fees
    // A $0 "fee" is the model reading a policy line with no charge.
    .filter((f) => f.category !== "base_rent" && f.amount > 0)
    .map((f) => {
      let id = `${s.slug}-${slug(f.name)}`;
      for (let n = 2; used.has(id); n++) id = `${s.slug}-${slug(f.name)}-${n}`;
      used.add(id);
      const fee: Fee = {
        id,
        name: f.name,
        category: f.category,
        amount: f.amount,
        frequency: f.frequency,
        basis: f.basis,
        mandatory: f.mandatory,
        counted: true,
        refundable: f.refundable,
        quote: f.quote,
        source: "ai",
        confidence: f.confidence,
      };
      return { ...fee, counted: defaultCounted(fee, NO_NEEDS) };
    });

  return {
    id: s.slug,
    name: s.name,
    url: s.sourceUrl,
    site: s.site,
    readOn: s.fetchedOn,
    priceRange: {
      ...priceRangeFrom(x.advertisedPrice.quote, price),
      basis: x.advertisedPrice.basis,
    },
    autoScanned: true,
    apartment: {
      id: `catalog-${s.slug}`,
      name: s.name,
      advertised: {
        amount: price,
        basis: x.advertisedPrice.basis,
        quote: x.advertisedPrice.quote,
      },
      utilities: x.utilities,
      fees,
      reviewed: false,
    },
  };
}
