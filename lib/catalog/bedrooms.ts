// Bedroom counts for catalog listings priced for the whole unit, so their price
// is never split more ways than the unit has bedrooms. Owner: Andy (B).

// "3 Bedroom House" -> 3, "2 - 3 Beds" -> 2 (the low end, which matches the
// lowest price), "Studio..." -> 1, anything else -> null.
export function bedroomsFromText(text: string): number | null {
  if (/\bstudio\b/i.test(text)) return 1;
  const m = text.match(/(\d+)(?:\s*[-–]\s*\d+)?\s*(?:beds?|bedrooms?|br)\b/i);
  return m ? Number(m[1]) : null;
}
