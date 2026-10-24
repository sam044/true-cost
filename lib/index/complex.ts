// Normalizes a complex name to the key the fee index (F20) groups by.
// Owner: Andy (B). "Brexx at Blacksburg" and "BREXX Apartments" both become
// "brexx". Pure, so the API and the seed script share it.

// Phrases go before single words so "apartment homes" isn't half-removed.
const FILLER_PHRASES = ["apartment homes", "and townhomes", "at blacksburg", "of blacksburg"];
const FILLER_WORDS = new Set([
  "the",
  "apartments",
  "apartment",
  "townhomes",
  "blacksburg",
  "va",
  "virginia",
]);

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join("-");

export function complexKey(name: string): string {
  // "Brexx - Apartments for Rent", "Hub | Student Housing": keep the part before.
  const base = name.split(/\s[-|–]\s/)[0];
  let text = ` ${base.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9-]+/g, " ")} `;
  for (const phrase of FILLER_PHRASES) text = text.replaceAll(` ${phrase} `, " ");
  const words = text.split(/\s+/).filter((w) => w && !FILLER_WORDS.has(w));
  return words.length > 0 ? words.join("-") : slug(base);
}
