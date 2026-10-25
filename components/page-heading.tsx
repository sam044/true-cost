import type { ReactNode } from "react";

// The flow screens' title, set in the display face on the maroon band that the
// stepper starts. `meta` is a small line under the description.
export function PageHeading({
  title,
  description,
  meta,
}: {
  title: string;
  description?: string;
  meta?: ReactNode;
}) {
  return (
    <div className="bleed mb-12 flex flex-col gap-4 bg-maroon pb-14 text-cream">
      <h1 className="max-w-[20ch] text-[3.25rem] display-type sm:text-7xl lg:text-[5.5rem]">
        <span className="line-mask">
          <span>{title}</span>
        </span>
      </h1>
      {description && (
        <p
          className="fade-up max-w-2xl text-base text-pretty text-cream/80 sm:text-lg"
          style={{ "--d": "150ms" } as React.CSSProperties}
        >
          {description}
        </p>
      )}
      {meta && <p className="text-sm text-cream/65">{meta}</p>}
    </div>
  );
}
