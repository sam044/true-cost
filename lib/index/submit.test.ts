import { describe, expect, it } from "vitest";
import { mockApartments } from "../mock";
import type { Apartment, Fee } from "../types";
import { clientHash } from "./client-hash";
import { Submission, submissionFor, submissionIdFor } from "./submit";

const UUID = "1b4e28ba-2fa1-41d2-883f-0016d3cca427";

function fee(patch: Partial<Fee>): Fee {
  return {
    id: "f",
    name: "Admin fee",
    category: "admin",
    amount: 150,
    frequency: "one_time",
    basis: "per_person",
    mandatory: "yes",
    counted: true,
    refundable: false,
    quote: "Admin fee $150",
    source: "ai",
    confidence: "high",
    ...patch,
  };
}

const apartment = (patch: Partial<Apartment> = {}): Apartment => ({
  ...mockApartments[0],
  id: UUID,
  name: "Brexx at Blacksburg",
  fees: [fee({})],
  reviewed: true,
  ...patch,
});

describe("submissionIdFor", () => {
  it("uses an uploaded apartment's UUID, and the UUID at the end of a catalog id", () => {
    expect(submissionIdFor(UUID)).toBe(UUID);
    expect(submissionIdFor(`catalog-brexx--${UUID}`)).toBe(UUID);
  });

  it("returns null for sample apartments, whose ids aren't UUIDs", () => {
    expect(submissionIdFor("brexx")).toBeNull();
  });
});

describe("submissionFor", () => {
  it("sends only the complex, rent, utilities and fee facts, never quotes or ids", () => {
    const s = submissionFor(apartment())!;
    expect(s).toEqual({
      id: UUID,
      complexName: "Brexx at Blacksburg",
      advertised: 1069,
      advertisedBasis: "per_person",
      utilities: mockApartments[0].utilities,
      fees: [
        {
          category: "admin",
          name: "Admin fee",
          amount: 150,
          frequency: "one_time",
          basis: "per_person",
          mandatory: "yes",
          refundable: false,
        },
      ],
    });
    expect(Submission.safeParse(s).success).toBe(true);
  });

  it("leaves out base rent and our utility estimates", () => {
    const s = submissionFor(
      apartment({
        fees: [fee({}), fee({ category: "base_rent" }), fee({ source: "estimate", name: "Electric" })],
      }),
    )!;
    expect(s.fees.map((f) => f.name)).toEqual(["Admin fee"]);
  });

  it("refuses samples and apartments that haven't been reviewed", () => {
    expect(submissionFor(apartment({ id: "brexx" }))).toBeNull();
    expect(submissionFor(apartment({ reviewed: false }))).toBeNull();
  });
});

describe("Submission limits", () => {
  const base = submissionFor(apartment())!;
  const ok = (patch: object) => Submission.safeParse({ ...base, ...patch }).success;

  it("accepts at most 30 fees with amounts from 0 to 10,000", () => {
    expect(ok({ fees: Array(30).fill(base.fees[0]) })).toBe(true);
    expect(ok({ fees: Array(31).fill(base.fees[0]) })).toBe(false);
    expect(ok({ fees: [{ ...base.fees[0], amount: 10_001 }] })).toBe(false);
    expect(ok({ fees: [{ ...base.fees[0], amount: -1 }] })).toBe(false);
  });

  it("strips control characters and rejects empty or long names", () => {
    const parsed = Submission.parse({ ...base, fees: [{ ...base.fees[0], name: " Admin\u0000 fee\n" }] });
    expect(parsed.fees[0].name).toBe("Admin fee");
    expect(ok({ fees: [{ ...base.fees[0], name: "\u0007" }] })).toBe(false);
    expect(ok({ fees: [{ ...base.fees[0], name: "x".repeat(81) }] })).toBe(false);
    expect(ok({ complexName: "" })).toBe(false);
  });

  it("rejects categories and ids we don't know", () => {
    expect(ok({ fees: [{ ...base.fees[0], category: "bribe" }] })).toBe(false);
    expect(ok({ id: "brexx" })).toBe(false);
  });
});

describe("clientHash", () => {
  it("is stable within a day and changes with the date, so days can't be linked", () => {
    const a = clientHash("203.0.113.5", "salt", "2026-10-24");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(clientHash("203.0.113.5", "salt", "2026-10-24")).toBe(a);
    expect(clientHash("203.0.113.5", "salt", "2026-10-25")).not.toBe(a);
    expect(clientHash("203.0.113.6", "salt", "2026-10-24")).not.toBe(a);
  });
});
