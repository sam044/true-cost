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
// On a phone only the current label shows, with "Step n of 4".
export function Stepper({ current }: { current: StepKey }) {
  const currentIndex = STEPS.findIndex((s) => s.key === current);

  return (
    <nav aria-label="Progress" className="pt-8 pb-10">
      <p className="mb-2 text-sm text-muted-foreground sm:hidden" aria-hidden>
        Step {currentIndex + 1} of {STEPS.length}
        <span className="text-foreground"> · {STEPS[currentIndex].label}</span>
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
                className="group flex flex-col gap-2.5 rounded-md pb-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
              >
                <span
                  aria-hidden
                  className={cn(
                    "h-1 rounded-full transition-colors duration-300",
                    active || done ? "bg-primary" : "bg-border group-hover:bg-foreground/20",
                  )}
                />
                <span
                  className={cn(
                    "flex items-center gap-1.5 truncate transition-colors",
                    active && "font-medium text-foreground",
                    done && "text-muted-foreground group-hover:text-foreground",
                    !active && !done && "text-muted-foreground group-hover:text-foreground",
                    "max-sm:sr-only",
                  )}
                >
                  {done && <Check className="size-3.5 shrink-0 text-primary" aria-hidden />}
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
