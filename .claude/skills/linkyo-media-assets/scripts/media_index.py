"""Rebuilds apps/web/src/features/examples/media.ts from the files in src/assets/examples.
Run from the repo root after adding or removing an example picture: python3 <this file>"""
import glob
import os

root = os.path.join("apps", "web")
assets = os.path.join(root, "src", "assets", "examples")
files = sorted(os.path.basename(path) for path in glob.glob(os.path.join(assets, "ex*-*")) if not path.endswith(".md"))


def ident(name: str) -> str:
    base = name.rsplit(".", 1)[0]
    head, rest = base.split("-", 1)
    return head + "".join(part.capitalize() for part in rest.split("-"))


lines = ['import type { StaticImageData } from "next/image";', ""]
lines += [f'import {ident(name)} from "@/assets/examples/{name}";' for name in files]
lines += [
    "",
    "/** Pictures of the example gallery (stock photos, see assets/examples/CREDITS.md; logos are original). */",
    "export const exampleMedia = {",
]
lines += [f'  "sample:{name.rsplit(".", 1)[0]}": {ident(name)},' for name in files]
lines += ["} satisfies Record<string, StaticImageData>;", ""]
with open(os.path.join(root, "src", "features", "examples", "media.ts"), "w") as out:
    out.write("\n".join(lines))
print(len(files), "pictures")
