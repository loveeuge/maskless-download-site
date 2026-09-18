import { LANGUAGE_STORAGE_KEY, LOCALES, cleanText, localizeRelease, message, resolveLanguage } from "./i18n.mjs?v=20260918-pc-specs-1";

const REPOSITORY = "loveeuge/maskless-download-site";
const API_URL = `https://api.github.com/repos/${REPOSITORY}/releases?per_page=100`;
const RELEASES_URL = `https://github.com/${REPOSITORY}/releases`;
const ORIGINAL_DATES = {
  "v2.1.3": "2026-07-28T10:32:57Z",
  "v2.1.2": "2026-06-24T01:57:41Z",
  "v2.1": "2026-06-11T05:26:23Z",
  "v2.0.10.5": "2026-06-10T13:34:44Z",
  "v2.0.10.4": "2026-06-10T07:32:28Z",
  "v2.0.10": "2026-06-08T01:47:21Z",
  "v2.0.9": "2026-06-04T10:08:52Z",
  "v2.0.8.9.5": "2026-06-04T07:41:28Z",
  "v2.0.8.9": "2026-06-04T01:49:47Z",
  "v2.0.8.8": "2026-05-22T09:08:16Z",
  "v2.0.8": "2026-05-14T12:19:22Z",
  "v2.0.7": "2026-05-06T07:12:38Z",
  "v2.0.6": "2026-04-08T11:34:39Z",
  "v2.0.5": "2026-03-26T06:11:20Z",
};

const releaseList = document.querySelector("#release-list");
const searchInput = document.querySelector("#release-search");
const resultStatus = document.querySelector("#result-status");

const icons = {
  download: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3v9m0 0 4-4m-4 4L6 8M4 16h12" /></svg>',
  file: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 2.5h6l4 4V17H5z" /><path d="M11 2.5v4h4" /></svg>',
  external: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 14 14 6M8 6h6v6" /></svg>',
};

let releases = [];
let originalReleases = [];
let englishNotes = {};
let loadState = "loading";
let storedLanguage = null;
try {
  storedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
} catch {
  // Language switching also works when browser storage is disabled.
}
let currentLanguage = resolveLanguage(new URL(location.href).searchParams.get("lang"), storedLanguage);

function t(key, values) {
  return message(currentLanguage, key, values);
}

function applyLanguage() {
  document.documentElement.lang = currentLanguage;
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  for (const attribute of ["aria-label", "placeholder", "content"]) {
    document.querySelectorAll(`[data-i18n-${attribute}]`).forEach((element) => {
      element.setAttribute(attribute, t(element.getAttribute(`data-i18n-${attribute}`)));
    });
  }
  document.querySelectorAll("[data-language]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.language === currentLanguage));
  });
  if (loadState === "ready") renderReadyState();
  else if (loadState === "error") showError();
}

function setLanguage(language) {
  currentLanguage = resolveLanguage(language, null);
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, currentLanguage);
  } catch {
    // The URL preserves the selected language when storage is unavailable.
  }
  const url = new URL(location.href);
  url.searchParams.set("lang", currentLanguage);
  history.replaceState(history.state, "", url);
  applyLanguage();
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function formatDate(value) {
  if (!value) return t("dateUnavailable");
  return new Intl.DateTimeFormat(LOCALES[currentLanguage], {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

function releaseDateValue(release) {
  return ORIGINAL_DATES[release.tag_name] || release.published_at;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return t("sizeUnavailable");
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toFixed(index >= 2 ? 1 : 0)} ${units[index]}`;
}

async function loadEnglishNotes() {
  try {
    const response = await fetch("release-notes.en.json?v=20260918-pc-specs-1");
    if (!response.ok) throw new Error(`English release notes returned ${response.status}`);
    const translations = await response.json();
    if (!translations || typeof translations !== "object" || Array.isArray(translations)) {
      throw new Error("Invalid English release notes format");
    }
    return translations;
  } catch (error) {
    // Release files must remain available if the translation file cannot load.
    console.warn("English release notes could not be loaded.", error);
    return {};
  }
}

function firstSummary(body, fallback) {
  const line = cleanText(body)
    .split(/\r?\n/)
    .map((item) => item.replace(/^#{1,6}\s+/, "").trim())
    .find((item) => item && !item.startsWith("-") && !item.startsWith("*") && !/^\d+[.)]\s/.test(item));
  return line || fallback;
}

function appendInline(parent, value) {
  const text = cleanText(value);
  const tokenPattern = /(`[^`]+`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<]+))/g;
  let cursor = 0;
  let match;

  while ((match = tokenPattern.exec(text)) !== null) {
    if (match.index > cursor) parent.append(document.createTextNode(text.slice(cursor, match.index)));
    const token = match[0];

    if (token.startsWith("`")) {
      parent.append(createElement("code", "", token.slice(1, -1)));
    } else {
      const anchor = createElement("a", "", match[2] || match[4]);
      anchor.href = match[3] || match[4];
      anchor.target = "_blank";
      anchor.rel = "noreferrer";
      parent.append(anchor);
    }
    cursor = tokenPattern.lastIndex;
  }

  if (cursor < text.length) parent.append(document.createTextNode(text.slice(cursor)));
}

