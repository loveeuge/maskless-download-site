# Maskless Download Site

The official download site for PLANCK MASKLESS LITHO, with Korean and English interfaces, release notes, and downloads for each version.

## Website

[Maskless Download Site](https://loveeuge.github.io/maskless-download-site/)

- [Korean site](https://loveeuge.github.io/maskless-download-site/?lang=ko)
- [English site](https://loveeuge.github.io/maskless-download-site/?lang=en)

Use the language buttons at the top on desktop or mobile. The first visit defaults to Korean; a saved preference is used on later visits. An explicit `lang=ko` or `lang=en` URL overrides the saved preference. Switching languages preserves the search query, expanded release notes, and download links without refetching release data.

The two-line heading is `마스크리스 SW` / `다운로드` in Korean and `Maskless SW` / `Download` in English. Static copy and language selection live in `i18n.mjs`.

## How it works

- Published versions and download links are loaded from this repository's GitHub Releases API.
- Korean displays the original GitHub release titles and notes. English translations are maintained in `release-notes.en.json`, keyed by the exact release tag.
- All downloads point to the original files attached to each GitHub Release. Translations do not change release assets or the original notes on GitHub.
- This repository contains the download website, not the instrument-control application source code.
- Logos and brand images come from the [PLANCKLAB website](https://www.planck.co.kr/).

## Updating release notes

When publishing a release, add its English `name` and Markdown `body` to `release-notes.en.json`. Keep version numbers, filenames, hashes, test results, and historical behavior consistent with the original release notes.

In English mode, a missing translation falls back to English notes from GitHub or an English notice linking to the original release. Korean mode continues to show the original notes. Downloads remain available if the translation file cannot load.

CSS, JavaScript, the language module, and English notes use versioned asset URLs. Update their matching version strings when publishing UI or translation changes to avoid using stale assets from a previous deployment.

## Local preview

Serve the static files with a local HTTP server:

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

Open `http://127.0.0.1:8000/`. An internet connection is required to load GitHub release data.

## Tests

```powershell
node --test tests/i18n.test.mjs
```
