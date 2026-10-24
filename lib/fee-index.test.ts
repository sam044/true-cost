import { describe, expect, it } from "vitest";
import { feeAmountLabel, missingFees, reportsLabel, summaryLine, type IndexFee, type IndexSummary } from "./fee-index";
import { mockApartments } from "./mock";

function indexFee(patch: Partial<IndexFee>): IndexFee {
  return {
    category: "other",
    frequency: "monthly",
    name: "Fee",
    reports: 1,
    median: 10,
    low: 10,
    high: 10,
    ...patch,
  };
}

function summary(fees: IndexFee[], patch: Partial<IndexSummary> = {}): IndexSummary {
  return {
    found: true,
    complex: { slug: "brexx", name: "Brexx at Blacksburg", verified: true },
    reports: 3,
    medianAdvertised: 1069,
    includesSeed: false,
    fees,
    lastSeen: "2026-10-24T18:00:00Z",
    ...patch,
  };
}

const brexx = mockApartments[0]; // has admin (one-time), application (one-time), utility_fee (monthly)

describe("missingFees", () => {
  it("returns reported fees whose category and frequency the apartment lacks", () => {
    const missing = missingFees(
      summary([
        indexFee({ category: "admin", frequency: "one_time", name: "Admin fee" }),
        indexFee({ category: "insurance", frequency: "monthly", name: "Insurance" }),
        indexFee({ category: "parking", frequency: "monthly", name: "Parking" }),
      ]),
      brexx,
    );
    expect(missing.map((f) => f.name)).toEqual(["Insurance", "Parking"]);
  });

  it("treats the same category at a different frequency as missing", () => {
    const missing = missingFees(
      summary([indexFee({ category: "admin", frequency: "monthly", name: "Monthly admin" })]),
      brexx,
    );
    expect(missing).toHaveLength(1);
  });

  it("matches a fee with unknown frequency on category alone", () => {
    const missing = missingFees(
      summary([indexFee({ category: "utility_fee", frequency: null, name: "Utility fee" })]),
      brexx,
    );
    expect(missing).toEqual([]);
  });

  it("matches 'other' fees by name, ignoring case and spacing", () => {
    const apt = {
      ...brexx,
      fees: [{ ...brexx.fees[0], category: "other" as const, name: "Credit  reporting fee", frequency: "monthly" as const }],
    };
    const missing = missingFees(
      summary([
        indexFee({ name: "credit reporting fee" }),
        indexFee({ name: "Pest control" }),
      ]),
      apt,
    );
    expect(missing.map((f) => f.name)).toEqual(["Pest control"]);
  });

  it("ignores base rent and puts the most-reported fees first", () => {
    const missing = missingFees(
      summary([
        indexFee({ category: "base_rent", name: "Rent" }),
        indexFee({ category: "pest", name: "Pest", reports: 1 }),
        indexFee({ category: "amenity", name: "Amenity", reports: 4 }),
      ]),
      brexx,
    );
    expect(missing.map((f) => f.name)).toEqual(["Amenity", "Pest"]);
  });
});

describe("feeAmountLabel", () => {
  it("shows the median with its frequency", () => {
    expect(feeAmountLabel(indexFee({ median: 62 }))).toBe("$62/month");
    expect(feeAmountLabel(indexFee({ median: 150, low: 100, high: 200, frequency: "one_time" }))).toBe(
      "$150 one-time",
    );
    expect(feeAmountLabel(indexFee({ median: 300, frequency: "per_semester" }))).toBe("$300/semester");
    expect(feeAmountLabel(indexFee({ median: 99.5, frequency: "annual" }))).toBe("$99.50/year");
    expect(feeAmountLabel(indexFee({ median: 100, frequency: null }))).toBe("$100");
  });
});

describe("reportsLabel", () => {
  it("counts reports and adds the range only when reports differ", () => {
    expect(reportsLabel(indexFee({ reports: 1 }))).toBe("Reported once");
    expect(reportsLabel(indexFee({ reports: 2, low: 45, high: 50 }))).toBe("Reported 2 times · $45 to $50");
  });
});

describe("summaryLine", () => {
  it("says how many reports and when, and notes team-checked seed data", () => {
    expect(summaryLine(summary([]))).toBe("Based on 3 reports, last seen Oct 24.");
    expect(summaryLine(summary([], { reports: 1, includesSeed: true }))).toBe(
      "Based on 1 report, last seen Oct 24. Includes fees checked by the True Cost team.",
    );
  });
});
