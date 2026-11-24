/**
 * The team area stays teal (CLAUDE.md, ADR 0062): only the creator dashboard is black and grey, and it
 * gets that palette from `data-console`. The shared UI kit goes into both shells, so this reverse guard
 * keeps the marker out of the team console and out of the kit (critique 32). The dashboard's own rules
 * are in features/app/console-guard.test.ts.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const SRC = path.resolve(import.meta.dirname, "../..");
const UI = path.resolve(SRC, "../../../packages/ui/src");

/** Every .ts and .tsx file under a folder (tests included: a test that renders the marker is a smell too). */
function files(root: string): string[] {
  return readdirSync(root, { recursive: true, encoding: "utf8" })
    .filter((file) => /\.(ts|tsx)$/.test(file))
    .map((file) => path.join(root, file));
}

/** Lines that set the marker: an attribute, a prop, a selector or a dataset key. */
function markers(file: string): string[] {
  return readFileSync(file, "utf8")
    .split("\n")
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => /data-console|dataset\.console|\bconsole\s*:\s*["'](frame|local)["']/.test(line))
    .map(({ line, index }) => `${path.relative(SRC, file)}:${String(index + 1)}: ${line.trim()}`);
}

describe("the team area stays teal", () => {
  const roots = [path.join(SRC, "features/admin"), path.join(SRC, "app/[locale]/admin")];

  it("reads real folders (the guard would pass on nothing)", () => {
    for (const root of roots) expect(files(root).length, root).toBeGreaterThan(0);
    expect(files(UI).length).toBeGreaterThan(0);
  });

  it("never sets data-console under features/admin or app/[locale]/admin", () => {
    expect(roots.flatMap((root) => files(root).flatMap(markers))).toEqual([]);
  });

  it("keeps the marker out of the shared UI kit, which both shells use", () => {
    expect(files(UI).flatMap(markers)).toEqual([]);
  });

  it("catches the marker in every form it takes", () => {
    const probe = (text: string) => /data-console|dataset\.console|\bconsole\s*:\s*["'](frame|local)["']/.test(text);
    expect(probe('<div data-console="frame">')).toBe(true);
    expect(probe('{ "data-console": "local" }')).toBe(true);
    expect(probe("root.dataset.console = 'frame'")).toBe(true);
    expect(probe("console.warn('x')")).toBe(false);
  });
});
