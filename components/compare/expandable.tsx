// Show-more section for the Compare columns. A native <details>, so it works by
// keyboard and screen reader with no script.
import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export function Expandable({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-md py-1 text-sm font-medium hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <div className="pt-3">{children}</div>
    </details>
  );
}
