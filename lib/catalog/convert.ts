// Turns one hand-labelled eval case (eval/cases/<id>/) into a catalog entry.
// Owner: Sam (A). Pure, so scripts/build-catalog.ts and the Vitest test share it.
//
// Choices where expected.json leaves a field null (it means "the listing
// doesn't say"):
// - basis: per_unit only when the fee's own quote says "per unit", "per
//   apartment", "per household" or "per home"; otherwise per_person, because
//   these listings price by the bed and a per-person amount never hides cost.
// - frequency: "monthly" for utility fees (Brexx's Utility Billing Fee is a
//   recurring bill), otherwise "one_time" (situational charges per occurrence).
// - refundable: expected.json when it says so, else true only for security
//   deposits (Virginia requires a security deposit be returnable).
// - advertised amount: the low end of the price range, with its basis.
// - utilities: expected.json when it lists them, else "unknown" for each.
import { defaultCounted } from "../cost";
import type { Apartment, Basis, Fee, FeeCategory, Frequency, Utilities } from "../types";

export interface CaseInfo {
  name: string;
  url: string;
  site: string;
  readOn: string; // YYYY-MM-DD
}

export interface ExpectedFee {
  name: string;
  category: FeeCategory;
  amount: number;
  frequency: Frequency | null;
  basis: Basis | null;
  mandatory: "yes" | "no" | "unknown";
  refundable?: boolean;
  amountRange?: [number, number];
}

export interface Expected {
  advertisedPrice: { min: number; max: number; basis: Basis };
  utilities?: Utilities;
  fees: ExpectedFee[];
}

// Same fields the fee index (F20) keeps per complex: id, name, source URL, read
// date and the reviewed apartment with its fees.
export interface CatalogEntry {
  id: string; // eval case folder name, e.g. "hub"
  name: string;
  url: string;
  site: string;
  readOn: string; // YYYY-MM-DD
  priceRange: { min: number; max: number; basis: Basis };
  apartment: Apartment;
}

const UNKNOWN_UTILITIES: Utilities = {
  electric: "unknown",
  water: "unknown",
  gas: "unknown",
  internet: "unknown",
  trash: "unknown",
};

// Dollar amounts on a line: "$1,069", "$35.00", "$1.50/mo", "$400-$1500".
function amountsIn(line: string): number[] {
  return Array.from(line.matchAll(/\$\s?(\d[\d,]*(?:\.\d+)?)/g), (m) =>
    Number(m[1].replace(/,/g, "")),
  );
}

const words = (text: string) =>
  text
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length > 2);

// A long free-text line is cut down to the sentence that holds the amount.
function sentenceWith(line: string, amount: number): string {
  if (line.length <= 120) return line;
  const sentences = line.split(/(?<=\.)\s+/);
  return sentences.find((s) => amountsIn(s).includes(amount)) ?? line;
}

// The listing line that shows this fee: it must contain the amount and share at
// least one word with the fee name. Some sites put the name on the line above
// the amount, so "previous line + amount line" is a candidate too.
export function findQuote(listing: string, name: string, amount: number): string | null {
  const lines = listing.split(/\r?\n/).map((l) => l.trim());
  const nameWords = new Set(words(name));
  let best: { quote: string; score: number } | null = null;
  for (const [i, line] of lines.entries()) {
    if (!amountsIn(line).includes(amount)) continue;
    const own = sentenceWith(line, amount);
    const candidates = [own];
    if (i > 0 && lines[i - 1] && amountsIn(lines[i - 1]).length === 0) {
      candidates.push(`${lines[i - 1]} ${own}`);
    }
    for (const quote of candidates) {
      const score = new Set(words(quote).filter((w) => nameWords.has(w))).size;
      if (score > 0 && (!best || score > best.score)) best = { quote, score };
    }
  }
  return best?.quote ?? null;
}

function advertisedQuote(listing: string, amount: number): string | null {
  const line = listing
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => amountsIn(l).includes(amount));
  return line ?? null;
}

const PER_UNIT = /\bper (unit|apartment|household|home)\b/i;

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// Setup used only to pick each fee's starting `counted` value: no extras needed.
const NO_NEEDS = { people: 1, leaseMonths: 12 };

export function caseToEntry(
  id: string,
  info: CaseInfo,
  expected: Expected,
  listing: string,
): CatalogEntry {
  const usedIds = new Set<string>();
  const fees: Fee[] = expected.fees.map((f) => {
    const quote = findQuote(listing, f.name, f.amount);
    let feeId = `${id}-${slug(f.name)}`;
    for (let n = 2; usedIds.has(feeId); n++) feeId = `${id}-${slug(f.name)}-${n}`;
    usedIds.add(feeId);
    const fee: Fee = {
      id: feeId,
      name: f.name,
      category: f.category,
      amount: f.amount,
      frequency: f.frequency ?? (f.category === "utility_fee" ? "monthly" : "one_time"),
      basis: f.basis ?? (quote && PER_UNIT.test(quote) ? "per_unit" : "per_person"),
      mandatory: f.mandatory,
      counted: true,
      refundable: f.refundable ?? f.category === "security_deposit",
      quote,
      source: "ai",
      confidence: "high",
    };
    return { ...fee, counted: defaultCounted(fee, NO_NEEDS) };
  });

  const { min, max, basis } = expected.advertisedPrice;
  return {
    id,
    name: info.name,
    url: info.url,
    site: info.site,
    readOn: info.readOn,
    priceRange: { min, max, basis },
    apartment: {
      id: `catalog-${id}`,
      name: info.name,
      advertised: { amount: min, basis, quote: advertisedQuote(listing, min) },
      utilities: expected.utilities ?? UNKNOWN_UTILITIES,
      fees,
      reviewed: true,
    },
  };
}
