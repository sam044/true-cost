# True Cost Chrome extension

One click on an apartment listing captures the whole page, shows each step and the fees Gemma finds in a side panel, and opens them in True Cost's Review or Compare. Plan and scope: `docs/PRD.md`, "Browser extension (F19)".

## Load it

1. In Chrome (116 or newer), open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and pick this `extension/` folder.
2. Pin the True Cost button (puzzle-piece menu, then the pin).
3. Listings go to the deployed app, `https://true-cost-xi.vercel.app`, by default. The bottom of the side panel always shows where they go. To use a local app (`npm run dev`), click **Change** there (or right-click the button, then Options) and choose **Local development** (`http://localhost:3000`), or enter another address.

**Updating:** after pulling, click the reload icon on the True Cost card in `chrome://extensions` (the card should say 0.3.0). Version 0.1's options page was pre-filled with localhost, so saving it there stored localhost; since 0.3 that old setting is dropped and listings go to the deployed app again. A custom address saved in 0.1 or 0.2 is kept.

## Use it

Open a listing page and click the True Cost button. The side panel opens and shows each step as it happens:

1. **Capture the page:** "Screen 2 of 5", with the latest screenshot. Keep the tab in front for these few seconds; the page scrolls by itself and goes back to where you were.
2. **Put the screenshots together:** how many images and how big, plus how much page text.
3. **Gemma reads the fees:** a running clock, what Gemma is reading and why it takes a while (it transcribes every screenshot, then lists each fee with the line it came from). Usually 30 seconds to 2 minutes; after 100 seconds the panel says True Cost is trying the backup model, as the app does.
4. **Fees ready:** the advertised rent, then each fee grouped as required, not clear, or optional, with its amount, tags (per person, refundable, "check this" for low confidence) and the quote it came from. **Review in True Cost** opens Review for the apartment; **Add to Compare** adds it and opens Compare. Both open a new tab and don't call Gemma again; clicking both adds the apartment once.

If something fails, the panel says what and offers **Try again** (resends the same capture, no rescroll) and **Add it another way**. "What was sent" shows the stitched images.

## What it captures

- **The full page as screenshots.** It scrolls the page from the top one screen at a time and screenshots each screen with `chrome.tabs.captureVisibleTab`, at most 2 a second (Chrome's limit), up to 12 screens. Fixed and sticky elements (headers, chat buttons, cookie bars) appear in the first screen and are hidden for the rest so they don't repeat. Afterwards your scroll position and the page's styles are restored.
- **Stitched into at most 5 images** (the `/api/extract` limit), each 1600 px wide JPEG (narrower if your screen is), about 2,400 px tall, at most 4,000. All images together stay under 3.4 MB of base64 so the request stays under Vercel's 4.5 MB limit: JPEG quality drops from 0.82 to 0.46 if needed, then images are dropped from the bottom. Prices and fees are usually near the top.
- **The page text:** `document.body.innerText` (includes text below the fold), first 20,000 characters, and the page title as the apartment name.

## Limits

- Pages longer than 12 screens: only the first 12 are screenshotted; the text still covers the rest up to 20,000 characters.
- Pages that scroll an inner element instead of the window: it scrolls the largest scrollable element on screen and keeps anything above it (a header) once. Nested or horizontal scrollers, infinite scroll and canvas maps aren't handled specially.
- Content that only appears on hover or behind "Show more" buttons isn't opened.
- Don't switch tabs while it captures: Chrome can only screenshot the visible tab.
- `chrome://` pages, the Chrome Web Store and other browser pages can't be read; the panel says so and the badge shows a red `!`.
- The panel shows the latest capture only. Starting a new one replaces it.

## How it works

- `background.js` (service worker) runs the capture: small functions injected with `chrome.scripting.executeScript` measure the page, scroll it, hide fixed elements and restore it; `captureVisibleTab` takes each screen. Clicking the button also opens the side panel (`chrome.sidePanel.open`, which Chrome only allows straight from the click).
- `stitch.js` plans the stitching (which rows of each shot are new, how to split into images, the size budget). It has no Chrome or DOM code, so it can be checked in Node. `background.js` draws the pieces with `OffscreenCanvas` and encodes JPEGs.
- Progress lives in `chrome.storage.session`: `job` (the step, counts, timings, then the extraction or the error), `jobInput` (the stitched images and text) and `jobPreview` (the latest screenshot while capturing). `panel.js` renders whatever is there and re-renders on every change, so closing and reopening the panel loses nothing.
- `background.js` posts `{ images, text }` to `<app>/api/extract` itself and stores the returned extraction. A pending fetch doesn't keep an extension service worker alive, so while it waits it touches `chrome.storage` every 15 seconds; the panel treats a job with no heartbeat for 50 seconds as stopped and offers Try again.
- The panel's buttons open `<app>/compare/import` and write `{ version: 3, id, name, url, extraction, then: "review" | "compare" }` into that tab's `sessionStorage`. The import page validates the extraction against the `Extraction` schema, adds the apartment with `id` as its id (so a second click doesn't add it twice) and opens Review or Compare. It still accepts version 1 and 2 captures (screenshots and text) from older builds and calls `/api/extract` for those.
- `config.js` keeps the app address in `chrome.storage.sync` under `appTarget`; `migrateAppUrl()` drops the 0.1/0.2 key `appUrl` (localhost dropped, custom address kept) on install, on update and before every read.
- No API key lives here. The only site the extension sends anything to is the app. Permissions: `activeTab` (read and screenshot the tab you clicked on), `scripting`, `storage` (the app address and the panel's progress), `sidePanel`, and host access to `localhost:3000` and `*.vercel.app` to send the capture to the app.
- Debugging: open the service worker's DevTools from `chrome://extensions` and run `await trueCost.captureListing((await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0])` to see a capture without opening the app (needs the tab's permission, so click the button on that tab once first).
