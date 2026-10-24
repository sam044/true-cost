// Auto-scans Blacksburg complexes (F21 catalog growth). Owner: Sam (A).
// Reads each data/complexes/raw/<slug>.json (fee page text fetched from the
// complex's own site, see data/complexes/README.md), runs the app's own
// extractFees on it (the same call /api/extract makes) and writes
// data/complexes/scanned/<slug>.json. Then run to-catalog.ts.
//
//   node --experimental-strip-types scripts/complexes/scan.ts            new or changed only
//   node --experimental-strip-types scripts/complexes/scan.ts --all      rescan everything
//   node --experimental-strip-types scripts/complexes/scan.ts --slug hub (repeatable)
//
// Needs GEMINI_API_KEY (read from .env.local).
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { register } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { RawComplex, ScannedComplex } from "./types";

register("../../eval/loader.mjs", import.meta.url);
const { extractFees, ExtractionError } = await import("../../lib/ai/gemma");

const root = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const rawDir = path.join(root, "data", "complexes", "raw");
const outDir = path.join(root, "data", "complexes", "scanned");
const envFile = path.join(root, ".env.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);
mkdirSync(outDir, { recursive: true });

const argv = process.argv.slice(2);
const all = argv.includes("--all");
const only = argv.flatMap((a, i) =>
  a === "--slug" && argv[i + 1] ? [argv[i + 1]] : [],
);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const hash = (text: string) =>
  createHash("sha256").update(text).digest("hex").slice(0, 16);

async function scan(raw: RawComplex): Promise<ScannedComplex> {
  const base = {
    slug: raw.slug,
    name: raw.name,
    sourceUrl: raw.sourceUrl,
    site: raw.site,
    fetchedOn: raw.fetchedOn,
    autoScanned: true as const,
    textHash: hash(raw.text ?? ""),
    scannedAt: new Date().toISOString(),
  };
  const waits = [15_000, 45_000];
  for (let attempt = 1; ; attempt++) {
    try {
      const { extraction, model } = await extractFees({
        images: [],
        text: raw.text ?? "",
      });
      return { ...base, model, extraction, error: null };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (e instanceof ExtractionError || attempt > waits.length)
        return { ...base, model: null, extraction: null, error: message };
      const wait =
        (e as { status?: number }).status === 429 ? 60_000 : waits[attempt - 1];
      console.log(
        `  ${raw.slug}: ${message.slice(0, 100)}; retrying in ${wait / 1000}s`,
      );
      await sleep(wait);
    }
  }
}

const raws = readdirSync(rawDir)
  .filter((f) => f.endsWith(".json"))
  .map(
    (f) => JSON.parse(readFileSync(path.join(rawDir, f), "utf8")) as RawComplex,
  )
  .filter((r) => r.status === "fetched" && r.text)
  .filter((r) => only.length === 0 || only.includes(r.slug))
  .filter((r) => {
    if (all || only.length) return true;
    const out = path.join(outDir, `${r.slug}.json`);
    if (!existsSync(out)) return true;
    const prev = JSON.parse(readFileSync(out, "utf8")) as ScannedComplex;
    return prev.error !== null || prev.textHash !== hash(r.text ?? "");
  })
  .sort((a, b) => a.slug.localeCompare(b.slug));

console.log(`Scanning ${raws.length} complex(es), 2 at a time.`);
let next = 0;
await Promise.all(
  [0, 1].map(async () => {
    while (next < raws.length) {
      const raw = raws[next++];
      const started = Date.now();
      const result = await scan(raw);
      writeFileSync(
        path.join(outDir, `${raw.slug}.json`),
        `${JSON.stringify(result, null, 2)}\n`,
      );
      const secs = Math.round((Date.now() - started) / 1000);
      console.log(
        result.extraction
          ? `  ${raw.slug}: ${result.extraction.fees.length} fees, price ${result.extraction.advertisedPrice.amount ?? "none"} (${result.model}, ${secs}s)`
          : `  ${raw.slug}: FAILED ${result.error}`,
      );
    }
  }),
);
