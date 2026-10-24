import { describe, expect, it } from "vitest";
import { defaultCounted, itemize, monthlyEquivalent, perPerson, summarize } from "./cost";
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

describe("defaultCounted", () => {
  const needs = { parking: true, pet: false, furnished: false };

  it("always counts mandatory and unknown fees", () => {
    expect(defaultCounted(fee({ mandatory: "yes", category: "parking" }), setup)).toBe(true);
    expect(defaultCounted(fee({ mandatory: "unknown", category: "pet" }), { ...setup, needs })).toBe(true);
  });

  it("counts optional fees only for extras the user needs", () => {
    const s = { ...setup, needs };
    expect(defaultCounted(fee({ mandatory: "no", category: "parking" }), s)).toBe(true);
    expect(defaultCounted(fee({ mandatory: "no", category: "pet" }), s)).toBe(false);
    expect(defaultCounted(fee({ mandatory: "no", category: "furniture" }), s)).toBe(false);
    expect(
      defaultCounted(fee({ mandatory: "no", category: "furniture" }), {
        ...setup,
        needs: { ...needs, furnished: true },
      }),
    ).toBe(true);
  });

  it("leaves other optional fees out, and everything optional out when needs are unset", () => {
    expect(defaultCounted(fee({ mandatory: "no", category: "amenity" }), { ...setup, needs })).toBe(false);
    expect(defaultCounted(fee({ mandatory: "no", category: "parking" }), setup)).toBe(false);
  });
});

describe("itemize", () => {
  it("lists counted fees with their monthly share and how it was worked out", () => {
    const { rent, lines, excluded } = itemize(mockApartments[2], setup);
    expect(rent).toBe(600);
    expect(excluded).toEqual([]);
    const byId = Object.fromEntries(lines.map((l) => [l.fee.id, l]));
    expect(byId["tee-admin"].monthly).toBeCloseTo(199 / 48, 6);
    expect(byId["tee-admin"].note).toBe("$199 ÷ 4 people ÷ 12 mo");
    expect(byId["tee-recon"].note).toBe("$299 ÷ 12 mo");
    expect(byId["tee-deposit"].group).toBe("oneTimeAndDeposits");
  });

  it("notes per-semester, annual and plain monthly fees", () => {
    const { lines } = itemize(
      apartment([
        fee({ id: "m", amount: 62 }),
        fee({ id: "s", amount: 300, frequency: "per_semester" }),
        fee({ id: "y", amount: 240, frequency: "annual" }),
        fee({ id: "u", amount: 30, basis: "per_unit" }),
      ]),
      setup,
    );
    const notes = Object.fromEntries(lines.map((l) => [l.fee.id, l.note]));
    expect(notes).toEqual({
      m: null,
      s: "$300 per semester",
      y: "$240 per year",
      u: "$30 ÷ 4 people",
    });
  });

  it("puts uncounted fees in excluded with what they would add", () => {
    const { lines, excluded } = itemize(mockApartments[1], setup);
    expect(lines.map((l) => l.fee.id)).not.toContain("hub-parking");
    expect(excluded).toHaveLength(1);
    expect(excluded[0].monthly).toBe(7.5);
  });

  it("skips base_rent fees and orders recurring lines before one-time lines", () => {
    const { lines } = itemize(
      apartment([
        fee({ id: "once", frequency: "one_time", amount: 120 }),
        fee({ id: "rent", category: "base_rent" }),
        fee({ id: "monthly", amount: 5 }),
      ]),
      setup,
    );
    expect(lines.map((l) => l.fee.id)).toEqual(["monthly", "once"]);
  });

  it("adds up to the same true monthly cost as summarize", () => {
    for (const apt of mockApartments) {
      const { rent, lines } = itemize(apt, setup);
      const total = lines.reduce((sum, l) => sum + l.monthly, rent);
      expect(total).toBeCloseTo(summarize(apt, setup).trueMonthly, 9);
    }
  });
});

describe("fees included in the advertised price", () => {
  // Brexx: "Price shown is total price based on community-supplied monthly
  // required fees", so $1,069 already holds $15 + $6 + $9 = $30 of fees.
  const included = [
    fee({ id: "ins", category: "insurance", amount: 15, includedInAdvertised: true }),
    fee({ id: "trash", category: "trash", amount: 6, includedInAdvertised: true }),
    fee({ id: "credit", category: "other", amount: 9, includedInAdvertised: true }),
  ];
  const brexxLike = apartment([...included, fee({ id: "util", category: "utility_fee", amount: 62 })], 1069);

  it("does not add them on top of the advertised price", () => {
    const s = summarize(brexxLike, setup);
    expect(s.trueMonthly).toBe(1069 + 62);
    expect(s.hiddenPerYear).toBe(62 * 12);
  });

  it("moves them out of rent into their own groups so the bar still adds up", () => {
    const s = summarize(brexxLike, setup);
    expect(s.breakdown.rent).toBe(1039);
    expect(s.breakdown.recurringFees).toBe(15 + 9);
    expect(s.breakdown.utilities).toBe(6 + 62);
  });

  it("keeps them in the price even if switched off, since the rent already holds them", () => {
    const off = apartment([{ ...included[0], counted: false }], 1069);
    expect(summarize(off, setup).trueMonthly).toBe(1069);
  });

  it("itemizes them with a note, and the lines add up to the true cost", () => {
    const { rent, lines, excluded } = itemize(brexxLike, setup);
    expect(rent).toBe(1039);
    expect(excluded).toEqual([]);
    expect(lines.find((l) => l.fee.id === "ins")?.note).toBe("included in the advertised price");
    expect(lines.reduce((sum, l) => sum + l.monthly, rent)).toBe(summarize(brexxLike, setup).trueMonthly);
  });
});
