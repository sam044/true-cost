// Turns a validated extraction from POST /api/extract into an apartment for the
// store. Owner: Sam (A). Used by the import page (extension) and the Add screen.
import { defaultCounted } from "@/lib/cost";
import type { Apartment, Extraction, Fee, Setup } from "@/lib/types";
import { withUtilityEstimates } from "@/lib/utilities";

export function toApartment(name: string, extraction: Extraction, setup: Setup): Apartment {
  const fees: Fee[] = extraction.fees.map((fee) => {
    const f: Fee = {
      id: crypto.randomUUID(),
      name: fee.name,
      category: fee.category,
      amount: fee.amount,
      frequency: fee.frequency,
      basis: fee.basis,
      mandatory: fee.mandatory,
      counted: true,
      refundable: fee.refundable,
      quote: fee.quote,
      source: "ai",
      confidence: fee.confidence,
    };
    // Optional fees count only for extras the student said they need (Setup).
    return { ...f, counted: defaultCounted(f, setup) };
  });

  // Utilities the listing says aren't included get an editable estimate row.
  return withUtilityEstimates({
    id: crypto.randomUUID(),
    name: name.trim() || "Apartment",
    advertised: {
      amount: extraction.advertisedPrice.amount ?? 0,
      basis: extraction.advertisedPrice.basis,
      quote: extraction.advertisedPrice.quote,
    },
    utilities: extraction.utilities,
    fees,
    reviewed: false,
    // Already checked against the listing in lib/ai/checks.ts.
    ...(extraction.contactEmail ? { contactEmail: extraction.contactEmail } : {}),
  });
}
