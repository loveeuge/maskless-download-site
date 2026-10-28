"""Convert the complete published bilingual HTML manuals to searchable A4 PDFs."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import unicodedata
from pathlib import Path
from xml.sax.saxutils import escape

from bs4 import BeautifulSoup, NavigableString, Tag
from PIL import Image as PILImage
from pypdf import PdfReader
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, Frame, HRFlowable, Image, KeepTogether, PageBreak,
    PageTemplate, Paragraph, Spacer, Table, TableStyle,
)
from reportlab.platypus.tableofcontents import TableOfContents

VERSION = "2.1.5"
WIDTH, HEIGHT = A4
MARGIN = 48
BODY_WIDTH = WIDTH - 2 * MARGIN
INK = colors.HexColor("#152c37")
MUTED = colors.HexColor("#516672")
TEAL = colors.HexColor("#007c74")
PALE = colors.HexColor("#eaf5f3")
PUBLIC_RELEASE = "https://github.com/loveeuge/maskless-download-site/releases/tag/v2.1.5"
PRIVATE_RELEASE = "https://github.com/PLANCK-INC/MASKLESSLITHO/releases/tag/v2.1.5"
SITES = {
    "ko": "https://loveeuge.github.io/maskless-litho-manual-20260604-1959/",
    "en": "https://loveeuge.github.io/maskless-litho-manual-en-v2105/",
}


def clean(text):
    return str(text).replace("\u2011", "-").replace("\u2013", "-").replace("\u2014", "-")


def compact(text):
    return re.sub(r"\s+", "", unicodedata.normalize("NFKC", clean(text)))


class ManualDocument(BaseDocTemplate):
    def __init__(self, path, language, date):
        super().__init__(str(path), pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN,
                         topMargin=54, bottomMargin=48, pageCompression=1,
                         title=f"MASKLESS LITHO v{VERSION} - {'Korean' if language == 'ko' else 'English'} Operator Manual",
                         author="PLANCK INC", subject="Standard edition operator guide")
        self.language = language
        self.edition_date = date
        self.addPageTemplates(PageTemplate(
            id="manual", frames=[Frame(MARGIN, 48, BODY_WIDTH, HEIGHT - 102,
                                        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)],
            onPage=self.draw_page,
        ))

    def draw_page(self, canvas, doc):
        canvas.saveState()
        canvas.setFillColor(MUTED)
        canvas.setFont("Manual", 8)
        if doc.page > 1:
            canvas.drawString(MARGIN, HEIGHT - 29, f"PLANCK INC  /  MASKLESS LITHO v{VERSION}")
            canvas.drawRightString(WIDTH - MARGIN, HEIGHT - 29, "KOR" if self.language == "ko" else "EN")
            canvas.setStrokeColor(colors.HexColor("#cbd9dc"))
            canvas.line(MARGIN, HEIGHT - 38, WIDTH - MARGIN, HEIGHT - 38)
        canvas.drawString(MARGIN, 27, f"STANDARD EDITION  |  {self.edition_date}")
        canvas.drawRightString(WIDTH - MARGIN, 27, f"{doc.page:02d}")
        canvas.restoreState()

    def afterFlowable(self, flowable):
        if hasattr(flowable, "bookmark"):
            self.canv.bookmarkPage(flowable.bookmark)
            self.canv.addOutlineEntry(flowable.getPlainText(), flowable.bookmark,
                                     level=getattr(flowable, "outline_level", 0), closed=False)
            if getattr(flowable, "include_toc", False):
                self.notify("TOCEntry", (0, flowable.getPlainText(), self.page, flowable.bookmark))


class LinkedImage(Image):
    def __init__(self, path, width, height, url):
        super().__init__(str(path), width=width, height=height)
        self.url = url
        self.hAlign = "CENTER"

    def draw(self):
        super().draw()
        self.canv.linkURL(self.url, (0, 0, self.drawWidth, self.drawHeight), relative=1)


class Builder:
    def __init__(self, source, language, date):
        self.source = source.resolve()
        self.language = language
        self.date = date
        self.soup = BeautifulSoup((source / "index.html").read_text(encoding="utf-8"), "html.parser")
        self.expected = []
        self.images = []
        self.tab_ids = []
        self.styles = self.make_styles()

    def t(self, ko, en):
        return ko if self.language == "ko" else en

    def make_styles(self):
        base = dict(fontName="Manual", fontSize=10, leading=15, textColor=INK,
                    wordWrap="CJK" if self.language == "ko" else None,
                    splitLongWords=True, allowWidows=0, allowOrphans=0)
        body = ParagraphStyle("body", **base, spaceAfter=7)
        return {
            "body": body,
            "intro": ParagraphStyle("intro", parent=body, textColor=MUTED, fontSize=11, leading=17, spaceAfter=14),
            "title": ParagraphStyle("title", parent=body, fontName="Manual-Bold", fontSize=23, leading=30, spaceAfter=13, keepWithNext=True),
            "sub": ParagraphStyle("sub", parent=body, fontName="Manual-Bold", fontSize=12, leading=18, textColor=TEAL, spaceBefore=13, spaceAfter=8, keepWithNext=True),
            "item": ParagraphStyle("item", parent=body, leftIndent=15, bulletIndent=0, bulletFontName="Manual", bulletFontSize=9, spaceAfter=5),
            "cell": ParagraphStyle("cell", parent=body, fontSize=9, leading=14, spaceAfter=0),
            "head": ParagraphStyle("head", parent=body, fontName="Manual-Bold", textColor=colors.white, fontSize=9, leading=14, spaceAfter=0),
            "caption": ParagraphStyle("caption", parent=body, fontSize=8.5, leading=13, textColor=MUTED, spaceBefore=7, spaceAfter=0),
            "note": ParagraphStyle("note", parent=body, backColor=PALE, borderPadding=9, spaceBefore=9, spaceAfter=13),
            "warning": ParagraphStyle("warning", parent=body, backColor=colors.HexColor("#fff1da"), borderPadding=9, spaceBefore=9, spaceAfter=13),
            "code": ParagraphStyle("code", parent=body, fontSize=8.5, leading=13, backColor=colors.HexColor("#f0f3f6"), borderPadding=9, spaceBefore=8, spaceAfter=13),
            "cover": ParagraphStyle("cover", parent=body, fontName="Manual-Bold", fontSize=39, leading=48, spaceAfter=15),
            "cover-sub": ParagraphStyle("cover-sub", parent=body, fontName="Manual-Bold", fontSize=22, leading=31, textColor=TEAL, spaceAfter=22),
            "label": ParagraphStyle("label", parent=body, fontSize=9, leading=15, textColor=TEAL, spaceAfter=16),
        }

    def inline(self, node):
        if isinstance(node, NavigableString):
            return escape(clean(node))
        if not isinstance(node, Tag):
            return ""
        content = "".join(self.inline(child) for child in node.children)
        if node.name in ("b", "strong"):
            return f"<b>{content}</b>"
        if node.name in ("i", "em"):
            return content
        if node.name == "code":
            return f'<font color="#005a59">{content}</font>'
        if node.name == "br":
            return "<br/>"
        if node.name == "a":
            href = node.get("href", "")
            if href == PRIVATE_RELEASE:
                href = PUBLIC_RELEASE
            if href.startswith(("https://", "http://", "#")):
                return f'<link href="{escape(href, {chr(34): "&quot;"})}" color="#006d70">{content}</link>'
        return content

    def paragraph(self, node, style="body", **kwargs):
        self.expected.append(clean(node.get_text("", strip=False)))
        return Paragraph(self.inline(node), self.styles[style], **kwargs)

    def blocks(self, node):
        if isinstance(node, NavigableString):
            return [Paragraph(escape(clean(node).strip()), self.styles["body"])] if str(node).strip() else []
        if not isinstance(node, Tag):
            return []
        classes = node.get("class", [])
        if node.name == "figure":
            image = node.find("img")
            relative = image["src"]
            path = (self.source / relative).resolve()
            if not path.is_relative_to(self.source):
                raise ValueError(f"Image outside manual folder: {relative}")
            with PILImage.open(path) as bitmap:
                width, height = bitmap.size
            section = node.find_parent("section", class_="manual-section")
            # Keep the two calibration dialogs and profile guidance on one page.
            max_scale = 0.60 if section and section.get("id") == "uv-keystone" else 0.70
            scale = min(BODY_WIDTH / width, 440 / height, max_scale)
            picture = LinkedImage(path, width * scale, height * scale, SITES[self.language] + relative)
            self.images.append(relative)
            caption = node.find("figcaption")
            picture.spaceBefore = 9
            caption_flow = self.paragraph(caption, "caption")
            caption_flow.spaceAfter = 10
            return [KeepTogether([picture, caption_flow])]
        if node.name == "table":
            rows = []
            for row in node.find_all("tr"):
                cells = row.find_all(["th", "td"], recursive=False)
                rows.append([self.paragraph(cell, "head" if cell.name == "th" else "cell") for cell in cells])
            columns = len(rows[0])
            widths = [BODY_WIDTH * .28, BODY_WIDTH * .72] if columns == 2 else [BODY_WIDTH / columns] * columns
            table = Table(rows, colWidths=widths, repeatRows=1, hAlign="LEFT", spaceBefore=8, spaceAfter=13)
            table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), INK),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f1f6f6")]),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 9), ("RIGHTPADDING", (0, 0), (-1, -1), 9),
                ("TOPPADDING", (0, 0), (-1, -1), 9), ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
                ("LINEBELOW", (0, 0), (-1, -1), .3, colors.HexColor("#d5e0e3")),
            ]))
            return [table]
        if node.name in ("ul", "ol"):
            result = []
            for index, item in enumerate(node.find_all("li", recursive=False), 1):
                bullet = f"{index}." if node.name == "ol" else "-"
                result.append(self.paragraph(item, "item", bulletText=bullet))
            return result
        if "tab-list" in classes:
            return []
        if "tab-panel" in classes:
            self.tab_ids.append(node["id"])
            label = self.soup.find(id=node["aria-labelledby"]).get_text()
            heading = Paragraph(escape(clean(label)), self.styles["sub"])
            heading.bookmark = node["id"]
            heading.outline_level = 1
            return [heading] + [flow for child in node.children for flow in self.blocks(child)]
        if "callout" in classes:
            return [self.paragraph(node, "warning" if "warn" in classes else "note")]
        if "badges" in classes:
            return [Paragraph(" / ".join(escape(span.get_text()) for span in node.find_all("span")), self.styles["label"])]
        if "hero-actions" in classes:
            return []
        if node.name == "pre":
            self.expected.append(clean(node.get_text()))
            return [KeepTogether([Paragraph(escape(clean(node.get_text())).replace("\n", "<br/>"), self.styles["code"])])]
        if node.name == "span" and node.get("id") and not node.get_text().strip():
            return [Paragraph(f'<a name="{escape(node["id"])}"/>', self.styles["body"])]
        if node.name in ("p", "h3", "h4"):
            style = "sub" if node.name.startswith("h") else "intro" if "section-intro" in classes else "body"
            return [self.paragraph(node, style)]
        if node.name in ("div", "section"):
            return [flow for child in node.children for flow in self.blocks(child)]
        raise ValueError(f"Unhandled manual element: {node.name}")

    def story(self):
        sections = self.soup.select(".manual-section")
        if len(sections) != 24 or self.soup.html.get("lang") != self.language:
            raise ValueError("Unexpected manual version, language, or section count")
        story = [Spacer(1, 48), Paragraph("PLANCK INC", self.styles["label"]),
                 HRFlowable(width="100%", thickness=3, color=TEAL), Spacer(1, 42),
                 Paragraph("MASKLESS<br/>LITHO", self.styles["cover"]),
                 Paragraph(self.t("운용 매뉴얼", "Operator Manual"), self.styles["cover-sub"]),
                 Paragraph(f"v{VERSION}  /  STANDARD EDITION", self.styles["label"]),
                 Paragraph(self.t("한글판", "English Edition") + f"  |  {self.date}", self.styles["intro"]),
                 Spacer(1, 34), Paragraph(self.t(
                     "설치부터 DLP 출력, 첫 LED 확인, UV Keystone, GDS, Draw CAD 및 문제 해결까지.",
                     "Installation, DLP output, first-projection confirmation, UV Keystone, GDS, Draw CAD, and troubleshooting."), self.styles["intro"]),
                 Spacer(1, 16), Paragraph(self.t(
                     "웹 매뉴얼의 24개 항목과 모든 탭을 수록한 오프라인 문서입니다. 화면 캡처는 UI 예시이며, 실제 UV 출력이나 광량을 검증한 결과가 아닙니다. 사용 전 안전 절차를 확인하십시오.",
                     "An offline edition containing all 24 web-manual sections and every tab. Screenshots illustrate the UI; they do not verify actual UV output or irradiance. Review the safety procedures before use."), self.styles["note"]),
                 Spacer(1, 12), Paragraph(f'<link href="{SITES[self.language]}" color="#006d70">' + self.t("최신 웹 매뉴얼", "Online manual") + '</link>  /  <link href="https://loveeuge.github.io/maskless-download-site/" color="#006d70">' + self.t("프로그램 다운로드", "Software downloads") + '</link>', self.styles["body"]),
                 Paragraph(self.t("목차와 문서 내 링크를 누르면 해당 항목으로 이동합니다. 화면 이미지를 누르면 온라인 원본 이미지를 엽니다.", "Use the contents and internal links to navigate. Select a screenshot to open its full-resolution online original."), self.styles["caption"]), PageBreak()]
        heading = Paragraph(self.t("목차", "Contents"), self.styles["title"])
        heading.bookmark = "contents"
        story.append(heading)
        toc = TableOfContents()
        toc.levelStyles = [ParagraphStyle("toc", fontName="Manual", fontSize=10, leading=14, leftIndent=0,
                                         firstLineIndent=0, spaceBefore=2, spaceAfter=0, textColor=INK)]
        story += [toc, PageBreak()]
        for index, section in enumerate(sections, 1):
            if index > 1:
                story.append(PageBreak())
            title = section.find("h2").get_text()
            heading = Paragraph(f"{index:02d}. {escape(clean(title))}", self.styles["title"])
            heading.bookmark = section["id"]
            heading.include_toc = True
            story.append(heading)
            self.expected.append(title)
            for child in section.children:
                if isinstance(child, Tag) and set(child.get("class", [])) & {"section-kicker", "section-title-row"}:
                    continue
                story.extend(self.blocks(child))
        if len(self.images) != len(self.soup.select(".manual-section img")):
            raise ValueError("Not all source images were included")
        if len(self.tab_ids) != len(self.soup.select(".manual-section .tab-panel")):
            raise ValueError("Not all hidden tabs were included")
        return story

    def build(self, output):
        output.parent.mkdir(parents=True, exist_ok=True)
        document = ManualDocument(output, self.language, self.date)
        story = self.story()
        needed = set("".join(self.expected)) - set("\n\r\t")
        missing_glyphs = sorted(char for char in needed if ord(char) not in pdfmetrics.getFont("Manual").face.charToGlyph)
        if missing_glyphs:
            raise ValueError(f"Font does not cover source characters: {missing_glyphs}")
        document.multiBuild(story)
        reader = PdfReader(output)
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
        normalized = compact(text)
        missing = [item for item in self.expected if compact(item) not in normalized]
        if missing:
            raise ValueError(f"PDF text coverage failed ({len(missing)} blocks): {missing[:3]}")
        if "\ufffd" in text or not all(page.extract_text() for page in reader.pages):
            raise ValueError("Blank page or invalid extracted glyph detected")
        report = {
            "file": str(output.resolve()), "language": self.language, "version": VERSION,
            "date": self.date, "source_site": SITES[self.language],
            "source_sha256": hashlib.sha256((self.source / "index.html").read_bytes()).hexdigest(),
            "sha256": hashlib.sha256(output.read_bytes()).hexdigest(), "bytes": output.stat().st_size,
            "pages": len(reader.pages), "sections": 24, "tabs": len(self.tab_ids),
            "figure_placements": len(self.images), "unique_figures": len(set(self.images)),
            "text_blocks_checked": len(self.expected), "missing_text_blocks": len(missing),
            "external_release_links": "Public download mirror; application source remains private",
        }
        output.with_suffix(".qa.json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ko-source", type=Path, required=True)
    parser.add_argument("--en-source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--date", required=True, help="Publication date, YYYY-MM-DD")
    parser.add_argument("--font-dir", type=Path, default=Path("C:/Windows/Fonts"))
    args = parser.parse_args()
    pdfmetrics.registerFont(TTFont("Manual", str(args.font_dir / "malgun.ttf")))
    pdfmetrics.registerFont(TTFont("Manual-Bold", str(args.font_dir / "malgunbd.ttf")))
    pdfmetrics.registerFontFamily("Manual", normal="Manual", bold="Manual-Bold", italic="Manual", boldItalic="Manual-Bold")
    reports = [Builder(source, language, args.date).build(args.output / f"MASKLESS_LITHO_v2_1_5_Manual_{language}.pdf")
               for language, source in (("ko", args.ko_source), ("en", args.en_source))]
    print(json.dumps(reports, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
