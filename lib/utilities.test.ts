import { describe, expect, it } from "vitest";
import { summarize } from "./cost";
import { flagsFor } from "./flags";
import { mockApartments } from "./mock";
import type { Apartment, Fee, Utilities } from "./types";
import { UTILITY_ESTIMATES, estimateFor, withUtilityEstimates } from "./utilities";

const none: Utilities = {
  electric: "included",
  water: "included",
  gas: "included",
  internet: "included",
  trash: "included",
};

function apartment(utilities: Partial<Utilities>, fees: Fee[] = []): Apartment {
  return {
    id: "a",
    name: "Test",
    advertised: { amount: 1000, basis: "per_person", quote: null },
    utilities: { ...none, ...utilities },
    fees,
    reviewed: false,
  };
}

const feeIds = (apt: Apartment) => apt.fees.map((f) => f.id);

describe("withUtilityEstimates", () => {
  it("adds one estimate row for each utility the listing says is not included", () => {
    const apt = withUtilityEstimates(apartment({ electric: "not_included", gas: "not_included" }));
    expect(feeIds(apt)).toEqual(["estimate-electric", "estimate-gas"]);
    const electric = apt.fees[0];
    expect(electric).toMatchObject({
      name: "Electric",
      amount: UTILITY_ESTIMATES.electric.monthlyPerUnit,
      frequency: "monthly",
      basis: "per_unit",
      source: "estimate",
      quote: null,
      counted: true,
    });
  });

  it("leaves included and unknown utilities alone", () => {
    const apt = apartment({ water: "unknown" });
    expect(withUtilityEstimates(apt)).toBe(apt);
  });

  it("is safe to run twice and keeps the user's edits", () => {
    const once = withUtilityEstimates(apartment({ electric: "not_included" }));
    once.fees[0] = { ...once.fees[0], amount: 80 };
    const twice = withUtilityEstimates(once);
    expect(twice).toBe(once);
    expect(twice.fees[0].amount).toBe(80);
  });

  it("skips internet and trash when the listing already charges for them", () => {
    const listed: Fee = {
      id: "net",
      name: "Internet package",
      category: "internet",
      amount: 25,
      frequency: "monthly",
      basis: "per_person",
      mandatory: "yes",
      counted: true,
      refundable: false,
      quote: "Internet $25",
      source: "ai",
      confidence: "high",
    };
    const apt = withUtilityEstimates(
      apartment({ internet: "not_included", trash: "not_included" }, [listed]),
    );
    expect(feeIds(apt)).toEqual(["net", "estimate-trash"]);
  });

  it("adds to the utilities group, is split per person and never raises a legal flag", () => {
    const apt = withUtilityEstimates(apartment({ electric: "not_included" }));
    const s = summarize(apt, { people: 4, leaseMonths: 12 });
    expect(s.breakdown.utilities).toBe(UTILITY_ESTIMATES.electric.monthlyPerUnit / 4);
    expect(flagsFor(apt, { people: 4, leaseMonths: 12 })).toEqual([]);
  });

  it("does not change the sample apartments' existing numbers", () => {
    // Samples are curated; estimates only apply to apartments that go through it.
    expect(mockApartments[0].fees.some((f) => f.source === "estimate")).toBe(false);
  });
});

describe("estimateFor", () => {
  it("returns the source behind an estimate row, and nothing for other fees", () => {
    const [electric] = withUtilityEstimates(apartment({ electric: "not_included" })).fees;
    expect(estimateFor(electric)?.sourceUrl).toMatch(/^https:\/\//);
    expect(estimateFor({ ...electric, id: "other", source: "user" })).toBeNull();
  });

  it("has a source and a positive amount for every utility", () => {
    for (const e of Object.values(UTILITY_ESTIMATES)) {
      expect(e.monthlyPerUnit).toBeGreaterThan(0);
      expect(e.sourceLabel.length).toBeGreaterThan(0);
      expect(e.sourceUrl).toMatch(/^https:\/\//);
    }
  });
});
