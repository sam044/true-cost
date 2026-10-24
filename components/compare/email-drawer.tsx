"use client";

// "Draft email to leasing office" (F10). Opens a drawer, asks POST /api/email
// for a Gemma 4 draft built from this apartment's confirmed fees and flags, and
// lets the student edit, copy or open it in their own mail app. Nothing is sent.
import { useState } from "react";
import { Copy, Mail, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { emailRequestFor, gmailHref, mailtoHref, outlookHref, type DraftResult } from "@/lib/email";
import type { Apartment, LawFlag } from "@/lib/types";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; source: DraftResult["source"] }
  | { status: "error"; message: string };

export function EmailDrawer({ apartment, flags }: { apartment: Apartment; flags: LawFlag[] }) {
  const [state, setState] = useState<State>({ status: "idle" });
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const ids = { subject: `email-subject-${apartment.id}`, body: `email-body-${apartment.id}` };

  async function write() {
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emailRequestFor(apartment, flags)),
      });
      const data = (await res.json()) as DraftResult | { error: string };
      if (!res.ok || "error" in data) {
        throw new Error("error" in data ? data.error : `Request failed (${res.status})`);
      }
      setSubject(data.subject);
      setBody(data.body);
      setState({ status: "ready", source: data.source });
    } catch (e) {
      setState({
        status: "error",
        message: e instanceof Error ? e.message : "Something went wrong.",
      });
    }
  }

  async function copy(message = "Email copied") {
    try {
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
      toast.success(message);
    } catch {
      toast.error("Couldn't copy. Select the text and copy it yourself.");
    }
  }

  return (
    <Sheet
      onOpenChange={(open) => {
        if (open && state.status === "idle") void write();
      }}
    >
      <SheetTrigger asChild>
        <Button variant="outline" className="w-full">
          <Mail aria-hidden /> Draft email to leasing office
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Email to {apartment.name}</SheetTitle>
          <SheetDescription>
            Gemma 4 drafts a polite request for the full fee list from the fees you confirmed. Edit
            it, then send it yourself. True Cost never sends anything.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-6" aria-live="polite">
          {state.status === "loading" && (
            <div role="status" className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">Gemma 4 is writing your email…</p>
              <div className="h-9 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
              <div className="h-56 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
            </div>
          )}

          {state.status === "error" && (
            <div role="alert" className="flex flex-col items-start gap-3">
              <p className="text-sm text-destructive">{state.message}</p>
              <Button variant="outline" onClick={write}>
                <RefreshCw aria-hidden /> Try again
              </Button>
            </div>
          )}

          {state.status === "ready" && (
            <>
              {state.source === "template" && (
                <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                  Gemma was unavailable, so this is our standard draft. It still lists your fees.
                </p>
              )}
              <div className="flex flex-col gap-2">
                <Label htmlFor={ids.subject}>Subject</Label>
                <Input
                  id={ids.subject}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor={ids.body}>Message</Label>
                <Textarea
                  id={ids.body}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={14}
                  className="text-sm leading-relaxed"
                />
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">Send it from your email</p>
                <div className="flex flex-wrap gap-2">
                  <Button asChild>
                    <a href={gmailHref({ subject, body })} target="_blank" rel="noreferrer">
                      <Mail aria-hidden /> Open in Gmail
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  </Button>
                  <Button asChild variant="outline">
                    <a
                      href={outlookHref({ subject, body })}
                      target="_blank"
                      rel="noreferrer"
                      // Signed-out Outlook can drop the draft on its way through
                      // sign-in, so copy it first as a backup the student can paste.
                      onClick={() =>
                        void copy("Draft copied. If Outlook asks you to sign in, sign in, then paste it.")
                      }
                    >
                      Open in Outlook<span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  </Button>
                  <Button variant="outline" onClick={() => void copy()}>
                    <Copy aria-hidden /> Copy
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <a
                    href={mailtoHref({ subject, body })}
                    className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
                  >
                    Use my computer&apos;s mail app
                  </a>
                  <Button variant="ghost" size="sm" onClick={write}>
                    <RefreshCw aria-hidden /> Write it again
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Gmail and Outlook open a filled-in draft if you&apos;re signed in. Nothing is sent
                  until you press send there.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Review the draft before sending. It asks questions; it isn&apos;t legal advice.
              </p>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
