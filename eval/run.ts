// Extraction eval (F14). Owner: Sam (A). Runs the app's own extractFees (the
// same call /api/extract makes) on every folder in eval/cases/ and prints fee
// precision and recall, field accuracy and every miss against expected.json.
//
//   npm run eval                       all cases, listing text plus any screenshots
//   npm run eval -- --case hub         one case (repeatable)
//   npm run eval -- --text-only        ignore screenshots
//   npm run eval -- --images-only      screenshots only (skips cases without them)
//   npm run eval -- --concurrency 1    cases in parallel (default 2)
//
// Needs GEMINI_API_KEY (read from .env.local). Writes eval/results.json.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { register } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtractInput, ExtractResult } from "../lib/ai/gemma";
import type { CaseScore, Expected } from "./score";

// The hook must be in place before lib/ is loaded, so lib/ is imported dynamically.
register("./loader.mjs", import.meta.url);
const { extractFees, ExtractionError } = await import("../lib/ai/gemma");
const { FIELDS, ratio, scoreCase } = await import("./score");

const evalDir = path.dirname(fileURLToPath(import.meta.url));
const casesDir = path.join(evalDir, "cases");
const envFile = path.join(evalDir, "..", ".env.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(name);
const values = (name: string) => argv.flatMap((a, i) => (a === name && argv[i + 1] ? [argv[i + 1]] : []));
const only = values("--case");
const textOnly = flag("--text-only");
const imagesOnly = flag("--images-only");
const concurrency = Math.max(1, Number(values("--concurrency")[0] ?? 2));

interface CaseJson {
  name: string;
  screenshots?: { file: string }[];
}

interface CaseResult {
  id: string;
  name: string;
  input: { text: boolean; images: string[] };
  model?: string;
  seconds?: number;
  attempts: number;
  error?: string;
  score?: CaseScore;
}

function loadInput(dir: string, info: CaseJson): { input: ExtractInput; images: string[] } {
  const images = textOnly
    ? []
    : (info.screenshots ?? []).map((s) => s.file).filter((f) => existsSync(path.join(dir, f)));
  const text = imagesOnly ? undefined : readFileSync(path.join(dir, "listing.txt"), "utf8").trim();
  return {
    images,
    input: {
      text,
      images: images.map((f) => ({
        mimeType: f.endsWith(".png") ? "image/png" : f.endsWith(".webp") ? "image/webp" : "image/jpeg",
        data: readFileSync(path.join(dir, f)).toString("base64"),
      })),
    },
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// extractFees already retries fast 5xx errors and falls back to the second
// model. On top of that, a case that still fails on a rate limit or outage
// waits and runs again; an ExtractionError (invalid output twice) is a result.
async function extractWithRetry(input: ExtractInput): Promise<{ result: ExtractResult; attempts: number }> {
  const waits = [15_000, 45_000];
  for (let attempt = 1; ; attempt++) {
    try {
      return { result: await extractFees(input), attempts: attempt };
    } catch (e) {
      if (e instanceof ExtractionError || attempt > waits.length) throw Object.assign(e as object, { attempts: attempt });
      const rateLimited = (e as { status?: number }).status === 429;
      const wait = rateLimited ? 60_000 : waits[attempt - 1];
      console.log(`  ${e instanceof Error ? e.message.slice(0, 120) : e}; retrying in ${wait / 1000}s`);
      await sleep(wait);
    }
  }
}

async function runCase(id: string): Promise<CaseResult> {
  const dir = path.join(casesDir, id);
  const info = JSON.parse(readFileSync(path.join(dir, "case.json"), "utf8")) as CaseJson;
  const expected = JSON.parse(readFileSync(path.join(dir, "expected.json"), "utf8")) as Expected;
  const { input, images } = loadInput(dir, info);
  const base = { id, name: info.name, input: { text: Boolean(input.text), images } };
  if (!input.text && input.images.length === 0) return { ...base, attempts: 0, error: "no screenshots" };

  console.log(`  ${id}: extracting...`);
  const started = Date.now();
  try {
    const { result, attempts } = await extractWithRetry(input);
    const seconds = Math.round((Date.now() - started) / 1000);
    return { ...base, model: result.model, seconds, attempts, score: scoreCase(expected, result.extraction) };
  } catch (e) {
    return {
      ...base,
      attempts: (e as { attempts?: number }).attempts ?? 1,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

async function pool<T, R>(items: T[], n: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

const pct = (r: number | null) => (r === null ? "n/a" : `${Math.round(r * 100)}%`);
const money = (n: number) => `$${n}`;

function report(r: CaseResult) {
  const kind = [r.input.text && "text", r.input.images.length && `${r.input.images.length} img`].filter(Boolean).join(" + ");
  if (!r.score) {
    console.log(`\n${r.id} (${kind || "no input"}): FAILED after ${r.attempts} attempt(s): ${r.error}`);
    return;
  }
  const s = r.score;
  const price = s.price.ok ? "ok" : `WRONG (${s.price.predicted.amount} ${s.price.predicted.basis})`;
  console.log(
    `\n${r.id} (${kind}, ${r.model}, ${r.seconds}s): ${s.matches.length} matched, ${s.missed.length} missed, ${s.extra.length} extra; price ${price}`,
  );
  for (const m of s.missed) console.log(`  missed: ${m.name} ${money(m.amount)}`);
  for (const f of s.extra)
    console.log(`  extra:  ${f.name} ${money(f.amount)} (${f.confidence} confidence) "${f.quote.slice(0, 80)}"`);
  for (const m of s.matches)
    for (const w of m.wrong)
      console.log(`  wrong ${w.field}: ${m.expected.name} expected ${w.expected}, got ${w.predicted}`);
}

const ids = readdirSync(casesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && (only.length === 0 || only.includes(d.name)))
  .map((d) => d.name)
  .sort();
if (ids.length === 0) {
  console.log(only.length ? `No case named ${only.join(", ")} in eval/cases/.` : "No eval cases yet. Add folders to eval/cases/.");
  process.exit(1);
}

const mode = textOnly ? "text only" : imagesOnly ? "screenshots only" : "text plus any screenshots";
console.log(`Running ${ids.length} case(s), ${mode}, ${concurrency} at a time.`);
const results = await pool(ids, concurrency, runCase);
results.forEach(report);

const scored = results.filter((r) => r.score);
const sum = (f: (s: CaseScore) => number) => scored.reduce((n, r) => n + f(r.score!), 0);
const tp = sum((s) => s.matches.length);
const fp = sum((s) => s.extra.length);
const fn = sum((s) => s.missed.length);
const precision = ratio(tp, tp + fp);
const recall = ratio(tp, tp + fn);
const f1 = precision !== null && recall !== null && precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : null;
const fields = Object.fromEntries(
  FIELDS.map((f) => {
    const right = sum((s) => s.fields[f].right);
    const total = sum((s) => s.fields[f].total);
    return [f, { right, total, accuracy: ratio(right, total) }];
  }),
);
const pricesOk = sum((s) => (s.price.ok ? 1 : 0));
const lowFlagged = sum((s) => s.extra.filter((f) => f.confidence === "low").length);

console.log(`\n=== ${scored.length}/${results.length} cases scored (${mode}) ===`);
console.log(`Fees: precision ${pct(precision)} (${tp}/${tp + fp}), recall ${pct(recall)} (${tp}/${tp + fn}), F1 ${pct(f1)}`);
console.log(`Advertised price right: ${pricesOk}/${scored.length}`);
console.log(
  `Field accuracy on matched fees: ${FIELDS.map((f) => `${f} ${pct(fields[f].accuracy)} (${fields[f].right}/${fields[f].total})`).join(", ")}`,
);
console.log(`Extra fees already flagged low confidence by the grounding checks: ${lowFlagged}/${fp}`);
const failed = results.filter((r) => !r.score);
if (failed.length) console.log(`Failed: ${failed.map((r) => `${r.id} (${r.error})`).join(", ")}`);

writeFileSync(
  path.join(evalDir, "results.json"),
  JSON.stringify(
    {
      ranAt: new Date().toISOString(),
      mode,
      summary: { cases: results.length, scored: scored.length, tp, fp, fn, precision, recall, f1, pricesOk, fields },
      cases: results,
    },
    null,
    2,
  ) + "\n",
);
console.log("Details written to eval/results.json.");
if (failed.length) process.exitCode = 1;
