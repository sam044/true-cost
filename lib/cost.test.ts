import { describe, expect, it } from "vitest";
import { monthlyEquivalent, perPerson, summarize } from "./cost";
import { mockApartments } from "./mock";
import type { Apartment, Fee, Setup } from "./types";

const setup: Setup = { people: 4, leaseMonths: 12 };

function fee(patch: Partial<Fee>): Fee {
  return {
    id: "f",
    name: "Fee",
    category: "other",
    amount: 100,
    frequency: "monthly",
    basis: "per_person",
    mandatory: "yes",
    counted: true,
    refundable: false,
    quote: null,
    source: "user",
    confidence: "high",
    ...patch,
  };
}

function apartment(fees: Fee[], advertised = 1000): Apartment {
  return {
    id: "a",
    name: "Test",
    advertised: { amount: advertised, basis: "per_person", quote: null },
    utilities: {
      electric: "unknown",
      water: "unknown",
      gas: "unknown",
      internet: "unknown",
      trash: "unknown",
    },
    fees,
    reviewed: true,
  };
}

describe("perPerson", () => {
  it("splits per-unit amounts across people", () => {
    expect(perPerson(2400, "per_unit", setup)).toBe(600);
  });

  it("keeps per-person amounts as they are", () => {
    expect(perPerson(1069, "per_person", setup)).toBe(1069);
  });
});

describe("monthlyEquivalent", () => {
  it("counts monthly fees in full", () => {
    expect(monthlyEquivalent(fee({ amount: 62 }), setup)).toBe(62);
  });

  it("spreads one-time fees over the lease", () => {
    expect(monthlyEquivalent(fee({ amount: 120, frequency: "one_time" }), setup)).toBe(10);
    expect(
      monthlyEquivalent(fee({ amount: 120, frequency: "one_time" }), { ...setup, leaseMonths: 10 }),
    ).toBe(12);
  });

  it("turns per-semester fees into amount x 2 / 12", () => {
    expect(monthlyEquivalent(fee({ amount: 300, frequency: "per_semester" }), setup)).toBe(50);
  });

  it("turns annual fees into amount / 12", () => {
    expect(monthlyEquivalent(fee({ amount: 240, frequency: "annual" }), setup)).toBe(20);
  });

  it("splits per-unit fees before converting", () => {
    expect(monthlyEquivalent(fee({ amount: 30, basis: "per_unit" }), setup)).toBe(7.5);
  });
});

describe("summarize", () => {
  it("reports the advertised price per person", () => {
    expect(summarize(mockApartments[0], setup).advertisedMonthly).toBe(1069);
  });

  it("adds recurring and spread one-time fees for Brexx", () => {
    // 1069 + 62 utility fee + (150 + 50) / 12 = 1147.67 per person.
    const s = summarize(mockApartments[0], setup);
    expect(s.trueMonthly).toBeCloseTo(1147.67, 2);
    expect(s.hiddenPerYear).toBeCloseTo(944, 6);
    expect(s.leaseTotal).toBeCloseTo((1069 + 62) * 12 + 200, 6);
    expect(s.breakdown.rent).toBe(1069);
    expect(s.breakdown.utilities).toBe(62);
    expect(s.breakdown.recurringFees).toBe(0);
    expect(s.breakdown.oneTimeAndDeposits).toBeCloseTo(200 / 12, 6);
  });

  it("splits a per-unit advertised price and per-unit deposit (Tee Street)", () => {
    // rent 2400/4 = 600; admin 199/4/12; recon 299/12; deposit 2400/4/12 = 50
    const s = summarize(mockApartments[2], setup);
    expect(s.breakdown.rent).toBe(600);
    expect(s.trueMonthly).toBeCloseTo(600 + 199 / 48 + 299 / 12 + 50, 6);
  });

  it("leaves out fees the user did not count", () => {
    // Hub parking is optional and not counted.
    const s = summarize(mockApartments[1], setup);
    expect(s.trueMonthly).toBeCloseTo(1150 + 235 / 12, 6);
  });

  it("does not double count a base_rent fee", () => {
    const s = summarize(apartment([fee({ category: "base_rent", amount: 1000 })]), setup);
    expect(s.trueMonthly).toBe(1000);
  });

  it("groups recurring fees and estimates separately", () => {
    const s = summarize(
      apartment([
        fee({ category: "amenity", amount: 25 }),
        fee({ category: "parking", amount: 120, frequency: "per_semester" }),
        fee({ category: "other", amount: 40, source: "estimate" }),
      ]),
      setup,
    );
    expect(s.breakdown.recurringFees).toBe(45);
    expect(s.breakdown.utilities).toBe(40);
    expect(s.trueMonthly).toBe(1085);
    expect(s.hiddenPerYear).toBe(85 * 12);
  });

  it("compares the true cost, not the advertised price, to the budget", () => {
    const apt = apartment([fee({ amount: 50 })]);
    expect(summarize(apt, setup).overBudget).toBeNull();
    expect(summarize(apt, { ...setup, budget: 1040 }).overBudget).toBe(true);
    expect(summarize(apt, { ...setup, budget: 1050 }).overBudget).toBe(false);
  });
});
