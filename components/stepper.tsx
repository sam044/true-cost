import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "setup", label: "Setup", href: "/compare/setup" },
  { key: "add", label: "Apartments", href: "/compare/add" },
  { key: "review", label: "Review fees", href: "/compare/review" },
  { key: "results", label: "Compare", href: "/compare/results" },
] as const;

export type StepKey = (typeof STEPS)[number]["key"];

// Four equal segments: a filled bar over each step reached, the label under it.
// On a phone only the current label shows, with "Step n of 4". It sits on a
// maroon band that runs on from the header into the page heading below.
export function Stepper({ current }: { current: StepKey }) {
  const currentIndex = STEPS.findIndex((s) => s.key === current);

  return (
    <nav aria-label="Progress" className="bleed bg-maroon pt-7 pb-10 text-cream">
      <p className="mb-2 text-sm text-cream/70 sm:hidden" aria-hidden>
        Step {currentIndex + 1} of {STEPS.length}
        <span className="text-cream"> · {STEPS[currentIndex].label}</span>
      </p>
      <ol className="grid grid-cols-4 gap-2 text-sm">
        {STEPS.map((step, i) => {
          const done = i < currentIndex;
          const active = i === currentIndex;
          return (
            <li key={step.key} className="min-w-0">
              <Link
                href={step.href}
                aria-current={active ? "step" : undefined}
                className="group flex flex-col gap-2.5 rounded-md pb-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream focus-visible:ring-offset-4 focus-visible:ring-offset-maroon"
              >
                <span
                  aria-hidden
                  className={cn(
                    "h-1 rounded-full transition-colors duration-300",
                    active
                      ? "bg-orange"
                      : done
                        ? "bg-cream"
                        : "bg-cream/20 group-hover:bg-cream/35",
                  )}
                />
                <span
                  className={cn(
                    "flex items-center gap-1.5 truncate transition-colors",
                    active && "font-medium text-cream",
                    !active && "text-cream/65 group-hover:text-cream",
                    "max-sm:sr-only",
                  )}
                >
                  {done && <Check className="size-3.5 shrink-0 text-cream" aria-hidden />}
                  {step.label}
                  {done && <span className="sr-only"> (done)</span>}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
