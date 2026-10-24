"use client";

// Import from the browser extension. Owner: Sam (A). See docs/PRD.md, F19.
// The extension opens this page and writes a capture to sessionStorage. Since
// extension 0.3 its side panel has already called /api/extract, so the capture
// carries the extraction (version 3) and we only save the apartment and open
// Review or Compare. Older builds send the screenshots and text (versions 1
// and 2), which we send to /api/extract like the Add screen does.
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/page-heading";
import { Stepper } from "@/components/stepper";
import { useHydrated } from "@/components/review/use-hydrated";
import { extractListing } from "@/components/upload/extract";
import { toApartment } from "@/components/upload/to-apartment";
import { MAX_APARTMENTS, useTrueCost } from "@/lib/store";
import { Extraction } from "@/lib/types";

const STORAGE_KEY = "true-cost-capture";
const WAIT_MS = 8000;

// The capture comes from another page's script, so check it like any input.
// Version 1 (one screenshot) came from the first extension build.
const JpegDataUrl = z.string().regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/);
const Fields = { name: z.string().max(200), url: z.string().optional(), text: z.string().max(20000) };
const Capture = z
  .union([
    z.object({ version: z.literal(2), images: z.array(JpegDataUrl).max(5), ...Fields }),
    z.object({ version: z.literal(1), image: JpegDataUrl, ...Fields }),
  ])
  .transform(({ name, url, text, ...rest }) => ({
    name,
    url,
    text,
    images: "images" in rest ? rest.images : [rest.image],
  }))
  .refine((c) => c.images.length > 0 || c.text.trim().length > 0);
type Capture = z.infer<typeof Capture>;

const Extracted = z.object({
  version: z.literal(3),
  id: z.string().uuid(), // becomes the apartment id, so opening it twice doesn't add it twice
  name: z.string().max(200),
  url: z.string().optional(),
  extraction: Extraction,
  then: z.enum(["review", "compare"]),
});
type Extracted = z.infer<typeof Extracted>;

type Status =
  | { kind: "waiting" }
  | { kind: "none" }
  | { kind: "reading"; name: string }
  | { kind: "full" }
  | { kind: "error"; message: string; capture: Capture };

function takeCapture(): Capture | Extracted | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(STORAGE_KEY);
  try {
    const json = JSON.parse(raw);
    const parsed = json?.version === 3 ? Extracted.safeParse(json) : Capture.safeParse(json);
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
        const extraction = await extractListing({ images: capture.images, text: capture.text });
        const apartment = toApartment(capture.name, extraction, useTrueCost.getState().setup);
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

  const open = useCallback(
    (capture: Extracted) => {
      const { apartments } = useTrueCost.getState();
      if (!apartments.some((a) => a.id === capture.id)) {
        if (apartments.length >= MAX_APARTMENTS) {
          setStatus({ kind: "full" });
          return;
        }
        addApartment({
          ...toApartment(capture.name, capture.extraction, useTrueCost.getState().setup),
          id: capture.id,
        });
      }
      router.replace(capture.then === "compare" ? "/compare/results" : `/compare/review/${capture.id}`);
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
      if ("extraction" in capture) open(capture);
      else void run(capture);
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
  }, [hydrated, run, open]);

  return (
    <>
      <Stepper current="add" />
      {status.kind === "waiting" || status.kind === "reading" ? (
        <div role="status" aria-live="polite" className="flex flex-col gap-4">
          <PageHeading
            title={status.kind === "reading" ? `Reading ${status.name}` : "Getting your listing"}
            description="Gemma is reading the whole page, its screenshots and text, for fees. This usually takes 10 to 20 seconds."
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
