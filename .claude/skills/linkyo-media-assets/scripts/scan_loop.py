"""
Original motion graphic for Sevag's application page, made from a licensed photo
("A large empty warehouse" by Krisana Nakajo, Unsplash License).

A 7 s seamless loop at 4:5:
  - a cool, calm grade (the red-orange beams quieted, shadows a touch blue);
  - a slow breathing camera move into the aisle (periodic, so the loop has no seam);
  - an inventory scan: a blue beam crosses the racks top to bottom;
  - corner marks lock onto the aisle signs J and K, each confirmed with a dot, then let go.
Frame 0 carries no overlay, so the still poster equals the first frame. No text in the video.

usage: python3 -I render.py <photo.jpg> <out_dir>
"""
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SRC, OUT = Path(sys.argv[1]), Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)
(OUT / "frames").mkdir(exist_ok=True)

W, H = 1080, 1350          # output, 4:5
FPS, SECONDS = 30, 7
N = FPS * SECONDS
CROP = (250, 0, 1450, 1500)  # 4:5 window of the 2000 x 1500 photo; J and K stay inside the centre 78 % (phones crop the sides)
BLUE = (77, 141, 255)
WHITE = (255, 255, 255)

# Sign boxes in photo coordinates (measured on a grid).
SIGNS = {
    "J": (430, 430, 700, 690),
    "K": (804, 480, 980, 690),
}


def grade(img: Image.Image) -> Image.Image:
    """Cool, calm grade: quiet the warm hues, deepen contrast a little, blue in the shadows."""
    a = np.asarray(img.convert("RGB")).astype(np.float32) / 255.0
    hsv = np.asarray(img.convert("HSV")).astype(np.float32)
    h, s = hsv[..., 0] * 360 / 255, hsv[..., 1] / 255
    warm = np.clip(1 - np.minimum(np.abs(h - 10), np.abs(h - 370)) / 35, 0, 1)  # reds and oranges
    lum = (0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2])[..., None]
    keep = 1 - 0.8 * warm[..., None] * np.clip(s[..., None] * 1.4, 0, 1)
    a = lum + (a - lum) * keep                                            # desaturate warm only
    a = a * 0.92 + lum * 0.08                                             # a touch calmer overall
    a = np.clip((a - 0.5) * 1.08 + 0.5, 0, 1)                             # contrast
    shadow = np.clip(1 - lum * 1.6, 0, 1)
    a = a + shadow * np.array([-0.012, 0.004, 0.03])                      # blue in the shadows
    return Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))


def ease(t: float) -> float:
    t = min(max(t, 0.0), 1.0)
    return t * t * (3 - 2 * t)


def window(t: float, a: float, b: float, fade: float) -> float:
    """1 inside [a, b], easing in and out over `fade` seconds, 0 outside."""
    return ease((t - a) / fade) * (1 - ease((t - (b - fade)) / fade))


base = grade(Image.open(SRC)).crop(CROP)  # 1200 x 1500
BW, BH = base.size
scale0 = W / BW


def camera(t: float):
    """Periodic breathing push toward the K/L area: zoom 1.00 → 1.075 → 1.00 over the loop."""
    p = (1 - math.cos(2 * math.pi * t / SECONDS)) / 2
    zoom = 1 + 0.075 * p
    fx, fy = 620, 620                                  # focus point in crop coordinates (between K and the aisle)
    dx = 18 * math.sin(2 * math.pi * t / SECONDS)       # slight lateral drift
    return zoom, fx, fy, dx


def to_screen(x: float, y: float, cam) -> tuple[float, float]:
    zoom, fx, fy, dx = cam
    cx, cy = x - CROP[0], y - CROP[1]
    sx = (fx + (cx - fx) * zoom + dx) * scale0
    sy = (fy + (cy - fy) * zoom) * scale0
    return sx, sy


def frame(i: int) -> Image.Image:
    t = i / FPS
    cam = camera(t)
    zoom, fx, fy, dx = cam
    # Inverse affine: output pixel → crop pixel.
    a = 1 / (zoom * scale0)
    c = fx - (fx + dx) / zoom
    f = fy - fy / zoom
    img = base.transform((W, H), Image.Transform.AFFINE, (a, 0, c, 0, a, f), resample=Image.Resampling.BICUBIC)

    glow = Image.new("RGB", (W, H), (0, 0, 0))
    g = ImageDraw.Draw(glow)
    sharp = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(sharp)

    # Inventory scan: the beam crosses from above the racks to the floor between 0.9 s and 3.3 s.
    beam = window(t, 0.9, 3.3, 0.45)
    if beam > 0:
        y = -40 + ease((t - 0.9) / 2.4) * (H * 0.78)
        g.rectangle([0, y - 26, W, y + 26], fill=tuple(int(v * 0.55 * beam) for v in BLUE))
        g.rectangle([0, y - 120, W, y - 26], fill=tuple(int(v * 0.10 * beam) for v in BLUE))
        d.rectangle([0, y - 1.5, W, y + 1.5], fill=(*[min(255, v + 90) for v in BLUE], int(235 * beam)))

    # Corner marks lock onto the signs one after the other, then let go.
    for key, start in (("J", 2.7), ("K", 3.2)):
        on = window(t, start, 6.3 + (start - 2.7) * 0.3, 0.35)
        if on <= 0:
            continue
        lock = ease((t - start) / 0.45)
        x0, y0, x1, y1 = SIGNS[key]
        (sx0, sy0), (sx1, sy1) = to_screen(x0, y0, cam), to_screen(x1, y1, cam)
        pad = 10 + 28 * (1 - lock)
        sx0, sy0, sx1, sy1 = sx0 - pad, sy0 - pad, sx1 + pad, sy1 + pad
        arm = max(14, min(sx1 - sx0, sy1 - sy0) * 0.22)
        alpha = int(255 * on)
        w = 4
        for (cx, cy, hx, vy) in ((sx0, sy0, 1, 1), (sx1, sy0, -1, 1), (sx0, sy1, 1, -1), (sx1, sy1, -1, -1)):
            d.line([(cx, cy), (cx + hx * arm, cy)], fill=(*WHITE, alpha), width=w)
            d.line([(cx, cy), (cx, cy + vy * arm)], fill=(*WHITE, alpha), width=w)
        # Confirmed: a blue dot at the top end corner once locked.
        done = ease((t - start - 0.45) / 0.25) * on
        if done > 0:
            r = 7 + 3 * (1 - done)
            g.ellipse([sx1 - r * 2.4, sy0 - r * 2.4, sx1 + r * 2.4, sy0 + r * 2.4], fill=tuple(int(v * 0.6 * done) for v in BLUE))
            d.ellipse([sx1 - r, sy0 - r, sx1 + r, sy0 + r], fill=(*BLUE, int(255 * done)))

    glow = glow.filter(ImageFilter.GaussianBlur(18))
    out = Image.fromarray(np.clip(np.asarray(img, np.int16) + np.asarray(glow, np.int16), 0, 255).astype(np.uint8))
    out.paste(sharp, (0, 0), sharp)
    return out


for i in range(N):
    frame(i).save(OUT / "frames" / f"{i:04d}.png", compress_level=1)
# The still: frame 0 (no overlays), for the poster and for reduced motion.
frame(0).save(OUT / "still.jpg", "JPEG", quality=88, progressive=True, optimize=True)
print("frames", N)
