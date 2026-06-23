"""Generate a flat-design Pomodoro app icon set for Tauri.

Produces a flat tomato-red disc with a simple clock face, in all sizes
Tauri expects, into src-tauri/icons/.
"""
from PIL import Image, ImageDraw
import math
import os

ICONS_DIR = os.path.join(os.path.dirname(__file__), "src-tauri", "icons")
os.makedirs(ICONS_DIR, exist_ok=True)

BG = (255, 91, 91, 255)       # tomato red
DARK = (255, 255, 255, 255)   # white marks
SOFT = (255, 200, 200, 255)   # ring highlight


def draw_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pad = max(2, size // 16)
    # flat rounded square background
    d.rounded_rectangle([pad, pad, size - pad, size - pad], radius=size // 4, fill=BG)
    # clock ring
    cx = cy = size // 2
    r = int(size * 0.30)
    lw = max(2, size // 32)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=DARK, width=lw)
    # tick at 12 o'clock
    d.line([cx, cy - r + lw + 1, cx, cy - r + lw + size // 14], fill=DARK, width=lw)
    # hands — 10:10 pose
    def hand(angle_deg, length):
        a = math.radians(angle_deg - 90)
        return [cx, cy, cx + int(length * math.cos(a)), cy + int(length * math.sin(a))]
    d.line(hand(60, r * 0.55), fill=DARK, width=max(2, size // 40))
    d.line(hand(150, r * 0.45), fill=DARK, width=max(2, size // 40))
    d.ellipse([cx - lw, cy - lw, cx + lw, cy + lw], fill=DARK)
    return img


def save_png(img, path):
    img.save(path, "PNG")


def make_icns(pngs):
    """Build an .icns via iconutil (macOS)."""
    iconset = os.path.join(ICONS_DIR, "icon.iconset")
    os.makedirs(iconset, exist_ok=True)
    mapping = {
        "icon_16x16.png": (16, 1),
        "icon_16x16@2x.png": (16, 2),
        "icon_32x32.png": (32, 1),
        "icon_32x32@2x.png": (32, 2),
        "icon_128x128.png": (128, 1),
        "icon_128x128@2x.png": (128, 2),
    }
    for name, (base, scale) in mapping.items():
        draw_icon(base * scale).save(os.path.join(iconset, name), "PNG")
    import subprocess
    subprocess.run(
        ["iconutil", "-c", "icns", iconset, "-o", os.path.join(ICONS_DIR, "icon.icns")],
        check=True,
    )
    # leave the iconset pngs for any @2x needs, then remove the iconset dir
    for f in os.listdir(iconset):
        os.remove(os.path.join(iconset, f))
    os.rmdir(iconset)


def make_ico():
    """Build a multi-resolution .ico with PIL."""
    sizes = [16, 24, 32, 48, 64, 128, 256]
    imgs = [draw_icon(s) for s in sizes]
    imgs[0].save(
        os.path.join(ICONS_DIR, "icon.ico"),
        format="ICO",
        sizes=[(s, s) for s in sizes],
    )


if __name__ == "__main__":
    for name, px in [("32x32.png", 32), ("128x128.png", 128), ("128x128@2x.png", 256)]:
        save_png(draw_icon(px), os.path.join(ICONS_DIR, name))
    make_icns(None)
    make_ico()
    print("icons written to", ICONS_DIR)
    for f in sorted(os.listdir(ICONS_DIR)):
        print(" -", f)
