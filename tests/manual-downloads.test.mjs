import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { message } from "../i18n.mjs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const manifest = JSON.parse(readFileSync(new URL("../downloads/manuals.json", import.meta.url), "utf8"));

test("both published manual PDFs match their versioned manifest", () => {
  assert.equal(manifest.version, "2.1.5");
  assert.deepEqual(manifest.manuals.map((manual) => manual.language), ["ko", "en"]);
  for (const manual of manifest.manuals) {
    const pdf = readFileSync(new URL(`../downloads/${manual.file}`, import.meta.url));
    assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
    assert.match(pdf.subarray(-20).toString(), /%%EOF/);
    assert.equal(pdf.length, manual.bytes);
    assert.equal(createHash("sha256").update(pdf).digest("hex"), manual.sha256);
    assert.equal(manual.pages, 32);
  }
});

test("manual links work without JavaScript and download same-origin PDF files", () => {
  const section = html.match(/<section class="manual-downloads"[\s\S]*?<\/section>/)?.[0];
  assert.ok(section);
  const links = [...section.matchAll(/<a\s+([^>]*\bdownload\b[^>]*)>/g)];
  assert.equal(links.length, 2);
  for (const manual of manifest.manuals) {
    const link = links.find(([, attrs]) => attrs.includes(`href="downloads/${manual.file}"`));
    assert.ok(link, manual.language);
    assert.ok(link[1].includes(`hreflang="${manual.language}"`));
    assert.ok(link[1].includes('type="application/pdf"'));
  }
  assert.match(section, /https:\/\/loveeuge.github.io\/maskless-litho-manual-20260604-1959\//);
  assert.match(section, /https:\/\/loveeuge.github.io\/maskless-litho-manual-en-v2105\//);
  assert.equal((html.match(/href="#manuals"/g) || []).length, 2);
});

test("manual labels have accurate Korean fallbacks and complete English translations", () => {
  for (const [, key, fallback] of html.matchAll(/data-i18n="(manual\w+)">([^<]*)</g)) {
    assert.equal(fallback, message("ko", key), key);
    assert.doesNotMatch(message("en", key), /[가-힣]/, key);
  }
  assert.match(message("en", "manualNote"), /v2\.1\.5 Standard Edition/);
  assert.match(message("ko", "manualNote"), /2026-10-28/);
});

test("deployment cache versions stay in sync", () => {
  const script = readFileSync(new URL("../script.js", import.meta.url), "utf8");
  const versions = [...(html + script).matchAll(/\?v=([\w-]+)/g)].map((match) => match[1]);
  assert.equal(versions.length, 5);
  assert.deepEqual([...new Set(versions)], ["20261028-manual-pdf-1"]);
});
