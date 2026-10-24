// Virginia fee flags. Owner: Andy (B). Computed by code on confirmed fees,
// never by the model. Statutes were read on law.lis.virginia.gov on Oct 24, 2026.
import type { Apartment, LawFlag, Setup } from "./types";

export const CITATIONS = {
  advertised_price: {
    label: "Va. Code § 59.1-608(A)",
    url: "https://law.lis.virginia.gov/vacode/title59.1/chapter60/section59.1-608/",
  },
  deposit_cap: {
    label: "Va. Code § 55.1-1226(A)",
    url: "https://law.lis.virginia.gov/vacode/title55.1/chapter12/section55.1-1226/",
  },
  first_page_itemization: {
    label: "Va. Code § 55.1-1204.1",
    url: "https://law.lis.virginia.gov/vacode/title55.1/chapter12/section55.1-1204.1/",
  },
} as const;

export const LEGAL_AID_URL = "https://www.virginialawhelp.org/";

export function flagsFor(apartment: Apartment, setup: Setup): LawFlag[] {
  // TODO(Andy): implement the three triggers from the PRD:
  // 1. advertised_price (issue): a counted, mandatory, recurring fee is not in the advertised price
  // 2. deposit_cap (issue): security deposit > 2 x monthly rent on the same basis
  // 3. first_page_itemization (info): any one-time fee or deposit was found in a listing
  void apartment;
  void setup;
  return [];
}
