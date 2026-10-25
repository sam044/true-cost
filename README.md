# True Cost

**The rent you see isn't the rent you pay.** True Cost reads apartment listing screenshots with Gemma 4, finds every fee, and shows the real monthly cost per person, side by side, before you sign.

Built at GDG Build with AI x Hacktoberfest 2026, Virginia Tech (Oct 24–25, 2026).

## What

Blacksburg students compare apartments by the headline per-bed price, but admin fees, utility fees, parking and reconditioning fees live on separate tabs and in fine print. Virginia now requires advertised prices to include mandatory fees (Va. Code § 59.1-608) and leases to itemize charges on page one (Va. Code § 55.1-1204.1), but nobody adds it all up for you.

## AI model

- **Model:** `gemma-4-26b-a4b-it` (fallback `gemma-4-31b-it`) through the Gemini API, using the `@google/genai` SDK.
- **License:** Gemma is provided under the [Gemma Terms of Use](https://ai.google.dev/gemma/terms).
- **What it does:** reads screenshots (multimodal), transcribes them, and returns structured fees through the `record_fees` function. Each fee carries the exact quote it came from.
- **What it never does:** arithmetic or legal judgments. Code in `lib/cost.ts` and `lib/flags.ts` does both.

## Run it locally

```bash
npm install
cp .env.example .env.local   # then paste your key from https://aistudio.google.com
npm run dev                  # http://localhost:3000
npm test                     # cost engine tests
```

## Architecture

```
Browser (Next.js)                Vercel functions               Gemini API
 Screens, image resize  ──────▶  POST /api/extract  ──────────▶  gemma-4-26b-a4b-it
 Cost engine + VA flags ◀──────  Zod + quote checks
 localStorage (no account)       POST /api/email (P1)
```

## Responsible AI

- Every fee shows its source quote; quotes and amounts are checked against the transcript, and anything unverified is flagged "Check this".
- Users must review fees before any numbers are shown.
- No accounts. Screenshots are processed in memory and never stored.
- Virginia flags cite the statute and link to legal aid. Information, not legal advice.

## Evaluation

`npm run eval` reports extraction precision and recall on labelled Blacksburg listings in `eval/cases/`. Results: _coming soon_.

## Team and contributing

Sam ([@sam044](https://github.com/sam044)) and Andy ([@andyshah17](https://github.com/andyshah17)).

- Branch per feature from `main` (`sam/...`, `andy/...`), small pull requests, pull `main` often.
- Folder ownership: Sam owns `app/compare/add`, `app/compare/review`, `app/api/extract`, `lib/ai/`. Andy owns `app/compare/setup`, `app/compare/results`, `app/api/email`, `lib/cost.ts`, `lib/flags.ts`.
- `lib/types.ts` and `lib/store.ts` are shared: change them in a small PR and say so first.

## License

[Apache-2.0](LICENSE)
