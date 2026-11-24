import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Production builds run through Turborepo (vercel.json, `pnpm build`), whose strict env mode hands a
 * task only the variables turbo.json declares (and NEXT_PUBLIC_*, which it infers for Next.js). A
 * variable read while building that is not declared is silently undefined: the launch gate would
 * let a LAUNCH=1 build with draft legal texts through, and the "Entwurf" banner of the statically
 * rendered legal pages would never go away after the review. Declared in `env`, they also count in
 * the cache key, so a cached build is never reused for a launch build.
 */
const web = join(__dirname, "..", "..", "..");
const source = (path: string) => readFileSync(join(web, path), "utf8");
const BUILD_TIME_FILES = ["next.config.ts", "src/features/legal/legal-page.tsx"];

const envReads = (text: string) => [...text.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)].map((match) => match[1] ?? "");

describe("variables read while building", () => {
  it("are declared for the build task in turbo.json", () => {
    const turbo = JSON.parse(source("../../turbo.json")) as { tasks: { build: { env?: string[] } } };
    const declared = new Set(turbo.tasks.build.env ?? []);
    const read = [...new Set(BUILD_TIME_FILES.flatMap((file) => envReads(source(file))))].filter((name) => !name.startsWith("NEXT_PUBLIC_"));
    expect(read).toEqual(expect.arrayContaining(["EMAIL_TRANSPORT", "LAUNCH", "LEGAL_REVIEWED"]));
    expect(read.filter((name) => !declared.has(name))).toEqual([]);
  });
});
