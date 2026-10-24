# Auto-scanned Blacksburg complexes

Raw data for growing the catalog (F21) past the 8 hand-labelled eval cases. Every entry here is **auto-scanned**: the fee text was fetched from the complex's own site (or a listing site) and run through the app's `extractFees`, and no person has checked the result.

| Path | What it is |
| --- | --- |
| `list.json` | The complexes and rental companies we tried, by slug |
| `raw/<slug>.json` | Fetch result: `status` (`fetched`, `blocked`, `no_fees_found`, `not_found`), `sourceUrl`, `site`, `fetchedOn`, `autoScanned: true`, every URL tried, and the page's price and fee text |
| `scanned/<slug>.json` | `extractFees` output for each fetched page, with the model used and a hash of the text it read |
| `lib/catalog/auto.json` | One catalog entry per scan with an advertised price, in the catalog's `CatalogEntry` shape with `autoScanned: true` and `apartment.reviewed: false`; `getCatalog()` lists them after the hand-checked seed |
| `coverage.json` | Per complex: fetched or blocked, scan result, fee count, low-confidence count, price range |

## Rebuild

```bash
node --experimental-strip-types scripts/complexes/scan.ts
node --experimental-strip-types scripts/complexes/to-catalog.ts
```

`scan.ts` only rescans complexes whose text changed or whose last scan failed (`--all` rescans everything, `--slug x` one complex). It needs `GEMINI_API_KEY` in `.env.local`.

## How the text was fetched

offcampus.vt.edu and similar listing sites block scripted requests (Akamai "Access Denied"), so these pages come from each complex's own website, or its Apartments.com or ApartmentFinder page when the official site shows no fees, read with a web fetch tool that returns the page as text. Sites that answered 403 or a CAPTCHA are recorded as `blocked` and were not retried another way. The fetch tool passes the page through a small model, so a quote can differ slightly from the live page; the extraction's grounding check still requires every fee's quote to appear in the fetched text.

## Plugging in

- **Catalog (F21):** entries match `CatalogEntry` from `lib/catalog/convert.ts`. Because they are not reviewed, the catalog should either open Review when one is selected or show an "Auto-scanned, not checked" label, and keep them after the 8 checked complexes.
- **Fee index (F20):** the index only holds human-checked fees, so these entries are not seed data. A student who confirms one on Review and opts in submits it like any other apartment.
