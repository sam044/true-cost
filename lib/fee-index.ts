// Compare-side logic for the Blacksburg fee index (F20). Owner: Andy (B).
// The database, API and seed live in lib/index/, app/api/index/. The index
// only gives hints: nothing here changes the totals in lib/cost.ts.
import type { Apartment, Frequency, IndexFee, IndexSummary } from "./types";

export type { IndexFee, IndexSummary };

const nameKey = (name: string) => name.toLowerCase().replace(/\s+/g, " ").trim();

// Fees reported at this complex that the apartment doesn't have, most-reported
// first. Matched by category and frequency (a null frequency matches any), and
// by name for "other" fees, since that category covers unrelated charges.
export function missingFees(summary: IndexSummary, apartment: Apartment): IndexFee[] {
  const has = (reported: IndexFee) =>
    apartment.fees.some(
      (fee) =>
        fee.category === reported.category &&
        (reported.frequency == null || fee.frequency === reported.frequency) &&
        (reported.category !== "other" || nameKey(fee.name) === nameKey(reported.name)),
    );
  return summary.fees
    .filter((f) => f.category !== "base_rent" && !has(f))
    .sort((a, b) => b.reports - a.reports);
}

const FREQUENCY_SUFFIX: Record<Frequency, string> = {
  monthly: "/month",
  one_time: " one-time",
  per_semester: "/semester",
  annual: "/year",
};

function dollars(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

// The median with its frequency: "$62/month", "$150 one-time".
export function feeAmountLabel(fee: IndexFee): string {
  return dollars(fee.median) + (fee.frequency ? FREQUENCY_SUFFIX[fee.frequency] : "");
}

// "Reported 2 times · $45 to $50"; the range only when reports differ.
export function reportsLabel(fee: IndexFee): string {
  const times = fee.reports === 1 ? "Reported once" : `Reported ${fee.reports} times`;
  return fee.low === fee.high ? times : `${times} · ${dollars(fee.low)} to ${dollars(fee.high)}`;
}

// "Based on 3 reports, last seen Oct 24." plus a note when seed data is included.
export function summaryLine(summary: IndexSummary): string {
  const seen = new Date(summary.lastSeen).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "America/New_York",
  });
  const reports = `${summary.reports} report${summary.reports === 1 ? "" : "s"}`;
  const seed = summary.includesSeed ? " Includes fees checked by the True Cost team." : "";
  return `Based on ${reports}, last seen ${seen}.${seed}`;
}
