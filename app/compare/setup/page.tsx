"use client";

// Setup screen. Owner: Andy (B). People sharing (1-6), lease months, optional
// monthly budget per person. Saved to the store, which persists to localStorage.
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeading } from "@/components/page-heading";
import { Stepper } from "@/components/stepper";
import { useTrueCost } from "@/lib/store";
import { cn } from "@/lib/utils";

const PEOPLE = [1, 2, 3, 4, 5, 6];
const LEASE_PRESETS = [10, 12];
const MAX_LEASE_MONTHS = 24;

// The store loads from localStorage after the first render. Wait for it so the
// form starts from what the user saved, not the defaults.
function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(useTrueCost.persist.hasHydrated());
    return useTrueCost.persist.onFinishHydration(() => setHydrated(true));
  }, []);
  return hydrated;
}

function validateLease(value: string): string | null {
  const n = Number(value);
  if (value.trim() === "" || !Number.isInteger(n) || n < 1 || n > MAX_LEASE_MONTHS) {
    return `Enter a whole number of months from 1 to ${MAX_LEASE_MONTHS}.`;
  }
  return null;
}

function validateBudget(value: string): string | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "Enter a dollar amount above 0, or leave it blank.";
  return null;
}

function SetupForm() {
  const router = useRouter();
  const { setup, setSetup } = useTrueCost();
  const [people, setPeople] = useState(setup.people);
  const [lease, setLease] = useState(String(setup.leaseMonths));
  const [budget, setBudget] = useState(setup.budget == null ? "" : String(setup.budget));
  const [submitted, setSubmitted] = useState(false);
  const leaseRef = useRef<HTMLInputElement>(null);
  const budgetRef = useRef<HTMLInputElement>(null);

  // Errors show only after the first Continue, then update as the user types.
  const leaseError = submitted ? validateLease(lease) : null;
  const budgetError = submitted ? validateBudget(budget) : null;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (validateLease(lease)) return leaseRef.current?.focus();
    if (validateBudget(budget)) return budgetRef.current?.focus();
    setSetup({
      people,
      leaseMonths: Number(lease),
      budget: budget.trim() === "" ? undefined : Number(budget),
    });
    router.push("/compare/add");
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-xl flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col gap-8 p-6">
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-3 text-sm font-medium">How many people will share the unit?</legend>
            <div className="flex flex-wrap gap-2">
              {PEOPLE.map((n) => (
                <label key={n} className="relative">
                  <input
                    type="radio"
                    name="people"
                    value={n}
                    checked={people === n}
                    onChange={() => setPeople(n)}
                    className="peer sr-only"
                  />
                  <span
                    className={cn(
                      "grid size-11 cursor-pointer place-items-center rounded-lg border text-base font-medium tabular-nums transition-colors motion-reduce:transition-none",
                      "hover:bg-muted peer-focus-visible:border-ring peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50",
                      "peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground",
                    )}
                  >
                    {n}
                    <span className="sr-only">{n === 1 ? " person" : " people"}</span>
                  </span>
                </label>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              {people === 1
                ? "Per-unit fees are all yours."
                : `Per-unit rent and fees are split ${people} ways.`}
            </p>
          </fieldset>

          <div className="flex flex-col gap-3">
            <Label htmlFor="lease">Lease length in months</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                ref={leaseRef}
                id="lease"
                type="number"
                inputMode="numeric"
                min={1}
                max={MAX_LEASE_MONTHS}
                step={1}
                value={lease}
                onChange={(e) => setLease(e.target.value)}
                aria-invalid={leaseError ? true : undefined}
                aria-describedby={cn("lease-hint", leaseError && "lease-error")}
                className="h-10 w-24 tabular-nums"
              />
              {LEASE_PRESETS.map((n) => (
                <Button
                  key={n}
                  type="button"
                  variant="outline"
                  aria-pressed={lease === String(n)}
                  onClick={() => setLease(String(n))}
                  className="h-10 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground dark:aria-pressed:bg-primary aria-pressed:hover:bg-primary/90"
                >
                  {n} months
                </Button>
              ))}
            </div>
            <p id="lease-hint" className="text-sm text-muted-foreground">
              One-time fees and deposits are spread over this many months.
            </p>
            {leaseError && (
              <p id="lease-error" className="text-sm text-destructive">
                {leaseError}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <Label htmlFor="budget">
              Monthly budget per person
              <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <div className="relative w-40">
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground"
              >
                $
              </span>
              <Input
                ref={budgetRef}
                id="budget"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                placeholder="1100"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                aria-invalid={budgetError ? true : undefined}
                aria-describedby={cn("budget-hint", budgetError && "budget-error")}
                className="h-10 pl-6 tabular-nums"
              />
            </div>
            <p id="budget-hint" className="text-sm text-muted-foreground">
              All-in, after every fee. We&apos;ll show which places fit.
            </p>
            {budgetError && (
              <p id="budget-error" className="text-sm text-destructive">
                {budgetError}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <div>
        <Button type="submit" size="lg">
          Continue <ArrowRight aria-hidden />
        </Button>
      </div>
    </form>
  );
}

export default function SetupPage() {
  const hydrated = useHydrated();

  return (
    <>
      <Stepper current="setup" />
      <PageHeading
        title="Who's splitting the rent?"
        description="We use this to turn per-unit fees into what you pay per person."
      />
      {hydrated ? (
        <SetupForm />
      ) : (
        <div
          role="status"
          aria-label="Loading your saved setup"
          className="h-96 max-w-xl animate-pulse rounded-xl bg-muted motion-reduce:animate-none"
        />
      )}
    </>
  );
}
