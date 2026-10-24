// POST /api/email. Owner: Andy (B). P1 (F10).
// Body: EmailRequest (lib/email.ts): apartment name, advertised rent, counted
// fees and flag ids. Never images, quotes or Setup.
// Returns: { subject, body, source: "gemma" | "template" }. Always a usable
// draft: if Gemma fails or its draft quotes an amount we didn't give it, the
// plain template is returned instead. Errors: 400 for invalid input.
import { NextResponse } from "next/server";
import { ThinkingLevel } from "@google/genai";
import { FALLBACK_MODEL, PRIMARY_MODEL, gemma } from "@/lib/ai/gemma";
import { EMAIL_SYSTEM_INSTRUCTION, EmailRequest, draftEmail } from "@/lib/email";

export const maxDuration = 60;

// Primary model first; on any error try the fallback model once.
async function generate(prompt: string): Promise<string | undefined> {
  let lastError: unknown;
  for (const model of [PRIMARY_MODEL, FALLBACK_MODEL]) {
    try {
      const res = await gemma().models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          temperature: 0.3,
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
          systemInstruction: EMAIL_SYSTEM_INSTRUCTION,
          abortSignal: AbortSignal.timeout(25_000),
        },
      });
      return res.text;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

export async function POST(request: Request) {
  const parsed = EmailRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "That apartment's fees couldn't be read." }, { status: 400 });
  }
  return NextResponse.json(await draftEmail(parsed.data, generate));
}
