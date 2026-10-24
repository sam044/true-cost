// Side panel. Owner: Sam (A). Shows the capture background.js is running,
// step by step, from chrome.storage.session (see the top of background.js),
// then the fees Gemma found, with buttons that open them in the app.
import { DEFAULT_APP_URL, getAppUrl, hostOf, isLocal } from "./config.js";

const STALE_MS = 50_000; // background.js writes a heartbeat at least every 15s while working
const SLOW_MS = 30_000; // lib/ai/gemma.ts starts the backup model too after 30s
const VERY_SLOW_MS = 90_000;

const STEPS = [
  { key: "capturing", label: "Capture the page" },
  { key: "stitching", label: "Put the screenshots together" },
  { key: "reading", label: "Gemma reads the fees" },
  { key: "done", label: "Fees ready" },
];

const FREQUENCY = { one_time: "one-time", monthly: "/mo", per_semester: "/semester", annual: "/yr" };
const UTILITIES = { electric: "electric", water: "water", gas: "gas", internet: "internet", trash: "trash" };

const $ = (id) => document.getElementById(id);
let state = { job: null, jobInput: null, jobPreview: null };
let lastAnnounced = "";
let previewKey = "";
let tick = null;

// ---- Data

async function load() {
  state = { jobInput: null, jobPreview: null, ...(await chrome.storage.session.get(["job", "jobInput", "jobPreview"])) };
  render();
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "session") {
    for (const key of ["job", "jobInput", "jobPreview"]) {
      if (key in changes) state[key] = changes[key].newValue ?? null;
    }
    render();
  } else if (area === "sync" && changes.appTarget) {
    void showTarget();
  }
});

async function showTarget() {
  const url = await getAppUrl();
  $("target").textContent = hostOf(url);
  $("target").title = url;
  document.querySelector(".target").classList.toggle("local", isLocal(url));
  $("target-note").textContent = isLocal(url)
    ? " (local development: the app must be running)"
    : url === DEFAULT_APP_URL
      ? ""
      : " (custom address)";
}

// ---- Rendering

function render() {
  const { job } = state;
  $("idle").hidden = Boolean(job);
  $("job").hidden = !job;
  if (!job) return;

  const failed = job.step === "error";
  const lost = !failed && job.step !== "done" && Date.now() - (job.heartbeat ?? 0) > STALE_MS;
  const current = failed || lost ? job.failedStep ?? job.step : job.step;
  const index = STEPS.findIndex((s) => s.key === current);

  $("job-name").textContent = job.name || "This listing";
  $("job-url").textContent = job.url || "";
  $("job-url").href = job.url || "#";

  // Steps
  const list = $("steps");
  list.replaceChildren(
    ...STEPS.map((step, i) => {
      const li = document.createElement("li");
      const stateName =
        (failed || lost) && i === index ? "error" : i < index || job.step === "done" ? "done" : i === index ? "active" : "todo";
      li.dataset.state = stateName;
      if (stateName === "active") li.setAttribute("aria-current", "step");
      const icon = document.createElement("span");
      icon.className = "icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = stateName === "done" ? "✓" : stateName === "error" ? "!" : "";
      const text = document.createElement("span");
      const label = document.createElement("span");
      label.className = "label";
      label.textContent = step.label;
      const detail = document.createElement("span");
      detail.className = "detail";
      detail.textContent = stepDetail(step.key, stateName, job);
      const status = document.createElement("span");
      status.className = "sr-only";
      status.textContent = { done: " (done)", active: " (in progress)", error: " (failed)", todo: "" }[stateName];
      text.append(label, status, detail);
      li.append(icon, text);
      return li;
    }),
  );

  // Announce step changes once, not every heartbeat.
  const announcement = failed || lost ? "Something went wrong." : `${STEPS[index]?.label ?? ""}. ${stepDetail(current, "active", job)}`;
  if (announcement !== lastAnnounced) {
    lastAnnounced = announcement;
    $("announce").textContent = job.step === "done" ? `Fees ready: ${feeCountText(job.extraction)}.` : announcement;
  }

  renderReading(job, lost);
  renderResult(job);
  renderError(job, lost);
  renderPreview(job);
}

