// POST /api/extract. Owner: Sam (A).
// Body: { images: string[] (base64 JPEG data URLs, max 5), text?: string }
// Returns: Extraction (lib/types.ts), already validated and quote-checked.
import { NextResponse } from "next/server";
import { z } from "zod";
import type { Extraction } from "@/lib/types";

const Body = z.object({
  images: z.array(z.string()).max(5),
  text: z.string().max(20000).optional(),
});

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success || (parsed.data.images.length === 0 && !parsed.data.text)) {
    return NextResponse.json({ error: "Send at least one image or some text." }, { status: 400 });
  }

  // TODO(Sam): call Gemma via lib/ai, validate with Extraction, run quote and
  // amount checks. Until then, return a fixed result so the Review UI can be built.
  const placeholder: Extraction = {
    transcript: ["$1,069 / bed  Administrative Fee $150  Utility Service Fee $62"],
    advertisedPrice: { amount: 1069, basis: "per_person", quote: "$1,069 / bed" },
    bedrooms: 4,
    utilities: {
      electric: "not_included",
      water: "unknown",
      gas: "unknown",
      internet: "included",
      trash: "unknown",
    },
    fees: [
      {
        name: "Administrative fee",
        category: "admin",
        amount: 150,
        frequency: "one_time",
        basis: "per_person",
        mandatory: "yes",
        refundable: false,
        quote: "Administrative Fee $150",
        sourceImage: 0,
        confidence: "high",
      },
      {
        name: "Utility service fee",
        category: "utility_fee",
        amount: 62,
        frequency: "monthly",
        basis: "per_person",
        mandatory: "unknown",
        refundable: false,
        quote: "Utility Service Fee $62",
        sourceImage: 0,
        confidence: "low",
      },
    ],
  };
  return NextResponse.json(placeholder);
}
