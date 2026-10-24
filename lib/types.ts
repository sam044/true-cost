// Shared contract between the extraction side (Sam) and the compare side (Andy).
// Change this file only in a small PR, and say so in chat first.
import { z } from "zod";

export const FeeCategory = z.enum([
  "base_rent",
  "admin",
  "application",
  "amenity",
  "parking",
  "utility_fee",
  "internet",
  "trash",
  "pest",
  "technology",
  "insurance",
  "pet",
  "reconditioning",
  "furniture",
  "security_deposit",
  "other",
]);
export type FeeCategory = z.infer<typeof FeeCategory>;

export const Frequency = z.enum(["one_time", "monthly", "per_semester", "annual"]);
export type Frequency = z.infer<typeof Frequency>;

export const Basis = z.enum(["per_person", "per_unit"]);
export type Basis = z.infer<typeof Basis>;

export const Mandatory = z.enum(["yes", "no", "unknown"]);
export const Confidence = z.enum(["high", "medium", "low"]);
export const UtilityStatus = z.enum(["included", "not_included", "unknown"]);

// What Gemma returns through `record_fees`. Validated on the server before
// anything reaches the browser.
export const ExtractedFee = z.object({
  name: z.string().min(1),
  category: FeeCategory,
  amount: z.number().nonnegative(),
  frequency: Frequency,
  basis: Basis,
  mandatory: Mandatory,
  refundable: z.boolean(),
  quote: z.string(),
  sourceImage: z.number().int().nonnegative(),
  confidence: Confidence,
});
export type ExtractedFee = z.infer<typeof ExtractedFee>;

export const Utilities = z.object({
  electric: UtilityStatus,
  water: UtilityStatus,
  gas: UtilityStatus,
  internet: UtilityStatus,
  trash: UtilityStatus,
});
export type Utilities = z.infer<typeof Utilities>;
export type UtilityName = keyof Utilities;

export const Extraction = z.object({
  transcript: z.array(z.string()),
  advertisedPrice: z.object({
    amount: z.number().nonnegative().nullable(),
    basis: Basis,
    quote: z.string().nullable(),
  }),
  bedrooms: z.number().int().positive().nullable(),
  utilities: Utilities,
  fees: z.array(ExtractedFee),
});
export type Extraction = z.infer<typeof Extraction>;

// App state, after the user has seen and possibly edited the fees.
export interface Fee {
  id: string;
  name: string;
  category: FeeCategory;
  amount: number; // dollars
  frequency: Frequency;
  basis: Basis;
  mandatory: "yes" | "no" | "unknown";
  counted: boolean; // user toggle; defaults to true unless mandatory is "no"
  refundable: boolean;
  quote: string | null; // null for user-added fees and estimates
  source: "ai" | "user" | "estimate";
  confidence: "high" | "medium" | "low";
}

export interface Apartment {
  id: string;
  name: string;
  advertised: { amount: number; basis: Basis; quote: string | null };
  utilities: Utilities;
  fees: Fee[];
  reviewed: boolean;
}

export interface Setup {
  people: number; // people sharing the unit, 1 to 6
  leaseMonths: number; // default 12
  budget?: number; // optional monthly budget per person
}

// Output of lib/cost.ts for one apartment. All values are dollars per person.
export interface CostSummary {
  apartmentId: string;
  advertisedMonthly: number;
  trueMonthly: number;
  hiddenPerYear: number;
  leaseTotal: number;
  breakdown: {
    rent: number;
    recurringFees: number;
    utilities: number;
    oneTimeAndDeposits: number;
  };
  overBudget: boolean | null; // null when no budget was set
}

export type FlagSeverity = "issue" | "info";

export interface LawFlag {
  id: "advertised_price" | "deposit_cap" | "first_page_itemization";
  severity: FlagSeverity;
  title: string;
  explanation: string;
  citation: { label: string; url: string };
  feeIds: string[];
}
