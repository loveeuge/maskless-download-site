# Maskless Download Site

The official download site for PLANCK MASKLESS LITHO, with English release notes and downloads for each version.

## Website

[Maskless Download Site](https://loveeuge.github.io/maskless-download-site/)

## How it works

- Published versions and download links are loaded from this repository's GitHub Releases API.
- English release titles and notes are maintained in `release-notes.en.json`, keyed by the exact release tag.
- All downloads point to the original files attached to each GitHub Release. Translations do not change release assets or the original notes on GitHub.
- This repository contains the download website, not the instrument-control application source code.
- Logos and brand images come from the [PLANCKLAB website](https://www.planck.co.kr/).

## Updating release notes

When publishing a release, add its English `name` and Markdown `body` to `release-notes.en.json`. Keep version numbers, filenames, hashes, test results, and historical behavior consistent with the original release notes.

If a translation is missing, English notes from GitHub are used directly. Korean notes are replaced on the site with an English notice linking users to the original release. Downloads remain available if the translation file cannot load.

## Local preview

Serve the static files with a local HTTP server:

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

Open `http://127.0.0.1:8000/`. An internet connection is required to load GitHub release data.
