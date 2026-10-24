"use client";

// "Fee index" panel for one Compare column (F20). Loads after the page from
// GET /api/index/complex and shows fees other students reported at this complex
// that this apartment doesn't have. Hints only: never changes the totals.
// States: skeleton while loading, a note when not found, hidden on any error.
// Remount with key={apartment.name} so a renamed apartment refetches.
import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { feeAmountLabel, missingFees, reportsLabel, summaryLine, type IndexSummary } from "@/lib/fee-index";
import type { Apartment } from "@/lib/types";
import { Expandable } from "./expandable";
import { mockSummary } from "./index-mock";

type State =
  | { status: "loading" }
  | { status: "ready"; summary: IndexSummary }
  | { status: "not_found" }
  | { status: "error" };

const USE_MOCK = process.env.NEXT_PUBLIC_INDEX_MOCK === "1";

async function loadSummary(name: string, signal: AbortSignal): Promise<IndexSummary | null> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 400)); // show the skeleton
    return mockSummary(name);
  }
  const res = await fetch(`/api/index/complex?name=${encodeURIComponent(name)}`, { signal });
  if (!res.ok) throw new Error(`Fee index returned ${res.status}`);
  const body = (await res.json()) as IndexSummary | { found: false };
  return body.found ? body : null;
}

export function IndexPanel({ apartment }: { apartment: Apartment }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const headingId = `index-${apartment.id}`;

  useEffect(() => {
    const controller = new AbortController();
    loadSummary(apartment.name, controller.signal).then(
      (summary) => setState(summary ? { status: "ready", summary } : { status: "not_found" }),
      (error: unknown) => {
        if (controller.signal.aborted) return;
        console.warn("Fee index unavailable", error);
        setState({ status: "error" });
      },
    );
    return () => controller.abort();
  }, [apartment.name]);

  if (state.status === "error") return null;

  return (
    <Expandable
      title={
        <span id={headingId} className="flex items-center gap-1.5">
          <Users aria-hidden className="size-4 text-muted-foreground" />
          Fees other students reported
        </span>
      }
    >
      <section
        aria-labelledby={headingId}
        aria-live="polite"
        aria-busy={state.status === "loading"}
        className="flex flex-col gap-2 text-sm"
      >
        {state.status === "loading" && (
          <div className="flex flex-col gap-2" role="status" aria-label="Loading fees other students reported">
            <div className="h-4 w-3/4 animate-pulse rounded bg-muted motion-reduce:animate-none" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted motion-reduce:animate-none" />
          </div>
        )}

        {state.status === "not_found" && (
          <p className="text-muted-foreground">No one has shared fees for this complex yet.</p>
        )}

        {state.status === "ready" && <IndexResult apartment={apartment} summary={state.summary} />}
      </section>
    </Expandable>
  );
}

function IndexResult({ apartment, summary }: { apartment: Apartment; summary: IndexSummary }) {
  const missing = missingFees(summary, apartment);

  return (
    <>
      {missing.length === 0 ? (
        <p className="text-muted-foreground">
          Every fee other students reported here is already on your list.
        </p>
      ) : (
        <>
          <p className="text-muted-foreground">
            Other students reported these here. They are not on your list and not in your total;
            ask the leasing office whether they apply to you.
          </p>
          <ul className="divide-y rounded-lg border">
            {missing.map((fee) => (
              <li
                key={`${fee.category}-${fee.frequency}-${fee.name}`}
                className="flex items-start justify-between gap-3 px-3 py-2"
              >
                <span className="flex flex-col">
                  <span>{fee.name}</span>
                  <span className="text-xs text-muted-foreground">{reportsLabel(fee)}</span>
                </span>
                <span className="shrink-0 text-right tabular-nums">{feeAmountLabel(fee)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="text-xs text-muted-foreground">{summaryLine(summary)}</p>
    </>
  );
}
