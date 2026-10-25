// Show-more section for the Compare columns. A native <details>, so it works by
// keyboard and screen reader with no script.
import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export function Expandable({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <details className="group border-t border-border/70 first:border-t-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-2 py-3 text-sm font-medium transition-colors duration-150 select-none hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-(--ease-out-strong) group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <div className="px-2 pt-1 pb-4">{children}</div>
    </details>
  );
}
