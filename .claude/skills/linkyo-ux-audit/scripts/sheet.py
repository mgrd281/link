"""Contact sheets for a journey capture: python3 sheet.py <out-dir>  →  <out-dir>/sheet-*.png"""
import glob
import os
import sys

from PIL import Image

out = sys.argv[1]
shots = sorted(f for f in glob.glob(os.path.join(out, "*.png")) if "-full" not in f and "/sheet-" not in f)
groups = {}
for path in shots:
    name = os.path.basename(path)
    mode = "mobile" if "-mobile-" in name else "desktop"
    key = name.split(f"-{mode}-")[0] + "-" + mode
    groups.setdefault(key, []).append(path)

for key, files in groups.items():
    mobile = key.endswith("mobile")
    w, h = (390, 844) if mobile else (720, 450)
    cols = 4 if mobile else 2
    per = 8 if mobile else 6
    for start in range(0, len(files), per):
        batch = files[start : start + per]
        rows = (len(batch) + cols - 1) // cols
        sheet = Image.new("RGB", (cols * (w + 8), rows * (h + 8)), "#888")
        for i, path in enumerate(batch):
            image = Image.open(path).convert("RGB")
            image = image.crop((0, 0, 390, 844)) if mobile else image.crop((0, 0, 1440, 900)).resize((w, h))
            sheet.paste(image, ((i % cols) * (w + 8), (i // cols) * (h + 8)))
        target = os.path.join(out, f"sheet-{key}-{start // per + 1}.png")
        sheet.save(target)
        print(target)
