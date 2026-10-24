// Scores one extraction against a hand-labelled expected.json (F14).
// Pure functions, no I/O, so they run in tests. Matching rule from
// eval/cases/README.md: amounts equal (or inside amountRange) and the names
// share a word, or failing that the categories are equal. Each expected fee
// matches at most once, so duplicates count as false positives.
import type { Basis, ExtractedFee, Extraction, FeeCategory, Frequency } from "@/lib/types";

export interface ExpectedFee {
  name: string;
  category: FeeCategory;
  amount: number;
  amountRange?: [number, number];
  frequency: Frequency | null;
  basis: Basis | null;
  mandatory: "yes" | "no" | "unknown" | null;
  refundable?: boolean;
}

export interface Expected {
  advertisedPrice: { min: number; max: number; basis: Basis };
  fees: ExpectedFee[];
  notFees?: string[];
}

// Fields scored on matched fees; null in expected.json means "not scored".
export const FIELDS = ["category", "frequency", "basis", "mandatory", "refundable"] as const;
export type Field = (typeof FIELDS)[number];

export interface Match {
  expected: ExpectedFee;
  predicted: ExtractedFee;
  by: "name" | "category";
  wrong: { field: Field; expected: unknown; predicted: unknown }[];
}

export interface CaseScore {
  matches: Match[];
  missed: ExpectedFee[]; // false negatives
  extra: ExtractedFee[]; // false positives
  fields: Record<Field, { right: number; total: number }>;
  price: { ok: boolean; predicted: Extraction["advertisedPrice"] };
}

// Words too generic to say two fee names are the same fee.
const GENERIC = new Set(["fee", "fees", "charge", "charges", "the", "and", "of", "per", "a", "monthly", "month"]);

export function nameWords(name: string): Set<string> {
  const words = name.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w && !GENERIC.has(w));
  // "admin" and "administrative" are the same word for matching.
  return new Set(words.map((w) => (w.startsWith("admin") ? "admin" : w)));
}

function amountMatches(e: ExpectedFee, amount: number): boolean {
  if (e.amountRange) return amount >= e.amountRange[0] - 0.005 && amount <= e.amountRange[1] + 0.005;
  return Math.abs(e.amount - amount) < 0.005;
}

function sharesWord(a: string, b: string): boolean {
  const wa = nameWords(a);
  return [...nameWords(b)].some((w) => wa.has(w));
}

export function scoreCase(expected: Expected, extraction: Extraction): CaseScore {
  const unmatchedE = new Set(expected.fees.map((_, i) => i));
  const unmatchedP = new Set(extraction.fees.map((_, i) => i));
  const pairs: { e: number; p: number; by: Match["by"] }[] = [];

  // Name matches first so a category-only match can't steal a fee's real partner.
  for (const by of ["name", "category"] as const) {
    for (const e of [...unmatchedE]) {
      const ef = expected.fees[e];
      const p = [...unmatchedP].find((i) => {
        const pf = extraction.fees[i];
        if (!amountMatches(ef, pf.amount)) return false;
        return by === "name" ? sharesWord(ef.name, pf.name) : ef.category === pf.category;
      });
      if (p === undefined) continue;
      pairs.push({ e, p, by });
      unmatchedE.delete(e);
      unmatchedP.delete(p);
    }
  }

  const fields = Object.fromEntries(FIELDS.map((f) => [f, { right: 0, total: 0 }])) as CaseScore["fields"];
  const matches: Match[] = pairs.map(({ e, p, by }) => {
    const ef = expected.fees[e];
    const pf = extraction.fees[p];
    const wrong: Match["wrong"] = [];
    for (const field of FIELDS) {
      const want = ef[field];
      if (want === null || want === undefined) continue;
      fields[field].total++;
      if (pf[field] === want) fields[field].right++;
      else wrong.push({ field, expected: want, predicted: pf[field] });
    }
    return { expected: ef, predicted: pf, by, wrong };
  });

  const ap = extraction.advertisedPrice;
  const want = expected.advertisedPrice;
  const priceOk = ap.amount !== null && ap.amount >= want.min && ap.amount <= want.max && ap.basis === want.basis;

  return {
    matches,
    missed: [...unmatchedE].map((i) => expected.fees[i]),
    extra: [...unmatchedP].map((i) => extraction.fees[i]),
    fields,
    price: { ok: priceOk, predicted: ap },
  };
}

export function ratio(n: number, d: number): number | null {
  return d === 0 ? null : n / d;
}
