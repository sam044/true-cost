"use client";

// Screenshot drop zone. Owner: Sam (A). Click (or Enter/Space) opens the file
// picker, files can be dragged in, and the Add screen handles Ctrl+V paste.
import { forwardRef, useRef, useState, type DragEvent } from "react";
import { ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";

interface DropZoneProps {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  remaining: number;
  describedBy?: string;
}

export const DropZone = forwardRef<HTMLButtonElement, DropZoneProps>(function DropZone(
  { onFiles, disabled, remaining, describedBy },
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    onFiles(Array.from(event.dataTransfer.files));
  }

  return (
    <>
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        aria-describedby={describedBy}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex min-h-44 w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 text-center transition-colors motion-reduce:transition-none",
          "hover:border-primary/60 hover:bg-muted/50 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          "disabled:cursor-not-allowed disabled:opacity-60",
          dragging && "border-primary bg-primary/5",
        )}
      >
        <span className="grid size-11 place-items-center rounded-full bg-muted" aria-hidden>
          <ImagePlus className="size-5 text-muted-foreground" />
        </span>
        <span className="font-medium">
          {remaining > 0 ? "Drop screenshots here, or click to choose" : "That's the 5-screenshot limit"}
        </span>
        <span className="text-sm text-muted-foreground">
          {remaining > 0
            ? `You can also paste with Ctrl+V. Up to ${remaining} more.`
            : "Remove one to add a different screenshot."}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        tabIndex={-1}
        onChange={(e) => {
          onFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
    </>
  );
});
