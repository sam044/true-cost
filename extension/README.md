# True Cost Chrome extension

One click on an apartment listing captures the whole page and opens Review for that apartment in True Cost. Plan and scope: `docs/PRD.md`, "Browser extension (F19)".

## Load it

1. In Chrome, open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and pick this `extension/` folder.
2. Pin the True Cost button (puzzle-piece menu, then the pin).
3. Listings go to the deployed app, `https://true-cost-xi.vercel.app`, by default. To use a local app (`npm run dev`), open the extension's **Options** (right-click the button, then Options) and choose **Local development** (`http://localhost:3000`), or enter another address.

## Use it

Open a listing page and click the True Cost button. Keep the tab in front for a few seconds while the button's badge counts the screens (`1/6`, `2/6`, ...). The page scrolls by itself and goes back to where you were, then a new tab opens on the app, Gemma reads the capture and you land on Review.

## What it captures

- **The full page as screenshots.** It scrolls the page from the top one screen at a time and screenshots each screen with `chrome.tabs.captureVisibleTab`, at most 2 a second (Chrome's limit), up to 12 screens. Fixed and sticky elements (headers, chat buttons, cookie bars) appear in the first screen and are hidden for the rest so they don't repeat. Afterwards your scroll position and the page's styles are restored.
- **Stitched into at most 5 images** (the `/api/extract` limit), each 1600 px wide JPEG (narrower if your screen is), about 2,400 px tall, at most 4,000. All images together stay under 3.4 MB of base64 so the request stays under Vercel's 4.5 MB limit: JPEG quality drops from 0.82 to 0.46 if needed, then images are dropped from the bottom. Prices and fees are usually near the top.
- **The page text:** `document.body.innerText` (includes text below the fold), first 20,000 characters, and the page title as the apartment name.

## Limits

- Pages longer than 12 screens: only the first 12 are screenshotted; the text still covers the rest up to 20,000 characters.
- Pages that scroll an inner element instead of the window: it scrolls the largest scrollable element on screen and keeps anything above it (a header) once. Nested or horizontal scrollers, infinite scroll and canvas maps aren't handled specially.
- Content that only appears on hover or behind "Show more" buttons isn't opened.
- Don't switch tabs while it captures: Chrome can only screenshot the visible tab.
- `chrome://` pages, the Chrome Web Store and other browser pages can't be read; the badge shows a red `!` (hover it for the reason). The same `!` appears if the app doesn't load.

## How it works

- `background.js` (service worker) runs the capture: small functions injected with `chrome.scripting.executeScript` measure the page, scroll it, hide fixed elements and restore it; `captureVisibleTab` takes each screen.
- `stitch.js` plans the stitching (which rows of each shot are new, how to split into images, the size budget). It has no Chrome or DOM code, so it can be checked in Node. `background.js` draws the pieces with `OffscreenCanvas` and encodes JPEGs.
- It opens `<app>/compare/import` and writes the capture (`{ version: 2, name, url, images, text }`) into that tab's `sessionStorage`. That page posts `{ images, text }` to `POST /api/extract`, adds the apartment and opens `/compare/review/[id]`.
- No API key lives here. The only site the extension sends anything to is the app. Permissions: `activeTab` (read and screenshot the tab you clicked on), `scripting`, `storage` (the app address), and host access to `localhost:3000` and `*.vercel.app` to hand the capture to the app.
- Debugging: open the service worker's DevTools from `chrome://extensions` and run `await trueCost.captureListing((await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0])` to see a capture without opening the app (needs the tab's permission, so click the button on that tab once first).
