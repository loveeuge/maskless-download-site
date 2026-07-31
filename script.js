const REPOSITORY = "loveeuge/PLANCK-MASKLESS-SW";
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

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function formatDate(value) {
  if (!value) return "날짜 정보 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

function releaseDateValue(release) {
  return ORIGINAL_DATES[release.tag_name] || release.published_at;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "크기 정보 없음";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toFixed(index >= 2 ? 1 : 0)} ${units[index]}`;
}

function cleanText(text = "") {
  return text.replace(/^\uFEFF/, "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
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

  if (!container.childElementCount) container.append(createElement("p", "", "작성된 릴리스 노트가 없습니다."));
  return container;
}

function getAssetLabel(name) {
  const normalized = name.toLowerCase();
  if (normalized.includes("fast")) return "Fast Portable";
  if (normalized.endsWith(".exe")) return "Windows 실행 파일";
  if (normalized.endsWith(".zip")) return "압축 배포본";
  return "배포 파일";
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
  link.setAttribute("aria-label", `${asset.name} 다운로드, ${formatBytes(asset.size)}`);

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

function createReleaseCard(release, index) {
  const card = createElement("article", `release-card${index === 0 ? " is-latest" : ""}`);
  card.dataset.search = cleanText(
    [release.tag_name, release.name, release.body, ...(release.assets || []).map((asset) => asset.name)].join(" "),
  ).toLocaleLowerCase("ko-KR");
  card.style.animationDelay = `${Math.min(index * 45, 360)}ms`;

  const releaseIndex = createElement("div", "release-index");
  const indexTop = createElement("div");
  const badges = createElement("div", "release-badges");
  badges.append(createElement("span", "release-badge", "STABLE"));
  if (index === 0) badges.append(createElement("span", "release-badge latest", "LATEST"));
  if (release.prerelease || /beta/i.test(`${release.name} ${release.tag_name}`)) {
    badges.append(createElement("span", "release-badge beta", "BETA"));
  }
  indexTop.append(badges);
  indexTop.append(createElement("p", "release-version", release.tag_name));
  const publishedAt = releaseDateValue(release);
  const date = createElement("time", "release-date", formatDate(publishedAt));
  date.dateTime = publishedAt || "";
  indexTop.append(date);

  const sourceLink = createElement("a", "", "릴리스 원문");
  sourceLink.href = release.html_url;
  sourceLink.target = "_blank";
  sourceLink.rel = "noreferrer";
  sourceLink.insertAdjacentHTML("beforeend", icons.external);
  releaseIndex.append(indexTop, sourceLink);

  const content = createElement("div", "release-content");
  const titleRow = createElement("div", "release-title-row");
  titleRow.append(createElement("h3", "", cleanText(release.name) || release.tag_name));
  titleRow.append(createElement("span", "asset-count", `${release.assets?.length || 0} FILES`));
  content.append(titleRow);

  const assets = createElement("div", "asset-list");
  if (release.assets?.length) {
    release.assets.forEach((asset) => assets.append(createAssetLink(asset)));
  } else {
    assets.append(createElement("p", "no-assets", "이 버전에 등록된 배포 파일이 없습니다."));
  }
  content.append(assets);

  const notes = createElement("details", "release-notes");
  if (index === 0) notes.open = true;
  notes.append(createElement("summary", "", "업데이트 노트"));
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
  date.textContent = `Released ${formatDate(publishedAt)}`;
  date.dateTime = publishedAt || "";
  document.querySelector("#latest-assets").textContent = `${latest.assets?.length || 0} files`;
  document.querySelector("#latest-meta").textContent = `${formatDate(publishedAt)} 공개 · GitHub Releases 제공`;

  const download = document.querySelector("#latest-download");
  download.classList.remove("is-disabled");
  download.removeAttribute("aria-disabled");
  download.href = primaryAsset?.browser_download_url || latest.html_url;
  download.querySelector("span").textContent = primaryAsset ? `${latest.tag_name} 다운로드` : `${latest.tag_name} 릴리스 보기`;
}

function renderStats(items) {
  document.querySelector("#stat-latest").textContent = items[0]?.tag_name || "—";
  document.querySelector("#stat-releases").textContent = `${items.length}`;
  document.querySelector("#stat-files").textContent = `${items.reduce((sum, item) => sum + (item.assets?.length || 0), 0)}`;
}

function renderReleases(items) {
  releaseList.replaceChildren();
  items.forEach((release, index) => releaseList.append(createReleaseCard(release, index)));
  releaseList.setAttribute("aria-busy", "false");
  resultStatus.textContent = `총 ${items.length}개 릴리스 · 최신순`;
}

function filterReleases() {
  const query = cleanText(searchInput.value).toLocaleLowerCase("ko-KR");
  const cards = [...releaseList.querySelectorAll(".release-card")];
  let visible = 0;

  cards.forEach((card) => {
    const match = !query || card.dataset.search.includes(query);
    card.hidden = !match;
    if (match) visible += 1;
  });

  resultStatus.textContent = query ? `검색 결과 ${visible}개` : `총 ${releases.length}개 릴리스 · 최신순`;

  let emptyState = releaseList.querySelector(".empty-state");
  if (visible === 0) {
    if (!emptyState) {
      emptyState = createElement("div", "empty-state");
      emptyState.append(createElement("h3", "", "일치하는 릴리스가 없습니다."));
      emptyState.append(createElement("p", "", "다른 버전 번호나 업데이트 키워드로 검색해 보세요."));
      releaseList.append(emptyState);
    }
  } else {
    emptyState?.remove();
  }
}

function showError() {
  releaseList.setAttribute("aria-busy", "false");
  const state = createElement("div", "error-state");
  state.append(createElement("h3", "", "릴리스 목록을 불러오지 못했습니다."));
  state.append(createElement("p", "", "잠시 후 다시 시도하거나 GitHub Releases에서 파일을 확인해 주세요."));
  const link = createElement("a", "button button-dark", "GitHub Releases 열기");
  link.href = RELEASES_URL;
  state.append(link);
  releaseList.replaceChildren(state);
  resultStatus.textContent = "연결 오류";
  document.querySelector("#latest-meta").textContent = "GitHub Releases에서 직접 확인해 주세요.";
  const latestDownload = document.querySelector("#latest-download");
  latestDownload.classList.remove("is-disabled");
  latestDownload.removeAttribute("aria-disabled");
  latestDownload.href = RELEASES_URL;
  latestDownload.querySelector("span").textContent = "GitHub Releases 열기";
}

async function loadReleases() {
  try {
    const response = await fetch(API_URL, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!response.ok) throw new Error(`GitHub API returned ${response.status}`);
    const data = await response.json();
    releases = data
      .filter((release) => !release.draft)
      .sort((a, b) => new Date(releaseDateValue(b)) - new Date(releaseDateValue(a)));
    if (!releases.length) throw new Error("No releases found");

    renderHero(releases[0]);
    renderStats(releases);
    renderReleases(releases);
  } catch (error) {
    console.error(error);
    showError();
  }
}

searchInput.addEventListener("input", filterReleases);
loadReleases();
