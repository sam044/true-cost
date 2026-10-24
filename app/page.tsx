import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <section className="flex min-h-[calc(100dvh-12rem)] flex-col items-center justify-center gap-6 py-12 text-center sm:py-20">
      <p className="rounded-full border bg-accent px-3 py-1 text-sm text-accent-foreground">
        Made by renters, for renters
      </p>
      <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
        The rent you see isn&apos;t the rent you pay.
      </h1>
      <p className="max-w-xl text-lg text-muted-foreground text-pretty">
        Admin fees, utility fees, parking, reconditioning. True Cost reads your apartment
        screenshots and shows what each place really costs you per month, before you sign.
      </p>
      <Button asChild size="lg" className="mt-2">
        <Link href="/compare/setup">
          Compare apartments <ArrowRight aria-hidden />
        </Link>
      </Button>
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <ShieldCheck className="size-4 text-success" aria-hidden />
        No sign-up.
      </p>
    </section>
  );
}
