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
- If the newest release reports no files, the site makes at most one additional request to that release's assets endpoint, with an 8-second timeout. This handles GitHub summaries lagging behind newly published assets; on failure, the release-page fallback link remains usable. Existing releases and language changes do not trigger extra asset requests.
- Korean displays the original GitHub release titles and notes. English translations are maintained in `release-notes.en.json`, keyed by the exact release tag.
- Application downloads point to the original files attached to each GitHub Release. Manual PDFs are served as static files from `downloads/`. Translations do not change release assets or the original notes on GitHub.
- This repository contains the download website, not the instrument-control application source code.
- The header GitHub button and footer repository link are intentionally omitted. Release details and download links remain available.
- Logos and brand images come from the [PLANCKLAB website](https://www.planck.co.kr/).

## Updating release notes

When publishing a release, add its English `name` and Markdown `body` to `release-notes.en.json`. Keep version numbers, filenames, hashes, test results, and historical behavior consistent with the original release notes.

In English mode, a missing translation falls back to English notes from GitHub or an English notice linking to the original release. Korean mode continues to show the original notes. Downloads remain available if the translation file cannot load.

CSS, JavaScript, the language and release-data modules, and English notes use versioned asset URLs. Update their matching version strings when publishing UI or translation changes to avoid using stale assets from a previous deployment.

### v2.1.5 distribution

The application release originates in `PLANCK-INC/MASKLESSLITHO` (private). The public `v2.1.5` release here mirrors its three distribution binaries/archives and `SHA256SUMS.txt` without rebuilding or modifying them. Keep filenames and the source release date (`2026-09-23T07:47:53Z`) unchanged; verify each downloaded file against the source asset digest and checksum manifest before uploading, then compare the public asset digests. Never make the application source repository public to serve downloads.

The Korean notes retain the original release text, with a notice that linked development documentation requires repository access. The English translation describes the same changes and QA results reported by the application release; these are not new application tests performed by this website. Version 2.1.4 removes Motorized Focus from the standard edition and reserves it for a future Pro edition, so the current setup guide must not claim it is bundled. Historical notes for v2.1.3 and earlier retain their original behavior.

Version 2.1.5 adds safer Display Apply handling and a first-LED-ON observation dialog. Preserve the important distinction in both languages: `Pattern visible` records the user's observation, not automatic optical detection; UV may already be on before confirmation. Keep the 30-second confirmation timeout, cancellation behavior, native-DLL blocking caveat, and equipment safety warnings in the release notes. The reported 915 tests and 93 subtests belong to the application release's QA, not this website's tests.

## PC specifications guide

The final section, `#pc-specs`, compares minimum **planning guidelines** and recommended PC configurations in both languages. It describes the desktop application, not the browser requirements for this website.

- Scope: MASKLESS LITHO **v2.1.5**, standard edition. Review the version label and specifications when publishing a newer application release.
- Suggested baseline: Windows 11 x64 on Intel/AMD, a Windows 11-compatible 4-core CPU, 8 GB RAM, and an SSD with 5 GB of free working space. Suggested recommended configuration: 6 or more cores, 16 GB RAM (32 GB for large GDS/camera workflows), and an NVMe SSD with 20 GB free. These are not benchmark-verified minimums or a performance guarantee; storage excludes the operating system and growing user data.
- Verified software constraints in the application source at tag `v2.1.5`: `ui/dlp_display_policy.py` requires DLP output at 1920 x 1080 and 100% scaling. `ui/uv_keystone_window.py` also requires a separate main/camera monitor with matching resolution and scaling for Calibration. This is not a blanket ban on using a 4K main monitor outside Calibration.
- Packaging and driver guidance follows the application's tagged README. Python and GDS conversion components are bundled, but Motorized Focus remains excluded from v2.1.5. DLP drivers may still need installation, and the microscope camera uses an external application. Do not infer hardware validation from the website tests.
- OS guidance references [Qt 6.9 supported platforms](https://doc.qt.io/archives/qt-6.9/supported-platforms.html) and [Microsoft Windows 11 requirements](https://www.microsoft.com/en-us/windows/windows-11-specifications). Qt compatibility alone does not certify the application, equipment drivers, or suggested CPU/RAM figures. Windows 11's own processor, firmware, and storage requirements must also be met.

Copy is maintained in `i18n.mjs` with a matching Korean HTML fallback. The accessible comparison table scrolls within its container on narrow screens.

## Operator manual PDFs

The `#manuals` section and hero shortcut offer Korean and English **v2.1.5 Standard Edition** manuals. Both are 32-page searchable A4 PDFs, updated 2026-10-28, with embedded Korean fonts, a clickable contents page, chapter/tab bookmarks, and screenshots. All 24 sections, 27 tabs (including hidden panels), 255 text blocks per language, and 22 figure placements from the web manuals are retained. This is document QA, not a new hardware test or optical-output certification.

- [Korean PDF](downloads/MASKLESS_LITHO_v2_1_5_Manual_ko.pdf)
- [English PDF](downloads/MASKLESS_LITHO_v2_1_5_Manual_en.pdf)
- [Korean web manual](https://loveeuge.github.io/maskless-litho-manual-20260604-1959/)
- [English web manual](https://loveeuge.github.io/maskless-litho-manual-en-v2105/)

Each manual site also hosts its own language's PDF in `downloads/`, with a download link at the top. Same-origin static links work without JavaScript, GitHub sign-in, or release API availability. `downloads/manuals.json` records the exact sizes and SHA-256 digests. Keep the three sites' copies identical. PDF links to application release notes use the public download mirror rather than requiring access to the private source repository.

### Rebuild and verify

Run on Windows with Python 3.10+ and the installed Malgun Gothic regular/bold fonts. The source directories must contain the complete manual `index.html` and `assets/img` from the two manual repositories, or their locally generated equivalents. No instrument connection or application execution is required.

```powershell
python -m pip install -r tools/requirements-pdf.txt
python tools/build_manual_pdf.py --ko-source <korean-manual-folder> --en-source <english-manual-folder> --output output/pdf --date 2026-10-28
New-Item -ItemType Directory -Force tmp/pdfs/ko,tmp/pdfs/en
pdftoppm -r 120 -png output/pdf/MASKLESS_LITHO_v2_1_5_Manual_ko.pdf tmp/pdfs/ko/page
pdftoppm -r 120 -png output/pdf/MASKLESS_LITHO_v2_1_5_Manual_en.pdf tmp/pdfs/en/page
python tools/inspect_manual_pdf.py output/pdf/MASKLESS_LITHO_v2_1_5_Manual_ko.pdf tmp/pdfs/ko
python tools/inspect_manual_pdf.py output/pdf/MASKLESS_LITHO_v2_1_5_Manual_en.pdf tmp/pdfs/en
```

Generation fails on missing text, unsupported HTML elements, missing images, or missing font glyphs. Inspect every rendered page/contact sheet for layout, and check detailed text/table pages at full resolution. After approval, copy the PDFs into this repository's `downloads/` and each manual site's `downloads/`; update `manuals.json` from the generated `.qa.json` reports. Rebuilds can change the PDF digest because metadata includes a creation timestamp. Commit only the approved static PDFs, manifest, source tools, and website changes, not `tmp/`, `output/`, or local absolute-path QA reports. When updating the source manual generator, retain its localized `downloads/...pdf` hero link.

## Local preview

Serve the static files with a local HTTP server:

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

Open `http://127.0.0.1:8000/`. An internet connection is required to load GitHub release data.

## Tests

```powershell
node --test tests/i18n.test.mjs tests/release-data.test.mjs tests/manual-downloads.test.mjs
```
