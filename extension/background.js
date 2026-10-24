// True Cost extension. Owner: Sam (A). See docs/PRD.md, "Browser extension (F19)".
// One click on the toolbar button captures the whole listing in the current tab:
// it scrolls the page one screen at a time, screenshots each screen, stitches
// the shots into at most 5 tall images and reads the page text. Then it opens
// the app's /compare/import page and hands the capture to it. The app calls
// Gemma; this extension never holds an API key and only talks to the app.
import { getAppUrl } from "./config.js";
import { MAX_SHOTS, OUTPUT_WIDTH, fitBudget, planImages, planPieces } from "./stitch.js";

const MAX_TEXT = 20000; // /api/extract rejects longer text
const CAPTURE_GAP_MS = 550; // Chrome allows about 2 captureVisibleTab calls a second
const SETTLE_MS = 250; // let lazy images and scroll-linked headers settle after scrolling
const IDLE_TITLE = "Find the true cost of this listing";
const BUSY_COLOR = "#2563eb";
const ERROR_COLOR = "#b91c1c";

const busyTabs = new Set();

chrome.action.onClicked.addListener((tab) => void captureAndSend(tab));

async function captureAndSend(tab) {
  if (busyTabs.has(tab.id)) return;
  busyTabs.add(tab.id);
  try {
    if (isRestricted(tab.url)) throw new Error("Chrome doesn't let extensions read this page.");
    await setBadge(tab.id, "…", "Reading this listing", BUSY_COLOR);
    const capture = await captureListing(tab);
    await setBadge(tab.id, "…", "Opening True Cost", BUSY_COLOR);
    await sendToApp(tab, capture);
    await setBadge(tab.id, "", IDLE_TITLE);
  } catch (error) {
    console.error("True Cost capture failed", error);
    const message = error instanceof Error ? error.message : String(error);
    await setBadge(tab.id, "!", `True Cost couldn't read this page: ${message}`, ERROR_COLOR).catch(() => {});
  } finally {
    busyTabs.delete(tab.id);
  }
}

// chrome://, the Web Store and other browser pages block extensions.
function isRestricted(url = "") {
  return (
    /^(chrome|chrome-extension|chrome-search|chrome-untrusted|edge|about|devtools|view-source):/i.test(url) ||
    /^https:\/\/(chromewebstore\.google\.com|chrome\.google\.com\/webstore)/i.test(url)
  );
}

async function captureListing(tab) {
  const page = await inPage(tab.id, preparePage);
  if (!page) throw new Error("the page didn't respond.");
  const shots = [];
  let lastCapture = 0;
  try {
    const estimate = Math.min(MAX_SHOTS, Math.ceil(page.scrollHeight / page.region.height) || 1);
    let y = 0;
    while (shots.length < MAX_SHOTS) {
      if (shots.length === 1) await inPage(tab.id, hideFixed);
      const at = await inPage(tab.id, scrollRegion, [y]);
      if (shots.length && at.y <= shots[shots.length - 1].scrollY) break;
      const progress = `${shots.length + 1}/${Math.max(estimate, shots.length + 1)}`;
      await setBadge(tab.id, progress, "Capturing this listing", BUSY_COLOR);
      await delay(Math.max(SETTLE_MS, lastCapture + CAPTURE_GAP_MS - Date.now()));
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "jpeg", quality: 92 });
      lastCapture = Date.now();
      shots.push({ scrollY: at.y, dataUrl });
      if (at.y + page.region.height >= at.scrollHeight - 2) break;
      y = at.y + page.region.height;
    }
  } finally {
    await inPage(tab.id, restorePage).catch(() => {});
  }
  await setBadge(tab.id, "…", "Putting the screenshots together", BUSY_COLOR);
  const stitched = await stitch(shots, page);
  return {
    version: 2,
    name: listingName(page.title || tab.title),
    url: tab.url,
    images: stitched.dataUrls,
    text: (page.text || "").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_TEXT),
  };
}

// For checking a capture from the service worker's DevTools console:
// await trueCost.captureListing((await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0])
globalThis.trueCost = { captureAndSend, captureListing, stitch };

async function stitch(shots, page) {
  const { pieces, height } = planPieces(shots, page.region);
  const first = await decode(shots[0].dataUrl);
  const imgScale = first.width / page.innerWidth; // image px per CSS px (device pixel ratio and zoom)
  first.close();
  const cropWidth = Math.round(page.clientWidth * imgScale); // leave out the scrollbar
  const outWidth = Math.min(OUTPUT_WIDTH, cropWidth);
  const k = outWidth / page.clientWidth; // output px per CSS px
  const plan = planImages(height * k);

  const canvases = [];
  for (const image of plan.images) {
    const canvas = new OffscreenCanvas(outWidth, image.height);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingQuality = "high";
    for (const piece of pieces) {
      const top = piece.outTop * k - image.top;
      const h = piece.srcHeight * k;
      if (top >= image.height || top + h <= 0) continue;
      const bitmap = await decode(shots[piece.shot].dataUrl);
      ctx.drawImage(
        bitmap,
        0, piece.srcTop * imgScale, cropWidth, piece.srcHeight * imgScale,
        0, top, outWidth, h,
      );
      bitmap.close();
    }
    canvases.push(canvas);
  }
  const fitted = await fitBudget(canvases.length, (i, quality) => toJpegDataUrl(canvases[i], quality));
  return { ...fitted, truncated: plan.truncated || fitted.dropped > 0, shots: shots.length, height: height * k };
}

async function decode(dataUrl) {
  return createImageBitmap(await (await fetch(dataUrl)).blob());
}

