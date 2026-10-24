// Display text for the fee enums, shared by the Review screen's controls.
import type { Basis, Fee, FeeCategory, Frequency } from "@/lib/types";

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  one_time: "One-time",
  monthly: "Monthly",
  per_semester: "Per semester",
  annual: "Annual",
};

export const BASIS_LABELS: Record<Basis, string> = {
  per_person: "Per person",
  per_unit: "Per unit",
};

export const MANDATORY_LABELS: Record<Fee["mandatory"], string> = {
  yes: "Required",
  no: "Optional",
  unknown: "Not sure",
};

export const CATEGORY_LABELS: Record<FeeCategory, string> = {
  base_rent: "Base rent",
  admin: "Admin",
  application: "Application",
  amenity: "Amenity",
  parking: "Parking",
  utility_fee: "Utility fee",
  internet: "Internet",
  trash: "Trash",
  pest: "Pest control",
  technology: "Technology",
  insurance: "Insurance",
  pet: "Pet",
  reconditioning: "Reconditioning",
  furniture: "Furniture",
  security_deposit: "Security deposit",
  other: "Other",
};

// A fee the user should look at before trusting it: the model was unsure, or
// it could not tell whether the fee is required.
export function needsCheck(fee: Fee): boolean {
  return fee.source === "ai" && (fee.confidence === "low" || fee.mandatory === "unknown");
}
