import { describe, expect, it } from "vitest";
import { perPerson, summarize } from "./cost";
import { mockApartments } from "./mock";

const setup = { people: 4, leaseMonths: 12 };

describe("perPerson", () => {
  it("splits per-unit amounts across people", () => {
    expect(perPerson(2400, "per_unit", setup)).toBe(600);
  });

  it("keeps per-person amounts as they are", () => {
    expect(perPerson(1069, "per_person", setup)).toBe(1069);
  });
});

describe("summarize", () => {
  it("reports the advertised price per person", () => {
    expect(summarize(mockApartments[0], setup).advertisedMonthly).toBe(1069);
  });

  // TODO(Andy): enable once monthlyEquivalent is implemented.
  // Brexx: 1069 + 62 utility fee + (150 + 50) / 12 = 1147.67 per person.
  it.todo("adds recurring and spread one-time fees for Brexx");
});
