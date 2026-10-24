// Virginia fee-law flags for one apartment: short badges near the price that
// jump to the full explanations at the bottom of the column.
import { AlertTriangle, ExternalLink, Info } from "lucide-react";
import { LEGAL_AID_URL } from "@/lib/flags";
import type { LawFlag } from "@/lib/types";
import { cn } from "@/lib/utils";

const SHORT_LABEL: Record<LawFlag["id"], string> = {
  advertised_price: "Fees not in price",
  deposit_cap: "Deposit above limit",
  first_page_itemization: "Check lease page 1",
};

const flagAnchor = (apartmentId: string, flag: LawFlag) => `flag-${apartmentId}-${flag.id}`;

function FlagIcon({ flag, className }: { flag: LawFlag; className?: string }) {
  const Icon = flag.severity === "issue" ? AlertTriangle : Info;
  return <Icon aria-hidden className={cn("size-3.5 shrink-0", className)} />;
}

const tone = (flag: LawFlag) =>
  flag.severity === "issue"
    ? "border-warning bg-warning text-hidden-foreground"
    : "border-border bg-secondary text-secondary-foreground";

export function FlagBadges({ apartmentId, flags }: { apartmentId: string; flags: LawFlag[] }) {
  if (flags.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Virginia fee-law notes">
      {flags.map((flag) => (
        <li key={flag.id}>
          <a
            href={`#${flagAnchor(apartmentId, flag)}`}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
              "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none hover:underline",
              tone(flag),
            )}
          >
            <FlagIcon flag={flag} />
            <span className="sr-only">{flag.severity === "issue" ? "Possible issue: " : "Good to know: "}</span>
            {SHORT_LABEL[flag.id]}
          </a>
        </li>
      ))}
    </ul>
  );
}

export function FlagList({ apartmentId, flags }: { apartmentId: string; flags: LawFlag[] }) {
  if (flags.length === 0) return null;
  return (
    <section className="flex flex-col gap-3 text-sm" aria-labelledby={`flags-${apartmentId}`}>
      <h3 id={`flags-${apartmentId}`} className="font-medium">
        Before you sign
      </h3>
      <ul className="flex flex-col gap-3">
        {flags.map((flag) => (
          <li
            key={flag.id}
            id={flagAnchor(apartmentId, flag)}
            tabIndex={-1}
            className="flex scroll-mt-24 flex-col gap-1.5 rounded-lg border p-3 focus:outline-none target:ring-2 target:ring-ring"
          >
            <p className="flex items-center gap-1.5 font-medium">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
                  tone(flag),
                )}
              >
                <FlagIcon flag={flag} />
                {flag.severity === "issue" ? "Possible issue" : "Good to know"}
              </span>
            </p>
            <p className="font-medium">{flag.title}</p>
            <p className="text-muted-foreground">{flag.explanation}</p>
            <a
              href={flag.citation.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-fit items-center gap-1 text-primary underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {flag.citation.label}
              <ExternalLink aria-hidden className="size-3" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
      <LegalNote />
    </section>
  );
}

export function LegalNote() {
  return (
    <p className="text-xs text-muted-foreground">
      This is information, not legal advice. For help with a lease, contact{" "}
      <a
        href={LEGAL_AID_URL}
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-4 hover:text-foreground"
      >
        Virginia Law Help<span className="sr-only"> (opens in a new tab)</span>
      </a>
      .
    </p>
  );
}
