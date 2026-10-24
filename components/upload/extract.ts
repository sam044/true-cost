// Calls POST /api/extract from the browser. Owner: Sam (A).
// Shared by the Add screen and the extension's import page.
import { Extraction } from "@/lib/types";

const FALLBACK = "We couldn't read this listing.";

export async function extractListing(input: { images: string[]; text?: string }): Promise<Extraction> {
  let response: Response;
  try {
    response = await fetch("/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images: input.images, text: input.text?.trim() || undefined }),
    });
  } catch {
    throw new Error("We couldn't reach True Cost. Check your connection and try again.");
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error ?? FALLBACK);
  const extraction = Extraction.safeParse(body);
  if (!extraction.success) throw new Error(FALLBACK);
  return extraction.data;
}
