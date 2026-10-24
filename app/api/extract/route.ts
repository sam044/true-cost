// POST /api/extract. Owner: Sam (A).
// Body: { images: string[] (base64 JPEG/PNG/WebP data URLs, max 5), text?: string }
// Returns: Extraction (lib/types.ts), validated, quote-checked, low confidence first.
// Errors: { error: string } with 400 (bad input), 422 (unreadable), 502 (model down).
import { NextResponse } from "next/server";
import { z } from "zod";
import { ExtractionError, extractFees } from "@/lib/ai/gemma";

// Gemma can be slow under load; lib/ai/gemma.ts keeps the whole request under 280s.
// 300s is the Vercel Hobby limit with fluid compute.
export const maxDuration = 300;

const DataUrl = z
  .string()
  .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, "Images must be base64 data URLs.");

const Body = z.object({
  images: z.array(DataUrl).max(5),
  text: z.string().trim().max(20000).optional(),
});

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success || (parsed.data.images.length === 0 && !parsed.data.text)) {
    return NextResponse.json({ error: "Send at least one image or some text." }, { status: 400 });
  }

  const images = parsed.data.images.map((url) => {
    const [, mimeType, data] = url.match(/^data:(image\/\w+);base64,(.*)$/)!;
    return { mimeType, data };
  });

  try {
    const { extraction, model } = await extractFees({ images, text: parsed.data.text || undefined });
    return NextResponse.json(extraction, { headers: { "x-model": model } });
  } catch (e) {
    console.error("extract failed:", e instanceof Error ? e.message : e);
    if (e instanceof ExtractionError) {
      return NextResponse.json(
        { error: "We couldn't read this listing. Try clearer screenshots or paste the text instead." },
        { status: 422 },
      );
    }
    return NextResponse.json(
      { error: "The fee reader is unavailable right now. Try again in a moment, or paste the text instead." },
      { status: 502 },
    );
  }
}