function stepDetail(key, stateName, job) {
  const stats = job.stats;
  if (key === "capturing") {
    if (stateName === "todo") return "";
    if (stateName === "done") return `${stats?.shots ?? job.shot} screen${(stats?.shots ?? job.shot) === 1 ? "" : "s"}`;
    return job.shot ? `Screen ${job.shot} of ${job.shots}. The page scrolls by itself; keep this tab in front.` : "Starting…";
  }
  if (key === "stitching") {
    if (!stats) return stateName === "active" ? "Making at most 5 tall images" : "";
    return `${stats.images} image${stats.images === 1 ? "" : "s"}, ${mb(stats.chars)}, plus ${stats.text.toLocaleString()} characters of page text`;
  }
  if (key === "reading") {
    if (stateName === "todo") return "";
    if (stateName === "done" && job.finishedAt && job.readingSince) return `Read in ${duration(job.finishedAt - job.readingSince)}`;
    return `Sent to ${hostOf(job.appUrl)}. Gemma 4 runs there; this browser only waits for the answer.`;
  }
  if (key === "done") return stateName === "done" ? feeCountText(job.extraction) : "";
  return "";
}

function renderReading(job, lost) {
  const reading = job.step === "reading" && !lost;
  $("reading").hidden = !reading;
  clearInterval(tick);
  if (!reading) return;
  const stats = job.stats;
  $("reading-what").textContent = stats
    ? `Gemma is reading ${stats.images} screenshot${stats.images === 1 ? "" : "s"} and ${stats.text.toLocaleString()} characters of text from ${job.name || "this listing"}.`
    : "Gemma is reading the capture.";
  const update = () => {
    const ms = Date.now() - job.readingSince;
    $("elapsed").textContent = clock(ms);
    $("elapsed-note").textContent = "so far";
    $("reading-slow").textContent =
      ms > VERY_SLOW_MS
        ? "Gemma is very busy right now. True Cost stops waiting at about 2.5 minutes; if it fails, Try again usually works."
        : ms > SLOW_MS
          ? "Taking longer than usual, so True Cost has also asked its backup model (Gemma 4 31B). The first answer wins."
          : "";
  };
  update();
  tick = setInterval(update, 1000);
}

