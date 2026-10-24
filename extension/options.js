import { DEFAULT_APP_URL, LOCAL_APP_URL, getAppUrl, setAppUrl } from "./config.js";

const form = document.getElementById("form");
const custom = document.getElementById("app-url");
const status = document.getElementById("status");
document.getElementById("deployed-url").textContent = DEFAULT_APP_URL;
document.getElementById("local-url").textContent = LOCAL_APP_URL;

const current = await getAppUrl();
const choice = current === DEFAULT_APP_URL ? "deployed" : current === LOCAL_APP_URL ? "local" : "custom";
form.elements.target.value = choice;
if (choice === "custom") custom.value = current;
custom.addEventListener("input", () => (form.elements.target.value = "custom"));

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const target = form.elements.target.value;
  let origin;
  try {
    origin = new URL(target === "deployed" ? DEFAULT_APP_URL : target === "local" ? LOCAL_APP_URL : custom.value).origin;
  } catch {
    status.textContent = "Enter a full address, like https://your-app.vercel.app.";
    custom.focus();
    return;
  }
  // The extension needs access to the app's site to hand it the capture.
  // localhost:3000 and *.vercel.app are already allowed by the manifest.
  const granted = await chrome.permissions.request({ origins: [`${origin}/*`] });
  if (!granted) {
    status.textContent = "Not saved: True Cost needs access to that site to send it listings.";
    return;
  }
  await setAppUrl(origin);
  if (target === "custom") custom.value = origin;
  status.textContent = `Saved. Listings go to ${origin}.`;
});
