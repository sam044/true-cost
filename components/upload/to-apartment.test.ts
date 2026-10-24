import { describe, expect, it } from "vitest";
import type { Extraction, ExtractedFee, Setup } from "@/lib/types";
import { toApartment } from "./to-apartment";

const fee = (over: Partial<ExtractedFee>): ExtractedFee => ({
  name: "Fee",
  category: "other",
  amount: 10,
  frequency: "monthly",
  basis: "per_person",
  mandatory: "yes",
  refundable: false,
  quote: "Fee $10",
  sourceImage: 0,
  confidence: "high",
  ...over,
});

const extraction = (fees: ExtractedFee[], over: Partial<Extraction> = {}): Extraction => ({
  transcript: [],
  advertisedPrice: { amount: 1000, basis: "per_person", quote: "$1,000" },
  bedrooms: null,
  utilities: { electric: "unknown", water: "unknown", gas: "unknown", internet: "unknown", trash: "unknown" },
  fees,
  ...over,
});

const setup = (needs?: Setup["needs"]): Setup => ({ people: 4, leaseMonths: 12, needs });

describe("toApartment", () => {
  it("counts optional fees only for extras the student said they need", () => {
    const fees = [
      fee({ name: "Parking", category: "parking", mandatory: "no" }),
      fee({ name: "Pet rent", category: "pet", mandatory: "no" }),
    ];
    const apt = toApartment("Maple", extraction(fees), setup({ parking: true, pet: false, furnished: false }));
    const counted = Object.fromEntries(apt.fees.map((f) => [f.name, f.counted]));
    expect(counted).toEqual({ Parking: true, "Pet rent": false });
  });

  it("always counts required and unknown fees", () => {
    const apt = toApartment("Maple", extraction([fee({ mandatory: "unknown" }), fee({})]), setup());
    expect(apt.fees.every((f) => f.counted)).toBe(true);
  });

  it("adds utility estimates for utilities the listing says aren't included", () => {
    const apt = toApartment(
      "Maple",
      extraction([], {
        utilities: { electric: "not_included", water: "included", gas: "unknown", internet: "unknown", trash: "unknown" },
      }),
      setup(),
    );
    expect(apt.fees.map((f) => f.id)).toEqual(["estimate-electric"]);
  });

  it("keeps the listing's contact email", () => {
    const apt = toApartment("Maple", extraction([], { contactEmail: "leasing@maple.com" }), setup());
    expect(apt.contactEmail).toBe("leasing@maple.com");
  });
});
