import path from "node:path";
import { describe, expect, it } from "vitest";
import { complexKey } from "./complex";
import { seedRecords, seedSubmissionId } from "./seed";

const records = seedRecords(path.resolve(__dirname, "../../eval/cases"));

describe("seedRecords", () => {
  it("makes one verified complex per eval case with its 33 hand-labelled fees", () => {
    expect(records).toHaveLength(8);
    expect(records.flatMap((r) => r.fees)).toHaveLength(33);
    expect(records.every((r) => r.complex.verified)).toBe(true);
  });

  it("uses the case folder as the slug and adds the normalized name as an alias", () => {
    const edge = records.find((r) => r.complex.slug === "the-edge")!;
    expect(edge.complex.aliases).toContain(complexKey("The Edge Apartments and Townhomes"));
    const tee = records.find((r) => r.complex.slug === "tee-street")!;
    expect(tee.complex.aliases).toContain("203-209-tee-street");
    const fourteen = records.find((r) => r.complex.slug === "fourteen35")!;
    expect(fourteen.complex.aliases).toContain("1435");
    // Aliases never repeat the slug.
    for (const r of records) expect(r.complex.aliases).not.toContain(r.complex.slug);
  });

  it("finds every catalog name through its slug or an alias", () => {
    for (const r of records) {
      const key = complexKey(r.complex.name);
      expect([r.complex.slug, ...r.complex.aliases]).toContain(key);
    }
  });

  it("gives each seed submission a fixed UUID so re-running replaces it", () => {
    const brexx = records.find((r) => r.complex.slug === "brexx")!;
    expect(brexx.submission.id).toBe(seedSubmissionId("brexx"));
    expect(brexx.submission.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(seedSubmissionId("hub")).not.toBe(brexx.submission.id);
  });

  it("stores the low end of price and amount ranges, and keeps unknown frequencies null", () => {
    const brexx = records.find((r) => r.complex.slug === "brexx")!;
    expect(brexx.submission.advertised).toBe(1069);
    expect(brexx.fees.find((f) => f.name === "Utility Billing Fee")?.frequency).toBeNull();
    const foxridge = records.find((r) => r.complex.slug === "foxridge")!;
    expect(foxridge.fees.find((f) => f.name === "Deposit")?.amount).toBe(400);
  });
});
