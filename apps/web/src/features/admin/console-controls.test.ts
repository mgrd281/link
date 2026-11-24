import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * A-12 (Stage 3, WP3.4): the team console uses the UI kit's controls, not the browser's unstyled
 * ones. `Select` instead of `<select>`, `ChartTable` (a real button and table) instead of
 * `<details>`/`<summary>`. Code and comments alike, so the words do not creep back in either.
 */

const ROOT = join(__dirname);

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("team console controls", () => {
  const files = sources(ROOT);

  it("reads the console's sources", () => {
    expect(files.length).toBeGreaterThan(30);
  });

  it.each([
    ["<select", "the kit's Select"],
    ["<details", "the kit's ChartTable or a button that shows and hides"],
    ["<summary", "the kit's ChartTable or a button that shows and hides"],
  ])("has no native %s (use %s)", (tag) => {
    const offenders = files.filter((file) => readFileSync(file, "utf8").includes(tag)).map((file) => relative(ROOT, file));
    expect(offenders).toEqual([]);
  });

  it("uses the kit's KPI tile, select, filter sheet, data list and chart table", () => {
    const all = files.map((file) => readFileSync(file, "utf8")).join("\n");
    for (const component of ["KpiTile", "Select", "FilterSheet", "DataList", "ChartTable"]) expect(all, component).toMatch(new RegExp(`import \\{[^}]*\\b${component}\\b[^}]*\\} from "@linkyo/ui"`));
  });
});
