"use client";

// Review fees screen. Owner: Sam (A).
// The user checks every fee Gemma found before it reaches the numbers: fees the
// model was unsure about are flagged "Check this" and listed first, and every
// field can be edited, deleted or added by hand. "Looks right" sets reviewed.
import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, Plus, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeading } from "@/components/page-heading";
import { Stepper } from "@/components/stepper";
import { FeeRow } from "@/components/review/fee-row";
import { BASIS_LABELS, needsCheck } from "@/components/review/labels";
import { MoneyInput } from "@/components/review/money-input";
import { useHydrated } from "@/components/review/use-hydrated";
import { submissionFor } from "@/lib/index/submit";
import { useTrueCost } from "@/lib/store";
import type { Apartment, Basis, Fee, UtilityName } from "@/lib/types";

const UTILITY_LABELS: Record<UtilityName, string> = {
  electric: "Electric",
  water: "Water",
  gas: "Gas",
  internet: "Internet",
  trash: "Trash",
};

const UTILITY_STATUS: Record<Apartment["utilities"][UtilityName], string> = {
  included: "Included",
  not_included: "Not included",
  unknown: "Not stated",
};

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const hydrated = useHydrated();
  const apartment = useTrueCost((s) => s.apartments.find((a) => a.id === id));

  return (
    <>
      <Stepper current="review" />
      {!hydrated ? (
        <div role="status" aria-live="polite" className="flex flex-col gap-4">
          <span className="sr-only">Loading fees</span>
          <div className="h-9 w-2/3 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
          <div className="h-40 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
          <div className="h-40 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
        </div>
      ) : apartment ? (
        <ReviewApartment key={apartment.id} apartment={apartment} />
      ) : (
        <>
          <PageHeading
            title="We couldn't find that apartment"
            description="It may have been removed, or your saved comparison was cleared."
          />
          <Button asChild>
            <Link href="/compare/add">Add an apartment</Link>
          </Button>
        </>
      )}
    </>
  );
}

