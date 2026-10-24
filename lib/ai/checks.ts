// Grounding checks on Gemma's output. Owner: Sam (A). Pure functions, no I/O,
// so they run in tests and in the eval as well as in /api/extract.
import type { Extraction, ExtractedFee } from "@/lib/types";

// Lowercase, straighten quotes and dashes, collapse whitespace.
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

// Every number written in a quote, with "$" and thousands separators removed.
export function numbersIn(quote: string): number[] {
  const matches = quote.match(/\d[\d,]*(?:\.\d+)?/g) ?? [];
  return matches.map((m) => Number(m.replace(/,/g, ""))).filter((n) => Number.isFinite(n));
}

export function quoteIsGrounded(quote: string, sources: string[]): boolean {
  const q = normalize(quote);
  if (!q) return false;
  return sources.some((s) => normalize(s).includes(q));
}

export function amountIsInQuote(amount: number, quote: string): boolean {
  return numbersIn(quote).some((n) => Math.abs(n - amount) < 0.005);
}

const order = { low: 0, medium: 1, high: 2 } as const;

// Fees whose quote is not in the transcript (or the pasted text), whose amount
// is not in their quote, or whose source image does not exist drop to low
// confidence. Low-confidence fees sort first so Review shows them on top.
export function applyChecks(
  extraction: Extraction,
  opts: { pastedText?: string; imageCount: number },
): Extraction {
  const sources = [...extraction.transcript, ...(opts.pastedText ? [opts.pastedText] : [])];
  const fees: ExtractedFee[] = extraction.fees.map((fee) => {
    const grounded =
      quoteIsGrounded(fee.quote, sources) &&
      amountIsInQuote(fee.amount, fee.quote) &&
      (opts.imageCount === 0 || fee.sourceImage < opts.imageCount);
    return grounded ? fee : { ...fee, confidence: "low" };
  });
  fees.sort((a, b) => order[a.confidence] - order[b.confidence]);
  return { ...extraction, fees };
}
