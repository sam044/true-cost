"use client";

// Dollar amount field. Keeps its own text while the user types so a cleared
// field doesn't snap back to 0, and only reports valid non-negative numbers.
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface MoneyInputProps extends Omit<React.ComponentProps<"input">, "value" | "onChange"> {
  value: number;
  onValueChange: (value: number) => void;
}

const toText = (value: number) => (Number.isFinite(value) ? String(value) : "");

export function parseMoney(text: string): number | null {
  const cleaned = text.replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function MoneyInput({ value, onValueChange, className, onBlur, ...props }: MoneyInputProps) {
  const [text, setText] = useState(() => toText(value));
  const [lastValue, setLastValue] = useState(value);

  // Pick up changes made elsewhere (for example an undo) without clobbering typing.
  if (value !== lastValue) {
    setLastValue(value);
    if (parseMoney(text) !== value) setText(toText(value));
  }

  const invalid = parseMoney(text) === null;

  return (
    <div className="relative">
      <span
        className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-muted-foreground"
        aria-hidden
      >
        $
      </span>
      <Input
        inputMode="decimal"
        autoComplete="off"
        aria-invalid={invalid || undefined}
        className={cn("pl-6 tabular-nums", className)}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const parsed = parseMoney(e.target.value);
          if (parsed !== null) {
            setLastValue(parsed);
            onValueChange(parsed);
          }
        }}
        onBlur={(e) => {
          const parsed = parseMoney(text);
          if (parsed !== null) setText(toText(parsed));
          onBlur?.(e);
        }}
        {...props}
      />
    </div>
  );
}
