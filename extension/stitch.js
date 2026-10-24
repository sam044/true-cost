// Pure planning for the full-page capture. Owner: Sam (A). No chrome.* or DOM
// here, so it can be checked in Node (see extension/README.md).
//
// Coordinates are CSS pixels. The page scrolls inside a "region" of the
// viewport: the whole viewport for normal pages, or the box of the inner
// element that scrolls (some listing sites scroll a <div>, not the window).
// The stitched page puts document row d of the region at output row
// region.top + (d - firstScrollY), so a header above an inner scroller is kept
// once, from the first shot.

export const MAX_IMAGES = 5; // POST /api/extract accepts at most 5 images
export const MAX_SHOTS = 12; // viewports captured at most; the text covers the rest
export const OUTPUT_WIDTH = 1600; // same width the Add screen sends
export const TARGET_IMAGE_HEIGHT = 2400; // output px per image before we use more images
export const MAX_IMAGE_HEIGHT = 4000; // taller images get too small for the model to read
// Vercel rejects request bodies over 4.5 MB. The images travel as base64 data
// URLs inside JSON next to up to 20,000 characters of text, so keep the
// images' data URLs under 3.4 million characters in total.
export const IMAGE_BUDGET_CHARS = 3_400_000;
export const QUALITIES = [0.82, 0.7, 0.58, 0.46];

/**
 * Which rows of a viewport shot are new, and where they go in the stitched page.
 * shot: { scrollY } (actual scroll of the region when captured)
 * prevEnd: the document row where the previous shot's region ended (null for the first shot)
 * Returns { srcTop, srcHeight, outTop, docEnd } in CSS px, or null if the shot adds nothing.
 */
export function pieceFor(shot, region, firstScrollY, prevEnd) {
  const regionBottom = region.top + region.height;
  const docEnd = shot.scrollY + region.height;
  if (prevEnd === null) {
    // First shot: everything from the top of the viewport to the bottom of the region.
    return { srcTop: 0, srcHeight: regionBottom, outTop: 0, docEnd };
  }
  if (docEnd <= prevEnd) return null;
  const newFrom = Math.max(prevEnd, shot.scrollY);
  return {
    srcTop: region.top + (newFrom - shot.scrollY),
    srcHeight: docEnd - newFrom,
    outTop: region.top + (newFrom - firstScrollY),
    docEnd,
  };
}

/** Pieces for a list of shots, plus the stitched height in CSS px. */
export function planPieces(shots, region) {
  const pieces = [];
  let prevEnd = null;
  const first = shots.length ? shots[0].scrollY : 0;
  for (let i = 0; i < shots.length; i++) {
    const piece = pieceFor(shots[i], region, first, prevEnd);
    if (!piece) continue;
    pieces.push({ shot: i, ...piece });
    prevEnd = piece.docEnd;
  }
  const height = pieces.reduce((max, p) => Math.max(max, p.outTop + p.srcHeight), 0);
  return { pieces, height };
}

/**
 * Split a stitched page of `height` output px into at most MAX_IMAGES images
 * of similar height. Pages too tall for 5 images of MAX_IMAGE_HEIGHT keep
 * their top; the bottom is dropped (`truncated`).
 */
export function planImages(height, opts = {}) {
  const maxImages = opts.maxImages ?? MAX_IMAGES;
  const target = opts.targetHeight ?? TARGET_IMAGE_HEIGHT;
  const maxHeight = opts.maxHeight ?? MAX_IMAGE_HEIGHT;
  const total = Math.max(1, Math.round(height));
  const kept = Math.min(total, maxImages * maxHeight);
  const count = Math.min(maxImages, Math.max(1, Math.ceil(kept / target)));
  const each = Math.ceil(kept / count);
  const images = [];
  for (let top = 0; top < kept; top += each) {
    images.push({ top, height: Math.min(each, kept - top) });
  }
  return { images, truncated: kept < total };
}

/**
 * Encode images so their data URLs fit the budget. Tries each quality in turn;
 * if even the lowest is too big, drops images from the bottom (the top of a
 * listing has the price and fees). encode(index, quality) -> Promise<dataUrl>.
 * Returns { dataUrls, quality, dropped }.
 */
export async function fitBudget(count, encode, opts = {}) {
  const budget = opts.budget ?? IMAGE_BUDGET_CHARS;
  const qualities = opts.qualities ?? QUALITIES;
  let urls = [];
  for (const quality of qualities) {
    urls = [];
    for (let i = 0; i < count; i++) urls.push(await encode(i, quality));
    if (totalChars(urls) <= budget) return { dataUrls: urls, quality, dropped: 0 };
  }
  const quality = qualities[qualities.length - 1];
  let dropped = 0;
  while (urls.length > 1 && totalChars(urls) > budget) {
    urls.pop();
    dropped++;
  }
  if (totalChars(urls) > budget) throw new Error("the page is too large to send");
  return { dataUrls: urls, quality, dropped };
}

function totalChars(urls) {
  return urls.reduce((sum, url) => sum + url.length, 0);
}
