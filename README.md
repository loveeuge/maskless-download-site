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

## PC specifications guide

The final section, `#pc-specs`, compares minimum **planning guidelines** and recommended PC configurations in both languages. It describes the desktop application, not the browser requirements for this website.

- Scope: MASKLESS LITHO **v2.1.3**. Review the version label and specifications when publishing a newer application release.
- Suggested baseline: Windows 11 x64 on Intel/AMD, a Windows 11-compatible 4-core CPU, 8 GB RAM, and an SSD with 5 GB of free working space. Suggested recommended configuration: 6 or more cores, 16 GB RAM (32 GB for large GDS/camera workflows), and an NVMe SSD with 20 GB free. These are not benchmark-verified minimums or a performance guarantee; storage excludes the operating system and growing user data.
- Verified software constraints in the application source at tag `v2.1.3`: `ui/dlp_display_policy.py` requires DLP output at 1920 x 1080 and 100% scaling. `ui/uv_keystone_window.py` also requires a separate main/camera monitor with matching resolution and scaling for Calibration. This is not a blanket ban on using a 4K main monitor outside Calibration.
- Packaging and driver guidance follows the application's tagged README. Python, GDS conversion, and Motorized Focus components are bundled; hardware drivers may still need installation. Do not infer hardware validation from the website tests.
- OS guidance references [Qt 6.9 supported platforms](https://doc.qt.io/archives/qt-6.9/supported-platforms.html) and [Microsoft Windows 11 requirements](https://www.microsoft.com/en-us/windows/windows-11-specifications). Qt compatibility alone does not certify the application, equipment drivers, or suggested CPU/RAM figures. Windows 11's own processor, firmware, and storage requirements must also be met.

Copy is maintained in `i18n.mjs` with a matching Korean HTML fallback. The accessible comparison table scrolls within its container on narrow screens.

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
