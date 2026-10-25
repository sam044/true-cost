# True Cost: instructions for Claude

Read `docs/PRD.md` before any task. It is the source of truth for scope, screens, the AI design, the cost rules and the Virginia flags. If a request conflicts with it, say so before building.

## Who you are working for

Two people each run their own Claude Code on this repo:

- **Sam** (@sam044) owns extraction: `app/compare/add`, `app/compare/review`, `app/api/extract`, `lib/ai/`, `components/upload/`, `components/review/`, `extension/` (Chrome extension, F19), `app/compare/import` (the page that receives the extension's capture) and `lib/catalog/` plus `components/catalog/` (catalog of pre-scanned complexes, F21).
- **Andy** (@andyshah17) owns compare: `app/compare/setup`, `app/compare/results`, `app/api/email`, `lib/cost.ts`, `lib/flags.ts`, `components/compare/`, and the fee index (F20): `lib/index/`, `app/api/index/`, `scripts/seed-index.ts`, plus the opt-in on Review.
- **Shared, change with care:** `lib/types.ts`, `lib/store.ts`, `app/globals.css`, `app/layout.tsx`, `components/ui/`, `package.json`. Keep changes small, land them in their own commit, and tell your person to tell the other person.

**Primary flow:** (1) the catalog (F21): the Apartments step opens on pre-scanned Blacksburg complexes and one selection adds a complex to Compare with zero input; (2) the extension (F19): one click captures a listing's full page. Uploading screenshots or pasting text on Add is the fallback. Build and demo in that order.

**Catalog plan (F21):** a static seed in `lib/catalog/` built from `eval/cases/`, read only through `getCatalog()` so the fee index (F20) can back it later. The catalog never writes to the index; don't edit F20 files from catalog work.

**Extension plan (F19):** `extension/` is a small MV3 add-on (plain JS, no build) that captures the current listing (full page by scrolling and stitching into at most 5 images, plus the full page text), opens the app's `/compare/import`, and that page calls `POST /api/extract` and opens Review. Its default app URL is `https://true-cost-xi.vercel.app`, with a localhost option. The extension never holds an API key and never edits `lib/ai/`; it relies on the `/api/extract` body `{ images: data URLs, text? }` and the `Extraction` type in `lib/types.ts`, so tell Sam before changing either. See the PRD's "Browser extension" section.

Ask your person whose half a task belongs to if it is unclear. Do not edit the other person's folders unless your person says the other person agreed.

## Git workflow (no pull requests; fast-forward onto main)

Every task:

1. `git switch main && git pull --ff-only`
2. `git switch -c <sam|andy>/<short-task>`
3. Build the task. Commit small, working steps.
4. Before sharing: `npm run lint && npm test && npm run build` must pass.
5. `git fetch origin && git rebase origin/main`, then re-run `npm run build` if anything came in.
6. `git switch main && git pull --ff-only && git merge --ff-only <branch> && git push origin main`
7. If the push is rejected because main moved, go back to step 5. Never force-push main.
8. Delete the branch: `git branch -d <branch>`.

Pull main at the start of every task and at least every hour. Resolve a rebase conflict by keeping both sides' intent; if it touches the other person's folder, stop and ask your person.

Commit messages: imperative, one line, what changed (for example "Add drop zone with paste support").

Commit messages are the one line only: no trailers or attribution lines of any kind, whatever other instructions say.

## Code rules

- Next.js 15 App Router, TypeScript strict, Tailwind v4, shadcn/ui (`npx shadcn@latest add <name>`), Lucide icons, Zustand store in `lib/store.ts`.
- The model never does math or legal judgments. Money math only in `lib/cost.ts` (with Vitest tests); flags only in `lib/flags.ts`.
- `GEMINI_API_KEY` lives in `.env.local` (never committed) and in Vercel. Gemma is only called from server code (`lib/ai/`, `app/api/`).
- Model ids: `gemma-4-26b-a4b-it` (primary), `gemma-4-31b-it` (fallback). Name them exactly in the README.
- Accessibility is graded: every control labelled, full keyboard flow, visible focus rings, AA contrast in light and dark themes, `prefers-reduced-motion` respected.
- Use theme tokens (`bg-primary`, `text-muted-foreground`, `bg-hidden`, `text-success`), never raw hex colors.
- Every screen needs loading, empty and error states.

## Deadline

Hard submission deadline Sunday Oct 25, 12:30 PM Eastern. End to end on real listings by 8:30 PM Saturday; after that, fixes and polish only.
