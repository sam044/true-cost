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

export function Stepper({ current }: { current: StepKey }) {
  const currentIndex = STEPS.findIndex((s) => s.key === current);

  return (
    <nav aria-label="Progress" className="py-6">
      <ol className="flex flex-wrap items-center gap-2 text-sm">
        {STEPS.map((step, i) => {
          const done = i < currentIndex;
          const active = i === currentIndex;
          return (
            <li key={step.key} className="flex items-center gap-2">
              <Link
                href={step.href}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-full px-3 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active && "bg-primary text-primary-foreground",
                  done && "text-foreground hover:bg-muted",
                  !active && !done && "text-muted-foreground hover:bg-muted",
                )}
              >
                <span
                  className={cn(
                    "grid size-5 place-items-center rounded-full border text-xs",
                    active && "border-primary-foreground/40",
                    done && "border-success bg-success text-white",
                  )}
                  aria-hidden
                >
                  {done ? <Check className="size-3" /> : i + 1}
                </span>
                {step.label}
              </Link>
              {i < STEPS.length - 1 && <span className="h-px w-6 bg-border" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
