// Turns a complex's reported fee rows into the IndexSummary that Compare shows
// (F20). Owner: Andy (B). Done in code rather than SQL so it is tested, and the
// rows per complex are few. Medians, not means, so one odd report can't move
// the number; free-text "other" fees need 2+ submissions agreeing on the name.
import type { FeeCategory, Frequency, IndexFee, IndexSummary } from "../types";

export interface IndexRow {
  submissionId: string;
  source: "user" | "seed";
  advertised: number | null; // the submission's advertised rent
  updatedAt: string; // ISO time the submission was last saved
  category: FeeCategory;
  name: string;
  amount: number;
  frequency: Frequency | null;
}

const FEE_NAME: Record<FeeCategory, string> = {
  base_rent: "Base rent",
  admin: "Admin fee",
  application: "Application fee",
  amenity: "Amenity fee",
  parking: "Parking",
  utility_fee: "Utility fee",
  internet: "Internet",
  trash: "Trash",
  pest: "Pest control",
  technology: "Technology fee",
  insurance: "Renter's insurance",
  pet: "Pet fee",
  reconditioning: "Reconditioning fee",
  furniture: "Furniture",
  security_deposit: "Security deposit",
  other: "Other fee",
};

const nameKey = (name: string) => name.toLowerCase().replace(/\s+/g, " ").trim();

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Capitalize the first letter of a free-text name, keep the rest as reported.
const tidy = (name: string) => {
  const t = name.replace(/\s+/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
};

export function aggregate(
  complex: IndexSummary["complex"],
  rows: IndexRow[],
): IndexSummary | null {
  if (rows.length === 0) return null;

  const groups = new Map<string, IndexRow[]>();
  for (const r of rows) {
    if (r.category === "base_rent") continue;
    const key = [r.category, r.frequency ?? "", r.category === "other" ? nameKey(r.name) : ""].join("|");
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  const fees: IndexFee[] = [];
  for (const group of groups.values()) {
    const first = group[0];
    const reports = new Set(group.map((r) => r.submissionId)).size;
    if (first.category === "other" && reports < 2) continue;
    const amounts = group.map((r) => r.amount);
    fees.push({
      category: first.category,
      frequency: first.frequency,
      name: first.category === "other" ? tidy(first.name) : FEE_NAME[first.category],
      reports,
      median: median(amounts),
      low: Math.min(...amounts),
      high: Math.max(...amounts),
    });
  }
  fees.sort((a, b) => b.reports - a.reports || a.category.localeCompare(b.category));

  // One advertised rent and update time per submission.
  const submissions = new Map<string, IndexRow>();
  for (const r of rows) if (!submissions.has(r.submissionId)) submissions.set(r.submissionId, r);
  const subs = [...submissions.values()];
  const rents = subs.map((s) => s.advertised).filter((a): a is number => a != null);

  return {
    found: true,
    complex,
    reports: subs.length,
    medianAdvertised: rents.length ? median(rents) : null,
    includesSeed: subs.some((s) => s.source === "seed"),
    fees,
    lastSeen: new Date(Math.max(...subs.map((s) => Date.parse(s.updatedAt)))).toISOString(),
  };
}
