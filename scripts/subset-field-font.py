"""Build the fixed-cell OFL font for the decorative background.

One merged Noto Sans family covers every glyph in the field: Noto Sans KR
supplies Latin, Cyrillic, CJK, kana, and Hangul; Noto Sans supplies the four
Latin Extended glyphs the KR file lacks. The result is renamed Field Sans and
given a fixed 1em advance, so plain text keeps the 1.636em grid without spans.

Usage:
    python scripts/subset-field-font.py

Requires fontTools and brotli. Sources live in ../.tools/noto:
NotoSansKR-VF.ttf and NotoSans-Regular.ttf. The generated WOFF2 is committed,
so builds do not need Python.
"""

from __future__ import annotations

import argparse
import pathlib
import re

from fontTools.fontBuilder import FontBuilder
from fontTools.misc.timeTools import timestampNow
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
FIELD_SOURCE = ROOT / "src" / "components" / "BackgroundText.astro"
OUTPUT = ROOT / "public" / "fonts" / "FieldSans.woff2"
DEFAULT_KR = ROOT.parent / ".tools" / "noto" / "NotoSansKR-VF.ttf"
DEFAULT_LATIN = ROOT.parent / ".tools" / "noto" / "NotoSans-Regular.ttf"

TARGET_WIDTH = 0.86
TARGET_HEIGHT = 0.78
MAX_SCALE = 1.6


def field_chars() -> str:
    """Return the unique characters the background can draw."""
    source = FIELD_SOURCE.read_text(encoding="utf-8")
    match = re.search(r"const GLYPHS = \[(.*?)\];", source, re.S)
    if not match:
        raise RuntimeError(f"GLYPHS array not found in {FIELD_SOURCE}")
    chunks = re.findall(r'"([^"]*)"', match.group(1))
    if not chunks:
        raise RuntimeError("GLYPHS array contains no string literals")
    return "".join(dict.fromkeys("".join(chunks)))


def _scale_and_center(bounds: tuple[float, float, float, float], upm: int) -> tuple[float, float, float]:
    x_min, y_min, x_max, y_max = bounds
    width = x_max - x_min
    height = y_max - y_min
    if width <= 0 or height <= 0:
        raise ValueError("glyph has no ink")
    scale = min((TARGET_WIDTH * upm) / width, (TARGET_HEIGHT * upm) / height, MAX_SCALE)
    dx = upm / 2 - (x_min + width / 2) * scale
    dy = 0 - (y_min + height / 2) * scale
    return scale, dx, dy


def build(chars: str, kr_source: pathlib.Path, latin_source: pathlib.Path) -> int:
    """Build one fixed-cell TTF/WOFF2 and return the glyph count."""
    kr = TTFont(kr_source)
    if "fvar" in kr:
        kr = instantiateVariableFont(kr, {"wght": 400}, inplace=False)
    latin = TTFont(latin_source)
    sources = [("Noto Sans KR", kr), ("Noto Sans", latin)]

    upm = 1000
    glyphs: dict[str, object] = {}
    metrics: dict[str, tuple[int, int]] = {}
    cmap: dict[int, str] = {}
    order: list[str] = [".notdef"]
    for char in chars:
        code = ord(char)
        for label, font in sources:
            font_cmap = font.getBestCmap()
            if code not in font_cmap:
                continue
            name = f"uni{code:04X}"
            glyph_set = font.getGlyphSet()
            glyph_name = font_cmap[code]
            bounds_pen = BoundsPen(glyph_set)
            glyph_set[glyph_name].draw(bounds_pen)
            if not bounds_pen.bounds:
                raise RuntimeError(f"{label} U+{code:04X} has no ink")
            scale, dx, dy = _scale_and_center(bounds_pen.bounds, upm)
            recording = DecomposingRecordingPen(glyph_set)
            glyph_set[glyph_name].draw(recording)
            pen = TTGlyphPen(None)
            recording.replay(TransformPen(pen, (scale, 0, 0, scale, dx, dy)))
            glyphs[name] = pen.glyph()
            x_min = bounds_pen.bounds[0]
            metrics[name] = (upm, round(x_min * scale + dx))
            cmap[code] = name
            order.append(name)
            break
        else:
            raise RuntimeError(f"U+{code:04X} is missing from both source fonts")

    builder = FontBuilder(upm, isTTF=True)
    builder.setupGlyphOrder(order)
    builder.setupCharacterMap(cmap)
    builder.setupGlyf({".notdef": TTGlyphPen(None).glyph(), **glyphs})
    builder.setupHorizontalMetrics({".notdef": (upm, 0), **metrics})
    builder.setupHorizontalHeader(ascent=575, descent=-575, lineGap=0)
    builder.setupNameTable(
        {
            "familyName": "Field Sans",
            "styleName": "Regular",
            "uniqueFontIdentifier": "Field Sans Regular",
            "fullName": "Field Sans Regular",
            "psName": "FieldSans-Regular",
            "version": "Version 1.000",
            "copyright": "Derived from Noto Sans and Noto Sans KR; SIL OFL 1.1.",
        }
    )
    builder.setupOS2(
        sTypoAscender=575,
        sTypoDescender=-575,
        sTypoLineGap=0,
        usWinAscent=575,
        usWinDescent=575,
        usWeightClass=400,
        usWidthClass=5,
        fsSelection=0x40,
        fsType=0,
        sxHeight=500,
        sCapHeight=700,
        achVendID="NONE",
    )
    builder.setupPost(italicAngle=0, underlinePosition=-100, underlineThickness=50, isFixedPitch=0)
    builder.setupMaxp()
    builder.setupHead(
        unitsPerEm=upm,
        xMin=0,
        yMin=-575,
        xMax=upm,
        yMax=575,
        macStyle=0,
        created=timestampNow(),
        modified=timestampNow(),
    )
    builder.font.flavor = "woff2"
    builder.save(OUTPUT)

    check = TTFont(OUTPUT)
    missing = [char for char in chars if ord(char) not in check.getBestCmap()]
    if missing:
        raise RuntimeError(f"generated font is missing: {''.join(missing)}")
    advances = {advance for advance, _ in check["hmtx"].metrics.values()}
    if advances != {upm}:
        raise RuntimeError(f"generated font has non-cell advances: {advances}")
    count = len(order) - 1
    check.close()
    return count


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--kr-source", type=pathlib.Path, default=DEFAULT_KR)
    parser.add_argument("--latin-source", type=pathlib.Path, default=DEFAULT_LATIN)
    args = parser.parse_args()
    for source in (args.kr_source, args.latin_source):
        if not source.exists():
            raise FileNotFoundError(f"font source not found: {source}")

    chars = field_chars()
    count = build(chars, args.kr_source, args.latin_source)
    print(f"{OUTPUT.name}: {count} glyphs, {OUTPUT.stat().st_size / 1024:.1f} KB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
