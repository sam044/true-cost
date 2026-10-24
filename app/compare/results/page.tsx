"use client";

// Compare screen. Owner: Andy (B). One column per shown apartment with the true
// cost, a stacked bar and an itemized breakdown; a picker hides apartments.
// TODO: flag badges, fee detail drawer (Sheet) with email draft.
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/page-heading";
import { Stepper } from "@/components/stepper";
import { ApartmentColumn } from "@/components/compare/apartment-column";
import { ApartmentPicker } from "@/components/compare/apartment-picker";
import { useHydrated } from "@/components/compare/use-hydrated";
import { summarize } from "@/lib/cost";
import { useTrueCost } from "@/lib/store";
import { cn } from "@/lib/utils";

const COLUMNS = ["", "md:grid-cols-1 max-w-xl", "md:grid-cols-2", "lg:grid-cols-3 md:grid-cols-2"];

function EmptyState() {
  return (
    <div className="flex max-w-xl flex-col items-start gap-4 rounded-xl border border-dashed p-8">
      <Building2 className="size-8 text-muted-foreground" aria-hidden />
      <div>
        <h2 className="font-semibold">No apartments to compare yet</h2>
        <p className="text-sm text-muted-foreground">
          Add up to 3 apartments and check their fees, or try it with sample listings.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/compare/add">Add an apartment</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/compare/results?sample=1">See a sample comparison</Link>
        </Button>
      </div>
    </div>
  );
}

function Results() {
  const sample = useSearchParams().get("sample");
  const { setup, apartments, loadSamples } = useTrueCost();
  // Apartments the user hid with the picker. Kept on this page only.
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (sample) loadSamples();
  }, [sample, loadSamples]);

  if (apartments.length === 0) return <EmptyState />;

  const shown = apartments.filter((a) => !hidden.has(a.id));
  const totals = shown.map((a) => summarize(a, setup).trueMonthly);
  const cheapestId = shown.length > 1 ? shown[totals.indexOf(Math.min(...totals))].id : null;

  function toggle(id: string, show: boolean) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (show) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {apartments.length > 1 && (
        <ApartmentPicker
          apartments={apartments}
          shown={new Set(shown.map((a) => a.id))}
          onToggle={toggle}
        />
      )}
      <p className="text-sm text-muted-foreground">
        {setup.people === 1 ? "Just you" : `Split ${setup.people} ways`}, {setup.leaseMonths}
        -month lease.{" "}
        <Link href="/compare/setup" className="underline underline-offset-4 hover:text-foreground">
          Change setup
        </Link>
      </p>
      <div className={cn("grid items-start gap-4", COLUMNS[shown.length])}>
        {shown.map((apartment) => (
          <ApartmentColumn
            key={apartment.id}
            apartment={apartment}
            setup={setup}
            cheapest={apartment.id === cheapestId}
          />
        ))}
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div
      role="status"
      aria-label="Loading your comparison"
      className="h-96 animate-pulse rounded-xl bg-muted motion-reduce:animate-none"
    />
  );
}

export default function ResultsPage() {
  const hydrated = useHydrated();

  return (
    <>
      <Stepper current="results" />
      <PageHeading
        title="What each place really costs you"
        description="Per person per month, with every fee counted. Recurring fees count in full; one-time fees and deposits are spread over the lease."
      />
      <Suspense fallback={<Loading />}>{hydrated ? <Results /> : <Loading />}</Suspense>
    </>
  );
}
