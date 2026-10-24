import { describe, expect, it } from "vitest";
import type { ExtractedFee, Extraction } from "@/lib/types";
import { nameWords, scoreCase, type Expected } from "./score";

const unknownUtilities = { electric: "unknown", water: "unknown", gas: "unknown", internet: "unknown", trash: "unknown" } as const;

function fee(over: Partial<ExtractedFee>): ExtractedFee {
  return {
    name: "Application Fee",
    category: "application",
    amount: 35,
    frequency: "one_time",
    basis: "per_person",
    mandatory: "yes",
    refundable: false,
    quote: "Application Fee $35",
    sourceImage: 0,
    confidence: "high",
    ...over,
  };
}

function extraction(fees: ExtractedFee[], price = 1245): Extraction {
  return {
    transcript: [],
    advertisedPrice: { amount: price, basis: "per_person", quote: null },
    bedrooms: null,
    utilities: unknownUtilities,
    fees,
  };
}

const edge: Expected = {
  advertisedPrice: { min: 1245, max: 1415, basis: "per_person" },
  fees: [
    { name: "Application Fee", category: "application", amount: 35, frequency: "one_time", basis: "per_person", mandatory: "yes" },
    { name: "Security Deposit", category: "security_deposit", amount: 500, frequency: "one_time", basis: null, mandatory: "yes", refundable: true },
  ],
};

describe("scoreCase", () => {
  it("matches each expected fee once, so a duplicate is a false positive", () => {
    const s = scoreCase(edge, extraction([fee({}), fee({ name: "APPLICATION FEE" })]));
    expect(s.matches).toHaveLength(1);
    expect(s.extra).toHaveLength(1);
    expect(s.missed.map((m) => m.name)).toEqual(["Security Deposit"]);
    expect(s.price.ok).toBe(true);
  });

  it("falls back to category when the names share no word", () => {
    const s = scoreCase(edge, extraction([fee({ name: "Move-in hold", category: "security_deposit", amount: 500, refundable: true })]));
    expect(s.matches[0]).toMatchObject({ by: "category", wrong: [] });
  });

  it("needs the amount to match, and accepts any amount inside amountRange", () => {
    const ranged: Expected = {
      ...edge,
      fees: [{ ...edge.fees[1], amount: 400, amountRange: [400, 1500] }],
    };
    expect(scoreCase(ranged, extraction([fee({ name: "Deposit", category: "security_deposit", amount: 1500 })])).matches).toHaveLength(1);
    expect(scoreCase(edge, extraction([fee({ amount: 50 })])).matches).toHaveLength(0);
  });

  it("scores only the fields expected.json states and reports the wrong ones", () => {
    const s = scoreCase(edge, extraction([fee({ name: "Security Deposit", category: "security_deposit", amount: 500, basis: "per_unit" })]));
    expect(s.fields.basis.total).toBe(0);
    expect(s.matches[0].wrong).toEqual([{ field: "refundable", expected: true, predicted: false }]);
  });

  it("checks the advertised price range and basis", () => {
    expect(scoreCase(edge, extraction([], 999)).price.ok).toBe(false);
  });
});

describe("nameWords", () => {
  it("ignores generic words and treats admin spellings alike", () => {
    expect([...nameWords("Administrative Fee")]).toEqual(["admin"]);
  });
});
