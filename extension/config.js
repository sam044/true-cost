// The True Cost app this extension hands listings to. Change it on the options page.
export const DEFAULT_APP_URL = "http://localhost:3000";

export async function getAppUrl() {
  const { appUrl } = await chrome.storage.sync.get("appUrl");
  return (appUrl || DEFAULT_APP_URL).replace(/\/+$/, "");
}
