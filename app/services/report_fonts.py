"""Shared CJK font lookup for PDF report text and matplotlib trend charts."""

from pathlib import Path
from typing import List, Optional

CJK_NORMAL_FONT_PATHS: List[str] = [
    # Microsoft YaHei (Windows - ships with all modern versions)
    "C:/Windows/Fonts/msyh.ttc",
    "/mnt/c/Windows/Fonts/msyh.ttc",  # Windows fonts seen from WSL
    # Noto Sans CJK SC (Linux)
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/noto-cjk/NotoSansCJKsc-Regular.otf",
    "/usr/share/fonts/google-noto-cjk/NotoSansCJK-Regular.ttc",
    # PingFang SC (macOS)
    "/System/Library/Fonts/PingFang.ttc",
    "/Library/Fonts/PingFang.ttc",
]

CJK_BOLD_FONT_PATHS: List[str] = [
    "C:/Windows/Fonts/msyhbd.ttc",
    "/mnt/c/Windows/Fonts/msyhbd.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
    "/usr/share/fonts/noto-cjk/NotoSansCJKsc-Bold.otf",
    "/usr/share/fonts/google-noto-cjk/NotoSansCJK-Bold.ttc",
    "/System/Library/Fonts/PingFang.ttc",
    "/Library/Fonts/PingFang.ttc",
]

# CJK languages that need a dedicated CJK font to render.
CJK_LANGUAGES = frozenset({"zh", "ja", "ko"})


def find_cjk_font_path(bold: bool = False) -> Optional[str]:
    """Return the first installed CJK font file, or None if there is none."""
    paths = CJK_BOLD_FONT_PATHS if bold else CJK_NORMAL_FONT_PATHS
    return next((p for p in paths if Path(p).exists()), None)
