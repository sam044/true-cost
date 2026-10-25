"use client";

// Landing receipt: one real catalog listing worked out by lib/cost.ts, with a
// roommate split the visitor can change. Per-unit rent shrinks as the split
// grows; the per-person fees don't, which is the whole point of True Cost.
import { useId, useState } from "react";
import { money, moneyWhole } from "@/components/compare/format";
import { itemize, summarize } from "@/lib/cost";
import type { Apartment, Setup } from "@/lib/types";
import { cn } from "@/lib/utils";

const SPLITS = [1, 2, 3, 4];
const SHOWN_LINES = 4;

export function Receipt({
  apartment,
  leaseMonths,
  initialPeople,
}: {
  apartment: Apartment;
  leaseMonths: number;
  initialPeople: number;
}) {
  const [people, setPeople] = useState(initialPeople);
  const groupId = useId();
  const setup: Setup = { people, leaseMonths };
  const summary = summarize(apartment, setup);
  const { rent, lines } = itemize(apartment, setup);
  const shown = lines.slice(0, SHOWN_LINES);
  const rest = lines.slice(SHOWN_LINES);
  const restTotal = rest.reduce((sum, line) => sum + line.monthly, 0);
  const index = SPLITS.indexOf(people);

  return (
    <figure className="w-full max-w-md justify-self-center lg:justify-self-end">
      <div className="receipt-in rounded-2xl bg-card p-6 text-card-foreground shadow-[0_1px_2px_rgb(0_0_0/0.04),0_16px_40px_-16px_rgb(60_20_20/0.22)] ring-1 ring-foreground/[0.06] sm:p-7 dark:shadow-none">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-semibold">{apartment.name}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Per person, per month, {leaseMonths}-month lease
            </p>
          </div>
        </div>

        <fieldset className="mt-5">
          <legend className="mb-2 text-sm text-muted-foreground" id={groupId}>
            Splitting the unit
          </legend>
          <div className="relative grid grid-cols-4 rounded-xl bg-muted p-1">
            <span
              aria-hidden
              className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/4)] rounded-lg bg-card shadow-[0_1px_2px_rgb(0_0_0/0.08)] ring-1 ring-foreground/[0.06] transition-transform duration-300 ease-(--ease-out-strong) motion-reduce:transition-none"
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
                    "flex h-9 cursor-pointer items-center justify-center rounded-lg text-sm font-medium transition-colors duration-150 select-none",
                    "text-muted-foreground hover:text-foreground peer-checked:text-foreground",
                    "peer-focus-visible:ring-2 peer-focus-visible:ring-ring",
                  )}
                >
                  {n === 1 ? "Just me" : `${n} people`}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <dl className="mt-6 flex flex-col gap-3 text-[0.95rem]">
          <div
            className="receipt-line flex items-baseline justify-between gap-4"
            style={{ "--i": 0 } as React.CSSProperties}
          >
            <dt className="text-muted-foreground">
              Advertised rent
              {apartment.advertised.basis === "per_unit" && people > 1 && (
                <span className="text-muted-foreground/80"> ÷ {people}</span>
              )}
            </dt>
            <dd key={`rent-${people}`} className="num-swap tabular-nums">
              {money(rent)}
            </dd>
          </div>
          {shown.map((line, i) => (
            <div
              key={line.fee.id}
              className="receipt-line flex items-baseline justify-between gap-4"
              style={{ "--i": i + 1 } as React.CSSProperties}
            >
              <dt className="min-w-0 truncate">{line.fee.name}</dt>
              <dd className="shrink-0 font-medium text-hidden-ink tabular-nums">
                +{money(line.monthly)}
              </dd>
            </div>
          ))}
          {rest.length > 0 && (
            <div
              className="receipt-line flex items-baseline justify-between gap-4"
              style={{ "--i": shown.length + 1 } as React.CSSProperties}
            >
              <dt className="text-muted-foreground">
                {rest.length === 1 ? "1 more fee" : `${rest.length} more fees`}
              </dt>
              <dd className="shrink-0 font-medium text-hidden-ink tabular-nums">
                +{money(restTotal)}
              </dd>
            </div>
          )}
        </dl>

        <div
          className="receipt-line mt-6 border-t border-dashed border-foreground/15 pt-5"
          style={{ "--i": shown.length + 2 } as React.CSSProperties}
        >
          <div className="flex items-baseline justify-between gap-4">
            <p className="font-medium">True cost</p>
            <p
              key={`total-${people}`}
              className="num-swap text-3xl font-semibold tracking-tight tabular-nums"
              aria-live="polite"
            >
              {money(summary.trueMonthly)}
            </p>
          </div>
          {summary.hiddenPerYear > 0.005 && (
            <p className="mt-3 text-sm text-muted-foreground">
              <span
                key={`hidden-${people}`}
                className="num-swap inline-block font-medium text-foreground"
              >
                {moneyWhole(summary.hiddenPerYear)} a year
              </span>{" "}
              not in the headline price.
            </p>
          )}
        </div>
      </div>
      <figcaption className="mt-3 px-1 text-sm text-pretty text-muted-foreground">
        A real Blacksburg listing from our catalog. Rent splits with roommates; the fees mostly
        don&apos;t.
      </figcaption>
    </figure>
  );
}
