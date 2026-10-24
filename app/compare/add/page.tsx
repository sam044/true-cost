"use client";

// Add apartment screen. Owner: Sam (A).
// Opens on the catalog of pre-scanned complexes (F21). For any other listing,
// "Not in the list?" points to the extension (F19), whose capture comes back
// through /compare/import. Each apartment added shows as a card (max 3);
// "Review fees" moves on.
import Link from "next/link";
import { ChevronDown, CircleCheck, CircleDashed, Puzzle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";
import { Stepper } from "@/components/stepper";
import { CatalogPicker } from "@/components/catalog/catalog-picker";
import { useHydrated } from "@/components/review/use-hydrated";
import { MAX_APARTMENTS, useTrueCost } from "@/lib/store";
import type { Apartment } from "@/lib/types";
import { cn } from "@/lib/utils";

const REPO_URL = "https://github.com/sam044/true-cost";
const EXTENSION_URL = `${REPO_URL}/tree/main/extension`;

export default function AddApartmentPage() {
  const hydrated = useHydrated();

  return (
    <>
      <Stepper current="add" />
      <PageHeading
        title="Add up to 3 apartments"
        description="Pick Blacksburg complexes we've already checked, or add any listing with the extension."
      />
      {hydrated ? (
        <AddApartments />
      ) : (
        <div role="status" aria-live="polite" className="flex flex-col gap-4">
          <span className="sr-only">Loading your apartments</span>
          <div className="h-80 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
        </div>
      )}
    </>
  );
}

function AddApartments() {
  const apartments = useTrueCost((s) => s.apartments);
  const { addApartment, removeApartment } = useTrueCost();
  const unreviewed = apartments.some((a) => !a.reviewed);

  function handleRemove(apartment: Apartment) {
    removeApartment(apartment.id);
    toast(`Removed ${apartment.name}`, {
      action: { label: "Undo", onClick: () => addApartment(apartment) },
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <CatalogPicker />

      {apartments.length > 0 && (
        <section aria-labelledby="added-heading" className="flex flex-col gap-3">
          <h2 id="added-heading" className="text-lg font-semibold">
            Your apartments{" "}
            <span className="font-normal text-muted-foreground">
              ({apartments.length} of {MAX_APARTMENTS})
            </span>
          </h2>
          <ul className="grid gap-3 sm:grid-cols-3">
            {apartments.map((apartment) => (
              <li key={apartment.id}>
                <ApartmentCard apartment={apartment} onRemove={() => handleRemove(apartment)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="fallback-heading" className="flex flex-col gap-4 border-t pt-6">
        <h2 id="fallback-heading" className="text-lg font-semibold">
          Not in the list?
        </h2>
        <ExtensionNote />
      </section>

      {unreviewed && (
        <div className="flex flex-wrap items-center gap-3 border-t pt-6">
          <Button asChild size="lg">
            <Link href="/compare/review">Review fees</Link>
          </Button>
          <p className="text-sm text-muted-foreground">
            You&apos;ll check what Gemma found before anything is compared.
          </p>
        </div>
      )}
    </div>
  );
}

function ExtensionNote() {
  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-muted/40 p-4 sm:p-5">
      <p className="flex items-start gap-3 text-sm text-muted-foreground">
        <Puzzle className="mt-0.5 size-5 shrink-0" aria-hidden />
        On any listing page, one click captures the whole page and opens it here for review.
      </p>
      <div className="flex flex-wrap items-start gap-3">
        <Button asChild>
          <a href={EXTENSION_URL} target="_blank" rel="noopener noreferrer">
            Get the extension<span className="sr-only"> (opens in a new tab)</span>
          </a>
        </Button>
        <details className="group w-full sm:w-auto sm:flex-1">
          <summary
            className={cn(
              buttonVariants({ variant: "outline" }),
              "cursor-pointer list-none [&::-webkit-details-marker]:hidden",
            )}
          >
            How to install
            <ChevronDown
              aria-hidden
              className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none"
            />
          </summary>
          <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5 text-sm">
            <li>
              On the{" "}
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                True Cost GitHub page<span className="sr-only"> (opens in a new tab)</span>
              </a>
              , click <span className="font-medium">Code</span>, then{" "}
              <span className="font-medium">Download ZIP</span>, and unzip it.
            </li>
            <li>
              In Chrome or Brave, open <code className="rounded bg-muted px-1">chrome://extensions</code>{" "}
              and turn on <span className="font-medium">Developer mode</span>.
            </li>
            <li>
              Click <span className="font-medium">Load unpacked</span> and pick the{" "}
              <code className="rounded bg-muted px-1">extension</code> folder inside it.
            </li>
            <li>Pin True Cost from the puzzle-piece menu, then click it on any listing.</li>
          </ol>
        </details>
      </div>
    </div>
  );
}

function ApartmentCard({ apartment, onRemove }: { apartment: Apartment; onRemove: () => void }) {
  const count = apartment.fees.length;
  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold break-words">{apartment.name}</h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            aria-label={`Remove ${apartment.name}`}
            className="-mt-1 -mr-2 shrink-0"
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {count === 1 ? "1 fee found" : `${count} fees found`}
        </p>
        <p className="mt-auto flex items-center gap-1.5 text-sm">
          {apartment.reviewed ? (
            <>
              <CircleCheck className="size-4 text-success" aria-hidden /> Reviewed
            </>
          ) : (
            <>
              <CircleDashed className="size-4 text-muted-foreground" aria-hidden /> Not reviewed yet
            </>
          )}
        </p>
        <Link
          href={`/compare/review/${apartment.id}`}
          className="w-fit rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {apartment.reviewed ? "Edit fees" : "Review fees"}
          <span className="sr-only"> for {apartment.name}</span>
        </Link>
      </CardContent>
    </Card>
  );
}
