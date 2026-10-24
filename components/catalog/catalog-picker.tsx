"use client";

// Catalog picker (F21). Owner: Sam (A). A searchable grid of pre-scanned
// Blacksburg complexes in a scrollable box about 6 cards tall; selecting a card
// (click, Enter or Space) adds its apartment to the store, selecting it again
// removes it. Hand-checked complexes come first and go straight to Compare;
// auto-scanned ones are added unreviewed, so they open Review first.
import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { ArrowRight, Check, ExternalLink, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  catalogApartment,
  catalogIdOf,
  getCatalog,
  listingFeeCount,
  type CatalogEntry,
} from "@/lib/catalog";
import { MAX_APARTMENTS, useTrueCost } from "@/lib/store";
import { cn } from "@/lib/utils";

const dollars = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function priceRange({ min, max, basis }: CatalogEntry["priceRange"]): string {
  const range = min === max ? dollars.format(min) : `${dollars.format(min)}–${dollars.format(max)}`;
  return `${range} a month ${basis === "per_unit" ? "for the whole unit" : "per person"}`;
}

export function CatalogPicker() {
  const catalog = getCatalog();
  const apartments = useTrueCost((s) => s.apartments);
  const { addApartment, removeApartment } = useTrueCost();
  const [query, setQuery] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const searchId = useId();
  const listHeadingId = useId();

  const selected = useMemo(() => {
    const ids = new Set<string>();
    for (const a of apartments) {
      const id = catalogIdOf(a.id);
      if (id) ids.add(id);
    }
    return ids;
  }, [apartments]);
  const full = apartments.length >= MAX_APARTMENTS;
  const anyUnreviewed = apartments.some((a) => catalogIdOf(a.id) && !a.reviewed);

  const q = query.trim().toLowerCase();
  const shown = q
    ? catalog.filter((e) => `${e.name} ${e.site}`.toLowerCase().includes(q))
    : catalog;

  function toggle(entry: CatalogEntry) {
    if (selected.has(entry.id)) {
      for (const a of apartments) if (catalogIdOf(a.id) === entry.id) removeApartment(a.id);
      setAnnouncement(`Removed ${entry.name} from your comparison.`);
      return;
    }
    if (full) {
      setAnnouncement(
        `You already have ${MAX_APARTMENTS} apartments, the most True Cost compares at once. Remove one to add ${entry.name}.`,
      );
      return;
    }
    addApartment(catalogApartment(entry));
    setAnnouncement(`Added ${entry.name} to your comparison.`);
  }

  return (
    <section aria-labelledby="catalog-heading" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="catalog-heading" className="text-lg font-semibold">
          Pick Blacksburg complexes
        </h2>
      </div>

      <div className="flex max-w-md flex-col gap-1.5">
        <Label htmlFor={searchId}>Search complexes</Label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Hub, Union, Foxridge…"
            autoComplete="off"
            className="pl-9"
          />
        </div>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {full && (
        <p className="rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground">
          That&apos;s {MAX_APARTMENTS}, the most you can compare. Select one again to remove it.
        </p>
      )}

      {shown.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed p-6">
          <p className="font-medium">No complexes match &ldquo;{query.trim()}&rdquo;</p>
          <Button type="button" variant="outline" size="sm" onClick={() => setQuery("")}>
            <X className="size-4" aria-hidden /> Clear search
          </Button>
        </div>
      ) : (
        // About two rows of three on desktop; the rest scroll inside the box.
        // tabIndex lets keyboard users scroll it; the cards stay in tab order.
        <div
          role="region"
          aria-labelledby={listHeadingId}
          tabIndex={0}
          className="max-h-[26rem] overflow-y-auto rounded-xl border bg-muted/30 p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <h3 id={listHeadingId} className="sr-only">
            {shown.length} Blacksburg complexes, scroll for more
          </h3>
          <ul aria-label="Blacksburg complexes" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((entry) => (
              <li key={entry.id}>
                <CatalogCard
                  entry={entry}
                  added={selected.has(entry.id)}
                  blocked={full && !selected.has(entry.id)}
                  onToggle={() => toggle(entry)}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <Link href={anyUnreviewed ? "/compare/review" : "/compare/results"}>
              {anyUnreviewed ? "Review fees" : "Go to compare"} <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
          <p className="text-sm text-muted-foreground">
            {apartments.length} of {MAX_APARTMENTS} selected
          </p>
        </div>
      )}
    </section>
  );
}

function CatalogCard({
  entry,
  added,
  blocked,
  onToggle,
}: {
  entry: CatalogEntry;
  added: boolean;
  blocked: boolean;
  onToggle: () => void;
}) {
  const fees = listingFeeCount(entry);
  const fullNoteId = useId();
  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-xl border bg-card text-card-foreground transition-colors",
        added && "border-primary ring-1 ring-primary",
      )}
    >
      {/* A native button gives click, Enter and Space for free. */}
      <button
        type="button"
        aria-pressed={added}
        aria-describedby={blocked ? fullNoteId : undefined}
        aria-disabled={blocked || undefined}
        onClick={onToggle}
        className={cn(
          "flex flex-1 flex-col gap-2 rounded-t-xl p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          blocked ? "cursor-not-allowed" : "hover:bg-muted/60",
        )}
      >
        <span className="flex items-start justify-between gap-2">
          <span className="font-semibold break-words">{entry.name}</span>
          {/* aria-pressed already says whether it's added. */}
          <span
            aria-hidden
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
              added
                ? "bg-primary text-primary-foreground"
                : "border text-muted-foreground",
            )}
          >
            {added ? (
              <>
                <Check className="size-3" aria-hidden /> Added
              </>
            ) : blocked ? (
              "List full"
            ) : (
              <>
                <Plus className="size-3" aria-hidden /> Add
              </>
            )}
          </span>
        </span>
        <span className="text-sm">{priceRange(entry.priceRange)}</span>
        <span className="text-sm text-muted-foreground">
          {fees === 1 ? "1 fee found" : `${fees} fees found`}
          {entry.autoScanned && " · Not checked yet"}
        </span>
        {blocked && (
          <span id={fullNoteId} className="sr-only">
            Your list is full. Remove an apartment to add this one.
          </span>
        )}
      </button>
      <div className="border-t px-4 py-3 text-xs">
        <a
          href={entry.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-fit items-center gap-1 rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          View listing <ExternalLink className="size-3" aria-hidden />
          <span className="sr-only"> for {entry.name} (opens in a new tab)</span>
        </a>
      </div>
    </div>
  );
}
