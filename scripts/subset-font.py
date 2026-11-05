"""Subset Smiley Sans (得意黑) to the glyphs the site actually sets.

The page copy is Chinese, and the full family is ~1.1 MB WOFF2. This script
collects every character that appears in `src/` (plus printable ASCII, CJK
punctuation, and a few symbols the copy uses) and writes a small WOFF2 the site
can preload.

Usage:
    python scripts/subset-font.py path/to/SmileySans-Oblique.ttf.woff2

Requires fontTools and brotli:
    python -m pip install fonttools brotli

Re-run it whenever new copy introduces characters outside the current set. The
output is committed, so builds do not need Python.
"""

from __future__ import annotations

import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = ROOT / "src"
OUTPUT = ROOT / "public" / "fonts" / "SmileySans-subset.woff2"

# Characters that never appear in source text but must survive whitespace
# handling in HTML, plus the symbols the copy and the code sample use.
EXTRA = "".join(
    [
        "".join(chr(code) for code in range(0x20, 0x7F)),  # printable ASCII
        "\u00a9\u00b7\u00d7\u2013\u2014\u2018\u2019\u201c\u201d\u2026\u2192",
        "\u3000\u3001\u3002\u3008\u3009\u300a\u300b\u300c\u300d\u300e\u300f",
        "\uff01\uff08\uff09\uff0c\uff1a\uff1b\uff1f\uff5e",
    ]
)


def source_text() -> str:
    """Return every character in the site sources.

    Returns:
        A string of the concatenated text of the Astro, TypeScript, and CSS
        files under `src/`.
    """
    # ".cliff" matters: the site's copy lives in the locale documents.
    suffixes = {".astro", ".ts", ".css", ".md", ".mdx", ".svg", ".cliff"}
    chunks: list[str] = []
    for path in sorted(SOURCE.rglob("*")):
        if path.suffix in suffixes and path.is_file():
            chunks.append(path.read_text(encoding="utf-8"))
    return "".join(chunks)


def main() -> int:
    """Write the subset font and report the glyph count."""
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    source = pathlib.Path(sys.argv[1])
    glyphs = "".join(dict.fromkeys(source_text() + EXTRA))
    text_file = ROOT / "public" / "fonts" / ".subset-chars.txt"
    text_file.write_text(glyphs, encoding="utf-8")
    try:
        subprocess.run(
            [
                sys.executable,
                "-m",
                "fontTools.subset",
                str(source),
                f"--text-file={text_file}",
                "--flavor=woff2",
                "--layout-features=kern,liga,calt",
                "--no-hinting",
                "--desubroutinize",
                f"--output-file={OUTPUT}",
            ],
            check=True,
        )
    finally:
        text_file.unlink(missing_ok=True)
    unique = len(dict.fromkeys(glyphs))
    print(f"{OUTPUT.name}: {unique} characters, {OUTPUT.stat().st_size / 1024:.1f} KB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
