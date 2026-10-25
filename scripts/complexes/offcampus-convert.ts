// Turns one offcampus.vt.edu listing (data/complexes/offcampus/listings.json)
// into a catalog entry. Owner: Sam (A). Pure, so offcampus.ts and the Vitest
// test share it. No Gemma: the site's own listing data is already structured
// (price range, per-bed or per-unit pricing, a fee table, included utilities).
//
// Like the other auto-scanned entries, reviewed is false and autoScanned is
// true: no person has checked these fees, so selecting one opens Review.
import { defaultCounted } from "../../lib/cost";
import type { Basis, Fee, FeeCategory, Frequency, Utilities } from "../../lib/types";
import type { CatalogEntry } from "../../lib/catalog/convert";

type UtilityStatus = Utilities[keyof Utilities];

// One row of the listing's "Fees and Policies" table: [group, subheading,
// label, value as shown, the site's rounded number, who it is charged per].
// Groups: R required fees, P parking, T pets, A personalized add-ons.
export type OffcampusFeeRow = [group: "R" | "P" | "T" | "A", sub: string, label: string, value: string, valueNumber: number, per: string];

export interface OffcampusListing {
  id: string; // the site's listing key, last part of the URL
  path: string; // after https://offcampus.vt.edu/housing/property/
  name: string;
  type: string; // "Apartment Community", "Single-Family Home", "Townhome", ...
  street: string;
  zip: string;
  beds: string; // "1 - 3 Beds", "Studio", "4 Beds"
  lo: number;
  hi: number;
  perBed: boolean;
  priceText: string; // the price as the listing shows it
  disc: string; // "total" when the page says the price includes monthly required fees
  util: string[]; // "Water/Sewer: Included", ...
  pmc?: string; // property manager; absent on listings posted by individuals
  updated: string;
  fees: OffcampusFeeRow[];
  // Floor plans as [bedrooms, 1 if priced per bed else 0, low, high], for
  // listings with more than one plan or any per-bed plan.
  plans?: [beds: number, perBed: 0 | 1, low: number, high: number][];
}

// The site's floor plans don't always agree with its summary price: Tech
// Terrace lists the same 4-bed unit as "$894" per bed and "$3,576" per unit,
// and some per-unit plans are plainly per-bed prices (a 3-bed for less than a
// 1-bed). Returns the per-person or per-unit range to show, or a reason the
// listing's prices can't be trusted.
export function checkPrices(
  listing: OffcampusListing,
): { min: number; max: number; basis: Basis } | { problem: string } {
  const plans = listing.plans ?? [];
  const basis: Basis = listing.perBed ? "per_person" : "per_unit";
  if (plans.length === 0) return { min: listing.lo, max: listing.hi, basis };
  if (plans.some((p) => p[1] === 1)) {
    // Bring every plan to a per-person price.
    const each = plans.flatMap(([beds, perBed, lo, hi]) =>
      perBed ? [lo, hi] : [lo / Math.max(beds, 1), hi / Math.max(beds, 1)],
    );
    const min = Math.round(Math.min(...each));
    const max = Math.round(Math.max(...each));
    if (max > 2.5 * min) return { problem: `per-bed prices run from $${min} to $${max}` };
    return { min, max, basis: "per_person" };
  }
  const byBeds = [...plans].sort((a, b) => a[0] - b[0]);
  for (const [i, more] of byBeds.entries()) {
    const fewer = byBeds.slice(0, i).find((p) => p[0] < more[0] && more[2] < 0.9 * p[2]);
    if (fewer) return { problem: `a ${more[0]}-bed unit ($${more[2]}) costs less than a ${fewer[0]}-bed ($${fewer[2]})` };
  }
  return { min: listing.lo, max: listing.hi, basis };
}

