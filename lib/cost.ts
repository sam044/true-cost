// Cost engine. Owner: Andy (B). Pure functions only; every number on the
// Compare screen comes from here, never from the model.
//
// Rules (from the PRD):
// - per_unit amounts are divided by setup.people; per_person amounts are used as is
// - monthly counts in full; one_time and deposits are spread over leaseMonths;
//   per_semester = amount * 2 / 12; annual = amount / 12
// - only fees with counted: true enter the true cost
// - deposits are spread like fees but keep their "refundable" label in the UI
// - base_rent fees are skipped: rent comes from the advertised price
// - optional fees count by default only for extras the user needs (defaultCounted)
import type { Apartment, CostSummary, Fee, FeeCategory, Needs, Setup } from "./types";

// Categories that land in the "utilities" group of the breakdown, alongside
// every estimate row.
const UTILITY_CATEGORIES: FeeCategory[] = ["utility_fee", "internet", "trash"];

export function perPerson(amount: number, basis: Fee["basis"], setup: Setup): number {
  return basis === "per_unit" ? amount / setup.people : amount;
}

export function monthlyEquivalent(fee: Fee, setup: Setup): number {
  const amount = perPerson(fee.amount, fee.basis, setup);
  switch (fee.frequency) {
    case "monthly":
      return amount;
    case "one_time":
      return amount / setup.leaseMonths;
    case "per_semester":
      return (amount * 2) / 12;
    case "annual":
      return amount / 12;
  }
}

// Optional fees in these categories count when the user said they need the extra.
const NEED_FOR_CATEGORY: Partial<Record<FeeCategory, keyof Needs>> = {
  parking: "parking",
  pet: "pet",
  furniture: "furnished",
};

// Starting value for Fee.counted. Mandatory and unknown fees always count, so
// the true cost never hides a fee we are unsure about.
export function defaultCounted(fee: Fee, setup: Setup): boolean {
  if (fee.mandatory !== "no") return true;
  const need = NEED_FOR_CATEGORY[fee.category];
  return need != null && setup.needs?.[need] === true;
}

export type Group = keyof CostSummary["breakdown"];
export type FeeGroup = Exclude<Group, "rent">;

export function groupOf(fee: Fee): FeeGroup {
  if (fee.frequency === "one_time") return "oneTimeAndDeposits";
  if (fee.source === "estimate" || UTILITY_CATEGORIES.includes(fee.category)) return "utilities";
  return "recurringFees";
}

export function summarize(apartment: Apartment, setup: Setup): CostSummary {
  const advertisedMonthly = perPerson(
    apartment.advertised.amount,
    apartment.advertised.basis,
    setup,
  );

  const breakdown = { rent: advertisedMonthly, recurringFees: 0, utilities: 0, oneTimeAndDeposits: 0 };
  for (const fee of apartment.fees) {
    if (!fee.counted || fee.category === "base_rent") continue;
    breakdown[groupOf(fee)] += monthlyEquivalent(fee, setup);
  }

  const trueMonthly =
    breakdown.rent + breakdown.recurringFees + breakdown.utilities + breakdown.oneTimeAndDeposits;

  return {
    apartmentId: apartment.id,
    advertisedMonthly,
    trueMonthly,
    hiddenPerYear: (trueMonthly - advertisedMonthly) * 12,
    leaseTotal: trueMonthly * setup.leaseMonths,
    breakdown,
    overBudget: setup.budget == null ? null : trueMonthly > setup.budget,
  };
}

export interface ItemLine {
  fee: Fee;
  group: FeeGroup;
  monthly: number; // per person per month
  note: string | null; // how the monthly share was worked out, e.g. "$150 ÷ 12 mo"
}

export interface Itemized {
  rent: number; // advertised price per person per month
  lines: ItemLine[]; // counted fees, recurring before one-time, largest first
  excluded: ItemLine[]; // uncounted fees, with what they would add
}

const GROUP_ORDER: FeeGroup[] = ["recurringFees", "utilities", "oneTimeAndDeposits"];

function dollars(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function noteFor(fee: Fee, setup: Setup): string | null {
  const parts: string[] = [];
  if (fee.basis === "per_unit" && setup.people > 1) parts.push(`÷ ${setup.people} people`);
  if (fee.frequency === "one_time") parts.push(`÷ ${setup.leaseMonths} mo`);
  if (fee.frequency === "per_semester") parts.push("per semester");
  if (fee.frequency === "annual") parts.push("per year");
  return parts.length === 0 ? null : `${dollars(fee.amount)} ${parts.join(" ")}`;
}

export function itemize(apartment: Apartment, setup: Setup): Itemized {
  const toLine = (fee: Fee): ItemLine => ({
    fee,
    group: groupOf(fee),
    monthly: monthlyEquivalent(fee, setup),
    note: noteFor(fee, setup),
  });
  const byGroupThenSize = (a: ItemLine, b: ItemLine) =>
    GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) || b.monthly - a.monthly;

  const fees = apartment.fees.filter((f) => f.category !== "base_rent");
  return {
    rent: perPerson(apartment.advertised.amount, apartment.advertised.basis, setup),
    lines: fees.filter((f) => f.counted).map(toLine).sort(byGroupThenSize),
    excluded: fees.filter((f) => !f.counted).map(toLine).sort(byGroupThenSize),
  };
}