function renderResult(job) {
  const done = job.step === "done" && job.extraction;
  $("result").hidden = !done;
  if (!done) return;
  const x = job.extraction;
  const price = x.advertisedPrice;
  $("advertised").textContent =
    price.amount != null
      ? `Advertised ${money(price.amount)}/mo ${price.basis === "per_person" ? "per person" : "per unit"}${x.bedrooms ? `, ${x.bedrooms} bed` : ""}`
      : "No advertised rent found";
  const fees = x.fees.filter((f) => f.category !== "base_rent");
  const lowCount = fees.filter((f) => f.confidence === "low").length;
  $("result-summary").textContent =
    fees.length === 0
      ? "Gemma found no fees on this page. Review it anyway; some listings put fees on a separate page."
      : `Gemma found ${feeCountText(x)}${lowCount ? `; ${lowCount} to double-check` : ""}. The total is worked out in True Cost.`;

  const groups = [
    { title: "Required", fees: fees.filter((f) => f.mandatory === "yes"), cls: "required" },
    { title: "Not clear if required", fees: fees.filter((f) => f.mandatory === "unknown"), cls: "unknown" },
    { title: "Optional", fees: fees.filter((f) => f.mandatory === "no"), cls: "optional" },
  ].filter((g) => g.fees.length);
  $("groups").replaceChildren(
    ...groups.flatMap((g) => {
      const h = document.createElement("h3");
      h.textContent = `${g.title} (${g.fees.length})`;
      const ul = document.createElement("ul");
      ul.className = "fees";
      ul.append(...g.fees.map((f) => feeItem(f, g.cls)));
      return [h, ul];
    }),
  );

  const included = Object.entries(x.utilities).filter(([, v]) => v === "included").map(([k]) => UTILITIES[k]);
  const notIncluded = Object.entries(x.utilities).filter(([, v]) => v === "not_included").map(([k]) => UTILITIES[k]);
  $("utilities").textContent = [
    included.length ? `Included: ${included.join(", ")}.` : "",
    notIncluded.length ? `You pay: ${notIncluded.join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function feeItem(fee, cls) {
  const li = document.createElement("li");
  li.className = `fee ${cls}`;
  const top = document.createElement("div");
  top.className = "fee-top";
  const name = document.createElement("span");
  name.className = "fee-name";
  name.textContent = fee.name;
  const amount = document.createElement("span");
  amount.className = "fee-amount";
  const freq = FREQUENCY[fee.frequency] ?? "";
  amount.textContent = `${money(fee.amount)}${freq.startsWith("/") ? freq : ` ${freq}`}`;
  top.append(name, amount);
  const tags = document.createElement("div");
  tags.className = "fee-tags";
  const tagList = [
    fee.basis === "per_person" ? "per person" : "per unit",
    fee.refundable ? "refundable" : null,
    fee.confidence === "low" ? "check this" : null,
  ].filter(Boolean);
  tags.append(
    ...tagList.map((t) => {
      const span = document.createElement("span");
      span.className = t === "check this" ? "tag check" : "tag";
      span.textContent = t;
      return span;
    }),
  );
  li.append(top, tags);
  if (fee.quote) {
    const q = document.createElement("p");
    q.className = "fee-quote";
    q.textContent = `“${fee.quote}”`;
    q.title = fee.quote;
    li.append(q);
  }
  return li;
}

function renderError(job, lost) {
  const show = job.step === "error" || lost;
  $("error").hidden = !show;
  if (!show) return;
  $("error-message").textContent = lost
    ? "True Cost stopped responding partway through (Chrome may have paused the extension). Try again."
    : job.error || "Something went wrong.";
  // Try again resends the saved capture; without one, capture again from the toolbar.
  $("retry").hidden = !state.jobInput;
  if (!state.jobInput) {
    $("error-message").textContent += " Click the True Cost button on the listing to capture it again.";
  }
}

function renderPreview(job) {
  const capturing = job.step === "capturing" || job.step === "stitching";
  const images = capturing ? (state.jobPreview ? [state.jobPreview] : []) : (state.jobInput?.images ?? []);
  $("preview").hidden = images.length === 0;
  const key = `${job.id}:${capturing}:${capturing ? job.shot : images.length}`;
  if (key === previewKey) return;
  const wasCapturing = previewKey.split(":")[1] === "true";
  previewKey = key;
  if (capturing) $("preview").open = true;
  else if (wasCapturing) $("preview").open = false; // fold it away once the fees are the focus
  $("preview-summary").textContent = capturing
    ? `Latest screen (${job.shot} of ${job.shots})`
    : `What was sent (${images.length} image${images.length === 1 ? "" : "s"})`;
  $("preview-images").replaceChildren(
    ...images.map((src, i) => {
      const img = document.createElement("img");
      img.src = src;
      img.alt = capturing ? `Screen ${job.shot} of the listing` : `Captured listing, part ${i + 1} of ${images.length}`;
      return img;
    }),
  );
  $("preview-note").textContent =
    !capturing && job.stats?.truncated
      ? "The page was too long to send whole, so the top was kept. The page text still covers the rest."
      : "";
}

// ---- Actions

async function openInApp(then) {
  const buttons = [$("open-review"), $("open-compare")];
  buttons.forEach((b) => (b.disabled = true));
  $("open-status").textContent = "Opening True Cost…";
  const answer = await chrome.runtime.sendMessage({ type: "open", then }).catch((e) => ({ ok: false, error: e.message }));
  buttons.forEach((b) => (b.disabled = false));
  $("open-status").textContent = answer?.ok ? "Opened in a new tab." : (answer?.error ?? "Couldn't open True Cost.");
}

$("open-review").addEventListener("click", () => void openInApp("review"));
$("open-compare").addEventListener("click", () => void openInApp("compare"));
$("retry").addEventListener("click", () => void chrome.runtime.sendMessage({ type: "retry" }));
$("add-other").addEventListener("click", async () => {
  const appUrl = state.job?.appUrl ?? (await getAppUrl());
  await chrome.tabs.create({ url: `${appUrl}/compare/add` });
});
$("change-target").addEventListener("click", () => void chrome.runtime.openOptionsPage());

// Re-render every few seconds so a capture that stopped (no heartbeat) shows an error.
setInterval(() => state.job && state.job.step !== "done" && state.job.step !== "error" && render(), 5000);

// ---- Formatting

function money(n) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
}
function mb(chars) {
  return `${(chars / 1_000_000).toFixed(1)} MB`;
}
function clock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
function duration(ms) {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
}
function feeCountText(x) {
  const n = x ? x.fees.filter((f) => f.category !== "base_rent").length : 0;
  return `${n} fee${n === 1 ? "" : "s"}`;
}

await showTarget();
await load();
