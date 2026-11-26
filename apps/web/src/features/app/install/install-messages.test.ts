import { readFileSync } from "node:fs";
import path from "node:path";

import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import ar from "@/messages/ar.json";
import de from "@/messages/de.json";
import en from "@/messages/en.json";

/**
 * "Linkyo als App" in Arabic: Latin names (Linkyo, Safari, Mac, Dock, Chrome, Edge) sit inside <bdi>,
 * so they keep their direction wherever the text goes (a dir=auto box, a tooltip, a copied string),
 * the rule `features/admin/arabic-bdi.test.ts` sets for the console. The sheet, the Settings row and
 * Home's hint render these keys with t.rich and a `bdi` tag; a plain t() would print the key instead.
 *
 * The `pwa` texts are not covered: the manifest and the offline page are plain text, not markup (the
 * manifest says `dir: "rtl"` itself).
 */

interface Tree {
  [key: string]: Tree | string;
}

const strings = (tree: Tree | string, prefix: string): [string, string][] =>
  typeof tree === "string" ? [[prefix, tree]] : Object.entries(tree).flatMap(([key, value]) => strings(value, `${prefix}.${key}`));

const FILES = { de, en, ar } as const;
const install = (locale: keyof typeof FILES) => strings(FILES[locale].app.install, "app.install");

/** The literal text outside <bdi>, without the other tags (the share glyph) and placeholders. */
const plain = (message: string) =>
  message
    .replace(/<bdi>[\s\S]*?<\/bdi>/g, "")
    .replace(/<\/?\w+>/g, "")
    .replace(/\{\w+\}/g, "");

describe("the install texts", () => {
  it("isolate every Latin name in the Arabic texts", () => {
    const offenders = install("ar")
      .filter(([, message]) => /[A-Za-z0-9]/.test(plain(message)))
      .map(([key, message]) => `${key}: ${message}`);
    expect(offenders).toEqual([]);
    // The keys the review named, and the new Chromium text, carry the tag.
    const tagged = install("ar")
      .filter(([, message]) => message.includes("<bdi>"))
      .map(([key]) => key.replace("app.install.", ""));
    expect(tagged).toEqual(
      expect.arrayContaining(["row", "title", "prompt.body", "prompt.later", "ios.intro", "mac.intro", "mac.step", "installed.title", "installed.body", "other.body", "chromium.body", "hint.title"]),
    );
  });

  it("keep German and English free of the tag", () => {
    for (const locale of ["de", "en"] as const) expect(install(locale).filter(([, message]) => message.includes("<bdi>"))).toEqual([]);
  });

  it.each(["de", "en", "ar"] as const)("%s: every text formats with its tags", (locale) => {
    const errors: string[] = [];
    const t = createTranslator({ locale, messages: FILES[locale], onError: (error) => errors.push(`${error.code}: ${error.message}`) }) as unknown as {
      markup(key: string, values: Record<string, unknown>): string;
    };
    for (const [key] of install(locale)) {
      const text = t.markup(key, { bdi: (chunks: string) => `[${chunks}]`, glyph: () => "⇪" });
      expect(text, key).not.toMatch(/[{}<>]/);
    }
    expect(errors).toEqual([]);
    if (locale === "ar") {
      expect(t.markup("app.install.row", { bdi: (chunks: string) => `[${chunks}]` })).toBe("[Linkyo] كتطبيق");
      expect(t.markup("app.install.mac.intro", { bdi: (chunks: string) => `[${chunks}]` })).toBe("في [Safari] على [Mac]:");
    }
  });

  it("are read with t.rich wherever a language has markup in them (a plain t() prints the key)", () => {
    const files = [
      ["install-sheet.tsx", "app.install"],
      ["install-row.tsx", "app.install"],
      ["install-hint.tsx", "app.install.hint"],
    ] as const;
    const marked = new Set(
      (["de", "en", "ar"] as const).flatMap((locale) => install(locale).filter(([, message]) => /<\w+>/.test(message)).map(([key]) => key)),
    );
    const plainCalls = files.flatMap(([file, namespace]) =>
      [...readFileSync(path.join(import.meta.dirname, file), "utf8").matchAll(/\bt\("([\w.]+)"\)/g)].map((match) => `${namespace}.${match[1] ?? ""}`),
    );
    expect(plainCalls.length).toBeGreaterThan(3);
    expect(plainCalls.filter((key) => marked.has(key))).toEqual([]);
  });
});
