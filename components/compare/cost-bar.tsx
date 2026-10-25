// Stacked bar of where the true monthly cost goes. Plain CSS, so it renders on
// the server and needs no chart library; the legend repeats every value as text.
import type { CostSummary } from "@/lib/types";
import { money } from "./format";

const SEGMENTS: { key: keyof CostSummary["breakdown"]; label: string; color: string }[] = [
  { key: "rent", label: "Rent", color: "bg-chart-1" },
  { key: "recurringFees", label: "Recurring fees", color: "bg-chart-2" },
  { key: "utilities", label: "Utilities", color: "bg-chart-3" },
  { key: "oneTimeAndDeposits", label: "One-time fees, spread monthly", color: "bg-chart-4" },
];

export function CostBar({ summary }: { summary: CostSummary }) {
  const parts = SEGMENTS.filter((s) => summary.breakdown[s.key] > 0);

  return (
    <div className="flex flex-col gap-3">
      <div aria-hidden className="bar-grow flex h-2.5 w-full gap-[3px] overflow-hidden rounded-full bg-muted">
        {parts.map((s) => (
          <div
            key={s.key}
            className={`${s.color} first:rounded-l-full last:rounded-r-full`}
            style={{ width: `${(summary.breakdown[s.key] / summary.trueMonthly) * 100}%` }}
          />
        ))}
      </div>
      <ul className="grid gap-1.5 text-sm" aria-label="Monthly cost by type">
        {parts.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <span aria-hidden className={`size-2 shrink-0 rounded-full ${s.color}`} />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="ml-auto tabular-nums">{money(summary.breakdown[s.key])}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
