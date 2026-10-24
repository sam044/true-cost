"use client";

// Review fees screen. Owner: Sam (A).
// TODO: editable advertised price, fee rows (name, amount, frequency, basis,
// mandatory toggle, source quote), "Check this" badge for low confidence sorted
// first, add/delete fee, utility estimate rows, "Looks right" sets reviewed.
import Link from "next/link";
import { use } from "react";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/page-heading";
import { Stepper } from "@/components/stepper";
import { useTrueCost } from "@/lib/store";

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const apartment = useTrueCost((s) => s.apartments.find((a) => a.id === id));

  return (
    <>
      <Stepper current="review" />
      <PageHeading
        title={apartment ? `Check the fees for ${apartment.name}` : "Apartment not found"}
        description="Every fee shows the words it came from. Fix anything that looks off."
      />
      <Button asChild>
        <Link href="/compare/results">Looks right</Link>
      </Button>
    </>
  );
}
