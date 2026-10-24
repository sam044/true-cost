"use client";

// True once the persisted store has loaded from localStorage, so screens can
// show a loading state instead of flashing "not found" on refresh.
import { useSyncExternalStore } from "react";
import { useTrueCost } from "@/lib/store";

const subscribe = (onChange: () => void) => useTrueCost.persist.onFinishHydration(onChange);

export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => useTrueCost.persist.hasHydrated(),
    () => false,
  );
}
