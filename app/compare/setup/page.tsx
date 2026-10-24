"use client";

// Setup screen. Owner: Andy (B). TODO: people (1-6) stepper, lease months, optional budget.
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/page-heading";
import { Stepper } from "@/components/stepper";

export default function SetupPage() {
  return (
    <>
      <Stepper current="setup" />
      <PageHeading
        title="Who's splitting the rent?"
        description="We use this to turn per-unit fees into what you pay per person."
      />
      <Button asChild>
        <Link href="/compare/add">Continue</Link>
      </Button>
    </>
  );
}
