"use client";

// Sends the user to the first apartment that still needs review. Owner: Sam (A).
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useHydrated } from "@/components/review/use-hydrated";
import { useTrueCost } from "@/lib/store";

export default function ReviewIndexPage() {
  const router = useRouter();
  const apartments = useTrueCost((s) => s.apartments);
  const hydrated = useHydrated();

  // Wait for localStorage, or a refresh would bounce to Add before the saved apartments load.
  useEffect(() => {
    if (!hydrated) return;
    const next = apartments.find((a) => !a.reviewed) ?? apartments[0];
    router.replace(next ? `/compare/review/${next.id}` : "/compare/add");
  }, [hydrated, apartments, router]);

  return null;
}
