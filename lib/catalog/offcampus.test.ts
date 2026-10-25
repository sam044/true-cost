import { describe, expect, it } from "vitest";
import listings from "../../data/complexes/offcampus/listings.json";
import {
  categoryOf,
  checkPrices,
  displayName,
  offcampusToEntry,
  type OffcampusListing,
} from "../../scripts/complexes/offcampus-convert";
import { getCatalog } from "./index";
import offcampus from "./offcampus.json";

const all = listings as OffcampusListing[];
const byId = (id: string) => all.find((l) => l.id === id)!;

describe("offcampus.vt.edu catalog entries", () => {
  it("keeps the catalog at 100 or more complexes with unique ids", () => {
    const catalog = getCatalog();
    expect(catalog.length).toBeGreaterThanOrEqual(100);
    const ids = catalog.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Utility estimate rows share ids by design (lib/utilities.ts).
    const feeIds = catalog.flatMap((e) => e.apartment.fees.filter((f) => f.source !== "estimate").map((f) => f.id));
    expect(new Set(feeIds).size).toBe(feeIds.length);
  });

  it("only holds Blacksburg listings with a price and a priced, quoted fee", () => {
    for (const entry of offcampus) {
      expect(entry.url).toMatch(/^https:\/\/offcampus\.vt\.edu\/housing\/property\//);
      expect(entry.apartment.advertised.amount).toBeGreaterThan(0);
      expect(entry.apartment.reviewed).toBe(false);
      expect(entry.apartment.fees.length).toBeGreaterThan(0);
      for (const fee of entry.apartment.fees) {
        expect(fee.amount).toBeGreaterThan(0);
        expect(fee.quote).toContain("$");
      }
    }
  });

  it("matches the committed offcampus.json (rerun scripts/complexes/offcampus.ts)", () => {
    for (const entry of offcampus) {
      const listing = all.find((l) => entry.url.endsWith(l.path))!;
      expect(offcampusToEntry(listing, entry.id, entry.readOn)).toEqual(entry);
    }
  });

  it("reads Foxridge's monthly required fees, cents included", () => {
    const fox = offcampusToEntry(byId("fvqsq5t"), "foxridge", "2026-10-24")!;
    const monthly = fox.apartment.fees.filter((f) => f.frequency === "monthly").map((f) => [f.name, f.amount]);
    expect(monthly).toEqual([
      ["Utility - Billing Administrative Fee", 1.5],
      ["Internet Service", 65],
      ["Refuse Removal", 7],
    ]);
  });

  it("drops the duplicate dog and cat rows and makes pet fees optional", () => {
    const f35 = offcampusToEntry(byId("edgcljq"), "fourteen35", "2026-10-24")!;
    const pets = f35.apartment.fees.filter((f) => f.category === "pet");
    expect(pets.map((f) => f.name)).toEqual(["One-Time Pet Fee", "Monthly Pet Fee"]);
    expect(pets.every((f) => f.mandatory === "no" && !f.counted)).toBe(true);
  });

  it("leaves out listings posted by individuals", () => {
    const sublet = { ...byId("ocpc2t2l1g"), pmc: undefined };
    expect(offcampusToEntry(sublet, "x", "2026-10-24")).toBeNull();
  });

  it("names single units by bedrooms, kind and street", () => {
    expect(displayName(byId("ocpc2t2l1g"))).toBe("4 Bedroom House, 2001 Christopher Drive");
    expect(displayName(byId("e3wj6hp"))).toBe("3 Bedroom Townhouse, 2714 Quincy Ct");
    expect(displayName(byId("ocpbc6lvgb"))).toBe("Turner NW");
  });

  it("prices listings that mix per-bed and per-unit plans per person", () => {
    expect(checkPrices(byId("7pgnn3w"))).toEqual({ min: 894, max: 894, basis: "per_person" });
  });

  it("drops listings whose floor plans contradict each other", () => {
    expect(checkPrices(byId("6y68vyt"))).toHaveProperty("problem");
    expect(checkPrices(byId("wkg0gyl"))).toHaveProperty("problem");
    expect(offcampus.some((e) => e.url.endsWith("/wkg0gyl"))).toBe(false);
  });

  it("files utility billing fees as utilities, not admin fees", () => {
    expect(categoryOf("R", "Utility - Billing Administrative Fee")).toBe("utility_fee");
    expect(categoryOf("T", "Pet Deposit")).toBe("pet");
    expect(categoryOf("R", "Reservation Deposit")).toBe("security_deposit");
  });
});
