// Seed records for the fee index (F20), built from the 8 hand-labelled eval
// cases. Owner: Andy (B). Node only: used by scripts/seed-index.ts and its test,
// never by the app. Fees come straight from expected.json (human-checked), so a
// null frequency or basis stays null rather than being guessed.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { CaseInfo, Expected } from "../catalog/convert";
import type { Basis, FeeCategory, Frequency, Utilities } from "../types";
import { complexKey } from "./complex";

export interface SeedRecord {
  complex: { slug: string; name: string; aliases: string[]; listingUrl: string; verified: true };
  submission: { id: string; advertised: number; basis: Basis; utilities: Utilities | null };
  fees: {
    category: FeeCategory;
    name: string;
    nameKey: string;
    amount: number;
    frequency: Frequency | null;
    basis: Basis | null;
    mandatory: "yes" | "no" | "unknown";
    refundable: boolean;
  }[];
}

// Hand-written aliases for names people type that complexKey can't derive.
const EXTRA_ALIASES: Record<string, string[]> = { fourteen35: ["1435"] };

// A fixed UUID per complex, so re-running the seed replaces its submission.
export function seedSubmissionId(slug: string): string {
  const h = createHash("sha1").update(`true-cost-seed:${slug}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export function seedRecords(casesDir: string): SeedRecord[] {
  return readdirSync(casesDir)
    .filter((id) => statSync(path.join(casesDir, id)).isDirectory())
    .sort()
    .map((slug) => {
      const read = (file: string) => readFileSync(path.join(casesDir, slug, file), "utf8");
      const info = JSON.parse(read("case.json")) as CaseInfo;
      const expected = JSON.parse(read("expected.json")) as Expected;
      const aliases = [...new Set([complexKey(info.name), ...(EXTRA_ALIASES[slug] ?? [])])].filter(
        (a) => a && a !== slug,
      );
      return {
        complex: { slug, name: info.name, aliases, listingUrl: info.url, verified: true },
        submission: {
          id: seedSubmissionId(slug),
          advertised: expected.advertisedPrice.min,
          basis: expected.advertisedPrice.basis,
          utilities: expected.utilities ?? null,
        },
        fees: expected.fees.map((f) => ({
          category: f.category,
          name: f.name.trim().slice(0, 80),
          nameKey: f.name.toLowerCase().replace(/\s+/g, " ").trim(),
          amount: f.amountRange?.[0] ?? f.amount,
          frequency: f.frequency,
          basis: f.basis,
          mandatory: f.mandatory,
          refundable: f.refundable ?? f.category === "security_deposit",
        })),
      };
    });
}
