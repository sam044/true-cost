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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  catalogApartment,
  catalogIdOf,
  getCatalog,
  listingFeeCount,
  type CatalogEntry,
} from "@/lib/catalog";
import {
  SORT_LABELS,
  catalogSummary,
  milesToCampus,
  sharersFor,
  sortCatalog,
  type SortKey,
} from "@/lib/catalog/sort";
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

// "2026-10-24" -> "Oct 24, 2026", without a time zone shift.
function readDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function CatalogPicker() {
  const catalog = getCatalog();
  const apartments = useTrueCost((s) => s.apartments);
  const { addApartment, removeApartment } = useTrueCost();
  const [query, setQuery] = useState("");
  // Sorting (Andy): prices per person for the current Setup.
  const [sort, setSort] = useState<SortKey>("recommended");
  const setup = useTrueCost((s) => s.setup);
  const sortId = useId();
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
  const shown = sortCatalog(
    q ? catalog.filter((e) => `${e.name} ${e.site}`.toLowerCase().includes(q)) : catalog,
    sort,
    setup,
  );
  // When sorting by a price, each card shows the number it was sorted by.
  const perPerson = (entry: CatalogEntry): PerPerson | null => {
    if (sort === "recommended" || sort === "distance" || sort === "hidden-asc") return null;
    if (entry.apartment.advertised.amount <= 0) return null;
    const s = catalogSummary(entry, setup);
    const trueCost = sort === "true-asc" || sort === "true-desc";
    return {
      amount: trueCost ? s.trueMonthly : s.advertisedMonthly,
      allIn: trueCost,
      split: entry.apartment.advertised.basis === "per_unit" ? sharersFor(entry, setup) : null,
    };
  };

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
        <h2 id="catalog-heading" className="text-xl font-semibold tracking-tight">
          Pick Blacksburg complexes
        </h2>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex w-full max-w-md flex-col gap-1.5">
          <Label htmlFor={searchId} className="sr-only">
            Search complexes
          </Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id={searchId}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search, e.g. Hub or Union"
              autoComplete="off"
              className="h-11 rounded-xl pl-10 text-base"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor={sortId} className="shrink-0 text-sm text-muted-foreground">
            Sort by
          </Label>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger id={sortId} className="h-11 min-w-56 rounded-xl text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {SORT_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {full && (
        <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
          You have {MAX_APARTMENTS} apartments, the most True Cost compares at once. Select an added
          complex again to remove it.
        </p>
      )}

      {shown.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl bg-muted/60 p-6">
          <p className="font-medium">No complexes match &ldquo;{query.trim()}&rdquo;</p>
          <p className="text-sm text-muted-foreground">
            Check the spelling, or add the listing yourself below.
          </p>
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
          className="relative max-h-[30rem] overflow-y-auto overscroll-contain rounded-2xl bg-muted/70 p-2 [scrollbar-gutter:stable] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-3"
        >
          <h3 id={listHeadingId} className="sr-only">
            {shown.length} Blacksburg complexes, scroll for more
          </h3>
          <ul
            aria-label="Blacksburg complexes"
            className="grid gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3"
          >
            {shown.map((entry) => (
              <li key={entry.id}>
                <CatalogCard
                  entry={entry}
                  miles={milesToCampus(entry.id)}
                  perPerson={perPerson(entry)}
                  added={selected.has(entry.id)}
                  blocked={full && !selected.has(entry.id)}
                  onToggle={() => toggle(entry)}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Sticks to the bottom of the screen while the list scrolls past, so the
          next step is always one tap away. */}
      {selected.size > 0 && (
        <div className="sticky bottom-4 z-30 mt-2">
          <div className="selection-bar flex flex-col gap-3 rounded-2xl bg-foreground p-3 pl-5 text-background shadow-[0_12px_32px_-8px_rgb(0_0_0/0.35)] sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <span className="flex shrink-0 gap-1" aria-hidden>
                {Array.from({ length: MAX_APARTMENTS }, (_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "size-2 rounded-full transition-colors duration-200",
                      i < apartments.length ? "bg-background" : "bg-background/25",
                    )}
                  />
                ))}
              </span>
              <p className="min-w-0 text-sm text-pretty">
                <span className="font-medium">
                  {apartments.length} of {MAX_APARTMENTS} apartments selected.
                </span>{" "}
                <span className="text-background/70">
                  {anyUnreviewed
                    ? "Auto-scanned complexes open Review first so you can check their fees."
                    : "Catalog fees are already checked, so they go straight to Compare."}
                </span>
              </p>
            </div>
            <Button
              asChild
              size="lg"
              className="shrink-0 bg-background text-foreground shadow-none hover:bg-background/90"
            >
              <Link href={anyUnreviewed ? "/compare/review" : "/compare/results"}>
                {anyUnreviewed ? "Review fees" : "Go to compare"}{" "}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

interface PerPerson {
  amount: number;
  allIn: boolean; // true cost (fees included) rather than the advertised price
  split: { people: number; bedroomsKnown: boolean } | null; // whole-unit prices only
}

function CatalogCard({
  entry,
  miles,
  perPerson,
  added,
  blocked,
  onToggle,
}: {
  entry: CatalogEntry;
  miles: number | null; // straight line to the Drillfield
  perPerson: PerPerson | null; // shown when sorting by a price
  added: boolean;
  blocked: boolean;
  onToggle: () => void;
}) {
  const fees = listingFeeCount(entry);
  const fullNoteId = useId();
  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-xl bg-card text-card-foreground shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1 ring-foreground/[0.06] transition-[box-shadow,background-color] duration-200",
        added && "theme-maroon ring-0",
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
          "group/card flex flex-1 flex-col gap-1.5 rounded-t-xl p-4 text-left transition-transform duration-150 ease-(--ease-out-strong) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          blocked ? "cursor-not-allowed" : "active:scale-[0.985] motion-reduce:active:scale-100",
        )}
      >
        <span className="flex items-start justify-between gap-2">
          <span className="leading-snug font-semibold break-words">{entry.name}</span>
          {/* aria-pressed already says whether it's added. */}
          <span
            aria-hidden
            className={cn(
              "inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-medium transition-colors duration-200",
              added
                ? "bg-primary text-primary-foreground"
                : blocked
                  ? "bg-muted text-muted-foreground"
                  : "bg-muted text-foreground group-hover/card:bg-primary group-hover/card:text-primary-foreground",
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
        <span className="mt-1 text-sm tabular-nums">{priceRange(entry.priceRange)}</span>
        {perPerson && (
          <span className="text-sm font-medium tabular-nums">
            About {dollars.format(perPerson.amount)} a month each{perPerson.allIn ? ", all-in" : ""}
            {perPerson.split && (
              <span className="font-normal text-muted-foreground">
                {" "}
                · split {perPerson.split.people} {perPerson.split.people === 1 ? "way" : "ways"}
                {perPerson.split.bedroomsKnown ? "" : ", bedrooms unknown"}
              </span>
            )}
          </span>
        )}
        <span className="text-sm text-muted-foreground tabular-nums">
          {miles != null ? `About ${miles.toFixed(1)} mi to campus` : "Distance unknown"}
        </span>
        <span className="text-sm text-muted-foreground">
          {fees === 1 ? "1 fee found" : `${fees} fees found`}
          {entry.autoScanned ? " · Auto-scanned, not checked yet" : " · Checked by hand"}
        </span>
        {blocked && (
          <span id={fullNoteId} className="sr-only">
            Your list is full. Remove an apartment to add this one.
          </span>
        )}
      </button>
      <div className="mx-4 flex flex-col gap-1 border-t border-dashed border-foreground/10 py-3 text-xs text-muted-foreground">
        <span>
          {entry.site} · Read {readDate(entry.readOn)}
        </span>
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
