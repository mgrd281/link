import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { UI_COMPONENT_MODULES } from "./stats";

describe("/design's figures", () => {
  it("counts the component modules @linkyo/ui exports (a capitalised value export, not a type or a constant)", () => {
    const index = readFileSync(path.join(import.meta.dirname, "../../../../../packages/ui/src/index.ts"), "utf8");
    const modules = [...index.matchAll(/export\s*\{([^}]*)\}\s*from\s*"([^"]+)"/g)].filter(([, names = ""]) =>
      names
        .split(",")
        .map((name) => name.trim())
        .some((name) => /^[A-Z][a-z]/.test(name) && !name.startsWith("type ")),
    );
    expect(modules.length).toBeGreaterThan(15);
    expect(UI_COMPONENT_MODULES).toBe(modules.length);
  });
});
