import { describe, expect, it } from "vitest";
import type { Extraction, ExtractedFee } from "@/lib/types";
import { amountIsInQuote, applyChecks, normalize, numbersIn, quoteIsGrounded } from "./checks";
import { jsonFromText, parseExtraction } from "./parse";

const fee = (over: Partial<ExtractedFee>): ExtractedFee => ({
  name: "Administrative fee",
  category: "admin",
  amount: 150,
  frequency: "one_time",
  basis: "per_person",
  mandatory: "yes",
  refundable: false,
  quote: "Administrative Fee $150",
  sourceImage: 0,
  confidence: "high",
  ...over,
});

const extraction = (fees: ExtractedFee[]): Extraction => ({
  transcript: ["$1,069 / bed\nAdministrative  Fee $150\nUtility Service Fee $62"],
  advertisedPrice: { amount: 1069, basis: "per_person", quote: "$1,069 / bed" },
  bedrooms: 4,
  utilities: { electric: "unknown", water: "unknown", gas: "unknown", internet: "unknown", trash: "unknown" },
  fees,
});

describe("normalize and numbers", () => {
  it("collapses whitespace, case and curly quotes", () => {
    expect(normalize("  Admin\n  FEE ’s ")).toBe("admin fee 's");
  });
  it("reads dollar amounts with commas and cents", () => {
    expect(numbersIn("$1,069.50 / bed, 4 beds")).toEqual([1069.5, 4]);
  });
});

describe("grounding checks", () => {
  it("finds a quote despite whitespace and case differences", () => {
    expect(quoteIsGrounded("administrative fee $150", ["Administrative  Fee $150"])).toBe(true);
    expect(quoteIsGrounded("Pet fee $300", ["Administrative Fee $150"])).toBe(false);
    expect(quoteIsGrounded("  ", ["anything"])).toBe(false);
  });
  it("matches the amount against numbers in the quote", () => {
    expect(amountIsInQuote(1069, "$1,069 / bed")).toBe(true);
    expect(amountIsInQuote(150, "Admin fee $1,500")).toBe(false);
  });
});

describe("applyChecks", () => {
  it("keeps grounded fees and lowers ungrounded ones, sorting low first", () => {
    const out = applyChecks(
      extraction([
        fee({}),
        fee({ name: "Pet fee", quote: "Pet fee $300", amount: 300 }),
        fee({ name: "Utility", quote: "Utility Service Fee $62", amount: 26, confidence: "medium" }),
      ]),
      { imageCount: 1 },
    );
    expect(out.fees.map((f) => [f.name, f.confidence])).toEqual([
      ["Pet fee", "low"],
      ["Utility", "low"],
      ["Administrative fee", "high"],
    ]);
  });
  it("accepts quotes from pasted text and rejects missing source images", () => {
    const ex = { ...extraction([fee({ quote: "Parking $30/month", amount: 30, sourceImage: 0 })]), transcript: [] };
    expect(applyChecks(ex, { imageCount: 0, pastedText: "Parking $30/month" }).fees[0].confidence).toBe("high");
    const bad = extraction([fee({ sourceImage: 3 })]);
    expect(applyChecks(bad, { imageCount: 1 }).fees[0].confidence).toBe("low");
  });
});

describe("parseExtraction", () => {
  it("accepts function-call args", () => {
    const r = parseExtraction(extraction([fee({})]) as unknown as Record<string, unknown>, undefined);
    expect(r.ok).toBe(true);
  });
  it("falls back to fenced JSON text", () => {
    const text = "Here you go:\n```json\n" + JSON.stringify(extraction([])) + "\n```";
    expect(jsonFromText(text)).toMatchObject({ bedrooms: 4 });
    expect(parseExtraction(undefined, text).ok).toBe(true);
  });
  it("reports schema errors with their paths", () => {
    const r = parseExtraction({ ...extraction([fee({})]), fees: [{ name: "x" }] }, undefined);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("fees.0");
  });
});
