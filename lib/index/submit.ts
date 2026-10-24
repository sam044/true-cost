// What a student shares with the fee index when they confirm an apartment on
// Review and opted in (F20). Owner: Andy (B). Runs in the browser (building the
// request) and on the server (validating it). Only fee facts are sent: never
// images, quotes, fee ids, `counted`, or anything from Setup.
import { z } from "zod";
import { Basis, FeeCategory, Frequency, Mandatory, Utilities, type Apartment } from "../types";

// Control characters out, whitespace collapsed, then trimmed.
const cleanText = (max: number) =>
  z
    .string()
    .transform((s) => s.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim())
    .pipe(z.string().min(1).max(max));

export const Submission = z.object({
  id: z.uuid(), // the apartment's id: re-confirming replaces the submission
  complexName: cleanText(120),
  listingUrl: z.url().max(500).optional(),
  advertised: z.number().min(0).max(10_000),
  advertisedBasis: Basis,
  utilities: Utilities,
  fees: z
    .array(
      z.object({
        category: FeeCategory,
        name: cleanText(80),
        amount: z.number().min(0).max(10_000),
        frequency: Frequency,
        basis: Basis,
        mandatory: Mandatory,
        refundable: z.boolean(),
      }),
    )
    .max(30),
});
export type Submission = z.infer<typeof Submission>;

const UUID_AT_END = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Uploaded apartments use a plain UUID; catalog ones end in "--<uuid>". Sample
// apartments ("brexx") have none, so they are never shared.
export function submissionIdFor(apartmentId: string): string | null {
  return apartmentId.match(UUID_AT_END)?.[0].toLowerCase() ?? null;
}

// The request for a reviewed apartment, or null if it shouldn't be shared.
// Utility estimates are our guesses, not something the student found, so they
// stay out; so does base rent, which is already `advertised`.
export function submissionFor(apartment: Apartment): Submission | null {
  const id = submissionIdFor(apartment.id);
  if (!id || !apartment.reviewed) return null;
  return {
    id,
    complexName: apartment.name,
    advertised: apartment.advertised.amount,
    advertisedBasis: apartment.advertised.basis,
    utilities: apartment.utilities,
    fees: apartment.fees
      .filter((f) => f.category !== "base_rent" && f.source !== "estimate")
      .slice(0, 30)
      .map(({ category, name, amount, frequency, basis, mandatory, refundable }) => ({
        category,
        name,
        amount,
        frequency,
        basis,
        mandatory,
        refundable,
      })),
  };
}
