export async function recoverLatestReleaseAssets(releases, fetchAssets) {
  const latest = releases[0];
  if (!latest || latest.assets?.length || !Number.isSafeInteger(latest.id) || latest.id <= 0) {
    return releases;
  }

  // GitHub's release summary can lag behind its dedicated assets endpoint after publication.
  try {
    const assets = await fetchAssets(latest.id);
    if (!Array.isArray(assets) || !assets.length) return releases;
    const uploaded = assets.filter((asset) => asset?.state === "uploaded"
      && typeof asset.name === "string" && typeof asset.browser_download_url === "string");
    if (!uploaded.length) return releases;
    return [{ ...latest, assets: uploaded }, ...releases.slice(1)];
  } catch {
    // Keep the release-page link usable if the extra request is unavailable or rate-limited.
    return releases;
  }
}