async function toJpegDataUrl(canvas, quality) {
  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return `data:image/jpeg;base64,${btoa(binary)}`;
}

// "Hub Blacksburg | Apartments in Blacksburg, VA" -> "Hub Blacksburg"
function listingName(title = "") {
  const name = title.split(/\s[|–—-]\s/)[0].trim();
  return (name || "Apartment").slice(0, 80);
}

async function sendToApp(tab, capture) {
  const appUrl = await getAppUrl();
  const appTab = await chrome.tabs.create({ url: `${appUrl}/compare/import`, index: tab.index + 1 });
  await waitForLoad(appTab.id);
  const delivered = await inPage(appTab.id, deliver, [capture]);
  if (!delivered) throw new Error("the True Cost tab couldn't take the capture.");
}

function waitForLoad(tabId) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      reject(new Error("the True Cost app didn't load. Is it running?"));
    }, 30000);
    function onUpdated(id, info) {
      if (id !== tabId || info.status !== "complete") return;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      resolve();
    }
    chrome.tabs.onUpdated.addListener(onUpdated);
  });
}

async function inPage(tabId, func, args = []) {
  const [result] = await chrome.scripting.executeScript({ target: { tabId }, func, args });
  return result?.result;
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));

async function setBadge(tabId, text, title, color) {
  if (color) await chrome.action.setBadgeBackgroundColor({ tabId, color });
  await chrome.action.setBadgeText({ tabId, text });
  await chrome.action.setTitle({ tabId, title });
}

// ---- The functions below run inside a tab, in the extension's isolated world
// (which keeps window.__trueCost between calls). Each must be self-contained.

function preparePage() {
  const root = document.scrollingElement || document.documentElement;
  const viewHeight = document.documentElement.clientHeight || innerHeight;
  // Most pages scroll the window. Some apps scroll an inner element instead;
  // then use the biggest scrollable element on screen.
  let scroller = null;
  if (root.scrollHeight <= viewHeight + 4) {
    let best = 0;
    for (const el of document.body ? document.body.querySelectorAll("*") : []) {
      if (el.scrollHeight <= el.clientHeight + 4 || el.clientHeight < viewHeight / 3) continue;
      const overflow = getComputedStyle(el).overflowY;
      if (overflow !== "auto" && overflow !== "scroll" && overflow !== "overlay") continue;
      const area = el.clientWidth * el.clientHeight;
      if (area > best) {
        best = area;
        scroller = el;
      }
    }
  }
  let region = { top: 0, height: viewHeight };
  if (scroller) {
    const rect = scroller.getBoundingClientRect();
    const top = Math.max(0, Math.round(rect.top + scroller.clientTop));
    region = { top, height: Math.max(1, Math.min(scroller.clientHeight, viewHeight - top)) };
  }
  window.__trueCost = {
    scroller,
    hidden: [],
    windowX: scrollX,
    windowY: scrollY,
    scrollerY: scroller ? scroller.scrollTop : 0,
    behavior: [document.documentElement.style.scrollBehavior, scroller ? scroller.style.scrollBehavior : ""],
  };
  document.documentElement.style.scrollBehavior = "auto";
  if (scroller) scroller.style.scrollBehavior = "auto";
  return {
    title: document.title,
    // innerText includes content below the fold; read it before anything is hidden.
    text: document.body ? document.body.innerText.slice(0, 40000) : "",
    innerWidth,
    clientWidth: document.documentElement.clientWidth || innerWidth,
    region,
    scrollHeight: scroller ? scroller.scrollHeight : root.scrollHeight,
  };
}

async function scrollRegion(y) {
  const state = window.__trueCost;
  const el = state.scroller;
  if (el) el.scrollTop = y;
  else window.scrollTo({ left: state.windowX, top: y, behavior: "instant" });
  // Wait for a frame so scroll-linked content updates before the screenshot.
  await new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
    setTimeout(resolve, 200);
  });
  const root = document.scrollingElement || document.documentElement;
  return {
    y: el ? el.scrollTop : scrollY,
    scrollHeight: el ? el.scrollHeight : root.scrollHeight,
  };
}

// Fixed and sticky headers, chat buttons and cookie bars would repeat in every
// shot. They are in the first shot; hide them for the rest.
function hideFixed() {
  const state = window.__trueCost;
  for (const el of document.body ? document.body.querySelectorAll("*") : []) {
    const position = getComputedStyle(el).position;
    if (position !== "fixed" && position !== "sticky") continue;
    if (state.scroller && el.contains(state.scroller)) continue;
    state.hidden.push([el, el.style.getPropertyValue("visibility"), el.style.getPropertyPriority("visibility")]);
    el.style.setProperty("visibility", "hidden", "important");
  }
}

function restorePage() {
  const state = window.__trueCost;
  if (!state) return;
  for (const [el, value, priority] of state.hidden) {
    if (value) el.style.setProperty("visibility", value, priority);
    else el.style.removeProperty("visibility");
  }
  if (state.scroller) state.scroller.scrollTop = state.scrollerY;
  window.scrollTo({ left: state.windowX, top: state.windowY, behavior: "instant" });
  document.documentElement.style.scrollBehavior = state.behavior[0];
  if (state.scroller) state.scroller.style.scrollBehavior = state.behavior[1];
  delete window.__trueCost;
}

// Runs inside the app tab. The import page reads the capture from
// sessionStorage on load, or when this event fires if it loaded first.
function deliver(capture) {
  try {
    sessionStorage.setItem("true-cost-capture", JSON.stringify(capture));
  } catch {
    return false;
  }
  window.dispatchEvent(new Event("true-cost-capture"));
  return true;
}