function renderMarkdown(body) {
  const container = createElement("div", "markdown-body");
  const lines = cleanText(body).split(/\r?\n/);
  let activeList = null;
  let activeListType = null;

  const closeList = () => {
    activeList = null;
    activeListType = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      closeList();
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      closeList();
      const level = Math.min(5, heading[1].length + 2);
      const element = createElement(`h${level}`);
      appendInline(element, heading[2]);
      container.append(element);
      continue;
    }

    const unordered = line.match(/^[-*]\s+(.+)$/);
    const ordered = line.match(/^\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      const type = unordered ? "ul" : "ol";
      if (!activeList || activeListType !== type) {
        activeList = createElement(type);
        activeListType = type;
        container.append(activeList);
      }
      const item = createElement("li");
      appendInline(item, (unordered || ordered)[1]);
      activeList.append(item);
      continue;
    }

    closeList();
    if (line.startsWith("> ")) {
      const quote = createElement("blockquote");
      appendInline(quote, line.slice(2));
      container.append(quote);
    } else if (!/^[-_*]{3,}$/.test(line)) {
      const paragraph = createElement("p");
      appendInline(paragraph, line);
      container.append(paragraph);
    }
  }

  if (!container.childElementCount) container.append(createElement("p", "", t("emptyNotes")));
  return container;
}

function getAssetLabel(name) {
  const normalized = name.toLowerCase();
  if (normalized.includes("fast")) return t("fastPortable");
  if (normalized.endsWith(".exe")) return t("windowsExecutable");
  if (normalized.endsWith(".zip")) return t("zipArchive");
  return t("downloadFile");
}

function choosePrimaryAsset(assets = []) {
  return (
    assets.find((asset) => asset.name.toLowerCase().endsWith(".exe") && !asset.name.toLowerCase().includes("beta")) ||
    assets.find((asset) => asset.name.toLowerCase().endsWith(".zip") && !asset.name.toLowerCase().includes("fast")) ||
    assets[0]
  );
}

function createAssetLink(asset) {
  const link = createElement("a", "asset-link");
  link.href = asset.browser_download_url;
  link.setAttribute("download", "");
  link.setAttribute("aria-label", t("assetDownloadLabel", { name: asset.name, size: formatBytes(asset.size) }));

  const icon = createElement("span", "asset-icon");
  icon.innerHTML = icons.file;

  const copy = createElement("span", "asset-copy");
  copy.append(createElement("strong", "", asset.name));
  copy.append(createElement("span", "", `${getAssetLabel(asset.name)} · ${formatBytes(asset.size)}`));

  const downloadIcon = createElement("span", "asset-download-icon");
  downloadIcon.innerHTML = icons.download;
  link.append(icon, copy, downloadIcon);
  return link;
}

function createReleaseCard(release, index, expanded) {
  const card = createElement("article", `release-card${index === 0 ? " is-latest" : ""}`);
  card.dataset.tag = release.tag_name;
  card.dataset.search = cleanText(
    [release.tag_name, release.name, release.body, ...(release.assets || []).map((asset) => asset.name)].join(" "),
  ).toLocaleLowerCase(LOCALES[currentLanguage]);
  card.style.animationDelay = `${Math.min(index * 45, 360)}ms`;

  const releaseIndex = createElement("div", "release-index");
  const indexTop = createElement("div");
  const badges = createElement("div", "release-badges");
  badges.append(createElement("span", "release-badge", t("stableBadge")));
  if (index === 0) badges.append(createElement("span", "release-badge latest", t("latestBadge")));
  if (release.prerelease || /beta|베타/i.test(`${release.name} ${release.tag_name}`)) {
    badges.append(createElement("span", "release-badge beta", t("betaBadge")));
  }
  indexTop.append(badges);
  indexTop.append(createElement("p", "release-version", release.tag_name));
  const publishedAt = releaseDateValue(release);
  const date = createElement("time", "release-date", formatDate(publishedAt));
  date.dateTime = publishedAt || "";
  indexTop.append(date);

  const sourceLink = createElement("a", "", t("viewOnGithub"));
  sourceLink.href = release.html_url;
  sourceLink.target = "_blank";
  sourceLink.rel = "noreferrer";
  sourceLink.insertAdjacentHTML("beforeend", icons.external);
  releaseIndex.append(indexTop, sourceLink);

  const content = createElement("div", "release-content");
  const titleRow = createElement("div", "release-title-row");
  titleRow.append(createElement("h3", "", cleanText(release.name) || release.tag_name));
  titleRow.append(createElement("span", "asset-count", t("fileCount", { count: release.assets?.length || 0 })));
  content.append(titleRow);

  const assets = createElement("div", "asset-list");
  if (release.assets?.length) {
    release.assets.forEach((asset) => assets.append(createAssetLink(asset)));
  } else {
    assets.append(createElement("p", "no-assets", t("noFiles")));
  }
  content.append(assets);

  const notes = createElement("details", "release-notes");
  notes.open = expanded.has(release.tag_name) ? expanded.get(release.tag_name) : index === 0;
  notes.append(createElement("summary", "", t("releaseNotes")));
  notes.append(renderMarkdown(release.body));
  content.append(notes);

  card.append(releaseIndex, content);
  return card;
}

