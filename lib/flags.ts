// Virginia fee flags. Owner: Andy (B). Computed by code on confirmed fees,
// never by the model. Statutes were read on law.lis.virginia.gov on Oct 24, 2026.
//
// "Found in the listing" means source === "ai": the fee was read from what the
// user uploaded. Fees typed in by hand and utility estimates never trigger a flag.
// Wording says "may" and describes what to ask; it never accuses a landlord.
import { perPerson } from "./cost";
import type { Apartment, Fee, LawFlag, Setup } from "./types";

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

const dollars = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const fromListing = (fee: Fee) => fee.source === "ai";
const isDeposit = (fee: Fee) => fee.category === "security_deposit";

// 1. A counted, mandatory, recurring fee from the listing that the advertised
// price leaves out. Whether a listing site counts as the landlord's
// advertisement is not ours to judge, so the flag says "may".
function advertisedPrice(apartment: Apartment): LawFlag | null {
  const fees = apartment.fees.filter(
    (f) =>
      fromListing(f) &&
      f.counted &&
      f.mandatory === "yes" &&
      f.frequency !== "one_time" &&
      f.category !== "base_rent" &&
      !isDeposit(f),
  );
  if (fees.length === 0) return null;
  return {
    id: "advertised_price",
    severity: "issue",
    title: "Advertised price may not include required fees",
    explanation:
      "Virginia requires advertised prices to clearly show the total price, including every " +
      `mandatory fee. This listing shows required recurring fees (${fees.map((f) => f.name).join(", ")}) ` +
      "on top of the headline price. Ask the leasing office for the full monthly price in writing.",
    citation: CITATIONS.advertised_price,
    feeIds: fees.map((f) => f.id),
  };
}

// 2. Security deposits totalling more than 2 months' rent, compared per person.
// Deposits count whether or not the user included them in the true cost.
function depositCap(apartment: Apartment, setup: Setup): LawFlag | null {
  const rent = perPerson(apartment.advertised.amount, apartment.advertised.basis, setup);
  const deposits = apartment.fees.filter((f) => isDeposit(f) && f.mandatory !== "no");
  const total = deposits.reduce((sum, f) => sum + perPerson(f.amount, f.basis, setup), 0);
  if (rent <= 0 || total <= 2 * rent) return null;
  return {
    id: "deposit_cap",
    severity: "issue",
    title: "Deposit may be above the legal limit",
    explanation:
      `The security deposit works out to ${dollars(total)} per person, more than two months' rent ` +
      `(${dollars(2 * rent)}). In Virginia a landlord may not require more than two months' rent as a ` +
      "deposit, and must return it or itemize deductions within 45 days of move-out. Ask how the " +
      "deposit was calculated.",
    citation: CITATIONS.deposit_cap,
    feeIds: deposits.map((f) => f.id),
  };
}

// 3. Any one-time fee or deposit from the listing: a reminder, not an issue.
function firstPageItemization(apartment: Apartment): LawFlag | null {
  const fees = apartment.fees.filter((f) => fromListing(f) && f.frequency === "one_time");
  if (fees.length === 0) return null;
  return {
    id: "first_page_itemization",
    severity: "info",
    title: "Check page 1 of the lease",
    explanation:
      "Virginia leases must list the deposit, rent and every one-time charge due before move-in on " +
      "the first page, under a statement that nothing else will be charged unless listed. Make " +
      `sure ${fees.map((f) => f.name).join(", ")} appear there before you sign.`,
    citation: CITATIONS.first_page_itemization,
    feeIds: fees.map((f) => f.id),
  };
}

// Issues first, then information.
export function flagsFor(apartment: Apartment, setup: Setup): LawFlag[] {
  return [
    advertisedPrice(apartment),
    depositCap(apartment, setup),
    firstPageItemization(apartment),
  ].filter((f): f is LawFlag => f != null);
}
