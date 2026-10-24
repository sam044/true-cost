import { describe, expect, it } from "vitest";
import { CITATIONS, flagsFor } from "./flags";
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
    quote: "Fee $100",
    source: "ai",
    confidence: "high",
    ...patch,
  };
}

function apartment(fees: Fee[], advertised: Apartment["advertised"] = {
  amount: 1000,
  basis: "per_person",
  quote: "$1,000/bed",
}): Apartment {
  return {
    id: "a",
    name: "Test",
    advertised,
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

const ids = (apt: Apartment, s: Setup = setup) => flagsFor(apt, s).map((f) => f.id);

describe("advertised_price flag", () => {
  it("flags a counted, mandatory, recurring fee from the listing", () => {
    const [flag] = flagsFor(apartment([fee({ id: "amenity", category: "amenity" })]), setup);
    expect(flag.id).toBe("advertised_price");
    expect(flag.severity).toBe("issue");
    expect(flag.feeIds).toEqual(["amenity"]);
    expect(flag.citation).toEqual(CITATIONS.advertised_price);
  });

  it("covers per-semester and annual fees too", () => {
    expect(ids(apartment([fee({ frequency: "per_semester" })]))).toEqual(["advertised_price"]);
    expect(ids(apartment([fee({ frequency: "annual" })]))).toEqual(["advertised_price"]);
  });

  it("ignores optional, unknown, uncounted, hand-added, estimated and base-rent fees", () => {
    expect(
      ids(
        apartment([
          fee({ mandatory: "no" }),
          fee({ mandatory: "unknown" }),
          fee({ counted: false }),
          fee({ source: "user" }),
          fee({ source: "estimate" }),
          fee({ category: "base_rent" }),
        ]),
      ),
    ).toEqual([]);
  });
});

describe("advertised_price flag and included fees", () => {
  it("does not fire for fees the listing says its price already includes", () => {
    expect(ids(apartment([fee({ category: "insurance", includedInAdvertised: true })]))).toEqual([]);
  });
});

describe("deposit_cap flag", () => {
  it("flags a deposit above two months' rent on the same basis", () => {
    // Rent is $2,400 per unit; a $5,000 per-unit deposit is more than 2 x 2,400.
    const apt = apartment(
      [fee({ id: "dep", category: "security_deposit", amount: 5000, basis: "per_unit", frequency: "one_time", refundable: true })],
      { amount: 2400, basis: "per_unit", quote: null },
    );
    const flag = flagsFor(apt, setup).find((f) => f.id === "deposit_cap");
    expect(flag?.severity).toBe("issue");
    expect(flag?.feeIds).toEqual(["dep"]);
  });

  it("compares per person when rent and deposit use different bases", () => {
    // Rent $1,000 per person; a $8,000 per-unit deposit is $2,000 each: exactly 2 months, allowed.
    const ok = apartment([
      fee({ category: "security_deposit", amount: 8000, basis: "per_unit", frequency: "one_time" }),
    ]);
    expect(ids(ok)).not.toContain("deposit_cap");
    const over = apartment([
      fee({ category: "security_deposit", amount: 8004, basis: "per_unit", frequency: "one_time" }),
    ]);
    expect(ids(over)).toContain("deposit_cap");
  });

  it("adds up several deposits, counted or not, and skips optional ones", () => {
    const apt = apartment([
      fee({ id: "d1", category: "security_deposit", amount: 1500, frequency: "one_time", counted: false }),
      fee({ id: "d2", category: "security_deposit", amount: 600, frequency: "one_time", source: "user" }),
      fee({ id: "pet", category: "security_deposit", amount: 900, frequency: "one_time", mandatory: "no" }),
    ]);
    const flag = flagsFor(apt, setup).find((f) => f.id === "deposit_cap");
    expect(flag?.feeIds).toEqual(["d1", "d2"]);
  });

  it("does nothing when the rent is unknown", () => {
    const apt = apartment(
      [fee({ category: "security_deposit", amount: 5000, frequency: "one_time" })],
      { amount: 0, basis: "per_person", quote: null },
    );
    expect(ids(apt)).not.toContain("deposit_cap");
  });
});

describe("first_page_itemization flag", () => {
  it("is an info flag listing one-time fees and deposits found in the listing", () => {
    const apt = apartment([
      fee({ id: "admin", category: "admin", frequency: "one_time", amount: 150 }),
      fee({ id: "typed", category: "admin", frequency: "one_time", source: "user" }),
      fee({ id: "monthly", mandatory: "no" }),
    ]);
    const flag = flagsFor(apt, setup).find((f) => f.id === "first_page_itemization");
    expect(flag?.severity).toBe("info");
    expect(flag?.feeIds).toEqual(["admin"]);
  });

  it("is absent when nothing one-time came from the listing", () => {
    expect(ids(apartment([fee({ mandatory: "no" })]))).toEqual([]);
  });
});

describe("sample apartments", () => {
  it("gives the expected flags, issues first", () => {
    // Brexx's utility fee is mandatory "unknown", so only the info flag fires.
    expect(ids(mockApartments[0])).toEqual(["first_page_itemization"]);
    // Tee Street's deposit is $600 each against $600 rent: within the cap.
    expect(ids(mockApartments[2])).toEqual(["first_page_itemization"]);
    const flags = flagsFor(
      apartment([
        fee({ category: "admin", frequency: "one_time" }),
        fee({ category: "amenity" }),
      ]),
      setup,
    );
    expect(flags.map((f) => f.severity)).toEqual(["issue", "info"]);
  });

  it("words every flag as information, never an accusation", () => {
    const apt = apartment(
      [
        fee({ category: "amenity" }),
        fee({ category: "security_deposit", amount: 5000, frequency: "one_time" }),
      ],
    );
    for (const flag of flagsFor(apt, setup)) {
      expect(flag.title.length).toBeGreaterThan(0);
      expect(flag.explanation).not.toMatch(/illegal|violat|breaking the law/i);
    }
  });
});