function renderHero(latest) {
  const primaryAsset = choosePrimaryAsset(latest.assets);
  const publishedAt = releaseDateValue(latest);
  document.querySelector("#latest-version").textContent = latest.tag_name;
  document.querySelector("#latest-panel-title").textContent = firstSummary(latest.body, latest.name);

  const date = document.querySelector("#latest-date");
  date.textContent = t("releasedDate", { date: formatDate(publishedAt) });
  date.dateTime = publishedAt || "";
  document.querySelector("#latest-assets").textContent = t("fileCount", { count: latest.assets?.length || 0 });
  document.querySelector("#latest-meta").textContent = t("releasedMeta", { date: formatDate(publishedAt) });

  const download = document.querySelector("#latest-download");
  download.classList.remove("is-disabled");
  download.removeAttribute("aria-disabled");
  download.href = primaryAsset?.browser_download_url || latest.html_url;
  download.querySelector("span").textContent = t(primaryAsset ? "downloadVersion" : "viewRelease", { version: latest.tag_name });
}

function renderStats(items) {
  document.querySelector("#stat-latest").textContent = items[0]?.tag_name || "—";
  document.querySelector("#stat-releases").textContent = `${items.length}`;
  document.querySelector("#stat-files").textContent = `${items.reduce((sum, item) => sum + (item.assets?.length || 0), 0)}`;
}

function renderReleases(items) {
  const expanded = new Map([...releaseList.querySelectorAll(".release-card")].map((card) => [
    card.dataset.tag, card.querySelector(".release-notes").open,
  ]));
  releaseList.replaceChildren();
  items.forEach((release, index) => releaseList.append(createReleaseCard(release, index, expanded)));
  releaseList.setAttribute("aria-busy", "false");
  resultStatus.textContent = t("releaseCount", { count: items.length });
}

function renderReadyState() {
  releases = originalReleases.map((release) => localizeRelease(release, englishNotes, currentLanguage));
  renderHero(releases[0]);
  renderStats(releases);
  renderReleases(releases);
  filterReleases();
}

function filterReleases() {
  if (loadState !== "ready") return;
  const query = cleanText(searchInput.value).toLocaleLowerCase(LOCALES[currentLanguage]);
  const cards = [...releaseList.querySelectorAll(".release-card")];
  let visible = 0;

  cards.forEach((card) => {
    const match = !query || card.dataset.search.includes(query);
    card.hidden = !match;
    if (match) visible += 1;
  });

  resultStatus.textContent = query
    ? t(visible === 1 ? "matchedOne" : "matchedMany", { count: visible })
    : t("releaseCount", { count: releases.length });

  let emptyState = releaseList.querySelector(".empty-state");
  if (visible === 0) {
    if (!emptyState) {
      emptyState = createElement("div", "empty-state");
      emptyState.append(createElement("h3", "", t("noMatches")));
      emptyState.append(createElement("p", "", t("noMatchesHelp")));
      releaseList.append(emptyState);
    }
  } else {
    emptyState?.remove();
  }
}

function showError() {
  releaseList.setAttribute("aria-busy", "false");
  const state = createElement("div", "error-state");
  state.append(createElement("h3", "", t("unableLoad")));
  state.append(createElement("p", "", t("retryHelp")));
  const link = createElement("a", "button button-dark", t("openGithub"));
  link.href = RELEASES_URL;
  state.append(link);
  releaseList.replaceChildren(state);
  resultStatus.textContent = t("connectionError");
  document.querySelector("#latest-meta").textContent = t("visitGithub");
  document.querySelector("#latest-panel-title").textContent = t("unableLoad");
  const latestDownload = document.querySelector("#latest-download");
  latestDownload.classList.remove("is-disabled");
  latestDownload.removeAttribute("aria-disabled");
  latestDownload.href = RELEASES_URL;
  latestDownload.querySelector("span").textContent = t("openGithub");
}

async function loadReleases() {
  try {
    const [response, translations] = await Promise.all([
      fetch(API_URL, { headers: { Accept: "application/vnd.github+json" } }),
      loadEnglishNotes(),
    ]);
    if (!response.ok) throw new Error(`GitHub API returned ${response.status}`);
    const data = await response.json();
    originalReleases = data
      .filter((release) => !release.draft)
      .sort((a, b) => new Date(releaseDateValue(b)) - new Date(releaseDateValue(a)));
    if (!originalReleases.length) throw new Error("No releases found");

    englishNotes = translations;
    loadState = "ready";
    renderReadyState();
  } catch (error) {
    console.error(error);
    loadState = "error";
    showError();
  }
}

searchInput.addEventListener("input", filterReleases);
document.querySelectorAll("[data-language]").forEach((button) => {
  button.addEventListener("click", () => setLanguage(button.dataset.language));
});
applyLanguage();
loadReleases();
