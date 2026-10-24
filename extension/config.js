// The True Cost app this extension hands listings to. Change it on the options page.
export const DEFAULT_APP_URL = "https://true-cost-xi.vercel.app";
export const LOCAL_APP_URL = "http://localhost:3000";

// Since 0.3 the chosen address lives under "appTarget". Versions 0.1 and 0.2
// used "appUrl", and 0.1's options page was pre-filled with localhost, so any
// Save there stored localhost (and Chrome sync carries it to other installs).
// migrateAppUrl() drops that old key: a saved localhost goes back to the
// deployed app, and a custom address is kept.
const KEY = "appTarget";
const LEGACY_KEY = "appUrl";

export async function getAppUrl() {
  await migrateAppUrl();
  const { [KEY]: appUrl } = await chrome.storage.sync.get(KEY);
  return (appUrl || DEFAULT_APP_URL).replace(/\/+$/, "");
}

export async function setAppUrl(origin) {
  await chrome.storage.sync.set({ [KEY]: origin });
}

export async function migrateAppUrl() {
  const stored = await chrome.storage.sync.get([KEY, LEGACY_KEY]);
  const legacy = stored[LEGACY_KEY];
  if (legacy === undefined) return;
  if (!stored[KEY] && typeof legacy === "string" && !isLocal(legacy)) {
    try {
      const origin = new URL(legacy).origin;
      if (origin !== DEFAULT_APP_URL) await setAppUrl(origin);
    } catch {
      // not an address; fall back to the default
    }
  }
  await chrome.storage.sync.remove(LEGACY_KEY);
}

export function isLocal(url) {
  try {
    return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

// "https://true-cost-xi.vercel.app" -> "true-cost-xi.vercel.app"
export function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
