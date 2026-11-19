"""Prints the inked word segments per row of rtl-probe.png: python3 rtl-measure.py [rtl-probe.png]"""
import sys

from PIL import Image

image = Image.open(sys.argv[1] if len(sys.argv) > 1 else "rtl-probe.png").convert("L")
width, height = image.size
for row, top in enumerate(range(20, height - 20, 100)):
    columns = [any(image.getpixel((x, y)) > 128 for y in range(top, min(top + 90, height), 2)) for x in range(width)]
    segments, start = [], None
    for x, inked in enumerate(columns + [False]):
        if inked and start is None:
            start = x
        if not inked and start is not None:
            if segments and start - segments[-1][1] < 8:
                segments[-1][1] = x
            else:
                segments.append([start, x])
            start = None
    print(f"row {row}: " + "  ".join(f"x={a} w={b - a}" for a, b in segments))
