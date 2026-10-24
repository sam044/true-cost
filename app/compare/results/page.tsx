"use client";

// Compare screen. Owner: Andy (B).
// TODO: big true-cost number, advertised price struck through, hidden per year,
// stacked breakdown bar (Recharts), lease total, flag badges, "Lowest true cost"
// badge, budget line, fee detail drawer (Sheet) with email draft.
import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";
import { Stepper } from "@/components/stepper";
import { summarize } from "@/lib/cost";
import { useTrueCost } from "@/lib/store";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function Results() {
  const sample = useSearchParams().get("sample");
  const { setup, apartments, loadSamples } = useTrueCost();

  useEffect(() => {
    if (sample) loadSamples();
  }, [sample, loadSamples]);

  return (
    <>
      <Stepper current="results" />
      <PageHeading title="What each place really costs you" />
      <div className="grid gap-4 md:grid-cols-3">
        {apartments.map((apartment) => {
          const summary = summarize(apartment, setup);
          return (
            <Card key={apartment.id}>
              <CardContent className="flex flex-col gap-2 p-6">
                <h2 className="font-semibold">{apartment.name}</h2>
                <p className="text-3xl font-semibold tabular-nums">
                  {usd.format(summary.trueMonthly)}
                </p>
                <p className="text-sm text-muted-foreground">per person per month</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}

export default function ResultsPage() {
  return (
    <Suspense>
      <Results />
    </Suspense>
  );
}
