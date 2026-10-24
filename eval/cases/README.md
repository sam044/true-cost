# Eval cases

Eight real Blacksburg listings, read on Oct 24, 2026, with every fee labelled by hand. `npm run eval` (F14) runs extraction on each case and reports precision and recall against `expected.json`.

## Folder layout

Each case is one folder:

| File | What it is |
| --- | --- |
| `case.json` | Listing name, URL, site, the date it was read, which screenshots belong in the folder, and notes on what makes the case hard |
| `listing.txt` | The listing's price and fee text, copied from the page. Use it as the pasted-text input (F2) |
| `expected.json` | The hand-labelled answer |
| `1-price.png`, `2-…png` | Screenshots of the same sections (see `case.json` for what each one shows) |

## `expected.json`

```json
{
  "advertisedPrice": { "min": 1069, "max": 1399, "basis": "per_person" },
  "fees": [
    {
      "name": "Application Fee",
      "category": "application",
      "amount": 50,
      "frequency": "one_time",
      "basis": "per_person",
      "mandatory": "yes"
    }
  ],
  "notFees": ["Late Fee (percentage, no fixed amount)"]
}
```

- Enum values match `ExtractedFee` in `lib/types.ts`.
- `null` means the listing doesn't say, so that field isn't scored (for example, a situational fee with no frequency, or a fee whose basis isn't stated).
- `advertisedPrice` is a range because complexes list several floor plans; any extracted price inside `min` to `max` with the right basis counts.
- `amountRange` (optional) marks a fee whose amount is a range on the listing; any amount inside it counts.
- `refundable` and `utilities` are only given where the listing says so.
- `notFees` lists things that look like fees but shouldn't be extracted with an amount. "N/A" entries (for example Hub's surface lot) aren't fees either.

## Suggested matching for the scorer

A predicted fee matches an expected fee when the amounts are equal (or inside `amountRange`) and the normalised names share a word, or, failing that, the categories are equal. Each expected fee can be matched once, so a duplicate counts as a false positive (see `the-edge`).

## Screenshot checklist

The listing sites block automated browsers, so these screenshots are taken by hand. In each folder, save the PNGs that `case.json` lists, cropped to just the section named (no photos or maps). A browser window about 1280 px wide works well. Copy the best three (Brexx, Hub, Foxridge) into `public/samples/` for the demo.
