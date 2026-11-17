#!/usr/bin/env node
/**
 * Usage: node packages/config/token-guard/cli.mjs [files...]
 * Without arguments it scans the whole repo. Exits 1 on any violation.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { checkLintCoverage, loadSwiftRules, scanSwift } from "./core.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const SWIFTLINT = path.join(ROOT, "apps/ios/.swiftlint.yml");
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", ".build", "DerivedData", ".git", ".turbo", "coverage"]);

/** @param {string} dir @returns {string[]} */
function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    if (SKIP_DIRS.has(entry)) return [];
    const full = path.join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const args = process.argv.slice(2);
const files = (args.length > 0 ? args.map((file) => path.resolve(file)) : walk(path.join(ROOT, "apps"))).filter(
  (file) => file.endsWith(".swift"),
);

const swiftRules = existsSync(SWIFTLINT) ? loadSwiftRules(SWIFTLINT) : [];
const violations = files.flatMap((file) =>
  scanSwift(path.relative(ROOT, file), readFileSync(file, "utf8"), swiftRules),
);

const packages = ["apps", "packages"].flatMap((group) =>
  readdirSync(path.join(ROOT, group))
    .map((name) => path.join(ROOT, group, name))
    .filter((dir) => existsSync(path.join(dir, "package.json")))
    .map((dir) => ({
      dir: path.relative(ROOT, dir),
      pkg: JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8")),
      hasCss: walk(path.join(dir, "src")).some((file) => file.endsWith(".css")),
    })),
);
const coverageProblems = args.length > 0 ? [] : checkLintCoverage(packages);

for (const v of violations) {
  console.error(`${v.file}:${v.line}  ${v.rule}  ${v.message}\n    ${v.text}`);
}
for (const problem of coverageProblems) console.error(problem);

if (violations.length > 0 || coverageProblems.length > 0) {
  console.error(`\n✖ token-guard: ${violations.length} raw design value(s), ${coverageProblems.length} lint coverage problem(s).`);
  process.exit(1);
}
console.warn(`✔ token-guard: ${files.length} Swift file(s) clean, ${packages.length} package(s) lint-covered.`);
