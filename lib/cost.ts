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
import type { Apartment, CostSummary, Fee, FeeCategory, Setup } from "./types";

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

type Group = keyof CostSummary["breakdown"];

function groupOf(fee: Fee): Exclude<Group, "rent"> {
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
