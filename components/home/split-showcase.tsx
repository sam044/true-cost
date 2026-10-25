"use client";

// The one live thing on the landing page: the roommate split, blown up. A real
// catalog listing is worked out by lib/cost.ts as the visitor changes the split;
// the per-unit rent shrinks, the per-person fees don't.
import { useId, useState } from "react";
import { money, moneyWhole } from "@/components/compare/format";
import { summarize } from "@/lib/cost";
import type { Apartment } from "@/lib/types";
import { cn } from "@/lib/utils";

const SPLITS = [1, 2, 3, 4];
const WORDS = ["Just you", "Two ways", "Three ways", "Four ways"];

export function SplitShowcase({
  apartment,
  leaseMonths,
}: {
  apartment: Apartment;
  leaseMonths: number;
}) {
  const [people, setPeople] = useState(2);
  const groupId = useId();
  const summary = summarize(apartment, { people, leaseMonths });
  const index = SPLITS.indexOf(people);

  return (
    <section
      aria-labelledby="split-heading"
      className="bleed overflow-hidden bg-orange py-20 text-ink sm:py-28"
    >
      <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-end">
        <div className="flex flex-col gap-5">
          <h2 id="split-heading" className="text-6xl display-type sm:text-7xl lg:text-8xl">
            Split it{" "}
            <span key={people} className="num-swap inline-block">
              {WORDS[index]}
            </span>
          </h2>
          <p className="max-w-[40ch] text-lg text-pretty text-ink/80">
            {apartment.name} lists {money(apartment.advertised.amount)} a month for the whole unit.
            Pick a split and watch what each person really pays once every fee is counted.
          </p>
        </div>

        <div className="flex flex-col gap-8" data-ui>
          <fieldset>
            <legend className="sr-only">People splitting the unit</legend>
            <div className="relative grid grid-cols-4 rounded-2xl bg-ink/10 p-1.5">
              <span
                aria-hidden
                className="absolute inset-y-1.5 left-1.5 w-[calc((100%-0.75rem)/4)] rounded-xl bg-ink transition-transform duration-300 ease-(--ease-out-strong) motion-reduce:transition-none"
                style={{ transform: `translateX(${index * 100}%)` }}
              />
              {SPLITS.map((n) => (
                <label key={n} className="relative">
                  <input
                    type="radio"
                    name={groupId}
                    value={n}
                    checked={people === n}
                    onChange={() => setPeople(n)}
                    className="peer sr-only"
                  />
                  <span
                    className={cn(
                      "flex h-16 cursor-pointer items-center justify-center rounded-xl text-[2rem] display-type transition-colors duration-200 select-none sm:h-20 sm:text-5xl",
                      "text-ink/60 hover:text-ink peer-checked:text-orange",
                      "peer-focus-visible:ring-3 peer-focus-visible:ring-ink",
                    )}
                  >
                    {n}
                    <span className="sr-only">{n === 1 ? " person" : " people"}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div
            className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4"
            aria-live="polite"
          >
            <p className="flex flex-col gap-3">
              <span className="text-sm font-medium text-ink/70">True cost, each, per month</span>
              <span
                key={summary.trueMonthly.toFixed(2)}
                className="num-swap text-[5.5rem] leading-[0.8] display-type tabular-nums sm:text-[9rem]"
              >
                {money(summary.trueMonthly)}
              </span>
            </p>
            <dl className="flex flex-col gap-1.5 pb-2 text-base">
              <div className="flex justify-between gap-6">
                <dt className="text-ink/70">Advertised, each</dt>
                <dd className="tabular-nums line-through decoration-ink/40">
                  {money(summary.advertisedMonthly)}
                </dd>
              </div>
              <div className="flex justify-between gap-6">
                <dt className="text-ink/70">Not in the price</dt>
                <dd className="font-semibold tabular-nums">
                  {moneyWhole(summary.hiddenPerYear)} a year
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}
