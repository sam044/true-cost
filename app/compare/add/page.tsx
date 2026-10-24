"use client";

// Add apartment screen. Owner: Sam (A).
// Name, up to 5 screenshots (drag, click or Ctrl+V paste) and/or pasted
// listing text. Screenshots are resized to 1600 px JPEG in the browser, then
// everything goes to POST /api/extract in one call. Each apartment added shows
// as a card (max 3); "Review fees" moves on.
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { CircleCheck, CircleDashed, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { PageHeading } from "@/components/page-heading";
import { Stepper } from "@/components/stepper";
import { useHydrated } from "@/components/review/use-hydrated";
import { DropZone } from "@/components/upload/drop-zone";
import { extractListing } from "@/components/upload/extract";
import { resizeToJpeg } from "@/components/upload/resize";
import { toApartment } from "@/components/upload/to-apartment";
import { MAX_APARTMENTS, useTrueCost } from "@/lib/store";
import type { Apartment } from "@/lib/types";

const MAX_IMAGES = 5;
const MAX_TEXT = 20000;

export default function AddApartmentPage() {
  const hydrated = useHydrated();

  return (
    <>
      <Stepper current="add" />
      <PageHeading
        title="Add up to 3 apartments"
        description="Drop in screenshots of the listing, the fees page or the lease's fee table, or paste the listing text."
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
  // A new key resets the form after each apartment is added.
  const [formKey, setFormKey] = useState(0);
  const full = apartments.length >= MAX_APARTMENTS;

  function handleAdded(apartment: Apartment) {
    addApartment(apartment);
    setFormKey((k) => k + 1);
    toast.success(
      `Found ${apartment.fees.length === 1 ? "1 fee" : `${apartment.fees.length} fees`} for ${apartment.name}`,
    );
  }

  function handleRemove(apartment: Apartment) {
    removeApartment(apartment.id);
    toast(`Removed ${apartment.name}`, {
      action: { label: "Undo", onClick: () => addApartment(apartment) },
    });
  }

  return (
    <div className="flex flex-col gap-8">
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

      {full ? (
        <p className="rounded-xl border bg-card p-4 text-muted-foreground">
          That&apos;s {MAX_APARTMENTS} apartments, the most True Cost compares at once. Remove one
          to add a different apartment.
        </p>
      ) : (
        <AddForm key={formKey} position={apartments.length + 1} onAdded={handleAdded} />
      )}

      {apartments.length > 0 && (
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

interface Screenshot {
  id: string;
  dataUrl: string;
  label: string;
}

type Status =
  | { kind: "idle" }
  | { kind: "preparing"; done: number; total: number }
  | { kind: "reading" }
  | { kind: "error"; message: string };

function AddForm({ position, onAdded }: { position: number; onAdded: (a: Apartment) => void }) {
  const [name, setName] = useState("");
  const [tab, setTab] = useState("screenshots");
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [note, setNote] = useState<string | null>(null);
  const [missingInput, setMissingInput] = useState(false);
  const dropRef = useRef<HTMLButtonElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const busy = status.kind === "preparing" || status.kind === "reading";
  const remaining = MAX_IMAGES - screenshots.length;

  const addFiles = useCallback(
    async (files: File[]) => {
      const images = files.filter((f) => f.type.startsWith("image/"));
      const skipped: string[] = [];
      if (images.length < files.length) skipped.push("only images can be added");
      const room = MAX_IMAGES - screenshots.length;
      if (images.length > room) skipped.push(`only ${MAX_IMAGES} screenshots fit`);
      const accepted = images.slice(0, Math.max(0, room));
      if (accepted.length === 0) {
        setNote(skipped.length ? `Nothing added: ${skipped.join(", ")}.` : null);
        return;
      }

      setMissingInput(false);
      const added: Screenshot[] = [];
      for (const [i, file] of accepted.entries()) {
        setStatus({ kind: "preparing", done: i + 1, total: accepted.length });
        try {
          added.push({
            id: crypto.randomUUID(),
            dataUrl: await resizeToJpeg(file),
            label: file.name && file.name !== "image.png" ? file.name : "Pasted screenshot",
          });
        } catch {
          skipped.push(`${file.name || "a pasted image"} couldn't be opened`);
        }
      }
      setScreenshots((current) => [...current, ...added].slice(0, MAX_IMAGES));
      setStatus({ kind: "idle" });
      setNote(
        skipped.length
          ? `Added ${added.length}; ${skipped.join(", ")}.`
          : `Added ${added.length === 1 ? "1 screenshot" : `${added.length} screenshots`}.`,
      );
    },
    [screenshots.length],
  );

  // Ctrl+V anywhere on the page adds a copied screenshot. Text pastes into
  // fields are left alone.
  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const files = Array.from(event.clipboardData?.files ?? []).filter((f) =>
        f.type.startsWith("image/"),
      );
      if (files.length === 0 || busy) return;
      event.preventDefault();
      setTab("screenshots");
      void addFiles(files);
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [addFiles, busy]);

  useEffect(() => {
    if (status.kind === "error") errorRef.current?.focus();
  }, [status.kind]);

  function removeScreenshot(index: number) {
    setScreenshots((current) => current.filter((_, i) => i !== index));
    setNote(`Removed screenshot ${index + 1}.`);
    dropRef.current?.focus();
  }

  async function onSubmit(event?: FormEvent) {
    event?.preventDefault();
    if (busy) return;
    if (screenshots.length === 0 && text.trim() === "") {
      setMissingInput(true);
      if (tab === "text") textRef.current?.focus();
      else dropRef.current?.focus();
      return;
    }
    setStatus({ kind: "reading" });
    try {
      const extraction = await extractListing({
        images: screenshots.map((s) => s.dataUrl),
        text: text.slice(0, MAX_TEXT),
      });
      onAdded(toApartment(name.trim() || `Apartment ${position}`, extraction));
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "We couldn't read this listing.",
      });
    }
  }

  const shots = screenshots.length === 1 ? "your screenshot" : `your ${screenshots.length} screenshots`;
  const readingLabel =
    screenshots.length > 0
      ? `Gemma is reading ${shots}${text.trim() ? " and text" : ""}…`
      : "Gemma is reading your listing text…";

  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
          <h2 className="text-lg font-semibold">
            {position === 1 ? "Add an apartment" : "Add another apartment"}
          </h2>

          <div className="flex max-w-md flex-col gap-1.5">
            <Label htmlFor="apartment-name">Apartment name</Label>
            <Input
              id="apartment-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Hub Blacksburg"
              maxLength={80}
              autoComplete="off"
              disabled={busy}
            />
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="screenshots" disabled={busy}>
                Screenshots
              </TabsTrigger>
              <TabsTrigger value="text" disabled={busy}>
                Paste listing text instead
              </TabsTrigger>
            </TabsList>

            <TabsContent value="screenshots" className="flex flex-col gap-4 pt-2">
              <DropZone
                ref={dropRef}
                onFiles={(files) => void addFiles(files)}
                disabled={busy || remaining === 0}
                remaining={remaining}
                describedBy={missingInput ? "input-error" : undefined}
              />
              {screenshots.length > 0 && (
                <ul aria-label="Screenshots to read" className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                  {screenshots.map((shot, i) => (
                    <li key={shot.id} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
                      <img
                        src={shot.dataUrl}
                        alt={`Screenshot ${i + 1}: ${shot.label}`}
                        className="aspect-[3/4] w-full rounded-lg border object-cover object-top"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        onClick={() => removeScreenshot(i)}
                        disabled={busy}
                        aria-label={`Remove screenshot ${i + 1}`}
                        className="absolute top-1.5 right-1.5 size-7 rounded-full shadow"
                      >
                        <X className="size-4" aria-hidden />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="text" className="flex flex-col gap-1.5 pt-2">
              <Label htmlFor="listing-text">Listing text</Label>
              <Textarea
                ref={textRef}
                id="listing-text"
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setMissingInput(false);
                }}
                maxLength={MAX_TEXT}
                rows={10}
                disabled={busy}
                aria-describedby={missingInput ? "text-hint input-error" : "text-hint"}
                placeholder={"Copy the fees section of the listing and paste it here, for example:\nAdministrative Fee $150\nUtility Service Fee $62/month"}
              />
              <p id="text-hint" className="text-sm text-muted-foreground">
                Include the price and every fee you can find. Any screenshots you added are read too.
              </p>
            </TabsContent>
          </Tabs>

          <p role="status" aria-live="polite" className="text-sm text-muted-foreground empty:hidden">
            {status.kind === "preparing"
              ? `Preparing screenshot ${status.done} of ${status.total}…`
              : status.kind === "reading"
                ? readingLabel
                : (note ?? "")}
          </p>

          {missingInput && (
            <p id="input-error" className="text-sm text-destructive">
              Add at least one screenshot or paste the listing text.
            </p>
          )}

          {status.kind === "error" && (
            <div
              ref={errorRef}
              tabIndex={-1}
              role="alert"
              className="flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <p className="font-medium">We couldn&apos;t read this listing</p>
              <p className="text-sm text-muted-foreground">{status.message}</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => void onSubmit()}>
                  Try again
                </Button>
                {tab === "screenshots" && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setTab("text");
                      setStatus({ kind: "idle" });
                      requestAnimationFrame(() => textRef.current?.focus());
                    }}
                  >
                    Paste text instead
                  </Button>
                )}
              </div>
            </div>
          )}

          <div>
            <Button type="submit" size="lg" disabled={busy}>
              {status.kind === "reading" ? "Finding fees…" : "Find fees"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
