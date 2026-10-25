"use client";

// Setup screen. Owner: Andy (B). People sharing (1-6), lease months, optional
// monthly budget per person, and which optional extras they need. Saved to the
// store, which persists to localStorage.
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeading } from "@/components/page-heading";
import { Stepper } from "@/components/stepper";
import { useHydrated } from "@/components/compare/use-hydrated";
import { defaultCounted } from "@/lib/cost";
import { useTrueCost } from "@/lib/store";
import type { Needs } from "@/lib/types";
import { cn } from "@/lib/utils";

const PEOPLE = [1, 2, 3, 4, 5, 6];
const LEASE_PRESETS = [10, 12];
const MAX_LEASE_MONTHS = 24;
const NO_NEEDS: Needs = { parking: false, pet: false, furnished: false };
const NEED_OPTIONS: { key: keyof Needs; label: string }[] = [
  { key: "parking", label: "Parking" },
  { key: "pet", label: "A pet" },
  { key: "furnished", label: "A furnished unit" },
];

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
  const { setup, apartments, setSetup, updateFee } = useTrueCost();
  const [people, setPeople] = useState(setup.people);
  const [lease, setLease] = useState(String(setup.leaseMonths));
  const [budget, setBudget] = useState(setup.budget == null ? "" : String(setup.budget));
  const [needs, setNeeds] = useState<Needs>(setup.needs ?? NO_NEEDS);
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
    const next = {
      people,
      leaseMonths: Number(lease),
      budget: budget.trim() === "" ? undefined : Number(budget),
      needs,
    };
    setSetup(next);

    // Re-apply the defaults to optional fees already added, but only when the
    // answers changed, so per-fee choices made on Compare survive a resubmit.
    const prev = setup.needs ?? NO_NEEDS;
    if (NEED_OPTIONS.some(({ key }) => prev[key] !== needs[key])) {
      for (const apartment of apartments) {
        for (const fee of apartment.fees) {
          if (fee.mandatory === "no") {
            updateFee(apartment.id, fee.id, { counted: defaultCounted(fee, next) });
          }
        }
      }
    }
    router.push("/compare/add");
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="grid items-start gap-6 lg:grid-cols-[minmax(0,36rem)_minmax(0,1fr)] lg:gap-x-10"
    >
      <SetupSummary people={people} lease={lease} budget={budget} needs={needs} />
      <Card className="shadow-[0_1px_2px_rgb(0_0_0/0.03)] ring-foreground/[0.07]">
        <CardContent className="flex flex-col divide-y divide-border/70 px-6 sm:px-8 [&>*]:py-7 [&>*:first-child]:pt-2 [&>*:last-child]:pb-2">
          <div>
            <fieldset className="flex flex-col gap-3">
              <legend className="mb-3 text-[0.95rem] font-medium">
                How many people will share the unit?
              </legend>
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
                        "pressable grid size-11 cursor-pointer place-items-center rounded-xl border bg-card text-base font-medium tabular-nums motion-reduce:transition-none",
                        "hover:border-foreground/25 peer-focus-visible:border-ring peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50",
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
          </div>

          <div className="flex flex-col gap-3">
            <Label htmlFor="lease" className="text-[0.95rem]">
              Lease length in months
            </Label>
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
                className="h-11 w-20 rounded-xl text-base tabular-nums"
              />
              {LEASE_PRESETS.map((n) => (
                <Button
                  key={n}
                  type="button"
                  variant="outline"
                  aria-pressed={lease === String(n)}
                  onClick={() => setLease(String(n))}
                  className="h-11 rounded-xl px-3.5 text-[0.95rem] aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground dark:aria-pressed:bg-primary aria-pressed:hover:bg-primary/90"
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

          <div>
            <fieldset className="flex flex-col gap-3">
              <legend className="mb-3 text-[0.95rem] font-medium">
                Will you need any of these?{" "}
                <span className="font-normal text-muted-foreground">(tick any that apply)</span>
              </legend>
              <div className="flex flex-wrap gap-2">
                {NEED_OPTIONS.map(({ key, label }) => (
                  <label key={key} className="relative">
                    <input
                      type="checkbox"
                      checked={needs[key]}
                      onChange={(e) => setNeeds({ ...needs, [key]: e.target.checked })}
                      aria-describedby="needs-hint"
                      className="peer sr-only"
                    />
                    <span
                      className={cn(
                        "pressable flex h-11 cursor-pointer items-center gap-2 rounded-xl border bg-card px-4 text-[0.95rem] select-none",
                        "hover:border-foreground/25 peer-focus-visible:border-ring peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50",
                        "peer-checked:border-primary peer-checked:bg-primary/[0.07] peer-checked:text-primary dark:peer-checked:bg-primary/15",
                        "[&>svg]:hidden peer-checked:[&>svg]:block",
                      )}
                    >
                      <Check className="size-4" aria-hidden />
                      {label}
                    </span>
                  </label>
                ))}
              </div>
              <p id="needs-hint" className="text-sm text-muted-foreground">
                Optional fees for these count toward the true cost. You can still change any single
                fee on the Compare screen.
              </p>
            </fieldset>
          </div>

          <div className="flex flex-col gap-3">
            <Label htmlFor="budget" className="text-[0.95rem]">
              Monthly budget per person
              <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <div className="relative w-40">
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-muted-foreground"
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
                className="h-11 rounded-xl pl-7 text-base tabular-nums"
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

// The answers so far, set large on an orange card beside the form. A mirror of
// the form for sighted users, so it is hidden from screen readers.
function SetupSummary({
  people,
  lease,
  budget,
  needs,
}: {
  people: number;
  lease: string;
  budget: string;
  needs: Needs;
}) {
  const months = validateLease(lease) ? null : Number(lease);
  const amount = budget.trim() === "" || validateBudget(budget) ? null : Number(budget);
  const extras = NEED_OPTIONS.filter(({ key }) => needs[key]).map(({ label }) =>
    label.toLowerCase(),
  );
  const lines = [
    people === 1 ? "Just you" : `Split ${people} ways`,
    months ? `${months}-month lease` : "Lease length?",
    amount ? `Up to $${amount.toLocaleString("en-US")} each` : "No budget set",
  ];

  return (
    <div
      aria-hidden
      className="hidden flex-col justify-between gap-10 bg-orange p-8 text-ink lg:sticky lg:top-20 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:flex lg:min-h-[28rem]"
    >
      <p className="text-sm font-medium text-ink/70">Your setup</p>
      <div className="flex flex-col gap-1">
        {lines.map((line) => (
          <p key={line} className="num-swap text-5xl display-type xl:text-6xl">
            {line}
          </p>
        ))}
      </div>
      <p className="text-base text-pretty text-ink/80">
        {extras.length
          ? `Optional fees for ${extras.join(", ")} will count toward the true cost.`
          : "No optional extras counted yet."}
      </p>
    </div>
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
          className="h-[34rem] max-w-xl animate-pulse rounded-xl bg-muted motion-reduce:animate-none"
        />
      )}
    </>
  );
}
