import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Receipt } from "@/components/home/receipt";
import { getCatalog } from "@/lib/catalog";

// The receipt beside the headline is a real hand-checked catalog listing with
// per-unit rent and per-person fees, so the roommate split shows the point.
const EXAMPLE_NAME = "Foxridge";

function exampleListing() {
  const catalog = getCatalog().filter((e) => !e.autoScanned);
  return catalog.find((e) => e.name.includes(EXAMPLE_NAME)) ?? catalog[0];
}

export default function Home() {
  const example = exampleListing();

  return (
    <section className="grid min-h-[calc(100dvh-8rem)] items-center gap-14 py-14 sm:py-20 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-20">
      <div className="flex flex-col items-start gap-7">
        <h1 className="max-w-[13ch] text-[2.75rem] leading-[1.02] font-semibold tracking-[-0.04em] sm:text-6xl lg:text-7xl">
          The rent you see isn&apos;t the rent you pay.
        </h1>
        <p className="max-w-[46ch] text-lg text-pretty text-muted-foreground sm:text-xl sm:leading-relaxed">
          Admin fees, utility fees, parking, reconditioning. True Cost reads your apartment
          screenshots and shows what each place really costs you per month, before you sign.
        </p>
        <div className="flex flex-col items-start gap-5 pt-1">
          <Button asChild size="lg">
            <Link href="/compare/setup">
              Compare apartments
              <ArrowRight
                aria-hidden
                className="transition-transform duration-200 ease-(--ease-out-strong) group-hover/button:translate-x-0.5"
              />
            </Link>
          </Button>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span>Made by renters, for renters</span>
            <span aria-hidden>·</span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-success" aria-hidden />
              No sign-up.
            </span>
          </p>
        </div>
      </div>

      {example && <Receipt apartment={example.apartment} leaseMonths={12} initialPeople={2} />}
    </section>
  );
}
