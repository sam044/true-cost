// GET /api/index/complex?name=…&url=… Owner: Andy (B). F20, read-only.
// Finds the complex (by listing URL, then by normalized name or alias) without
// creating one, and returns what students reported there as an IndexSummary,
// or { found: false }. Errors: 400 bad input, 503 when the index is down; the
// Compare panel hides itself on any error.
import { NextResponse } from "next/server";
import { z } from "zod";
import { aggregate, type IndexRow } from "@/lib/index/aggregate";
import { complexKey } from "@/lib/index/complex";
import { IndexUnavailable, db } from "@/lib/index/db";

export const runtime = "nodejs";

const Query = z.object({
  name: z.string().trim().min(1).max(200),
  url: z.string().url().max(500).optional(),
});

// Host and path only: offcampus.vt.edu property paths are stable ids.
function urlKey(url: string | undefined): string | null {
  if (!url) return null;
  const u = new URL(url);
  return `${u.host}${u.pathname}`.replace(/\/$/, "").toLowerCase();
}

const CACHE = { "Cache-Control": "s-maxage=60, stale-while-revalidate=300" };

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const parsed = Query.safeParse({
    name: params.get("name") ?? undefined,
    url: params.get("url") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Send a complex name." }, { status: 400 });
  }

  try {
    const sql = db();
    const key = complexKey(parsed.data.name);
    const [complex] = (await sql.query(
      `select id, slug, name, verified from complexes
       where ($1::text is not null
              and lower(regexp_replace(regexp_replace(listing_url, '^https?://', ''), '[?#].*$|/$', '')) = $1)
          or slug = $2 or $2 = any(aliases)
       order by (lower(regexp_replace(regexp_replace(listing_url, '^https?://', ''), '[?#].*$|/$', '')) = $1) desc nulls last
       limit 1`,
      [urlKey(parsed.data.url), key],
    )) as { id: number; slug: string; name: string; verified: boolean }[];
    if (!complex) return NextResponse.json({ found: false }, { headers: CACHE });

    // Unverified complexes show only once 2 different devices have reported them.
    if (!complex.verified) {
      const [{ n }] = (await sql.query(
        `select count(distinct client_hash)::int as n from submissions where complex_id = $1`,
        [complex.id],
      )) as { n: number }[];
      if (n < 2) return NextResponse.json({ found: false }, { headers: CACHE });
    }

    const rows = (await sql.query(
      `select s.id as "submissionId", s.source, s.advertised::float8 as advertised,
              s.updated_at as "updatedAt", f.category, f.name, f.amount::float8 as amount, f.frequency
       from submissions s join reported_fees f on f.submission_id = s.id
       where s.complex_id = $1`,
      [complex.id],
    )) as (Omit<IndexRow, "updatedAt"> & { updatedAt: string | Date })[];

    const summary = aggregate(
      { slug: complex.slug, name: complex.name, verified: complex.verified },
      rows.map((r) => ({ ...r, updatedAt: new Date(r.updatedAt).toISOString() })),
    );
    return NextResponse.json(summary ?? { found: false }, { headers: CACHE });
  } catch (e) {
    console.error("fee index lookup failed:", e instanceof Error ? e.message : e);
    const status = e instanceof IndexUnavailable ? 503 : 500;
    return NextResponse.json({ error: "The fee index is unavailable right now." }, { status });
  }
}
