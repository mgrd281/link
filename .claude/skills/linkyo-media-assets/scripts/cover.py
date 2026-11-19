"""Helpers for original cover art and photo prep (Pillow). Import from your own script:

    import sys; sys.path.insert(0, ".claude/skills/linkyo-media-assets/scripts")
    from cover import font, cover_crop, tint, vignette, spaced, lift_backdrop, contact_sheet

Fonts: the OFL faces bundled in ../fonts (Gloock, Big Shoulders, Work Sans, DM Mono) and the ones
the app already ships as WOFF in apps/web/node_modules/@fontsource (Instrument Serif, Anton, Lato).
"""
import os

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
BUNDLED = os.path.join(HERE, "..", "fonts")
FONTSOURCE = os.path.join("apps", "web", "node_modules", "@fontsource")
FACES = {
    "gloock": os.path.join(BUNDLED, "Gloock-Regular.ttf"),
    "big-shoulders": os.path.join(BUNDLED, "BigShoulders-Bold.ttf"),
    "work-sans": os.path.join(BUNDLED, "WorkSans-Regular.ttf"),
    "dm-mono": os.path.join(BUNDLED, "DMMono-Regular.ttf"),
    "instrument-serif": os.path.join(FONTSOURCE, "instrument-serif", "files", "instrument-serif-latin-400-normal.woff"),
    "instrument-serif-italic": os.path.join(FONTSOURCE, "instrument-serif", "files", "instrument-serif-latin-400-italic.woff"),
    "anton": os.path.join(FONTSOURCE, "anton", "files", "anton-latin-400-normal.woff"),
}


def font(face: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FACES[face], size)


def cover_crop(image: Image.Image, width: int, height: int, cx: float = 0.5, cy: float = 0.5) -> Image.Image:
    """Scale to cover width × height, keeping the point (cx, cy) of the picture in view."""
    scale = max(width / image.width, height / image.height)
    image = image.resize((round(image.width * scale), round(image.height * scale)), Image.LANCZOS)
    x = round((image.width - width) * cx)
    y = round((image.height - height) * cy)
    return image.crop((x, y, x + width, y + height))


def tint(image: Image.Image, dark: str, light: str) -> Image.Image:
    """Duotone: shadows to `dark`, highlights to `light` (hex colors chosen for the cover)."""
    return ImageOps.colorize(ImageOps.grayscale(image), dark, light)


def vignette(image: Image.Image, strength: float = 0.5) -> Image.Image:
    width, height = image.size
    mask = Image.new("L", (width, height), 0)
    ImageDraw.Draw(mask).ellipse((-width * 0.25, -height * 0.25, width * 1.25, height * 1.25), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(width * 0.18))
    dark = Image.blend(image, Image.new("RGB", image.size, (0, 0, 0)), strength)
    return Image.composite(image, dark, mask)


def spaced(draw: ImageDraw.ImageDraw, xy, text: str, face, fill, tracking: int, anchor: str = "la"):
    """Letter-spaced text; anchor "la" (left), "ma" (centre) or "ra" (right)."""
    widths = [draw.textlength(char, font=face) for char in text]
    total = sum(widths) + tracking * (len(text) - 1)
    x, y = xy
    if anchor == "ma":
        x -= total / 2
    elif anchor == "ra":
        x -= total
    for char, width in zip(text, widths):
        draw.text((x, y), char, font=face, fill=fill)
        x += width + tracking


def lift_backdrop(image: Image.Image, keep_below: int = 140, gamma: float = 0.6) -> Image.Image:
    """Turns a grey studio backdrop white (so a portrait melts into a white page); darker tones stay."""
    def curve(value: int) -> int:
        if value <= keep_below:
            return value
        t = (value - keep_below) / (255 - keep_below)
        return round(keep_below + (255 - keep_below) * t**gamma)

    return image.point([curve(v) for v in range(256)] * len(image.getbands()))


def contact_sheet(paths, out: str, height: int = 400, gap: int = 8):
    """Side by side at one height, to review several pictures in a single image."""
    images = [Image.open(path).convert("RGB") for path in paths]
    images = [image.resize((round(image.width * height / image.height), height)) for image in images]
    sheet = Image.new("RGB", (sum(i.width for i in images) + gap * (len(images) - 1), height), "#888")
    x = 0
    for image in images:
        sheet.paste(image, (x, 0))
        x += image.width + gap
    sheet.save(out)
    return out


__all__ = ["font", "cover_crop", "tint", "vignette", "spaced", "lift_backdrop", "contact_sheet", "ImageEnhance"]
