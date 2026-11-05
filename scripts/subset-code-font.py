"""Build the static 400-weight code font.

The page never sets a weight other than 400 in JetBrains Mono, and the code
samples are ASCII apart from CJK strings that already fall back to Smiley Sans.
Instancing the variable font and subsetting to ASCII drops the preload from
40 KB to about 5 KB.

Usage:
    python scripts/subset-code-font.py

Requires fontTools and brotli. The generated WOFF2 is committed.
"""

from __future__ import annotations

import pathlib
import subprocess
import sys
import tempfile

from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = ROOT / "public" / "fonts" / "JetBrainsMono-100-800.woff2"
OUTPUT = ROOT / "public" / "fonts" / "JetBrainsMono-400.woff2"

# Printable ASCII plus the punctuation the code samples and labels use.
CHARS = "".join(chr(code) for code in range(0x20, 0x7F)) + "→←↑↓✓•…—–‘’“”·×"


def main() -> int:
    """Instance weight 400, subset to the code character set, and report size."""
    font = TTFont(SOURCE)
    if "fvar" not in font:
        raise RuntimeError(f"{SOURCE} is not a variable font")
    font = instantiateVariableFont(font, {"wght": 400}, inplace=False)
    font["OS/2"].usWeightClass = 400
    with tempfile.TemporaryDirectory(prefix="cliff-code-") as temp:
        full = pathlib.Path(temp) / "JetBrainsMono-400.woff2"
        font.flavor = "woff2"
        font.save(full)
        with tempfile.NamedTemporaryFile("w", suffix=".txt", encoding="utf-8", delete=False) as handle:
            handle.write(CHARS)
            text_path = pathlib.Path(handle.name)
        try:
            subprocess.run(
                [
                    sys.executable,
                    "-m",
                    "fontTools.subset",
                    str(full),
                    f"--text-file={text_path}",
                    "--layout-features=",
                    "--no-hinting",
                    "--desubroutinize",
                    f"--output-file={OUTPUT}",
                ],
                check=True,
            )
        finally:
            text_path.unlink(missing_ok=True)

    print(f"{OUTPUT.name}: {len(set(CHARS))} characters, {OUTPUT.stat().st_size / 1024:.1f} KB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
