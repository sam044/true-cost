// Cost engine. Owner: Andy (B). Pure functions only; every number on the
// Compare screen comes from here, never from the model.
//
// Rules (from the PRD):
// - per_unit amounts are divided by setup.people; per_person amounts are used as is
// - monthly counts in full; one_time and deposits are spread over leaseMonths;
//   per_semester = amount * 2 / 12; annual = amount / 12
// - only fees with counted: true enter the true cost
// - deposits are spread like fees but keep their "refundable" label in the UI
import type { Apartment, CostSummary, Fee, Setup } from "./types";

export function perPerson(amount: number, basis: Fee["basis"], setup: Setup): number {
  return basis === "per_unit" ? amount / setup.people : amount;
}

export function monthlyEquivalent(fee: Fee, setup: Setup): number {
  // TODO(Andy): implement the frequency rules above, using perPerson()
  void fee;
  void setup;
  return 0;
}

export function summarize(apartment: Apartment, setup: Setup): CostSummary {
  // TODO(Andy): real breakdown. This stub only knows the advertised price so
  // the Compare screen renders something.
  const advertisedMonthly = perPerson(
    apartment.advertised.amount,
    apartment.advertised.basis,
    setup,
  );
  return {
    apartmentId: apartment.id,
    advertisedMonthly,
    trueMonthly: advertisedMonthly,
    hiddenPerYear: 0,
    leaseTotal: advertisedMonthly * setup.leaseMonths,
    breakdown: { rent: advertisedMonthly, recurringFees: 0, utilities: 0, oneTimeAndDeposits: 0 },
    overBudget: setup.budget == null ? null : advertisedMonthly > setup.budget,
  };
}
