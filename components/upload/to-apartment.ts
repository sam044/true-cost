// Turns a validated extraction from POST /api/extract into an apartment for the
// store. Owner: Sam (A). Used by the import page (extension) and the Add screen.
import type { Apartment, Extraction } from "@/lib/types";

export function toApartment(name: string, extraction: Extraction): Apartment {
  return {
    id: crypto.randomUUID(),
    name: name.trim() || "Apartment",
    advertised: {
      amount: extraction.advertisedPrice.amount ?? 0,
      basis: extraction.advertisedPrice.basis,
      quote: extraction.advertisedPrice.quote,
    },
    utilities: extraction.utilities,
    fees: extraction.fees.map((fee) => ({
      id: crypto.randomUUID(),
      name: fee.name,
      category: fee.category,
      amount: fee.amount,
      frequency: fee.frequency,
      basis: fee.basis,
      mandatory: fee.mandatory,
      counted: fee.mandatory !== "no",
      refundable: fee.refundable,
      quote: fee.quote,
      source: "ai",
      confidence: fee.confidence,
    })),
    reviewed: false,
    // Already checked against the listing in lib/ai/checks.ts.
    ...(extraction.contactEmail ? { contactEmail: extraction.contactEmail } : {}),
  };
}