const NO_NEEDS = { people: 1, leaseMonths: 12 };
export const OFFCAMPUS_SITE = "VT Off-Campus Housing (offcampus.vt.edu)";

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// "$1.50 / mo" gives 1.5; "$958 - $3,832 one-time" gives the low end, 958.
function amountOf(value: string): number {
  const m = value.match(/\$\s?(\d[\d,]*(?:\.\d+)?)/);
  return m ? Number(m[1].replace(/,/g, "")) : 0;
}

// Order matters: "Utility - Billing Administrative Fee" is a utility charge,
// not an admin fee, and "Pet Deposit" is a pet charge, not a security deposit.
const CATEGORY_RULES: [RegExp, FeeCategory][] = [
  [/applica/i, "application"],
  [/insurance|liability|master policy/i, "insurance"],
  [/utilit|electric|water|sewer|\bgas\b|\baep\b|atmos|power|conservice/i, "utility_fee"],
  [/internet|wi-?fi|cable|verizon|directv|directtv|glofiber/i, "internet"],
  [/trash|refuse|waste|recycl/i, "trash"],
  [/recondition|cleaning/i, "reconditioning"],
  [/amenity/i, "amenity"],
  [/pest/i, "pest"],
  [/deposit/i, "security_deposit"],
  [/admin|membership/i, "admin"],
  [/parking|garage/i, "parking"],
];

export function categoryOf(group: OffcampusFeeRow[0], label: string): FeeCategory {
  if (group === "T" || /\bpet|\bdog|\bcat\b/i.test(label)) return "pet";
  if (group === "P") return "parking";
  return CATEGORY_RULES.find(([re]) => re.test(label))?.[1] ?? "other";
}

const UTILITY_NAMES: [RegExp, keyof Utilities][] = [
  [/electric|\baep\b|appalachian power/i, "electric"],
  [/water|sewer/i, "water"],
  [/\bgas\b|atmos/i, "gas"],
  [/internet|wi-?fi/i, "internet"],
  [/trash|refuse/i, "trash"],
];

// "Included" wins over "usage-based": a utility the listing says is in the rent
// gets no estimate; one it bills by usage gets the Blacksburg estimate. A
// utility charged as a flat fee stays "unknown" so the fee isn't doubled.
export function utilitiesOf(listing: OffcampusListing): Utilities {
  const out: Utilities = { electric: "unknown", water: "unknown", gas: "unknown", internet: "unknown", trash: "unknown" };
  const set = (text: string, status: UtilityStatus) => {
    for (const [re, key] of UTILITY_NAMES) {
      if (!re.test(text)) continue;
      if (status === "included" || out[key] === "unknown") out[key] = status;
    }
  };
  for (const u of listing.util) if (/included/i.test(u)) set(u, "included");
  for (const [, , label, value] of listing.fees) {
    if (/included/i.test(value)) set(label, "included");
    else if (/usage/i.test(value)) set(label, "not_included");
  }
  return out;
}

const BEDS = /\bbed(room)?s?\b|\bbath|\bBR\b/i;

function kindOf(listing: OffcampusListing): string {
  if (/town ?(house|home)/i.test(listing.name) || listing.type === "Townhome") return "Townhouse";
  if (/condo/i.test(listing.name) || /condo/i.test(listing.type)) return "Condo";
  if (/duplex/i.test(listing.name) || listing.type === "Duplex") return "Duplex";
  if (/apartment/i.test(listing.name) || /apartment/i.test(listing.type)) return "Apartment";
  return "House";
}

// Apartment communities keep their own name. Single units ("3 Bedroom, 2 Bath
// Townhouse", "2714 Quincy Ct") get one in the seed's style, "4 Bedroom
// House, 2001 Christopher Drive", so a list of them can be told apart.
export function displayName(listing: OffcampusListing): string {
  const street = listing.street.trim().replace(/\s+/g, " ");
  const community = listing.type === "Apartment Community";
  if (community && !BEDS.test(listing.name)) {
    const name = listing.name.trim().replace(/\s+/g, " ");
    return name.length > 40 ? name.split(/\s+-\s+|!/)[0].trim() : name;
  }
  const beds = /studio/i.test(listing.beds) ? "Studio" : listing.beds.replace(/\s*Beds?$/i, " Bedroom");
  return `${beds} ${kindOf(listing)}, ${street}`;
}