function ReviewApartment({ apartment }: { apartment: Apartment }) {
  const router = useRouter();
  const apartments = useTrueCost((s) => s.apartments);
  const { updateApartment, updateFee, addFee, removeFee, shareToIndex, setShareToIndex } = useTrueCost();

  // Flagged fees go first. The order is fixed when the screen opens so rows
  // don't jump while the user edits them; new fees go at the end.
  const [order] = useState(() =>
    [...apartment.fees]
      .sort((a, b) => Number(needsCheck(b)) - Number(needsCheck(a)))
      .map((f) => f.id),
  );
  const fees = [
    ...order.flatMap((feeId) => apartment.fees.filter((f) => f.id === feeId)),
    ...apartment.fees.filter((f) => !order.includes(f.id)),
  ];
  const flaggedCount = fees.filter(needsCheck).length;

  const [showErrors, setShowErrors] = useState(false);
  const nameRefs = useRef(new Map<string, HTMLInputElement>());
  const [focusFeeId, setFocusFeeId] = useState<string | null>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!focusFeeId) return;
    nameRefs.current.get(focusFeeId)?.focus();
    setFocusFeeId(null);
  }, [focusFeeId]);

  const position = apartments.findIndex((a) => a.id === apartment.id) + 1;
  const priceMissing = !(apartment.advertised.amount > 0);
  const unnamed = fees.filter((f) => f.name.trim() === "");
  const errors = [
    ...(priceMissing ? ["Enter the advertised rent."] : []),
    ...(unnamed.length
      ? [`Give ${unnamed.length === 1 ? "1 fee" : `${unnamed.length} fees`} a name.`]
      : []),
  ];

  function handleAdd() {
    const fee: Fee = {
      id: crypto.randomUUID(),
      name: "",
      category: "other",
      amount: 0,
      frequency: "monthly",
      basis: "per_person",
      mandatory: "yes",
      counted: true,
      refundable: false,
      quote: null,
      source: "user",
      confidence: "high",
    };
    addFee(apartment.id, fee);
    setFocusFeeId(fee.id);
  }

  function handleRemove(fee: Fee) {
    removeFee(apartment.id, fee.id);
    addButtonRef.current?.focus();
    toast(`Deleted ${fee.name.trim() || "fee"}`, {
      action: { label: "Undo", onClick: () => addFee(apartment.id, fee) },
    });
  }

  function handleConfirm() {
    if (errors.length) {
      setShowErrors(true);
      if (priceMissing) priceRef.current?.focus();
      else if (unnamed[0]) nameRefs.current.get(unnamed[0].id)?.focus();
      else errorRef.current?.focus();
      return;
    }
    updateApartment(apartment.id, { reviewed: true });
    // Fee index (F20, Andy): opted in, so share the confirmed fees. Fire and
    // forget: navigation never waits, and a failure only logs a warning.
    const submission = shareToIndex ? submissionFor({ ...apartment, reviewed: true }) : null;
    if (submission) {
      fetch("/api/index/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submission),
        keepalive: true,
      })
        .then((res) => res.ok || console.warn("Fee index submit returned", res.status))
        .catch((e) => console.warn("Fee index submit failed", e));
    }
    const next = apartments.find((a) => a.id !== apartment.id && !a.reviewed);
    router.push(next ? `/compare/review/${next.id}` : "/compare/results");
  }

  return (
    <>
      <PageHeading
        title={`Check the fees for ${apartment.name}`}
      />
      {apartments.length > 1 && (
        <p className="-mt-4 pb-6 text-sm text-muted-foreground">
          Apartment {position} of {apartments.length}
        </p>
      )}

      <div className="flex flex-col gap-8">
        <section aria-labelledby="price-heading" className="rounded-xl border bg-card p-4 sm:p-5">
          <h2 id="price-heading" className="text-lg font-semibold">
            Advertised rent
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2fr]">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="advertised-amount">Monthly rent</Label>
              <MoneyInput
                ref={priceRef}
                id="advertised-amount"
                value={apartment.advertised.amount}
                aria-describedby={showErrors && priceMissing ? "advertised-error" : undefined}
                onValueChange={(amount) =>
                  updateApartment(apartment.id, { advertised: { ...apartment.advertised, amount } })
                }
              />
              {showErrors && priceMissing && (
                <p id="advertised-error" className="text-sm text-destructive">
                  Enter the advertised rent.
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="advertised-basis">Charged</Label>
              <Select
                value={apartment.advertised.basis}
                onValueChange={(basis) =>
                  updateApartment(apartment.id, {
                    advertised: { ...apartment.advertised, basis: basis as Basis },
                  })
                }
              >
                <SelectTrigger id="advertised-basis" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(BASIS_LABELS).map(([key, text]) => (
                    <SelectItem key={key} value={key}>
                      {text}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {apartment.advertised.quote && (
              <figure className="self-end rounded-lg bg-muted px-3 py-2 text-sm">
                <figcaption className="text-xs font-medium text-muted-foreground">
                  From the listing
                </figcaption>
                <blockquote className="mt-1">&ldquo;{apartment.advertised.quote}&rdquo;</blockquote>
              </figure>
            )}
          </div>
        </section>

        <section aria-labelledby="fees-heading" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="fees-heading" className="text-lg font-semibold">
              Fees <span className="font-normal text-muted-foreground">({fees.length})</span>
            </h2>
            {flaggedCount > 0 && (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <TriangleAlert className="size-4 text-warning" aria-hidden />
                {flaggedCount === 1 ? "1 fee needs" : `${flaggedCount} fees need`} a second look
              </p>
            )}
          </div>

          {fees.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <p className="font-medium">No fees found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                If you know about any fees for this apartment, add them below.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-4">
              {fees.map((fee) => (
                <FeeRow
                  key={fee.id}
                  ref={(el) => {
                    if (el) nameRefs.current.set(fee.id, el);
                    else nameRefs.current.delete(fee.id);
                  }}
                  fee={fee}
                  showErrors={showErrors}
                  onChange={(patch) => updateFee(apartment.id, fee.id, patch)}
                  onRemove={() => handleRemove(fee)}
                />
              ))}
            </ul>
          )}

          <Button ref={addButtonRef} variant="outline" className="self-start" onClick={handleAdd}>
            <Plus aria-hidden />
            Add a fee
          </Button>
        </section>

        <section aria-labelledby="utilities-heading" className="rounded-xl border bg-card p-4 sm:p-5">
          <h2 id="utilities-heading" className="text-lg font-semibold">
            Utilities
          </h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
            {(Object.keys(UTILITY_LABELS) as UtilityName[]).map((name) => (
              <div key={name} className="rounded-lg bg-muted px-3 py-2">
                <dt className="text-muted-foreground">{UTILITY_LABELS[name]}</dt>
                <dd className="font-medium">{UTILITY_STATUS[apartment.utilities[name]]}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="flex flex-col gap-3 border-t pt-6">
          {showErrors && errors.length > 0 && (
            <div
              ref={errorRef}
              tabIndex={-1}
              role="alert"
              className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {errors.join(" ")}
            </div>
          )}
          <label className="flex max-w-xl cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={shareToIndex}
              onChange={(e) => setShareToIndex(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 cursor-pointer accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            />
            <span>
              Add these fees to the Blacksburg fee index
              <span className="block text-muted-foreground">
                Anonymous: only the complex name and fee amounts are shared, so the next student
                knows what to expect.
              </span>
            </span>
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg" onClick={handleConfirm}>
              <CircleCheck aria-hidden />
              Looks right
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/compare/add">Back to apartments</Link>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
