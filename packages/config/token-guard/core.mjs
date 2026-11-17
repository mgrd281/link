/**
 * Token guard core: enforces "no raw design values outside @linkyo/tokens" for files that
 * ESLint/Stylelint do not cover (Swift) and verifies that every web package is linted.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import YAML from "yaml";

export * from "./patterns.js";

/**
 * Load SwiftLint custom rules (single source of truth for Swift token rules).
 * @param {string} swiftlintPath
 * @returns {{ id: string, regex: RegExp, message: string, excluded: RegExp[] }[]}
 */
export function loadSwiftRules(swiftlintPath) {
  const config = YAML.parse(readFileSync(swiftlintPath, "utf8"));
  const rules = config?.custom_rules ?? {};
  return Object.entries(rules).map(([id, rule]) => ({
    id,
    regex: new RegExp(rule.regex, "m"),
    message: rule.message,
    excluded: [rule.excluded ?? []].flat().map((pattern) => new RegExp(pattern)),
  }));
}

/**
 * @param {string} filePath repo-relative path
 * @param {string} source
 * @param {ReturnType<typeof loadSwiftRules>} rules
 */
export function scanSwift(filePath, source, rules) {
  /** @type {{ file: string, line: number, rule: string, message: string, text: string }[]} */
  const violations = [];
  const lines = source.split("\n");
  for (const rule of rules) {
    if (rule.excluded.some((pattern) => pattern.test(filePath))) continue;
    lines.forEach((line, index) => {
      if (/^\s*\/\//.test(line)) return;
      if (rule.regex.test(line)) {
        violations.push({ file: filePath, line: index + 1, rule: rule.id, message: rule.message, text: line.trim() });
      }
    });
  }
  return violations;
}

/**
 * Every workspace package that ships TS/CSS must run ESLint (and Stylelint for CSS) in `lint`.
 * @param {{ dir: string, pkg: any, hasCss: boolean }[]} packages
 */
export function checkLintCoverage(packages) {
  /** @type {string[]} */
  const problems = [];
  for (const { dir, pkg, hasCss } of packages) {
    if (pkg.name === "@linkyo/tokens") continue;
    const lint = pkg.scripts?.lint ?? "";
    if (!lint.includes("eslint")) problems.push(`${path.join(dir, "package.json")}: "lint" script must run eslint`);
    if (hasCss && !lint.includes("stylelint")) {
      problems.push(`${path.join(dir, "package.json")}: package has CSS, "lint" script must run stylelint`);
    }
  }
  return problems;
}
