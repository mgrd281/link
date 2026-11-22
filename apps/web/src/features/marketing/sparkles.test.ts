import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// Sparkles means AI. Where something else is meant (no sign-up needed, the features, templates, a
// team-made page), these screens use another glyph, so the AI mark stays unambiguous once AI ships.
// The creator link-icon catalogue keeps "sparkles": that is a creator's own content.

const SRC = path.resolve(import.meta.dirname, "../..");
const FILES = [
  "features/marketing/features.tsx",
  "features/marketing/mobile-menu.tsx",
  "app/[locale]/templates/page.tsx",
  "features/directions/poster/dashboard.tsx",
  "features/admin/creators-screen.tsx",
];

/** The names a file imports from lucide-react. */
function lucideImports(source: string): string[] {
  return [...source.matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*["']lucide-react["']/g)].flatMap((match) =>
    (match[1] ?? "")
      .split(",")
      .map((name) => name.trim().replace(/^type\s+/, ""))
      .filter(Boolean),
  );
}

describe("Sparkles only for AI", () => {
  it.each(FILES)("%s does not import Sparkles", (file) => {
    const source = readFileSync(path.join(SRC, file), "utf8");
    const names = lucideImports(source);
    expect(names.length).toBeGreaterThan(0);
    expect(names.filter((name) => /^Sparkles(?:Icon)?(?:\s+as\s+\w+)?$|^LucideSparkles/.test(name))).toEqual([]);
    expect(source).not.toMatch(/\bSparkles\b/);
  });
});
