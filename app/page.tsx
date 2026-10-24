import Link from "next/link";
import { ArrowRight, Images, ListChecks, Scale, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const steps = [
  {
    icon: Images,
    title: "Drop in screenshots",
    body: "Listing pages, fee sheets or lease tables for up to 3 apartments.",
  },
  {
    icon: ListChecks,
    title: "Check every fee",
    body: "Gemma 4 finds each fee and shows the exact words it came from. You confirm.",
  },
  {
    icon: Scale,
    title: "Compare the real number",
    body: "True monthly cost per person, side by side, with Virginia fee-law flags.",
  },
];

// Brexx at Blacksburg, 4 roommates, 12-month lease (fees from its public listing)
const example = [
  { label: "Advertised rent per bed", amount: "$1,069.00" },
  { label: "Utility service fee", amount: "+$62.00" },
  { label: "Admin + application fees, spread over 12 months", amount: "+$16.67" },
];

export default function Home() {
  return (
    <div className="flex flex-col gap-20 py-12 sm:py-20">
      <section className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
        <div className="flex flex-col gap-6">
          <p className="w-fit rounded-full border bg-accent px-3 py-1 text-sm text-accent-foreground">
            For Blacksburg renters
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            The rent you see isn&apos;t the rent you pay.
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground text-pretty">
            Admin fees, utility fees, parking, reconditioning. True Cost reads your apartment
            screenshots and shows what each place really costs you per month, before you sign.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link href="/compare/setup">
                Compare apartments <ArrowRight aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/compare/results?sample=1">See a sample comparison</Link>
            </Button>
          </div>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="size-4 text-success" aria-hidden />
            No sign-up. Your screenshots are never stored.
          </p>
        </div>

        <Card className="shadow-lg">
          <CardContent className="flex flex-col gap-4 p-6">
            <div className="flex items-baseline justify-between">
              <h2 className="font-semibold">Brexx at Blacksburg</h2>
              <span className="text-sm text-muted-foreground">per person / month</span>
            </div>
            <dl className="flex flex-col gap-2 text-sm">
              {example.map((row) => (
                <div key={row.label} className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{row.label}</dt>
                  <dd className="font-mono tabular-nums">{row.amount}</dd>
                </div>
              ))}
            </dl>
            <div className="flex items-end justify-between border-t pt-4">
              <div>
                <p className="text-sm text-muted-foreground">True monthly cost</p>
                <p className="text-3xl font-semibold tabular-nums">$1,147.67</p>
              </div>
              <p className="rounded-md bg-hidden/15 px-2 py-1 text-sm font-medium text-hidden-foreground dark:text-hidden">
                $944 / year not in the headline price
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="how" className="flex flex-col gap-6">
        <h2 id="how" className="text-2xl font-semibold tracking-tight">
          How it works
        </h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {steps.map((step, i) => (
            <li key={step.title}>
              <Card className="h-full">
                <CardContent className="flex flex-col gap-3 p-6">
                  <span className="flex items-center gap-3">
                    <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                      <step.icon className="size-5" aria-hidden />
                    </span>
                    <span className="text-sm text-muted-foreground">Step {i + 1}</span>
                  </span>
                  <h3 className="font-semibold">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.body}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <footer className="border-t pt-6 text-sm text-muted-foreground">
        Built with Gemma 4 (<code className="font-mono">gemma-4-26b-a4b-it</code>) at GDG Build
        with AI x Hacktoberfest 2026, Virginia Tech. Information, not legal advice.
      </footer>
    </div>
  );
}
