// Mock fee index responses for building the Compare panel before Sam's
// GET /api/index/complex exists. Used only when NEXT_PUBLIC_INDEX_MOCK=1.
// Amounts come from the hand-labelled eval cases in eval/cases/.
import type { IndexSummary } from "@/lib/fee-index";

const LAST_SEEN = "2026-10-24T19:00:00Z";

const MOCKS: Record<string, IndexSummary> = {
  brexx: {
    found: true,
    complex: { slug: "brexx", name: "Brexx at Blacksburg", verified: true },
    reports: 3,
    medianAdvertised: 1069,
    includesSeed: true,
    lastSeen: LAST_SEEN,
    fees: [
      { category: "admin", frequency: "one_time", name: "Admin fee", reports: 3, median: 150, low: 150, high: 150 },
      { category: "application", frequency: "one_time", name: "Application fee", reports: 3, median: 50, low: 50, high: 50 },
      { category: "utility_fee", frequency: null, name: "Utility fee", reports: 3, median: 62, low: 62, high: 62 },
      { category: "insurance", frequency: "monthly", name: "Renter's insurance", reports: 3, median: 15, low: 15, high: 15 },
      { category: "trash", frequency: "monthly", name: "Trash", reports: 2, median: 6, low: 6, high: 8 },
      { category: "parking", frequency: "monthly", name: "Parking", reports: 2, median: 50, low: 45, high: 50 },
      { category: "other", frequency: "monthly", name: "Credit reporting fee", reports: 2, median: 9, low: 9, high: 9 },
    ],
  },
  hub: {
    found: true,
    complex: { slug: "hub", name: "Hub Blacksburg", verified: true },
    reports: 2,
    medianAdvertised: 1150,
    includesSeed: true,
    lastSeen: LAST_SEEN,
    fees: [
      { category: "admin", frequency: "one_time", name: "Admin fee", reports: 2, median: 200, low: 200, high: 200 },
      { category: "application", frequency: "one_time", name: "Application fee", reports: 2, median: 35, low: 35, high: 35 },
      { category: "parking", frequency: "monthly", name: "Parking", reports: 2, median: 30, low: 30, high: 30 },
      { category: "amenity", frequency: "monthly", name: "Amenity fee", reports: 1, median: 25, low: 25, high: 25 },
    ],
  },
  "tee-street": {
    found: true,
    complex: { slug: "tee-street", name: "203-209 Tee Street", verified: true },
    reports: 1,
    medianAdvertised: 2400,
    includesSeed: true,
    lastSeen: LAST_SEEN,
    fees: [
      { category: "admin", frequency: "one_time", name: "Admin fee", reports: 1, median: 199, low: 199, high: 199 },
      { category: "reconditioning", frequency: "one_time", name: "Reconditioning fee", reports: 1, median: 299, low: 299, high: 299 },
    ],
  },
};

// A rough stand-in for Sam's complexKey(); good enough for the mock.
export function mockSummary(name: string): IndexSummary | null {
  const n = name.toLowerCase();
  if (n.includes("brexx")) return MOCKS.brexx;
  if (n.includes("hub")) return MOCKS.hub;
  if (n.includes("tee")) return MOCKS["tee-street"];
  return null;
}
