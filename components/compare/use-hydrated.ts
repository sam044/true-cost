"use client";

import { useEffect, useState } from "react";
import { useTrueCost } from "@/lib/store";

// The store loads from localStorage after the first render. Screens wait for
// it so they start from what the user saved, not the defaults.
export function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(useTrueCost.persist.hasHydrated());
    return useTrueCost.persist.onFinishHydration(() => setHydrated(true));
  }, []);
  return hydrated;
}
