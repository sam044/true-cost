// True Cost extension. Owner: Sam (A). See docs/PRD.md, "Browser extension (F19)".
// One click on the toolbar button opens the side panel and captures the whole
// listing in the current tab: it scrolls the page one screen at a time,
// screenshots each screen, stitches the shots into at most 5 tall images and
// reads the page text. It posts that to the app's POST /api/extract (the app
// calls Gemma; this extension never holds an API key and only talks to the
// app) and shows each step and the fees in the side panel (panel.js). The
// panel's buttons hand the fees to the app's /compare/import page.
//
// Progress lives in chrome.storage.session, which the panel watches:
//   job        { id, tabId, name, url, appUrl, step, ... } (small, rewritten often)
//   jobInput   { images, text } (the capture, written once)
//   jobPreview the latest screenshot while capturing
import { getAppUrl, hostOf, migrateAppUrl } from "./config.js";
import { MAX_SHOTS, OUTPUT_WIDTH, fitBudget, planImages, planPieces } from "./stitch.js";

const MAX_TEXT = 20000; // /api/extract rejects longer text
const CAPTURE_GAP_MS = 550; // Chrome allows about 2 captureVisibleTab calls a second
const SETTLE_MS = 250; // let lazy images and scroll-linked headers settle after scrolling
const EXTRACT_TIMEOUT_MS = 170_000; // the app's /api/extract gives up by 150s
const HEARTBEAT_MS = 15_000; // keeps this worker alive during the long Gemma wait; the panel watches it
const BUSY_COLOR = "#2563eb";
const DONE_COLOR = "#15803d";
const ERROR_COLOR = "#b91c1c";

let running = false; // one capture at a time; the panel shows the latest

chrome.runtime.onInstalled.addListener(() => void migrateAppUrl().then(updateIdleTitle));
chrome.runtime.onStartup.addListener(() => void updateIdleTitle());
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.appTarget) void updateIdleTitle();
});

chrome.action.onClicked.addListener((tab) => {
  // Chrome only lets the panel open straight from the click, before any await.
  chrome.sidePanel.open({ windowId: tab.windowId }).catch((e) => console.warn("side panel", e));
  void captureAndSend(tab);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "retry") {
    void readFees();
  } else if (message?.type === "open") {
    openInApp(message.then).then(
      () => sendResponse({ ok: true }),
      (e) => sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) }),
    );
    return true; // answers later
  }
});

async function updateIdleTitle() {
  await chrome.action.setTitle({ title: `Find the true cost of this listing (sends to ${hostOf(await getAppUrl())})` });
}

async function captureAndSend(tab) {
  if (running) return;
  running = true;
  try {
    await chrome.storage.session.remove(["jobInput", "jobPreview"]);
    await setJob({
      id: crypto.randomUUID(),
      tabId: tab.id,
      name: listingName(tab.title),
      url: tab.url,
      appUrl: await getAppUrl(),
      step: "capturing",
      shot: 0,
      shots: 0,
      startedAt: Date.now(),
    });
    if (isRestricted(tab.url)) {
      throw new Error("Chrome doesn't let extensions read this page. Open an apartment listing and try again.");
    }
    await setBadge(tab.id, "…", "Reading this listing", BUSY_COLOR);
    const capture = await captureListing(tab, async (progress) => {
      if (progress.preview) await chrome.storage.session.set({ jobPreview: progress.preview });
      await updateJob({ step: progress.step, shot: progress.shot, shots: progress.shots });
    });
    await chrome.storage.session.set({ jobInput: { images: capture.images, text: capture.text } });
    await chrome.storage.session.remove("jobPreview");
    await updateJob({
      name: capture.name,
      stats: {
        images: capture.images.length,
        chars: capture.images.reduce((sum, url) => sum + url.length, 0),
        text: capture.text.length,
        shots: capture.shots,
        truncated: capture.truncated,
      },
    });
  } catch (error) {
    running = false;
    await failJob(error);
    return;
  }
  running = false;
  await readFees();
}

// Sends the saved capture to /api/extract. Also the panel's "Try again".
async function readFees() {
  const { job, jobInput } = await chrome.storage.session.get(["job", "jobInput"]);
  if (!job || !jobInput || running) return;
  running = true;
  await updateJob({ step: "reading", readingSince: Date.now(), error: null, failedStep: null });
  await setBadge(job.tabId, "…", "Gemma is reading the fees", BUSY_COLOR).catch(() => {});
  // A pending fetch alone doesn't keep an extension service worker alive, and
  // Gemma can take minutes. Calling an extension API every few seconds does.
  const heartbeat = setInterval(() => void updateJob({}), HEARTBEAT_MS);
  try {
    const extraction = await postExtract(job.appUrl, jobInput);
    await updateJob({ step: "done", extraction, finishedAt: Date.now() });
    await setBadge(job.tabId, "✓", "Fees ready in the True Cost panel", DONE_COLOR).catch(() => {});
  } catch (error) {
    await failJob(error);
  } finally {
    clearInterval(heartbeat);
    running = false;
  }
}

