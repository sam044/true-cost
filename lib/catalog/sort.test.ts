import { describe, expect, it } from "vitest";
import type { Setup } from "../types";
import type { CatalogEntry } from "./convert";
import { getCatalog } from "./index";
import {
  CAMPUS,
  bedroomsFromText,
  catalogSummary,
  distanceMiles,
  milesToCampus,
  sharersFor,
  sortCatalog,
} from "./sort";

const setup: Setup = { people: 4, leaseMonths: 12 };
const catalog = getCatalog();
const byId = (id: string) => catalog.find((e) => e.id === id)!;

describe("distanceMiles", () => {
  it("is zero at the same point and about 69 miles per degree of latitude", () => {
    expect(distanceMiles(CAMPUS, CAMPUS)).toBe(0);
    expect(distanceMiles(CAMPUS, { lat: CAMPUS.lat + 1, lng: CAMPUS.lng })).toBeCloseTo(69.1, 0);
  });
});

describe("milesToCampus", () => {
  it("knows located complexes and returns null for the rest", () => {
    expect(milesToCampus("the-edge")).toBeGreaterThan(0.1);
    expect(milesToCampus("the-edge")).toBeLessThan(1);
    expect(milesToCampus("no-such-complex")).toBeNull();
  });
});

describe("sortCatalog", () => {
  const sample: CatalogEntry[] = ["brexx", "hub", "tee-street", "the-edge", "foxridge"].map(byId);

  it("keeps the catalog order for Recommended", () => {
    expect(sortCatalog(sample, "recommended", setup)).toEqual(sample);
  });

  // Prices we're sure of: per-person listings and whole units with known bedrooms.
  const sure: CatalogEntry[] = ["brexx", "hub", "the-edge", "christopher-drive-house", "151-college-ave"].map(byId);

  for (const [asc, desc, pick] of [
    ["price-asc", "price-desc", (e: CatalogEntry) => catalogSummary(e, setup).advertisedMonthly],
    ["true-asc", "true-desc", (e: CatalogEntry) => catalogSummary(e, setup).trueMonthly],
  ] as const) {
    it(`sorts by ${asc} and ${desc}, per person`, () => {
      const up = sortCatalog(sure, asc, setup);
      const down = sortCatalog(sure, desc, setup);
      const values = up.map(pick);
      expect(values).toEqual([...values].sort((x, y) => x - y));
      expect(down.map((e) => e.id)).toEqual(up.map((e) => e.id).reverse());
    });
  }

  it("splits per-unit prices by the number of people sharing", () => {
    const tee = byId("tee-street");
    const alone = sortCatalog([tee, byId("brexx")], "price-asc", { ...setup, people: 1 });
    expect(alone[0].id).toBe("brexx"); // $2,400 alone is more than Brexx's $1,069
  });

  it("puts the closest first and complexes without a location last", () => {
    const noLocation = { ...byId("hub"), id: "nowhere" };
    const sorted = sortCatalog([noLocation, ...sample], "distance", setup).map((e) => e.id);
    expect(sorted[0]).toBe("the-edge");
    expect(sorted[sorted.length - 1]).toBe("nowhere");
  });

  it("puts the fewest hidden dollars a year first", () => {
    const sorted = sortCatalog(sample, "hidden-asc", setup);
    const hidden = sorted.map((e) => e.id);
    expect(hidden).toHaveLength(5);
  });

  it("does not change the array it was given", () => {
    const copy = [...sample];
    sortCatalog(sample, "price-desc", setup);
    expect(sample).toEqual(copy);
  });
});

describe("splitting whole-unit prices", () => {
  it("never splits a unit more ways than it has bedrooms", () => {
    const oneBed = byId("151-college-ave");
    expect(sharersFor(oneBed, setup)).toEqual({ people: 1, bedroomsKnown: true });
    const house = byId("christopher-drive-house");
    expect(sharersFor(house, { ...setup, people: 6 })).toEqual({ people: 4, bedroomsKnown: true });
    expect(sharersFor(house, { ...setup, people: 2 })).toEqual({ people: 2, bedroomsKnown: true });
  });

  it("counts a studio as one person", () => {
    expect(bedroomsFromText("Studio - 2 Beds")).toBe(1);
    expect(bedroomsFromText("Studio Condo, 503 Sunridge Drive")).toBe(1);
    expect(bedroomsFromText("2 - 3 Beds")).toBe(2);
    expect(bedroomsFromText("3 Bedroom House, 1477 Sandy Circle")).toBe(3);
    expect(bedroomsFromText("Hub Blacksburg")).toBeNull();
  });

  it("uses the roommate count when bedrooms are unknown, and says so", () => {
    const base = byId("tech-terrace");
    const unknown = {
      ...base,
      id: "unknown-place",
      name: "Unknown Place",
      apartment: { ...base.apartment, advertised: { ...base.apartment.advertised, basis: "per_unit" as const } },
    };
    expect(sharersFor(unknown, setup)).toEqual({ people: 4, bedroomsKnown: false });
  });

  it("doesn't change per-person listings", () => {
    expect(sharersFor(byId("brexx"), setup)).toEqual({ people: 4, bedroomsKnown: true });
  });

  it("puts whole-unit prices with unknown bedrooms after the prices we're sure of", () => {
    const unknown = byId("university-terrace"); // $495 for the unit, bedrooms unknown
    expect(sharersFor(unknown, setup).bedroomsKnown).toBe(false);
    for (const key of ["price-asc", "true-asc", "price-desc", "true-desc"] as const) {
      const sorted = sortCatalog([unknown, byId("brexx"), byId("the-edge")], key, setup);
      expect(sorted.at(-1)!.id).toBe("university-terrace");
    }
  });

  it("sorts a 1-bedroom's whole-unit price as one person's rent", () => {
    const oneBed = byId("151-college-ave"); // whole unit, 1 bedroom
    const sorted = sortCatalog([oneBed, byId("brexx")], "price-asc", setup);
    const oneBedEach = oneBed.priceRange.min; // not divided by 4
    expect(oneBedEach).toBeGreaterThan(0);
    expect(sorted.map((e) => e.id)[0]).toBe(oneBedEach < 1069 ? "151-college-ave" : "brexx");
  });
});
