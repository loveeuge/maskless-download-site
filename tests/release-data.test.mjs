import assert from "node:assert/strict";
import test from "node:test";
import { recoverLatestReleaseAssets } from "../release-data.mjs";

const asset = Object.freeze({
  name: "maskless_v2_1_5.exe",
  state: "uploaded",
  size: 62823483,
  browser_download_url: "https://github.com/loveeuge/maskless-download-site/releases/download/v2.1.5/maskless_v2_1_5.exe",
});
const latest = Object.freeze({ id: 394438829, tag_name: "v2.1.5", assets: Object.freeze([]) });
const older = Object.freeze({ id: 391265124, tag_name: "v2.1.4", assets: Object.freeze([]) });

test("missing latest assets are recovered without mutating release data", async () => {
  const releases = Object.freeze([latest, older]);
  const requested = [];
  const result = await recoverLatestReleaseAssets(releases, async (id) => {
    requested.push(id);
    return [asset];
  });
  assert.deepEqual(requested, [latest.id]);
  assert.deepEqual(result[0].assets, [asset]);
  assert.equal(result[0].tag_name, latest.tag_name);
  assert.equal(result[1], older);
  assert.deepEqual(latest.assets, []);
});

test("known latest assets never trigger extra requests, even if older assets are empty", async () => {
  const releases = [{ ...latest, assets: [asset] }, older];
  let called = false;
  const result = await recoverLatestReleaseAssets(releases, async () => { called = true; });
  assert.equal(called, false);
  assert.equal(result, releases);
});

test("empty or invalid IDs do not produce asset requests", async () => {
  for (const releases of [[], [{ assets: [] }], [{ id: -1 }], [{ id: 0 }], [{ id: "394438829" }]]) {
    let called = false;
    assert.equal(await recoverLatestReleaseAssets(releases, async () => { called = true; }), releases);
    assert.equal(called, false);
  }
});

test("empty, invalid, or incomplete asset responses keep the release-page fallback", async () => {
  const releases = [latest, older];
  for (const response of [[], null, { message: "rate limited" }, [null, {}, { ...asset, state: "starter" }]]) {
    assert.equal(await recoverLatestReleaseAssets(releases, async () => response), releases);
  }
});

test("request failure and timeout keep existing releases available", async () => {
  const releases = [latest, older];
  for (const error of [new Error("HTTP 403"), new Error("network failure"), new Error("AbortError")]) {
    assert.equal(await recoverLatestReleaseAssets(releases, async () => { throw error; }), releases);
  }
});

test("only uploaded, usable asset entries are displayed", async () => {
  const result = await recoverLatestReleaseAssets([latest], async () => [
    null, asset, { ...asset, state: "starter" }, { ...asset, browser_download_url: null },
  ]);
  assert.deepEqual(result[0].assets, [asset]);
});
