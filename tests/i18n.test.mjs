import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { MESSAGES, localizeRelease, message, resolveLanguage } from "../i18n.mjs";

const release = Object.freeze({
  tag_name: "v1.0.0",
  name: "테스트 릴리즈",
  body: "\uFEFF## 업데이트\n노광 동작을 개선했습니다.\u000B",
  html_url: "https://github.com/example/site/releases/tag/v1.0.0",
  assets: Object.freeze([{ name: "app.exe", browser_download_url: "https://example.com/app.exe" }]),
});
const translations = {
  "v1.0.0": { name: "Test release", body: "## Updates\nImproved exposure behavior." },
};

test("URL language overrides the stored choice; first visits default to Korean", () => {
  assert.equal(resolveLanguage("en", "ko"), "en");
  assert.equal(resolveLanguage("ko", "en"), "ko");
  assert.equal(resolveLanguage(null, "en"), "en");
  assert.equal(resolveLanguage("fr", "en"), "en");
  assert.equal(resolveLanguage(null, null), "ko");
  assert.equal(resolveLanguage("invalid", "invalid"), "ko");
});

test("both languages contain every static UI key and matching placeholders", () => {
  assert.deepEqual(Object.keys(MESSAGES.ko).sort(), Object.keys(MESSAGES.en).sort());
  const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
  for (const key of Object.keys(MESSAGES.ko)) {
    assert.deepEqual(placeholders(MESSAGES.ko[key]), placeholders(MESSAGES.en[key]), key);
  }
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  for (const [, key] of html.matchAll(/data-i18n(?:-aria-label|-placeholder|-content)?="(\w+)"/g)) {
    assert.equal(typeof MESSAGES.ko[key], "string", key);
    assert.equal(typeof MESSAGES.en[key], "string", key);
  }
});

test("the headline uses the requested two lines in each language", () => {
  assert.equal(message("ko", "headingFirst"), "마스크리스 SW");
  assert.equal(message("ko", "headingSecond"), "다운로드");
  assert.equal(message("en", "headingFirst"), "Maskless SW");
  assert.equal(message("en", "headingSecond"), "Download");
});

test("repository navigation is removed without removing release access", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.doesNotMatch(html, /class="nav-github"/);
  assert.doesNotMatch(html, /href="https:\/\/github\.com\/loveeuge\/maskless-download-site\/?"/);
  assert.match(html, /href="https:\/\/github\.com\/loveeuge\/maskless-download-site\/releases"/);
  assert.match(html, /data-language="ko"[^>]*>Kor</);
  assert.match(html, /data-language="en"[^>]*>En</);
});

test("v2.1.4 notes and current setup distinguish standard edition from historical Focus builds", () => {
  const notes = JSON.parse(readFileSync(new URL("../release-notes.en.json", import.meta.url), "utf8"));
  assert.equal(notes["v2.1.4"].name, "MASKLESS LITHO v2.1.4");
  for (const name of ["maskless_v2_1_4.exe", "maskless_v2_1_4.zip", "maskless_v2_1_4_fast.zip", "SHA256SUMS.txt"]) {
    assert.ok(notes["v2.1.4"].body.includes(name), name);
  }
  assert.match(notes["v2.1.4"].body, /806 passed, 28 subtests passed/);
  assert.match(notes["v2.1.4"].body, /Motorized Focus is excluded/);
  assert.match(message("en", "specsSetupNote"), /Motorized Focus is excluded/);
  assert.match(message("ko", "specsSetupNote"), /Motorized Focus는 제외/);
  assert.match(notes["v2.1.3"].body, /Include Focus v0.1.1/);
});

test("PC specifications remain the final section with localized, accessible comparison rows", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const section = html.match(/<section class="system-requirements"[\s\S]*?<\/section>/)?.[0];
  assert.ok(section);
  assert.match(html, /<\/section>\s*<\/main>/);
  assert.ok(html.indexOf(section) > html.indexOf('class="download-guide"'));
  assert.equal((section.match(/scope="col"/g) || []).length, 3);
  assert.equal((section.match(/scope="row"/g) || []).length, 8);
  assert.match(section, /<caption/);
  for (const [, key, fallback] of section.matchAll(/data-i18n="(\w+)">([^<]*)</g)) {
    assert.equal(fallback, message("ko", key), key);
    assert.doesNotMatch(message("en", key), /[가-힣]/, key);
  }
  assert.match(message("en", "specsIntro"), /not benchmark-verified minimums/);
  for (const language of ["ko", "en"]) {
    assert.match(message(language, "specsDlpValue"), /1920 × 1080.*100%/);
    assert.match(message(language, "specsMainMin"), /Keystone Calibration.*1920 × 1080.*100%/);
  }
});

test("search and download labels interpolate values without losing zero counts", () => {
  assert.equal(message("en", "matchedOne", { count: 1 }), "1 matching release");
  assert.equal(message("ko", "matchedMany", { count: 0 }), "검색 결과 0개");
  assert.equal(message("en", "downloadVersion", { version: "v2.1.3" }), "Download v2.1.3");
  assert.throws(() => message("en", "missingKey"), /Unknown translation key/);
});

test("Korean displays original notes even when an English translation exists", () => {
  const localized = localizeRelease(release, translations, "ko");
  assert.equal(localized.name, "테스트 릴리즈");
  assert.equal(localized.body, "## 업데이트\n노광 동작을 개선했습니다.");
  assert.equal(localized.assets, release.assets);
  assert.equal(localized.html_url, release.html_url);
});

test("English uses translated notes without mutating source data or downloads", () => {
  const localized = localizeRelease(release, translations, "en");
  assert.equal(localized.body, translations[release.tag_name].body);
  assert.equal(localized.name, "Test release");
  assert.equal(localized.assets, release.assets);
  assert.equal(localized.tag_name, release.tag_name);
  assert.equal(localized.html_url, release.html_url);
  assert.match(release.body, /업데이트/);
  assert.match(localizeRelease(release, translations, "ko").body, /업데이트/);
});

test("missing English notes keep downloads and original-release links available", () => {
  const localized = localizeRelease(release, {}, "en");
  assert.equal(localized.name, "MASKLESS LITHO v1.0.0");
  assert.equal(localized.body, MESSAGES.en.missingEnglishNotes);
  assert.equal(localized.assets, release.assets);
  assert.equal(localized.html_url, release.html_url);
  assert.doesNotMatch(localized.body, /[가-힣]/);
});

test("future English notes pass through and invalid translations are ignored", () => {
  const future = { ...release, name: "Future release", body: "New English release notes." };
  const invalid = { "v1.0.0": { name: 123, body: "한글" } };
  const localized = localizeRelease(future, invalid, "en");
  assert.equal(localized.name, future.name);
  assert.equal(localized.body, future.body);
});

test("bundled English notes have English names and bodies", () => {
  const notes = JSON.parse(readFileSync(new URL("../release-notes.en.json", import.meta.url), "utf8"));
  for (const [tag, entry] of Object.entries(notes)) {
    assert.ok(entry.name && entry.body, tag);
    assert.doesNotMatch(entry.name + entry.body, /[가-힣]/, tag);
  }
});
