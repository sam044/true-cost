"use client";

// Sends the user to the first apartment that still needs review. Owner: Sam (A).
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTrueCost } from "@/lib/store";

export default function ReviewIndexPage() {
  const router = useRouter();
  const apartments = useTrueCost((s) => s.apartments);

  useEffect(() => {
    const next = apartments.find((a) => !a.reviewed) ?? apartments[0];
    router.replace(next ? `/compare/review/${next.id}` : "/compare/add");
  }, [apartments, router]);

  return null;
}
