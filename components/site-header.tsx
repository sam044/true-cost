"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { Moon, Receipt, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  const { resolvedTheme, setTheme } = useTheme();
  const nextTheme = resolvedTheme === "dark" ? "light" : "dark";

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-md font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
            <Receipt className="size-4" aria-hidden />
          </span>
          True Cost
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(nextTheme)}
        >
          {/* The theme is only known in the browser, so the label switches with
              CSS like the icons; a label from resolvedTheme breaks hydration. */}
          <span className="sr-only dark:hidden">Switch to dark theme</span>
          <span className="sr-only hidden dark:inline">Switch to light theme</span>
          <Sun className="size-4 dark:hidden" aria-hidden />
          <Moon className="hidden size-4 dark:block" aria-hidden />
        </Button>
      </div>
    </header>
  );
}
