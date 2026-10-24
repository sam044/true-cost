// True Cost extension. Owner: Sam (A). See docs/PRD.md, "Browser extension (F19)".
// One click on the toolbar button captures the listing in the current tab (a
// screenshot of what is visible plus the page text), opens the app's
// /compare/import page and hands the capture to it. The app calls Gemma; this
// extension never holds an API key and only talks to the app.
import { getAppUrl } from "./config.js";

const MAX_WIDTH = 1600; // same size the Add screen sends, keeps requests under 4.5 MB
const MAX_TEXT = 20000; // /api/extract rejects longer text
const IDLE_TITLE = "Find the true cost of this listing";

chrome.action.onClicked.addListener(async (tab) => {
  await setBadge(tab.id, "…", "Reading this listing");
  try {
    const capture = await captureListing(tab);
    const appUrl = await getAppUrl();
    const appTab = await chrome.tabs.create({
      url: `${appUrl}/compare/import`,
      index: tab.index + 1,
    });
    await waitForLoad(appTab.id);
    await chrome.scripting.executeScript({
      target: { tabId: appTab.id },
      func: deliver,
      args: [capture],
    });
    await setBadge(tab.id, "", IDLE_TITLE);
  } catch (error) {
    console.error("True Cost capture failed", error);
    await setBadge(tab.id, "!", `True Cost couldn't read this page: ${error.message}`);
  }
});

async function captureListing(tab) {
  const shot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "jpeg", quality: 90 });
  const [{ result: text }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => document.body?.innerText ?? "",
  });
  return {
    version: 1,
    name: listingName(tab.title),
    url: tab.url,
    image: await resizeJpeg(shot),
    text: (text || "").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_TEXT),
  };
}

// "Hub Blacksburg | Apartments in Blacksburg, VA" -> "Hub Blacksburg"
function listingName(title = "") {
  const name = title.split(/\s[|–—-]\s/)[0].trim();
  return (name || "Apartment").slice(0, 80);
}

async function resizeJpeg(dataUrl) {
  const bitmap = await createImageBitmap(await (await fetch(dataUrl)).blob());
  const scale = Math.min(1, MAX_WIDTH / bitmap.width);
  const canvas = new OffscreenCanvas(
    Math.round(bitmap.width * scale),
    Math.round(bitmap.height * scale),
  );
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.85 });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return `data:image/jpeg;base64,${btoa(binary)}`;
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

// Runs inside the app tab. The import page reads the capture from
// sessionStorage on load, or when this event fires if it loaded first.
function deliver(capture) {
  sessionStorage.setItem("true-cost-capture", JSON.stringify(capture));
  window.dispatchEvent(new Event("true-cost-capture"));
}

async function setBadge(tabId, text, title) {
  await chrome.action.setBadgeText({ tabId, text });
  await chrome.action.setTitle({ tabId, title });
}
