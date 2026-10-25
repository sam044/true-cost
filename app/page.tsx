import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { money, moneyWhole } from "@/components/compare/format";
import { getCatalog } from "@/lib/catalog";
import { itemize, summarize } from "@/lib/cost";
import type { Setup } from "@/lib/types";

// The receipt beside the headline is a real hand-checked catalog listing, worked
// out by lib/cost.ts exactly as Compare would, so the example never drifts.
const EXAMPLE_SETUP: Setup = { people: 1, leaseMonths: 12 };
const EXAMPLE_NAME = "Collegiate Suites";

function exampleReceipt() {
  const catalog = getCatalog().filter((e) => !e.autoScanned);
  const entry = catalog.find((e) => e.name.includes(EXAMPLE_NAME)) ?? catalog[0];
  if (!entry) return null;
  const summary = summarize(entry.apartment, EXAMPLE_SETUP);
  const { lines } = itemize(entry.apartment, EXAMPLE_SETUP);
  return { entry, summary, lines: lines.slice(0, 4) };
}

export default function Home() {
  const receipt = exampleReceipt();

  return (
    <section className="grid min-h-[calc(100dvh-8rem)] items-center gap-14 py-14 sm:py-20 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-20">
      <div className="flex flex-col items-start gap-7">
        <h1 className="max-w-[13ch] text-[2.75rem] leading-[1.02] font-semibold tracking-[-0.04em] sm:text-6xl lg:text-7xl">
          The rent you see isn&apos;t the rent you pay.
        </h1>
        <p className="max-w-[46ch] text-lg text-pretty text-muted-foreground sm:text-xl sm:leading-relaxed">
          Admin fees, utility fees, parking, reconditioning. True Cost reads your apartment
          screenshots and shows what each place really costs you per month, before you sign.
        </p>
        <div className="flex flex-col items-start gap-5 pt-1">
          <Button asChild size="lg">
            <Link href="/compare/setup">
              Compare apartments
              <ArrowRight
                aria-hidden
                className="transition-transform duration-200 ease-(--ease-out-strong) group-hover/button:translate-x-0.5"
              />
            </Link>
          </Button>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span>Made by renters, for renters</span>
            <span aria-hidden>·</span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-success" aria-hidden />
              No sign-up.
            </span>
          </p>
        </div>
      </div>

      {receipt && (
        <figure className="w-full max-w-md justify-self-center lg:justify-self-end">
          <div className="receipt-in rounded-2xl bg-card p-6 text-card-foreground shadow-[0_1px_2px_rgb(0_0_0/0.04),0_12px_32px_-12px_rgb(60_20_20/0.18)] ring-1 ring-foreground/[0.06] sm:p-7">
            <div className="flex items-baseline justify-between gap-4">
              <p className="font-semibold">{receipt.entry.name}</p>
              <p className="shrink-0 text-sm text-muted-foreground">per month</p>
            </div>
            <dl className="mt-6 flex flex-col gap-3 text-[0.95rem]">
              <div className="receipt-line flex items-baseline justify-between gap-4" style={{ "--i": 0 } as React.CSSProperties}>
                <dt className="text-muted-foreground">Advertised rent</dt>
                <dd className="tabular-nums">{money(receipt.summary.advertisedMonthly)}</dd>
              </div>
              {receipt.lines.map((line, i) => (
                <div
                  key={line.fee.id}
                  className="receipt-line flex items-baseline justify-between gap-4"
                  style={{ "--i": i + 1 } as React.CSSProperties}
                >
                  <dt className="min-w-0 truncate">{line.fee.name}</dt>
                  <dd className="shrink-0 font-medium text-hidden-ink tabular-nums">+{money(line.monthly)}</dd>
                </div>
              ))}
            </dl>
            <div
              className="receipt-line mt-6 border-t border-dashed border-foreground/15 pt-5"
              style={{ "--i": receipt.lines.length + 1 } as React.CSSProperties}
            >
              <div className="flex items-baseline justify-between gap-4">
                <p className="font-medium">True cost</p>
                <p className="text-3xl font-semibold tracking-tight tabular-nums">
                  {money(receipt.summary.trueMonthly)}
                </p>
              </div>
              {receipt.summary.hiddenPerYear > 0.005 && (
                <p className="mt-3 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {moneyWhole(receipt.summary.hiddenPerYear)} a year
                  </span>{" "}
                  not in the headline price.
                </p>
              )}
            </div>
          </div>
          <figcaption className="mt-3 px-1 text-sm text-muted-foreground">
            A real Blacksburg listing from our catalog, one person on a{" "}
            {EXAMPLE_SETUP.leaseMonths}-month lease.
          </figcaption>
        </figure>
      )}
    </section>
  );
}
