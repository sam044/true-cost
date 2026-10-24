// Turns a Gemma response into a validated Extraction. Owner: Sam (A).
// Both paths (a record_fees function call, or plain JSON text) go through the
// same Zod validator.
import { Extraction } from "@/lib/types";

export type ParseResult = { ok: true; data: Extraction } | { ok: false; error: string };

// Pull the first JSON object out of model text, tolerating ```json fences and
// prose around it.
export function jsonFromText(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON object in the response.");
  return JSON.parse(body.slice(start, end + 1));
}

export function parseExtraction(
  args: Record<string, unknown> | undefined,
  text: string | undefined,
): ParseResult {
  let raw: unknown = args;
  if (raw === undefined) {
    if (!text) return { ok: false, error: "The response had no record_fees call and no text." };
    try {
      raw = jsonFromText(text);
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Invalid JSON." };
    }
  }
  const result = Extraction.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 10)
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    return { ok: false, error: issues };
  }
  return { ok: true, data: result.data };
}
