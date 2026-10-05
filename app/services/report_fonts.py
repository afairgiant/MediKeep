"""Shared non-Latin font lookup for PDF report text and matplotlib trend charts."""

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

THAI_NORMAL_FONT_PATHS: List[str] = [
    # Noto Sans Thai (Linux: fonts-noto-core)
    "/usr/share/fonts/truetype/noto/NotoSansThai-Regular.ttf",
    "/usr/share/fonts/noto/NotoSansThai-Regular.ttf",
    # Thai TLWG (Linux: fonts-thai-tlwg)
    "/usr/share/fonts/truetype/tlwg/Loma.ttf",
    # Leelawadee UI (Windows 8+)
    "C:/Windows/Fonts/LeelawUI.ttf",
    "/mnt/c/Windows/Fonts/LeelawUI.ttf",
    # Tahoma (Windows)
    "C:/Windows/Fonts/tahoma.ttf",
    "/mnt/c/Windows/Fonts/tahoma.ttf",
    # Thonburi (macOS)
    "/System/Library/Fonts/Supplemental/Thonburi.ttc",
    "/System/Library/Fonts/Thonburi.ttc",
]

THAI_BOLD_FONT_PATHS: List[str] = [
    "/usr/share/fonts/truetype/noto/NotoSansThai-Bold.ttf",
    "/usr/share/fonts/noto/NotoSansThai-Bold.ttf",
    "/usr/share/fonts/truetype/tlwg/Loma-Bold.ttf",
    "C:/Windows/Fonts/LeelaUIb.ttf",
    "/mnt/c/Windows/Fonts/LeelaUIb.ttf",
    "C:/Windows/Fonts/tahomabd.ttf",
    "/mnt/c/Windows/Fonts/tahomabd.ttf",
    "/System/Library/Fonts/Supplemental/Thonburi.ttc",
    "/System/Library/Fonts/Thonburi.ttc",
]

# CJK languages that need a dedicated CJK font to render.
CJK_LANGUAGES = frozenset({"zh", "ja", "ko"})

# Thai needs its own font: DejaVu/Arial have no Thai glyphs.
THAI_LANGUAGES = frozenset({"th"})

# Every language whose script the default Latin/Cyrillic/Greek font cannot render.
DEDICATED_FONT_LANGUAGES = CJK_LANGUAGES | THAI_LANGUAGES


def find_cjk_font_path(bold: bool = False) -> Optional[str]:
    """Return the first installed CJK font file, or None if there is none."""
    paths = CJK_BOLD_FONT_PATHS if bold else CJK_NORMAL_FONT_PATHS
    return next((p for p in paths if Path(p).exists()), None)


def find_thai_font_path(bold: bool = False) -> Optional[str]:
    """Return the first installed Thai font file, or None if there is none."""
    paths = THAI_BOLD_FONT_PATHS if bold else THAI_NORMAL_FONT_PATHS
    return next((p for p in paths if Path(p).exists()), None)


def find_dedicated_font_path(language: str, bold: bool = False) -> Optional[str]:
    """Return the font file for a language needing a dedicated font, else None."""
    if language in CJK_LANGUAGES:
        return find_cjk_font_path(bold)
    if language in THAI_LANGUAGES:
        return find_thai_font_path(bold)
    return None
