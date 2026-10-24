// Reads eval/cases/*/ from disk and converts each case to a catalog entry.
// Node only: used by scripts/build-catalog.ts and the seed test, never by the app.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { caseToEntry, type CaseInfo, type CatalogEntry, type Expected } from "./convert";

export function entriesFromCases(casesDir: string): CatalogEntry[] {
  return readdirSync(casesDir)
    .filter((id) => statSync(path.join(casesDir, id)).isDirectory())
    .sort()
    .map((id) => {
      const read = (file: string) => readFileSync(path.join(casesDir, id, file), "utf8");
      const info = JSON.parse(read("case.json")) as CaseInfo;
      const expected = JSON.parse(read("expected.json")) as Expected;
      return caseToEntry(id, info, expected, read("listing.txt"));
    });
}
