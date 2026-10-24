"use client";

// Import from the browser extension. Owner: Sam (A). See docs/PRD.md, F19.
// The extension opens this page and writes its capture (one screenshot plus the
// page text) to sessionStorage. We send it to /api/extract like the Add screen
// does, save the apartment and open Review for it.
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/page-heading";
import { Stepper } from "@/components/stepper";
import { useHydrated } from "@/components/review/use-hydrated";
import { toApartment } from "@/components/upload/to-apartment";
import { MAX_APARTMENTS, useTrueCost } from "@/lib/store";
import { Extraction } from "@/lib/types";

const STORAGE_KEY = "true-cost-capture";
const WAIT_MS = 8000;

// The capture comes from another page's script, so check it like any input.
const Capture = z.object({
  version: z.literal(1),
  name: z.string().max(200),
  url: z.string().optional(),
  image: z.string().regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/),
  text: z.string().max(20000),
});
type Capture = z.infer<typeof Capture>;

type Status =
  | { kind: "waiting" }
  | { kind: "none" }
  | { kind: "reading"; name: string }
  | { kind: "full" }
  | { kind: "error"; message: string; capture: Capture };

function takeCapture(): Capture | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(STORAGE_KEY);
  try {
    const parsed = Capture.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export default function ImportPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const addApartment = useTrueCost((s) => s.addApartment);
  const [status, setStatus] = useState<Status>({ kind: "waiting" });
  const started = useRef(false);

  const run = useCallback(
    async (capture: Capture) => {
      if (useTrueCost.getState().apartments.length >= MAX_APARTMENTS) {
        setStatus({ kind: "full" });
        return;
      }
      setStatus({ kind: "reading", name: capture.name });
      try {
        const response = await fetch("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ images: [capture.image], text: capture.text || undefined }),
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body?.error ?? "We couldn't read this listing.");
        const extraction = Extraction.safeParse(body);
        if (!extraction.success) throw new Error("We couldn't read this listing.");
        const apartment = toApartment(capture.name, extraction.data);
        addApartment(apartment);
        router.replace(`/compare/review/${apartment.id}`);
      } catch (error) {
        setStatus({
          kind: "error",
          message: error instanceof Error ? error.message : "We couldn't read this listing.",
          capture,
        });
      }
    },
    [addApartment, router],
  );

  // Wait for saved apartments to load so the 3-apartment limit is checked
  // against them, then take the capture whichever arrived first, page or capture.
  useEffect(() => {
    if (!hydrated) return;
    const tryStart = () => {
      if (started.current) return;
      const capture = takeCapture();
      if (!capture) return;
      started.current = true;
      void run(capture);
    };
    tryStart();
    window.addEventListener(STORAGE_KEY, tryStart);
    const timer = setTimeout(() => {
      if (!started.current) setStatus({ kind: "none" });
    }, WAIT_MS);
    return () => {
      window.removeEventListener(STORAGE_KEY, tryStart);
      clearTimeout(timer);
    };
  }, [hydrated, run]);

  return (
    <>
      <Stepper current="add" />
      {status.kind === "waiting" || status.kind === "reading" ? (
        <div role="status" aria-live="polite" className="flex flex-col gap-4">
          <PageHeading
            title={status.kind === "reading" ? `Reading ${status.name}` : "Getting your listing"}
            description="Gemma is reading the screenshot and page text for fees. This can take a little while."
          />
          <div className="h-40 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
        </div>
      ) : status.kind === "full" ? (
        <>
          <PageHeading
            title={`You already have ${MAX_APARTMENTS} apartments`}
            description="Remove one on the Add screen, then click the True Cost button on the listing again."
          />
          <Button asChild>
            <Link href="/compare/add">Go to your apartments</Link>
          </Button>
        </>
      ) : status.kind === "error" ? (
        <div role="alert" className="flex flex-col">
          <PageHeading
            title="We couldn't read this listing"
            description={`${status.message} You can try again, or add it with screenshots or pasted text.`}
          />
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => void run(status.capture)}>Try again</Button>
            <Button asChild variant="outline">
              <Link href="/compare/add">Add it another way</Link>
            </Button>
          </div>
        </div>
      ) : (
        <>
          <PageHeading
            title="Nothing to import"
            description="Open an apartment listing and click the True Cost button in your browser's toolbar, or add the apartment here."
          />
          <Button asChild>
            <Link href="/compare/add">Add an apartment</Link>
          </Button>
        </>
      )}
    </>
  );
}
