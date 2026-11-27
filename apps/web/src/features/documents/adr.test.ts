import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The documents' decision carries its number: ADR 0089 (the Lebenslauf and Anschreiben PDFs). It and
 * ADR 0069 (Laufbahn, round 6: the page that offers them) name each other, the index lists it, and no
 * code, test or doc still points to the draft it was written as.
 */

const ROOT = path.resolve(import.meta.dirname, "../../../../..");
const DECISIONS = path.join(ROOT, "docs/DECISIONS");
const read = (file: string) => readFileSync(path.join(DECISIONS, file), "utf8");

/** Every text file under a folder of the repository (no dependencies, no build output). */
function files(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { recursive: true, encoding: "utf8" })
    .filter((name) => /\.(?:ts|tsx|mjs|css|md|json|sql)$/.test(name) && !name.split(path.sep).some((part) => part === "node_modules" || part.startsWith(".")))
    .map((name) => path.join(dir, name));
}

describe("ADR 0089", () => {
  it("is numbered, titled with its number and named by ADR 0069", () => {
    const pdfs = read("0089-laufbahn-pdfs.md");
    expect(pdfs.split("\n")[0]).toMatch(/^# 0089 — /);
    expect(pdfs).toContain("[0069](0069-laufbahn-template.md)");
    expect(read("0069-laufbahn-template.md")).toContain("[0089](0089-laufbahn-pdfs.md)");
    expect(readdirSync(DECISIONS).filter((name) => name.startsWith("draft-laufbahn"))).toEqual([]);
  });

  it("is listed in the index, in its format", () => {
    expect(read("README.md")).toMatch(/^\| \[0089\]\(0089-laufbahn-pdfs\.md\) \| .+ \| Accepted \|$/m);
  });

  it("says why Arabic pages get no PDFs", () => {
    const pdfs = read("0089-laufbahn-pdfs.md");
    expect(pdfs).toContain("**Arabic pages get no PDFs.**");
    expect(pdfs).toMatch(/no Arabic shaping/);
  });

  it("is what code, tests, tokens and docs point to, never the draft", () => {
    const found = ["apps/web/src", "apps/web/e2e", "packages/tokens", "docs", ".claude/skills"]
      .flatMap(files)
      .filter((file) => !file.endsWith("documents/adr.test.ts") && readFileSync(path.join(ROOT, file), "utf8").includes("draft-laufbahn-pdfs"));
    expect(found).toEqual([]);
  });
});
