import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { RESERVED_USERNAMES } from "@linkyo/blocks/rules";
import { describe, expect, it } from "vitest";

/** supabase/migrations, in the order Supabase applies them (file name order). */
const MIGRATIONS = path.resolve(import.meta.dirname, "../../../../../supabase/migrations");
const migrations = readdirSync(MIGRATIONS)
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => ({ file, sql: readFileSync(path.join(MIGRATIONS, file), "utf8") }));

/** Every name the migrations reserve: the quoted values of each `insert into public.reserved_usernames`. */
function reservedInDatabase(): { names: Set<string>; inserts: number } {
  const names = new Set<string>();
  let inserts = 0;
  for (const { sql } of migrations) {
    for (const statement of sql.matchAll(/insert\s+into\s+public\.reserved_usernames\b[^;]*;/gi)) {
      inserts += 1;
      const values = statement[0].slice(statement[0].search(/\bvalues\b/i));
      for (const value of values.matchAll(/'([^']*)'/g)) names.add(value[1] ?? "");
    }
  }
  return { names, inserts };
}

describe("reserved page addresses", () => {
  it("the database reserves exactly the names the app refuses", () => {
    const { names, inserts } = reservedInDatabase();
    expect(inserts).toBeGreaterThanOrEqual(2);
    expect([...names].sort()).toEqual([...RESERVED_USERNAMES].sort());
  });

  it("names are only ever added (a removal would need this test to learn it)", () => {
    for (const { file, sql } of migrations) {
      expect(/delete\s+from\s+public\.reserved_usernames|truncate\s+(table\s+)?public\.reserved_usernames/i.test(sql), file).toBe(false);
    }
  });

  it("covers every first-level route and the v7 pages", () => {
    for (const route of ["admin", "app", "design", "directions", "forgot", "login", "signup", "templates"]) expect(RESERVED_USERNAMES.has(route), route).toBe(true);
    for (const route of ["checkout", "service", "kuendigen", "widerruf", "widerrufsbelehrung", "impressum", "datenschutz", "agb"]) expect(RESERVED_USERNAMES.has(route), route).toBe(true);
    for (const name of RESERVED_USERNAMES) expect(name).toBe(name.toLowerCase());
  });
});
