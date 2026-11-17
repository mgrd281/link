import stylelint from "stylelint";
import { describe, expect, it } from "vitest";

import config from "../stylelint/index.js";

async function lint(code) {
  const result = await stylelint.lint({ code, config });
  return result.results[0]?.warnings.map((w) => w.rule) ?? [];
}

describe("stylelint token rules", () => {
  it("accepts token references", async () => {
    expect(
      await lint(`.a { color: var(--color-fg); padding: var(--spacing-4); font-family: var(--font-sans); width: 100%; }\n`),
    ).toEqual([]);
  });

  it.each([
    [".a { color: #fff; }\n", "color-no-hex"],
    [".a { color: rgb(0 0 0); }\n", "function-disallowed-list"],
    [".a { color: red; }\n", "color-named"],
    [".a { margin: 12px; }\n", "unit-disallowed-list"],
    [".a { padding: 1.5rem; }\n", "declaration-property-value-disallowed-list"],
    [".a { font-family: Inter, sans-serif; }\n", "declaration-property-value-allowed-list"],
  ])("rejects %s", async (code, rule) => {
    expect(await lint(code)).toContain(rule);
  });
});
