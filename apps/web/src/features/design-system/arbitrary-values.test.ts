/**
 * Arbitrary values that name a token with an underscore (`--spacing-0_5`) must reach the CSS with it.
 * Tailwind reads `_` in an arbitrary value as a space, except in the first argument of a `var()` it
 * recognises as one; a `var()` straight after an operator (`/2+var(--spacing-0_5)`) is not recognised,
 * so the name became `--spacing-0 5`, the minifier dropped the rule, and Laufbahn's career dots hung
 * beside their rail (round 6 review). This guard compiles every such class in the app and the UI kit
 * with Tailwind itself and fails when a token name loses its underscore.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { compile } from "tailwindcss";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(import.meta.dirname, "../..");
const UI = path.resolve(SRC, "../../../packages/ui/src");

/** Every .ts and .tsx file under a folder, tests left out (their strings are probes, not classes). */
function files(root: string): string[] {
  return readdirSync(root, { recursive: true, encoding: "utf8" })
    .filter((file) => /\.(ts|tsx)$/.test(file) && !/\.test\.tsx?$/.test(file))
    .map((file) => path.join(root, file));
}

/** A token name with an underscore inside a `var()`. */
const UNDERSCORED = /var\(--[\w\\-]*_[\w\\-]*/u;

/** The classes of a source text that hold an arbitrary value naming an underscored token. */
function candidates(source: string): string[] {
  return [...source.matchAll(/[^\s"'`{}]*\[[^\s"'`\]]+\][^\s"'`{}]*/gu)].map((match) => match[0]).filter((name) => UNDERSCORED.test(name));
}

/** The utility of a class: what follows its last variant (a `:` outside brackets and parentheses). */
function utilityOf(name: string): string {
  let depth = 0;
  let start = 0;
  for (let index = 0; index < name.length; index += 1) {
    const char = name[index];
    if (char === "[" || char === "(") depth += 1;
    else if (char === "]" || char === ")") depth -= 1;
    else if (char === ":" && depth === 0) start = index + 1;
  }
  return name.slice(start).replace(/^!/u, "");
}

/** The token names a class means (`--spacing-0_5`), as Tailwind should write them. */
const namesIn = (name: string): string[] => [...name.matchAll(/var\((--[\w\\-]+)/gu)].map((match) => (match[1] ?? "").replaceAll("\\_", "_")).filter((token) => token.includes("_"));

/** The classes whose CSS lost a token's underscore (or that produced no CSS at all). */
async function broken(names: readonly string[]): Promise<string[]> {
  const built = await Promise.all(
    names.map(async (name) => {
      // A compiler of its own for each class: a compiler's build returns every class it has seen so far.
      const compiler = await compile("@tailwind utilities;", { base: SRC });
      return { name, css: compiler.build([utilityOf(name)]) };
    }),
  );
  return built.flatMap(({ name, css }) => {
    // The declarations only: the selector repeats the class, underscore and all.
    const declarations = [...css.matchAll(/\{([^{}]*)\}/gu)].map((match) => match[1] ?? "").join("\n");
    return declarations.trim() === "" || namesIn(name).some((token) => !declarations.includes(token)) ? [name] : [];
  });
}

/**
 * A probe class, written in two halves: Tailwind scans tests too, and a whole broken class here would
 * put its broken rule (and the minifier's warning) into the app's CSS.
 */
const probe = (start: string, end: string): string => [start, end].join("");
const OLD_DOT = probe("-start-[calc(var(--spacing-dot)/2+var(--spacing", "-0_5)/2)]");
const WIDE_DOT = probe("@work:-start-[calc(var(--a)/2+var(--spacing", "-0_5)/2)]");
const ESCAPED = probe("-start-[calc((var(--spacing-dot)+var(--spacing", "-0\\_5))/2)]");

describe("arbitrary values keep their tokens' underscores", () => {
  const sources = [...files(SRC), ...files(UI)];

  it("reads real folders (the guard would pass on nothing)", () => {
    expect(sources.length).toBeGreaterThan(100);
  });

  it("finds the classes it checks, with their variants, and the token names they mean", () => {
    expect(candidates(`className="border-s-[length:var(--spacing-0_5)] ${WIDE_DOT} p-2"`)).toEqual(["border-s-[length:var(--spacing-0_5)]", WIDE_DOT]);
    expect(utilityOf(`@work:rtl:${OLD_DOT}`)).toBe(OLD_DOT);
    expect(namesIn(ESCAPED)).toEqual(["--spacing-0_5"]);
  });

  it("catches the class that hid Laufbahn's rail dots, and passes the forms Tailwind keeps", async () => {
    expect(await broken([OLD_DOT, WIDE_DOT])).toEqual([OLD_DOT, WIDE_DOT]);
    expect(await broken(["border-s-[length:var(--spacing-0_5)]", "border-[length:var(--spacing-0_5)]", ESCAPED])).toEqual([]);
  });

  it("finds no class in the app or the UI kit whose token name Tailwind would break", async () => {
    const found = [...new Set(sources.flatMap((file) => candidates(readFileSync(file, "utf8"))))];
    expect(found.length).toBeGreaterThan(0);
    expect(await broken(found)).toEqual([]);
  });
});
