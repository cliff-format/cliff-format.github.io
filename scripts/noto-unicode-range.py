"""Rewrite the Noto Sans SC unicode-range from its committed subset.

The fallback file is only useful for glyphs it actually contains. Keeping the
range exact stops a missing Japanese glyph from downloading the whole font just
to discover that the font cannot draw it.

Usage:
    python scripts/noto-unicode-range.py

Requires fontTools. Run after replacing NotoSansSC-subset.woff2.
"""

from __future__ import annotations

import pathlib

from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
FONT = ROOT / "public" / "fonts" / "NotoSansSC-subset.woff2"
STYLES = ROOT / "src" / "styles" / "tokens.css"


def ranges(font: TTFont) -> str:
    """Return a compact CSS unicode-range for the non-ASCII cmap entries."""
    codes = sorted(code for code in font.getBestCmap() if code >= 0x80)
    if not codes:
        raise RuntimeError(f"{FONT} has no non-ASCII glyphs")
    spans: list[tuple[int, int]] = []
    start = previous = codes[0]
    for code in codes[1:]:
        if code == previous + 1:
            previous = code
            continue
        spans.append((start, previous))
        start = previous = code
    spans.append((start, previous))
    return ",".join(f"U+{a:X}" if a == b else f"U+{a:X}-{b:X}" for a, b in spans)


def main() -> int:
    """Replace the range in tokens.css and report the result."""
    text = ranges(TTFont(FONT))
    css = STYLES.read_text(encoding="utf-8")
    family = css.index('font-family: "Noto Sans SC"')
    start = css.index("unicode-range:", family)
    end = css.index(";", start)
    STYLES.write_text(css[:start] + "unicode-range: " + text + css[end:], encoding="utf-8")
    print(f"{FONT.name}: {text.count('U+')} ranges, {len(text)} characters")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
