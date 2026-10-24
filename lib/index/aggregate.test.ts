import { describe, expect, it } from "vitest";
import { aggregate, type IndexRow } from "./aggregate";

const complex = { slug: "brexx", name: "Brexx at Blacksburg", verified: true };

function row(patch: Partial<IndexRow>): IndexRow {
  return {
    submissionId: "s1",
    source: "user",
    advertised: 1069,
    updatedAt: "2026-10-24T20:00:00Z",
    category: "admin",
    name: "Admin fee",
    amount: 150,
    frequency: "one_time",
    ...patch,
  };
}

describe("aggregate", () => {
  it("returns null when no one has reported this complex", () => {
    expect(aggregate(complex, [])).toBeNull();
  });

  it("groups fees by category and frequency across submissions with median, low and high", () => {
    const s = aggregate(complex, [
      row({ submissionId: "a", category: "parking", frequency: "monthly", amount: 45, name: "Garage" }),
      row({ submissionId: "b", category: "parking", frequency: "monthly", amount: 50, name: "Parking" }),
      row({ submissionId: "c", category: "parking", frequency: "monthly", amount: 60, name: "Lot" }),
    ])!;
    expect(s.fees).toEqual([
      { category: "parking", frequency: "monthly", name: "Parking", reports: 3, median: 50, low: 45, high: 60 },
    ]);
  });

  it("keeps the same category at different frequencies apart", () => {
    const s = aggregate(complex, [
      row({ category: "parking", frequency: "monthly", amount: 50 }),
      row({ category: "parking", frequency: "annual", amount: 400 }),
    ])!;
    expect(s.fees.map((f) => f.frequency).sort()).toEqual(["annual", "monthly"]);
  });

  it("averages the middle two for an even number of reports", () => {
    const s = aggregate(complex, [
      row({ submissionId: "a", amount: 100 }),
      row({ submissionId: "b", amount: 200 }),
    ])!;
    expect(s.fees[0].median).toBe(150);
  });

  it("shows free-text 'other' fees only once two submissions agree on the name", () => {
    const s = aggregate(complex, [
      row({ submissionId: "a", category: "other", name: "Credit reporting fee", amount: 9, frequency: "monthly" }),
      row({ submissionId: "b", category: "other", name: "credit  Reporting fee", amount: 9, frequency: "monthly" }),
      row({ submissionId: "a", category: "other", name: "Key fob", amount: 25, frequency: "one_time" }),
    ])!;
    expect(s.fees.map((f) => f.name)).toEqual(["Credit reporting fee"]);
  });

  it("skips base rent and sorts the most-reported fees first", () => {
    const s = aggregate(complex, [
      row({ submissionId: "a", category: "base_rent", amount: 1069, frequency: "monthly" }),
      row({ submissionId: "a", category: "trash", amount: 6, frequency: "monthly" }),
      row({ submissionId: "a", category: "admin" }),
      row({ submissionId: "b", category: "admin" }),
    ])!;
    expect(s.fees.map((f) => f.category)).toEqual(["admin", "trash"]);
    expect(s.fees.map((f) => f.name)).toEqual(["Admin fee", "Trash"]);
  });

  it("summarizes submissions: count, median advertised rent, seed data and last seen", () => {
    const s = aggregate(complex, [
      row({ submissionId: "seed", source: "seed", advertised: 1069, updatedAt: "2026-10-24T12:00:00Z" }),
      row({ submissionId: "u1", advertised: 1099, updatedAt: "2026-10-24T21:00:00Z" }),
      row({ submissionId: "u1", category: "trash", amount: 6, frequency: "monthly" }),
      row({ submissionId: "u2", advertised: null, updatedAt: "2026-10-24T18:00:00Z" }),
    ])!;
    expect(s).toMatchObject({
      found: true,
      complex,
      reports: 3,
      medianAdvertised: 1084,
      includesSeed: true,
      lastSeen: "2026-10-24T21:00:00.000Z",
    });
  });
});