async function postExtract(appUrl, { images, text }) {
  const where = hostOf(appUrl);
  let response;
  try {
    response = await fetch(`${appUrl}/api/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images, text: text?.trim() || undefined }),
      signal: AbortSignal.timeout(EXTRACT_TIMEOUT_MS),
    });
  } catch (error) {
    if (error?.name === "TimeoutError") throw new Error("Gemma took too long to answer. Try again in a moment.");
    throw new Error(`We couldn't reach True Cost at ${where}. Check your connection, or the address in Options.`);
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    if (body?.error) throw new Error(body.error);
    if (response.status === 404) throw new Error(`${where} doesn't look like True Cost. Check the address in Options.`);
    throw new Error(`True Cost at ${where} answered with an error (${response.status}). Try again in a moment.`);
  }
  // The app validated the extraction before sending it, and the import page
  // checks it again; here we only need the parts the panel shows.
  if (!body || !Array.isArray(body.fees) || !body.advertisedPrice) {
    throw new Error("True Cost sent back something we couldn't read. Try again.");
  }
  return body;
}

async function failJob(error) {
  console.error("True Cost capture failed", error);
  const message = error instanceof Error ? error.message : String(error);
  const { job } = await chrome.storage.session.get("job");
  await updateJob({ step: "error", failedStep: job?.step ?? "capturing", error: message });
  if (job) await setBadge(job.tabId, "!", `True Cost couldn't read this page: ${message}`, ERROR_COLOR).catch(() => {});
}

async function setJob(job) {
  await chrome.storage.session.set({ job: { ...job, heartbeat: Date.now() } });
}

async function updateJob(patch) {
  const { job } = await chrome.storage.session.get("job");
  if (job) await setJob({ ...job, ...patch });
}

// chrome://, the Web Store and other browser pages block extensions.
function isRestricted(url = "") {
  return (
    /^(chrome|chrome-extension|chrome-search|chrome-untrusted|edge|about|devtools|view-source):/i.test(url) ||
    /^https:\/\/(chromewebstore\.google\.com|chrome\.google\.com\/webstore)/i.test(url)
  );
}

async function captureListing(tab, onProgress = async () => {}) {
  const page = await inPage(tab.id, preparePage);
  if (!page) throw new Error("The page didn't respond. Reload it and try again.");
  const shots = [];
  let lastCapture = 0;
  try {
    const estimate = Math.min(MAX_SHOTS, Math.ceil(page.scrollHeight / page.region.height) || 1);
    let y = 0;
    while (shots.length < MAX_SHOTS) {
      if (shots.length === 1) await inPage(tab.id, hideFixed);
      const at = await inPage(tab.id, scrollRegion, [y]);
      if (shots.length && at.y <= shots[shots.length - 1].scrollY) break;
      const total = Math.max(estimate, shots.length + 1);
      await setBadge(tab.id, `${shots.length + 1}/${total}`, "Capturing this listing", BUSY_COLOR);
      await delay(Math.max(SETTLE_MS, lastCapture + CAPTURE_GAP_MS - Date.now()));
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "jpeg", quality: 92 });
      lastCapture = Date.now();
      shots.push({ scrollY: at.y, dataUrl });
      await onProgress({ step: "capturing", shot: shots.length, shots: total, preview: dataUrl });
      if (at.y + page.region.height >= at.scrollHeight - 2) break;
      y = at.y + page.region.height;
    }
  } finally {
    await inPage(tab.id, restorePage).catch(() => {});
  }
  await onProgress({ step: "stitching", shot: shots.length, shots: shots.length });
  await setBadge(tab.id, "…", "Putting the screenshots together", BUSY_COLOR);
  const stitched = await stitch(shots, page);
  return {
    name: listingName(page.title || tab.title),
    url: tab.url,
    images: stitched.dataUrls,
    text: (page.text || "").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_TEXT),
    shots: shots.length,
    truncated: stitched.truncated,
  };
}

// For checking a capture from the service worker's DevTools console:
// await trueCost.captureListing((await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0])
globalThis.trueCost = { captureAndSend, captureListing, readFees, stitch };

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

// The panel's "Review in True Cost" / "Add to Compare". The import page adds
// the apartment from these fees (no second Gemma call) and opens Review or
// Compare. The job id becomes the apartment id, so a second click doesn't
// add the apartment twice.
async function openInApp(then) {
  const { job } = await chrome.storage.session.get("job");
  if (!job?.extraction) throw new Error("There are no fees to open yet.");
  const listing = await chrome.tabs.get(job.tabId).catch(() => null);
  const appTab = await chrome.tabs.create({
    url: `${job.appUrl}/compare/import`,
    ...(listing ? { index: listing.index + 1, windowId: listing.windowId } : {}),
  });
  await waitForLoad(appTab.id);
  const capture = {
    version: 3,
    id: job.id,
    name: job.name,
    url: job.url,
    extraction: job.extraction,
    then: then === "compare" ? "compare" : "review",
  };
  const delivered = await inPage(appTab.id, deliver, [capture]);
  if (!delivered) throw new Error("The True Cost tab couldn't take the fees.");
}

function waitForLoad(tabId) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      reject(new Error("The True Cost app didn't load. Check the address in Options."));
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
