import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The iPhone app's two decisions carry their numbers: ADR 0087 (app mode, the interface half of the
 * bridge) and ADR 0088 (the session hand-off, the page operations, the save guard and the store's
 * half). They name each other, the index lists both, and no code, test or doc still points to the
 * drafts they were written as.
 */

const ROOT = path.resolve(import.meta.dirname, "../../../../..");
const DECISIONS = path.join(ROOT, "docs/DECISIONS");
const read = (file: string) => readFileSync(path.join(DECISIONS, file), "utf8");

/** Every text file under a folder of the repository (no dependencies, no build output). */
function files(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { recursive: true, encoding: "utf8" })
    .filter((name) => /\.(?:ts|tsx|mjs|css|md|sql)$/.test(name) && !name.split(path.sep).some((part) => part === "node_modules" || part.startsWith(".")))
    .map((name) => path.join(dir, name));
}

describe("ADR 0087 and 0088", () => {
  it("are numbered, titled with their number and name each other", () => {
    const mode = read("0087-app-mode.md");
    const sync = read("0088-app-sync.md");
    expect(mode.split("\n")[0]).toMatch(/^# 0087 — /);
    expect(sync.split("\n")[0]).toMatch(/^# 0088 — /);
    expect(mode).toContain("[0088](0088-app-sync.md)");
    expect(sync).toContain("[0087](0087-app-mode.md)");
    expect(readdirSync(DECISIONS).filter((name) => name.startsWith("draft-app"))).toEqual([]);
  });

  it("are listed in the index, in its format", () => {
    const index = read("README.md");
    expect(index).toMatch(/^\| \[0087\]\(0087-app-mode\.md\) \| .+ \| Accepted \|$/m);
    expect(index).toMatch(/^\| \[0088\]\(0088-app-sync\.md\) \| .+ \| Accepted \|$/m);
  });

  it("0088 names both new routes for WP4.4: rate limits and binding the hand-off to the device id", () => {
    const sync = read("0088-app-sync.md");
    const wp44 = sync.slice(sync.indexOf("**For WP4.4"));
    expect(wp44.length).toBeLessThan(sync.length);
    for (const words of ["/api/auth/handoff", "/api/app/page", "Rate limits", "deviceId"]) expect(wp44, words).toContain(words);
  });

  it("no code, test, skill or doc still points to the drafts", () => {
    const stale = /draft-app-mode|draft-app-sync|ADR draft "app mode"/;
    const found = ["apps/web/src", "apps/web/e2e", "docs", ".claude/skills"]
      .flatMap(files)
      .filter((file) => !file.endsWith("adr-links.test.ts") && stale.test(readFileSync(path.join(ROOT, file), "utf8")));
    expect(found).toEqual([]);
  });
});
