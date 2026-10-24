"use client";

// One shared store for every screen, saved to localStorage so a refresh never
// loses work. Shared file: change only in a small PR.
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Apartment, Fee, Setup } from "./types";
import { mockApartments, mockSetup } from "./mock";

export const MAX_APARTMENTS = 3;

interface TrueCostState {
  setup: Setup;
  apartments: Apartment[];
  setSetup: (setup: Partial<Setup>) => void;
  addApartment: (apartment: Apartment) => void;
  updateApartment: (id: string, patch: Partial<Apartment>) => void;
  removeApartment: (id: string) => void;
  updateFee: (apartmentId: string, feeId: string, patch: Partial<Fee>) => void;
  addFee: (apartmentId: string, fee: Fee) => void;
  removeFee: (apartmentId: string, feeId: string) => void;
  loadSamples: () => void;
  reset: () => void;
}

const initialSetup: Setup = { people: 1, leaseMonths: 12 };

const mapApartment = (
  apartments: Apartment[],
  id: string,
  fn: (apartment: Apartment) => Apartment,
) => apartments.map((a) => (a.id === id ? fn(a) : a));

export const useTrueCost = create<TrueCostState>()(
  persist(
    (set) => ({
      setup: initialSetup,
      apartments: [],
      setSetup: (setup) => set((s) => ({ setup: { ...s.setup, ...setup } })),
      addApartment: (apartment) =>
        set((s) =>
          s.apartments.length >= MAX_APARTMENTS
            ? s
            : { apartments: [...s.apartments, apartment] },
        ),
      updateApartment: (id, patch) =>
        set((s) => ({
          apartments: mapApartment(s.apartments, id, (a) => ({ ...a, ...patch })),
        })),
      removeApartment: (id) =>
        set((s) => ({ apartments: s.apartments.filter((a) => a.id !== id) })),
      updateFee: (apartmentId, feeId, patch) =>
        set((s) => ({
          apartments: mapApartment(s.apartments, apartmentId, (a) => ({
            ...a,
            fees: a.fees.map((f) => (f.id === feeId ? { ...f, ...patch } : f)),
          })),
        })),
      addFee: (apartmentId, fee) =>
        set((s) => ({
          apartments: mapApartment(s.apartments, apartmentId, (a) => ({
            ...a,
            fees: [...a.fees, fee],
          })),
        })),
      removeFee: (apartmentId, feeId) =>
        set((s) => ({
          apartments: mapApartment(s.apartments, apartmentId, (a) => ({
            ...a,
            fees: a.fees.filter((f) => f.id !== feeId),
          })),
        })),
      loadSamples: () => set({ setup: mockSetup, apartments: mockApartments }),
      reset: () => set({ setup: initialSetup, apartments: [] }),
    }),
    { name: "true-cost" },
  ),
);
