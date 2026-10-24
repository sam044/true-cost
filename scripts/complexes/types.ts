// Shapes for the auto-scanned complexes in data/complexes/. Owner: Sam (A).
import type { Extraction } from "../../lib/types";

// data/complexes/raw/<slug>.json: one complex's fee page text as fetched.
export interface RawComplex {
  slug: string;
  name: string;
  address: string;
  status: "fetched" | "blocked" | "no_fees_found" | "not_found";
  sourceUrl: string | null;
  site: string;
  fetchedOn: string; // YYYY-MM-DD
  autoScanned: true;
  attempts: { url: string; result: string }[];
  text: string | null;
  notes?: string;
  notComplex?: boolean; // a rental company or scattered houses: kept out of the catalog
}

// data/complexes/scanned/<slug>.json: extractFees output for one raw file.
export interface ScannedComplex {
  slug: string;
  name: string;
  sourceUrl: string | null;
  site: string;
  fetchedOn: string;
  autoScanned: true;
  textHash: string; // of the raw text, so unchanged complexes aren't rescanned
  scannedAt: string;
  model: string | null;
  extraction: Extraction | null;
  error: string | null;
}
