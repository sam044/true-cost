// Blacksburg utility estimates (F9). Owner: Andy (B). When a listing says a
// utility is not included, we add an editable "estimate" fee for it so the true
// cost isn't missing the bill. Amounts are per unit per month and get split
// across roommates like any per-unit fee. Researched Oct 24, 2026.
import type { Apartment, Fee, FeeCategory, UtilityName } from "./types";

export interface UtilityEstimate {
  label: string;
  category: FeeCategory;
  monthlyPerUnit: number;
  basis: string; // how the number was worked out, shown to the user
  sourceLabel: string;
  sourceUrl: string;
}

export const UTILITY_ESTIMATES: Record<UtilityName, UtilityEstimate> = {
  electric: {
    label: "Electric",
    category: "utility_fee",
    monthlyPerUnit: 120,
    basis: "About 750 kWh a month at Appalachian Power's 16.36¢ per kWh",
    sourceLabel: "Appalachian Power rates, Oct 2025",
    sourceUrl:
      "https://www.wsls.com/news/local/2025/10/23/appalachian-power-announces-lower-energy-rates-for-virginia-residents",
  },
  water: {
    label: "Water and sewer",
    category: "utility_fee",
    monthlyPerUnit: 70,
    basis: "4,000 gallons a month at Town of Blacksburg water and sewer rates",
    sourceLabel: "Town of Blacksburg utility rates, FY2026",
    sourceUrl:
      "https://www.blacksburg.gov/departments/departments-a-k/financial-services/utility-service",
  },
  gas: {
    label: "Gas",
    category: "utility_fee",
    monthlyPerUnit: 35,
    basis: "Atmos Energy's $13.24 customer charge and delivery rate, plus an estimate for the gas itself",
    sourceLabel: "Atmos Energy Virginia tariff, Feb 2026",
    sourceUrl:
      "https://www.atmosenergy.com/static/5b61c7161ee8a686d343398f54093cb0/Virginia%20Tariffs%20February%202026.pdf",
  },
  internet: {
    label: "Internet",
    category: "internet",
    monthlyPerUnit: 50,
    basis: "A typical Blacksburg home plan; advertised plans run about $30 to $130",
    sourceLabel: "Blacksburg internet plans, 2026",
    sourceUrl: "https://broadbandmap.com/internet-providers/blacksburg-va",
  },
  trash: {
    label: "Trash",
    category: "trash",
    monthlyPerUnit: 33,
    basis: "Town of Blacksburg refuse fee of $32.67 a month",
    sourceLabel: "Town of Blacksburg utility rates, FY2026",
    sourceUrl:
      "https://www.blacksburg.gov/departments/departments-a-k/financial-services/utility-service",
  },
};

const UTILITIES = Object.keys(UTILITY_ESTIMATES) as UtilityName[];
const estimateId = (utility: UtilityName) => `estimate-${utility}`;

// A listing fee in these categories already covers the utility, so no estimate.
// Electric, water and gas have no reliable category: a "utility service fee"
// often covers water or trash but rarely electric, so we don't guess.
const COVERED_BY: Partial<Record<UtilityName, FeeCategory>> = {
  internet: "internet",
  trash: "trash",
};

// Adds an estimate fee for each utility marked not_included. Safe to call again:
// existing estimate rows (and the user's edits to them) are kept. Returns the
// same object when nothing changes.
export function withUtilityEstimates(apartment: Apartment): Apartment {
  const added: Fee[] = [];
  for (const utility of UTILITIES) {
    if (apartment.utilities[utility] !== "not_included") continue;
    if (apartment.fees.some((f) => f.id === estimateId(utility))) continue;
    const coveredBy = COVERED_BY[utility];
    if (coveredBy && apartment.fees.some((f) => f.category === coveredBy)) continue;
    const e = UTILITY_ESTIMATES[utility];
    added.push({
      id: estimateId(utility),
      name: e.label,
      category: e.category,
      amount: e.monthlyPerUnit,
      frequency: "monthly",
      basis: "per_unit",
      mandatory: "yes",
      counted: true,
      refundable: false,
      quote: null,
      source: "estimate",
      confidence: "medium",
    });
  }
  return added.length === 0 ? apartment : { ...apartment, fees: [...apartment.fees, ...added] };
}

// The research behind an estimate row, or null for any other fee.
export function estimateFor(fee: Fee): UtilityEstimate | null {
  if (fee.source !== "estimate") return null;
  const utility = UTILITIES.find((u) => estimateId(u) === fee.id);
  return utility ? UTILITY_ESTIMATES[utility] : null;
}
