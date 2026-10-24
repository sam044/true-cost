# True Cost Chrome extension

One click on an apartment listing sends it to True Cost and opens Review for that apartment. Plan and scope: `docs/PRD.md`, "Browser extension (F19)".

## Load it

1. Run the app (`npm run dev`, or use the Vercel URL).
2. In Chrome, open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and pick this `extension/` folder.
3. If the app is not at `http://localhost:3000`, open the extension's **Options** and enter its address.

## Use it

Open a listing or fee page, scroll so the fees are on screen, and click the True Cost toolbar button. A new tab opens on the app, Gemma reads the screenshot and page text, and you land on Review.

## How it works

- `background.js` captures the visible tab (resized to 1600 px JPEG) and the page text, opens `<app>/compare/import`, and writes the capture into that tab's `sessionStorage`.
- `app/compare/import` posts it to `POST /api/extract`, adds the apartment and opens `/compare/review/[id]`.
- No API key lives here. The only site the extension sends anything to is the app.
- A `!` badge on the button means the page couldn't be captured (for example `chrome://` pages, or the app not running); hover it for the reason.
