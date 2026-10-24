// POST /api/index/submit. Owner: Andy (B). F20 write path.
// Body: Submission (lib/index/submit.ts), sent only when the student opted in on
// Review. Saves fee facts anonymously by complex; re-confirming an apartment
// replaces its submission. Returns 201 { complex }, 400 bad input, 403 wrong
// origin, 409 id clash, 429 too many today, 503 when the index is down.
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { clientHash } from "@/lib/index/client-hash";
import { complexKey } from "@/lib/index/complex";
import { IndexUnavailable, db } from "@/lib/index/db";
import { Submission } from "@/lib/index/submit";

export const runtime = "nodejs";

const MAX_PER_DAY = 10;

function salt(): string {
  // INDEX_SALT if set; otherwise a secret derived from the database URL, which
  // also never leaves the server.
  return process.env.INDEX_SALT ?? createHash("sha256").update(`salt:${process.env.DATABASE_URL}`).digest("hex");
}

// Only our own pages may submit.
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Submissions come from the True Cost app only." }, { status: 403 });
  }
  const parsed = Submission.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Those fees couldn't be read." }, { status: 400 });
  }
  const s = parsed.data;
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const hash = clientHash(ip, salt(), new Date().toISOString().slice(0, 10));

  try {
    const sql = db();

    // A seed submission's id can never be overwritten by a student.
    const [clash] = (await sql.query(`select source from submissions where id = $1`, [s.id])) as {
      source: string;
    }[];
    if (clash && clash.source !== "user") {
      return NextResponse.json({ error: "That apartment can't be shared." }, { status: 409 });
    }

    const [{ n }] = (await sql.query(
      `select count(*)::int as n from submissions where client_hash = $1 and id <> $2`,
      [hash, s.id],
    )) as { n: number }[];
    if (n >= MAX_PER_DAY) {
      return NextResponse.json({ error: "That's enough sharing for today. Thank you!" }, { status: 429 });
    }

    // Find the complex by name or alias; otherwise add it unverified. It shows
    // in the index only after 2 different devices report it.
    const key = complexKey(s.complexName) || "unknown";
    await sql.query(
      `insert into complexes (slug, name, listing_url) values ($1, $2, $3) on conflict (slug) do nothing`,
      [key, s.complexName, s.listingUrl ?? null],
    );
    const [complex] = (await sql.query(
      `select id, slug, name from complexes where slug = $1 or $1 = any(aliases)
       order by (slug = $1) desc limit 1`,
      [key],
    )) as { id: number; slug: string; name: string }[];

    // Replace this apartment's earlier submission, and today's earlier one from
    // this device for the same complex, so nothing is counted twice.
    await sql.transaction([
      sql.query(
        `delete from submissions where source = 'user' and (id = $1 or (complex_id = $2 and client_hash = $3))`,
        [s.id, complex.id, hash],
      ),
      sql.query(
        `insert into submissions (id, complex_id, source, advertised, advertised_basis, utilities, client_hash)
         values ($1, $2, 'user', $3, $4, $5, $6)`,
        [s.id, complex.id, s.advertised, s.advertisedBasis, JSON.stringify(s.utilities), hash],
      ),
      ...s.fees.map((f) =>
        sql.query(
          `insert into reported_fees
             (submission_id, category, name, name_key, amount, frequency, basis, mandatory, refundable)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [s.id, f.category, f.name, f.name.toLowerCase(), f.amount, f.frequency, f.basis, f.mandatory, f.refundable],
        ),
      ),
    ]);

    return NextResponse.json({ complex: { slug: complex.slug, name: complex.name } }, { status: 201 });
  } catch (e) {
    console.error("fee index submit failed:", e instanceof Error ? e.message : e);
    const status = e instanceof IndexUnavailable ? 503 : 500;
    return NextResponse.json({ error: "The fee index is unavailable right now." }, { status });
  }
}
