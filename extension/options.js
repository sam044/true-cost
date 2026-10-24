import { getAppUrl } from "./config.js";

const input = document.getElementById("app-url");
const status = document.getElementById("status");
input.value = await getAppUrl();

document.getElementById("form").addEventListener("submit", async (event) => {
  event.preventDefault();
  let origin;
  try {
    origin = new URL(input.value).origin;
  } catch {
    status.textContent = "Enter a full address, like https://true-cost.vercel.app.";
    return;
  }
  // The extension needs access to the app's site to hand it the capture.
  const granted = await chrome.permissions.request({ origins: [`${origin}/*`] });
  if (!granted) {
    status.textContent = "Not saved: True Cost needs access to that site to send it listings.";
    return;
  }
  await chrome.storage.sync.set({ appUrl: origin });
  input.value = origin;
  status.textContent = "Saved.";
});
