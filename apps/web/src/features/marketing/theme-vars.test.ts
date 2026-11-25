import { readFileSync } from "node:fs";
import path from "node:path";

import { resolveCreatorTheme } from "@linkyo/tokens/creator";
import { describe, expect, it } from "vitest";

import { CARD_VARS, FACE_VARS, pickVars } from "./theme-vars";
import { TRY_LOOKS } from "./try-looks";

const source = (file: string) => readFileSync(path.join(import.meta.dirname, file), "utf8");

/**
 * The theme variables a piece of markup reads: its `creator-*` utilities (bg-creator-bg reads
 * --creator-bg; rounded-creator-button --creator-radius-button; font-creator-display
 * --creator-font-display), its `var(--creator-*)`, and the halo utility (the accent and both glows).
 */
function variablesRead(code: string): Set<string> {
  const found = new Set<string>();
  for (const [, utility, name] of code.matchAll(/\b(bg|text|from|via|to|border|fill|stroke|font|rounded)-creator-([a-z0-9-]+)/g)) {
    if (!name) continue;
    found.add(utility === "rounded" ? `--creator-radius-${name}` : utility === "font" ? `--creator-font-${name}` : `--creator-${name}`);
  }
  for (const [, name] of code.matchAll(/var\(--creator-([a-z0-9-]+)\)/g)) found.add(`--creator-${String(name)}`);
  if (code.includes("poster-halo")) for (const name of ["--creator-accent", "--creator-glow-1", "--creator-glow-2"]) found.add(name);
  return found;
}

describe("the theme variables the home page's islands get (E-03, ADR 0008)", () => {
  it("picks the named variables of a theme, in the theme's order", () => {
    expect(pickVars({ "--a": "1", "--b": "2", "--c": "3" }, ["--c", "--a"])).toEqual({ "--a": "1", "--c": "3" });
  });

  it("gives a look's card every variable it reads (the card in playground.tsx)", () => {
    const playground = source("playground.tsx");
    // The card: its mini buttons, its display type and LookPreview itself (up to the next component).
    const card = playground.slice(playground.indexOf("const MINI_BUTTON"), playground.indexOf("function Chosen"));
    const read = variablesRead(card);
    expect(read.size).toBeGreaterThan(8);
    expect([...read].filter((name) => !(CARD_VARS as readonly string[]).includes(name))).toEqual([]);
    // Each look's theme defines every one of them.
    for (const { config } of TRY_LOOKS) {
      const vars = pickVars(resolveCreatorTheme(config).cssVars, CARD_VARS);
      expect(Object.keys(vars).sort()).toEqual([...CARD_VARS].sort());
    }
  });

  it("gives the story picture's font probes what they read (story-picture.tsx)", () => {
    const read = variablesRead(source("story-picture.tsx"));
    expect([...read].sort()).toEqual([...FACE_VARS].sort());
  });

  it("leaves the rest of a theme on the server", () => {
    const all = resolveCreatorTheme(TRY_LOOKS[0]?.config ?? {}).cssVars;
    expect(Object.keys(all).length).toBeGreaterThan(CARD_VARS.length);
  });
});
