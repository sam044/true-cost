"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

// A maroon bar on every screen. On the flow screens the maroon carries on into
// the step band below it, so the top of the app reads as one field.
export function SiteHeader() {
  const { resolvedTheme, setTheme } = useTheme();
  const nextTheme = resolvedTheme === "dark" ? "light" : "dark";

  return (
    <header className="sticky top-0 z-40 bg-maroon text-cream">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="pressable rounded-sm text-[1.75rem] leading-none display-type tracking-[0.01em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream"
        >
          True
          <span aria-hidden className="text-orange">
            ·
          </span>
          <span className="sr-only"> </span>
          Cost
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/compare/setup"
            className="hidden rounded-md px-3 py-1.5 text-sm font-medium text-cream/80 transition-colors hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream sm:block"
          >
            Compare apartments
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="text-cream/80 hover:bg-cream/10 hover:text-cream focus-visible:ring-cream/60 dark:hover:bg-cream/10"
            onClick={() => setTheme(nextTheme)}
          >
            {/* The theme is only known in the browser, so the label switches with
                CSS like the icons; a label from resolvedTheme breaks hydration. */}
            <span className="sr-only dark:hidden">Switch to dark theme</span>
            <span className="sr-only hidden dark:inline">Switch to light theme</span>
            <Sun className="size-4 dark:hidden" aria-hidden />
            <Moon className="hidden size-4 dark:block" aria-hidden />
          </Button>
        </nav>
      </div>
    </header>
  );
}
