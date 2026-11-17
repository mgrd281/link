import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { checkLintCoverage, loadSwiftRules, scanSwift } from "../token-guard/core.mjs";

const swiftlint = path.resolve(import.meta.dirname, "../../../apps/ios/.swiftlint.yml");

describe("token guard — Swift", () => {
  const rules = loadSwiftRules(swiftlint);

  it("loads the SwiftLint custom rules", () => {
    expect(rules.map((r) => r.id)).toEqual(
      expect.arrayContaining(["no_raw_color", "no_raw_font", "no_raw_spacing", "no_raw_radius"]),
    );
  });

  it.each([
    ["Color(red: 0.2, green: 0.3, blue: 1)", "no_raw_color"],
    ['Color(hex: "#3355FF")', "no_raw_color"],
    ["UIColor(red: 1, green: 0, blue: 0, alpha: 1)", "no_raw_color"],
    [".font(.system(size: 17))", "no_raw_font"],
    ['.font(.custom("Geist", size: 20))', "no_raw_font"],
    [".padding(16)", "no_raw_spacing"],
    [".padding(.horizontal, 20)", "no_raw_spacing"],
    ["VStack(spacing: 12) {", "no_raw_spacing"],
    [".frame(width: 44, height: 44)", "no_raw_spacing"],
    ["RoundedRectangle(cornerRadius: 14)", "no_raw_radius"],
  ])("flags %s", (line, rule) => {
    const violations = scanSwift("apps/ios/Linkyo/Feature.swift", `struct A {\n  ${line}\n}\n`, rules);
    expect(violations.map((v) => v.rule)).toContain(rule);
  });

  it("accepts token usage and skips generated files", () => {
    const ok = `VStack(spacing: LinkyoTokens.Spacing.s3) { Text("Hi").padding(LinkyoTokens.Spacing.s4).foregroundStyle(Color.Linkyo.fg) }\n.padding(0)`;
    expect(scanSwift("apps/ios/Linkyo/Feature.swift", ok, rules)).toEqual([]);
    expect(
      scanSwift("apps/ios/Packages/LinkyoDesignSystem/Sources/LinkyoDesignSystem/Generated/DesignTokens.swift", ".padding(16)", rules),
    ).toEqual([]);
  });
});

describe("token guard — lint coverage", () => {
  it("requires eslint (and stylelint when CSS exists) in every package", () => {
    const problems = checkLintCoverage([
      { dir: "packages/a", pkg: { name: "@linkyo/a", scripts: { lint: "eslint ." } }, hasCss: false },
      { dir: "packages/b", pkg: { name: "@linkyo/b", scripts: {} }, hasCss: false },
      { dir: "apps/c", pkg: { name: "@linkyo/c", scripts: { lint: "eslint ." } }, hasCss: true },
    ]);
    expect(problems).toHaveLength(2);
  });

  it("CLI exits non-zero on a violating Swift file", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "token-guard-"));
    const file = path.join(dir, "Bad.swift");
    writeFileSync(file, "let c = Color(red: 1, green: 0, blue: 0)\n");
    const { spawnSync } = await import("node:child_process");
    const result = spawnSync(process.execPath, [path.resolve(import.meta.dirname, "../token-guard/cli.mjs"), file], {
      encoding: "utf8",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("no_raw_color");
  });
});
