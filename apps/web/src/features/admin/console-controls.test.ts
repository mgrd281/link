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

  it("reads whether views are measured from the data, never from a constant of the build", () => {
    // Real accounts get measured views once the page statistics count (live.ts, ADR 0081); a module
    // constant (`!supabaseEnabled`) kept every real console at "not measured" whatever the database held.
    const model = readFileSync(join(ROOT, "customers/model.ts"), "utf8");
    expect(model).not.toMatch(/export const viewsMeasured/);
    const screens = files.filter((file) => /viewsMeasured/.test(readFileSync(file, "utf8")) && /-screen\.tsx$/.test(file));
    expect(screens.map((file) => relative(ROOT, file)).sort()).toEqual(["analytics-screen.tsx", "customer-detail-screen.tsx", "customers-list-screen.tsx", "overview-screen.tsx"]);
    for (const file of screens) expect(readFileSync(file, "utf8"), relative(ROOT, file)).toMatch(/\bviewsMeasured\b[^}]*\} = useCustomers\(\)/);
    // The demo's sample customers carry numbers; the live data says itself.
    expect(readFileSync(join(ROOT, "customers/data.ts"), "utf8")).toContain("viewsMeasured: true");
    expect(readFileSync(join(ROOT, "live.ts"), "utf8")).toMatch(/viewsMeasured: counted/);
  });

  it("uses the kit's KPI tile, select, filter sheet, data list and chart table", () => {
    const all = files.map((file) => readFileSync(file, "utf8")).join("\n");
    for (const component of ["KpiTile", "Select", "FilterSheet", "DataList", "ChartTable"]) expect(all, component).toMatch(new RegExp(`import \\{[^}]*\\b${component}\\b[^}]*\\} from "@linkyo/ui"`));
  });
});
