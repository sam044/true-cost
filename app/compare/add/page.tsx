"use client";

// Add apartment screen. Owner: Sam (A).
// TODO: name field, drop zone (drag, click, Ctrl+V paste), up to 5 thumbnails,
// "Paste listing text instead" tab, resize to 1600 px JPEG, POST /api/extract,
// progress text ("Reading screenshot 2 of 3"), apartment cards (max 3).
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/page-heading";
import { Stepper } from "@/components/stepper";

export default function AddApartmentPage() {
  return (
    <>
      <Stepper current="add" />
      <PageHeading
        title="Add up to 3 apartments"
        description="Drop in screenshots of the listing, the fees page or the lease's fee table."
      />
      <Button asChild>
        <Link href="/compare/review">Review fees</Link>
      </Button>
    </>
  );
}
