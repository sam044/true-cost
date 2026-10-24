import path from "node:path";
import { describe, expect, it } from "vitest";
import { entriesFromCases } from "./cases";
import { findQuote } from "./convert";
import { catalogApartment, catalogIdOf, getCatalog } from "./index";
import seed from "./seed.json";

const fresh = entriesFromCases(path.resolve(__dirname, "../../eval/cases"));

describe("catalog seed", () => {
  it("has one entry per eval case with unique ids", () => {
    expect(fresh).toHaveLength(8);
    const ids = fresh.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    const feeIds = fresh.flatMap((e) => e.apartment.fees.map((f) => f.id));
    expect(new Set(feeIds).size).toBe(feeIds.length);
  });

  it("gives every complex reviewed, quoted fees", () => {
    for (const entry of fresh) {
      expect(entry.apartment.reviewed).toBe(true);
      expect(entry.apartment.fees.length).toBeGreaterThan(0);
      expect(entry.apartment.advertised.amount).toBe(entry.priceRange.min);
      for (const fee of entry.apartment.fees) {
        expect(fee.source).toBe("ai");
        expect(fee.quote, `${entry.id}: ${fee.name}`).not.toBeNull();
        expect(fee.counted).toBe(fee.mandatory !== "no");
      }
    }
  });

  it("matches the committed seed.json (rerun scripts/build-catalog.ts)", () => {
    expect(seed).toEqual(fresh);
  });
});

describe("findQuote", () => {
  it("joins a name line with the amount line below it", () => {
    expect(findQuote("Deposit\n$400-$1500", "Deposit", 400)).toBe("Deposit $400-$1500");
  });

  it("returns null when no line has both the amount and a name word", () => {
    expect(findQuote("Parking Fee N/A", "Surface Parking", 30)).toBeNull();
  });
});

describe("catalog apartments", () => {
  it("get a fresh id that maps back to the entry", () => {
    const entry = getCatalog()[0];
    const a = catalogApartment(entry);
    const b = catalogApartment(entry);
    expect(a.id).not.toBe(b.id);
    expect(catalogIdOf(a.id)).toBe(entry.id);
    expect(catalogIdOf("brexx")).toBeNull();
  });

  it("adds utility estimates where the listing says utilities aren't included", () => {
    const house = getCatalog().find((e) => e.id === "christopher-drive-house");
    expect(house?.apartment.fees.some((f) => f.source === "estimate")).toBe(true);
  });
});
