// Gemma 4 client. Owner: Sam (A). Server-only: never import from a client component.
import "server-only";
import { GoogleGenAI } from "@google/genai";

export const PRIMARY_MODEL = "gemma-4-26b-a4b-it";
export const FALLBACK_MODEL = "gemma-4-31b-it";

let client: GoogleGenAI | null = null;

export function gemma(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set (see .env.example)");
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

// TODO(Sam): system instruction, the record_fees function declaration, the
// call with images + text, one retry on invalid output, fallback model on 5xx.