// Listings posted by individuals (sublets, rooms) have no property manager and
// aren't a place a student can lease from; "Rent TBD" prices aren't final.
export function isCatalogListing(listing: OffcampusListing): boolean {
  if (!listing.pmc || !listing.street.trim()) return false;
  if (/sublet|sublease|\broom\b|rent tbd/i.test(listing.name)) return false;
  return listing.lo > 0;
}

// Null when the listing has no priced fee: the catalog only takes listings
// whose price and fee table were both read.
export function offcampusToEntry(listing: OffcampusListing, id: string, readOn: string): CatalogEntry | null {
  if (!isCatalogListing(listing)) return null;
  const prices = checkPrices(listing);
  if ("problem" in prices) return null;
  const basis = prices.basis;
  // The site's price "includes monthly required fees" unless the price it
  // shows is higher than the floor plans' rent (then the rent is base rent).
  const shownLow = amountOf(listing.priceText);
  const included = listing.disc === "total" && shownLow <= listing.lo;

  const seen = new Set<string>();
  const used = new Set<string>();
  const fees: Fee[] = [];
  for (const [group, sub, label, value, , per] of listing.fees) {
    const amount = amountOf(value);
    if (amount <= 0) continue;
    // Some rows leave off "/ mo": "Monthly Pet Fee $25", "Pet Rent $25", and
    // parking, which is a monthly charge unless the row says one-time.
    const frequency: Frequency =
      /\/\s*mo/i.test(value) || /monthly|\brent\b/i.test(label) || (group === "P" && !/one-time/i.test(value))
        ? "monthly"
        : "one_time";
    // Dogs and cats often list the same fee twice.
    const key = `${label.toLowerCase()}|${amount}|${frequency}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const category = categoryOf(group, label);
    // A bare "Other" says nothing; its table heading says when it is due.
    const name = label.trim() === "Other" && sub ? `Other (${sub})` : label.trim();
    let feeId = `${id}-${slug(name)}`;
    for (let n = 2; used.has(feeId); n++) feeId = `${id}-${slug(name)}-${n}`;
    used.add(feeId);
    const feeBasis: Basis =
      /applicant|resident|person|bed/i.test(per) || category === "application"
        ? "per_person"
        : /unit/i.test(per)
          ? "per_unit"
          : basis;
    const mandatory = group === "R" ? "yes" : "no";
    const fee: Fee = {
      id: feeId,
      name,
      category,
      amount,
      frequency,
      basis: feeBasis,
      mandatory,
      counted: true,
      refundable: /non-?refundable/i.test(label) ? false : /refundable|deposit/i.test(label),
      quote: `${name} ${value}`,
      source: "ai",
      confidence: "high",
    };
    fees.push({
      ...fee,
      counted: defaultCounted(fee, NO_NEEDS),
      ...(included && mandatory === "yes" && frequency === "monthly" ? { includedInAdvertised: true } : {}),
    });
  }
  if (fees.length === 0) return null;

  const name = displayName(listing);
  return {
    id,
    name,
    url: `https://offcampus.vt.edu/housing/property/${listing.path}`,
    site: OFFCAMPUS_SITE,
    readOn,
    priceRange: { min: prices.min, max: prices.max, basis },
    autoScanned: true,
    apartment: {
      id: `catalog-${id}`,
      name,
      advertised: { amount: prices.min, basis, quote: listing.priceText },
      utilities: utilitiesOf(listing),
      fees,
      reviewed: false,
    },
  };
}

export function slugFor(listing: OffcampusListing): string {
  return listing.type === "Apartment Community" && !BEDS.test(listing.name)
    ? slug(displayName(listing))
    : slug(listing.street);
}
