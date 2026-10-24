"use client";

// One apartment on the Compare screen: the true monthly cost, the bar, and an
// itemized breakdown. Every number comes from lib/cost.ts; flags from lib/flags.ts.
import { Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { itemize, summarize, type ItemLine } from "@/lib/cost";
import { flagsFor } from "@/lib/flags";
import { useTrueCost } from "@/lib/store";
import type { Apartment, Setup } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CostBar } from "./cost-bar";
import { money, moneyWhole } from "./format";
import { FlagBadges, FlagList } from "./law-flags";

function FeeLine({ apartmentId, line }: { apartmentId: string; line: ItemLine }) {
  const updateFee = useTrueCost((s) => s.updateFee);
  const { fee } = line;
  const optional = fee.mandatory === "no";
  // Optional fees can always be toggled; so can any fee left out on Review.
  const toggleable = optional || !fee.counted;
  const switchId = `include-${apartmentId}-${fee.id}`;

  function toggle(counted: boolean) {
    updateFee(apartmentId, fee.id, { counted });
    // The line moves between the counted and "Not included" lists and is
    // re-created, so put keyboard focus back on its switch.
    setTimeout(() => document.getElementById(switchId)?.focus(), 0);
  }

  return (
    <li className="flex items-start gap-3 py-1.5">
      {toggleable && (
        <Switch
          id={switchId}
          size="sm"
          checked={fee.counted}
          onCheckedChange={toggle}
          aria-label={`Include ${fee.name} in the true cost`}
          className="mt-0.5"
        />
      )}
      <div className="flex min-w-0 flex-col">
        <span className={cn(!fee.counted && "text-muted-foreground")}>
          {fee.name}
          {fee.source === "estimate" && <span className="text-muted-foreground"> (estimate)</span>}
        </span>
        <span className="text-xs text-muted-foreground">
          {[line.note, optional && "optional", fee.refundable && "refundable"]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </div>
      <span
        className={cn("ml-auto shrink-0 tabular-nums", !fee.counted && "text-muted-foreground")}
      >
        +{money(line.monthly)}
      </span>
    </li>
  );
}

export function ApartmentColumn({
  apartment,
  setup,
  cheapest,
}: {
  apartment: Apartment;
  setup: Setup;
  cheapest: boolean;
}) {
  const summary = summarize(apartment, setup);
  const flags = flagsFor(apartment, setup);
  const { rent, lines, excluded } = itemize(apartment, setup);
  const headingId = `apartment-${apartment.id}`;

  return (
    <Card className={cn(cheapest && "ring-2 ring-success")}>
      <CardContent className="flex flex-col gap-5 p-6">
        <section aria-labelledby={headingId} className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id={headingId} className="text-lg font-semibold">
              {apartment.name}
            </h2>
            {cheapest && (
              <Badge className="bg-success text-white">
                <Trophy aria-hidden /> Lowest true cost
              </Badge>
            )}
          </div>
          <p className="flex flex-wrap items-baseline gap-x-3">
            <span className="text-4xl font-semibold tracking-tight tabular-nums">
              {money(summary.trueMonthly)}
            </span>
            <span className="text-muted-foreground tabular-nums">
              <span className="sr-only">Advertised price </span>
              <s>{money(summary.advertisedMonthly)}</s>
            </span>
          </p>
          <p className="text-sm text-muted-foreground">per person per month, all-in</p>
          {summary.hiddenPerYear > 0.005 && (
            <p className="mt-2 w-fit rounded-md bg-hidden px-2 py-1 text-sm font-medium text-hidden-foreground">
              {moneyWhole(summary.hiddenPerYear)} / year not in the headline price
            </p>
          )}
          {summary.overBudget != null && setup.budget != null && (
            <p
              className={cn(
                "mt-1 text-sm font-medium",
                summary.overBudget ? "text-destructive" : "text-success",
              )}
            >
              {summary.overBudget
                ? `Over your ${money(setup.budget)} budget by ${money(summary.trueMonthly - setup.budget)}`
                : `Within your ${money(setup.budget)} budget`}
            </p>
          )}
          <FlagBadges apartmentId={apartment.id} flags={flags} />
        </section>

        <CostBar summary={summary} />

        <Separator />

        <section aria-label={`Itemized monthly cost for ${apartment.name}`} className="text-sm">
          <h3 className="mb-1 font-medium">Breakdown per person per month</h3>
          <ul className="divide-y">
            <li className="flex items-start gap-3 py-1.5">
              <div className="flex flex-col">
                <span>Rent (advertised)</span>
                {apartment.advertised.basis === "per_unit" && setup.people > 1 && (
                  <span className="text-xs text-muted-foreground">
                    {money(apartment.advertised.amount)} ÷ {setup.people} people
                  </span>
                )}
              </div>
              <span className="ml-auto tabular-nums">{money(rent)}</span>
            </li>
            {lines.map((line) => (
              <FeeLine key={line.fee.id} apartmentId={apartment.id} line={line} />
            ))}
          </ul>
          <div className="mt-1 flex items-baseline justify-between border-t-2 border-foreground/20 pt-2 font-semibold">
            <span>True monthly cost</span>
            <span className="tabular-nums">{money(summary.trueMonthly)}</span>
          </div>
          <div className="flex items-baseline justify-between pt-1 text-muted-foreground">
            <span>Over a {setup.leaseMonths}-month lease</span>
            <span className="tabular-nums">{money(summary.leaseTotal)}</span>
          </div>

          {excluded.length > 0 && (
            <div className="mt-4">
              <h3 className="font-medium">Not included</h3>
              <p className="text-xs text-muted-foreground">Switch one on to add it.</p>
              <ul className="divide-y">
                {excluded.map((line) => (
                  <FeeLine key={line.fee.id} apartmentId={apartment.id} line={line} />
                ))}
              </ul>
            </div>
          )}
        </section>

        {flags.length > 0 && (
          <>
            <Separator />
            <FlagList apartmentId={apartment.id} flags={flags} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
