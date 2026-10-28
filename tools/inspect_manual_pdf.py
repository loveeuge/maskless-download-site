"""Check PDF text bounds and create numbered contact sheets from Poppler renders."""

import argparse
import json
from pathlib import Path

import pdfplumber
from PIL import Image, ImageDraw, ImageFont
from pypdf import PdfReader


def inspect(pdf, renders):
    reader = PdfReader(pdf)
    outside = []
    pages = []
    with pdfplumber.open(pdf) as document:
        for number, page in enumerate(document.pages, 1):
            for char in page.chars:
                if char.get("text", "").strip() and (char["x0"] < 46 or char["x1"] > page.width - 46
                                                       or char["top"] < 15 or char["bottom"] > page.height - 15):
                    outside.append({"page": number, "text": char["text"], "bounds": [char["x0"], char["x1"], char["top"], char["bottom"]]})
            pages.append({"page": number, "characters": len(page.chars), "image_placements": len(page.images)})
    if outside:
        raise ValueError(f"Text outside safe page bounds: {outside[:15]}")
    font = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 15)
    files = sorted(renders.glob("page-*.png"), key=lambda p: int(p.stem.split("-")[-1]))
    if len(files) != len(reader.pages):
        raise ValueError("Rendered page count does not match PDF")
    for start in range(0, len(files), 9):
        sheet = Image.new("RGB", (1080, 1605), "#cdd4d8")
        draw = ImageDraw.Draw(sheet)
        for offset, path in enumerate(files[start:start + 9]):
            with Image.open(path) as page:
                page.thumbnail((344, 495))
                x = (offset % 3) * 360 + 8
                y = (offset // 3) * 535 + 28
                sheet.paste(page.convert("RGB"), (x, y))
            draw.text((x, y - 22), f"{pdf.stem[-2:].upper()}  /  {start + offset + 1:02d}", font=font, fill="#152c37")
        sheet.save(renders / f"contact-{start // 9 + 1}.png")
    report = {"file": str(pdf), "pages": len(reader.pages), "text_bounds_passed": True,
              "image_placements": sum(p["image_placements"] for p in pages),
              "page_details": pages, "top_level_bookmarks": len([x for x in reader.outline if not isinstance(x, list)])}
    (renders / "layout-check.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({k: v for k, v in report.items() if k != "page_details"}, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", type=Path)
    parser.add_argument("renders", type=Path)
    args = parser.parse_args()
    inspect(args.pdf, args.renders)
