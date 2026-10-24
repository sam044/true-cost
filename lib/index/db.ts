// Neon Postgres client for the fee index (F20). Owner: Andy (B). Server only:
// DATABASE_URL never reaches the browser. Neon's HTTP driver needs no
// connection pool, which suits serverless functions.
import "server-only";
import { neon } from "@neondatabase/serverless";

export class IndexUnavailable extends Error {}

export function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new IndexUnavailable("DATABASE_URL is not set (see .env.example)");
  return neon(url);
}
