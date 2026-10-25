"use client";

// One editable fee on the Review screen: name, amount, frequency, basis,
// required or optional, and the words the fee came from.
import { forwardRef, useId } from "react";
import { Trash2, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { defaultCounted } from "@/lib/cost";
import { useTrueCost } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { Basis, Fee, Frequency } from "@/lib/types";
import { BASIS_LABELS, FREQUENCY_LABELS, MANDATORY_LABELS, needsCheck } from "./labels";
import { MoneyInput } from "./money-input";

interface FeeRowProps {
  fee: Fee;
  showErrors: boolean;
  onChange: (patch: Partial<Fee>) => void;
  onRemove: () => void;
}

export const FeeRow = forwardRef<HTMLInputElement, FeeRowProps>(function FeeRow(
  { fee, showErrors, onChange, onRemove },
  nameRef,
) {
  const id = useId();
  const setup = useTrueCost((s) => s.setup);
  const flagged = needsCheck(fee);
  const nameMissing = showErrors && fee.name.trim() === "";
  const label = fee.name.trim() || "new fee";

  return (
    <li
      aria-labelledby={`${id}-title`}
      className={cn(
        "flex flex-col gap-4 rounded-2xl bg-card p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1 ring-foreground/[0.07] sm:p-6",
        flagged && "bg-warning/[0.06] ring-2 ring-warning dark:bg-warning/10",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={`${id}-title`} className="sr-only">
          {label}
        </h3>
        {flagged && (
          <Badge className="bg-warning text-foreground dark:text-background">
            <TriangleAlert aria-hidden />
            Check this
          </Badge>
        )}
        {fee.source === "estimate" && <Badge variant="secondary">Estimate</Badge>}
        {fee.source === "user" && <Badge variant="outline">Added by you</Badge>}
        {fee.refundable && <Badge variant="outline">Refundable</Badge>}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          aria-label={`Delete ${label}`}
        >
          <Trash2 aria-hidden />
          Delete
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-name`}>Fee name</Label>
          <Input
            ref={nameRef}
            id={`${id}-name`}
            value={fee.name}
            placeholder="For example, Parking"
            aria-invalid={nameMissing || undefined}
            aria-describedby={nameMissing ? `${id}-name-error` : undefined}
            onChange={(e) => onChange({ name: e.target.value })}
          />
          {nameMissing && (
            <p id={`${id}-name-error`} className="text-sm text-destructive">
              Give this fee a name.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-amount`}>Amount</Label>
          <MoneyInput
            id={`${id}-amount`}
            value={fee.amount}
            onValueChange={(amount) => onChange({ amount })}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <ChipSelect
          id={`${id}-frequency`}
          label="How often"
          value={fee.frequency}
          options={FREQUENCY_LABELS}
          onChange={(frequency) => onChange({ frequency: frequency as Frequency })}
        />
        <ChipSelect
          id={`${id}-basis`}
          label="Charged"
          value={fee.basis}
          options={BASIS_LABELS}
          onChange={(basis) => onChange({ basis: basis as Basis })}
        />
        <ChipSelect
          id={`${id}-mandatory`}
          label="Required?"
          value={fee.mandatory}
          options={MANDATORY_LABELS}
          // Optional fees count only for extras the student said they need in
          // Setup; any fee can still be switched on or off in Compare.
          onChange={(mandatory) =>
            onChange({
              mandatory: mandatory as Fee["mandatory"],
              counted: defaultCounted({ ...fee, mandatory: mandatory as Fee["mandatory"] }, setup),
            })
          }
        />
      </div>

      {fee.quote ? (
        <figure className="rounded-xl bg-muted/80 px-3.5 py-2.5 text-sm">
          <figcaption className="text-xs font-medium text-muted-foreground">
            From the listing
          </figcaption>
          <blockquote className="mt-1 text-foreground">&ldquo;{fee.quote}&rdquo;</blockquote>
        </figure>
      ) : (
        fee.source === "ai" && (
          <p className="text-sm text-muted-foreground">No quote found for this fee.</p>
        )
      )}
    </li>
  );
});

function ChipSelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: Record<string, string>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(options).map(([key, text]) => (
            <SelectItem key={key} value={key}>
              {text}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
