// POST /api/email. Owner: Andy (B). P1.
// Body: { apartmentName: string, fees: Fee[], flags: LawFlag[] }
// Returns: { subject: string, body: string } drafted by Gemma 4.
import { NextResponse } from "next/server";

export async function POST() {
  // TODO(Andy): build the prompt from confirmed fees and flags (never raw images)
  // and call Gemma through lib/ai/gemma.ts.
  return NextResponse.json({ error: "Not implemented yet" }, { status: 501 });
}
