import { readdirSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Static guard: secrets and server-only packages never reach a browser bundle. It reads the source
 * files and fails when
 *  1. the Anthropic SDK is imported as a value anywhere but `src/features/ai/server/claude.ts` and
 *     tests (`import type` is fine under `src/features/ai/server/`);
 *  2. `stripe` is imported anywhere but `src/features/payments/server/stripe-payments.ts`, tests and
 *     `e2e/` (`import type` is fine under `src/features/payments/server/`);
 *  3. a "use client" file imports a path with a `/server` segment;
 *  4. code under `src/` uses the Stripe.js address outside `src/features/payments/stripe-js.tsx`
 *     (prose in `src/features/legal/texts.ts` may name it, and the checkout policy in `src/lib/csp.ts`);
 *  5. a NEXT_PUBLIC_ variable is named like a secret (SECRET, or KEY other than a publishable key and
 *     the existing NEXT_PUBLIC_SUPABASE_ANON_KEY fallback);
 *  6. a "use client" file reads a server secret.
 * With `verbatimModuleSyntax`, only `import type` / `export type … from` is erased; an import whose
 * names are all marked `type` inside the braces still loads the module, so it counts as a value import.
 */

interface SourceFile {
  /** Relative to apps/web, with forward slashes. */
  path: string;
  text: string;
}

interface Violation {
  rule: number;
  file: string;
  detail: string;
}

const WEB = path.resolve(import.meta.dirname, "../..");
const SELF = "src/lib/static-guard.test.ts";
const CODE = /\.(?:[cm]?[jt]s|[jt]sx)$/;
const SKIP = new Set(["node_modules", ".next", "dist", "test-results", "playwright-report", ".turbo"]);
const SECRETS = ["ANTHROPIC_API_KEY", "STRIPE_SECRET_KEY", "SUPABASE_SECRET_KEY", "SCW_SECRET_KEY", "MAINTENANCE_SECRET"];

function walk(root: string, dir: string, out: SourceFile[]): void {
  let entries;
  try {
    entries = readdirSync(path.join(root, dir), { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP.has(entry.name)) continue;
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) walk(root, rel, out);
    else if (CODE.test(entry.name)) out.push({ path: path.posix.normalize(rel), text: readFileSync(path.join(root, rel), "utf8") });
  }
}

/** Source files of the app (src, e2e, scripts, root config files), plus the shared packages' sources. */
function collect(root: string, withPackages: boolean): SourceFile[] {
  const files: SourceFile[] = [];
  for (const dir of ["src", "e2e", "scripts"]) walk(root, dir, files);
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.isFile() && CODE.test(entry.name)) files.push({ path: entry.name, text: readFileSync(path.join(root, entry.name), "utf8") });
  }
  if (withPackages) {
    const packages = path.resolve(root, "../../packages");
    const shared: SourceFile[] = [];
    for (const name of readdirSync(packages)) walk(packages, `${name}/src`, shared);
    for (const file of shared) files.push({ ...file, path: `../../packages/${file.path}` });
  }
  return files.filter((file) => file.path !== SELF);
}

/** Comments removed (good enough for finding imports; strings with `//` are cut, which is harmless here). */
const stripComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

const isClient = (text: string) => /^["']use client["']/.test(stripComments(text).trimStart());

interface Import {
  specifier: string;
  typeOnly: boolean;
}

function imports(text: string): Import[] {
  const code = stripComments(text);
  const found: Import[] = [];
  for (const match of code.matchAll(/\bimport\s+(type\s+)?(?:[\w*{}\s,$]+?\s+from\s+)?["']([^"']+)["']/g)) found.push({ specifier: match[2] ?? "", typeOnly: Boolean(match[1]) });
  for (const match of code.matchAll(/\bexport\s+(type\s+)?(?:\*(?:\s+as\s+\w+)?|\{[^}]*\})\s*from\s*["']([^"']+)["']/g)) found.push({ specifier: match[2] ?? "", typeOnly: Boolean(match[1]) });
  for (const match of code.matchAll(/\b(?:import|require)\s*\(\s*["']([^"']+)["']\s*\)/g)) found.push({ specifier: match[1] ?? "", typeOnly: false });
  return found;
}

const isTest = (file: string) => /\.test\.[cm]?[jt]sx?$/.test(file);
const isPackage = (specifier: string, name: string) => specifier === name || specifier.startsWith(`${name}/`);

function check(files: SourceFile[]): Violation[] {
  const violations: Violation[] = [];
  const add = (rule: number, file: string, detail: string) => violations.push({ rule, file, detail });
  for (const { path: file, text } of files) {
    const inSrc = file.startsWith("src/");
    const client = inSrc && isClient(text);
    for (const { specifier, typeOnly } of imports(text)) {
      if (isPackage(specifier, "@anthropic-ai/sdk")) {
        const allowed = file === "src/features/ai/server/claude.ts" || isTest(file) || (typeOnly && file.startsWith("src/features/ai/server/"));
        if (!allowed) add(1, file, specifier);
      }
      if (isPackage(specifier, "stripe")) {
        const allowed = file === "src/features/payments/server/stripe-payments.ts" || isTest(file) || file.startsWith("e2e/") || (typeOnly && file.startsWith("src/features/payments/server/"));
        if (!allowed) add(2, file, specifier);
      }
      if (client && /\/server(\/|$)/.test(specifier)) add(3, file, specifier);
    }
    if (inSrc && /\.tsx?$/.test(file) && text.includes("https://js.stripe.com") && file !== "src/features/payments/stripe-js.tsx" && file !== "src/features/legal/texts.ts" && file !== "src/lib/csp.ts" && file !== "src/lib/csp.test.ts") {
      add(4, file, "https://js.stripe.com");
    }
    if (!file.startsWith("../")) {
      for (const match of text.matchAll(/process\.env(?:\.|\[\s*["'])(NEXT_PUBLIC_\w+)/g)) {
        const name = match[1] ?? "";
        const keyLike = name.includes("KEY") && !name.endsWith("PUBLISHABLE_KEY") && name !== "NEXT_PUBLIC_SUPABASE_ANON_KEY";
        if (name.includes("SECRET") || keyLike) add(5, file, name);
      }
    }
    if (client) for (const secret of SECRETS) if (new RegExp(`\\b${secret}\\b`).test(text)) add(6, file, secret);
  }
  return violations;
}

describe("static guard", () => {
  it("passes on this tree", () => {
    const files = collect(WEB, true);
    expect(files.length).toBeGreaterThan(300);
    expect(files.some((file) => file.path === "src/lib/supabase/config.ts")).toBe(true);
    expect(files.some((file) => file.path.startsWith("../../packages/blocks/src/"))).toBe(true);
    expect(check(files)).toEqual([]);
  });

  it("fires on every rule (seeded counter-examples in a temp dir)", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "linkyo-guard-"));
    const seed = async (file: string, text: string) => {
      await mkdir(path.dirname(path.join(root, file)), { recursive: true });
      await writeFile(path.join(root, file), text, "utf8");
    };
    try {
      // 1 · Anthropic SDK
      await seed("src/features/ai/server/claude.ts", 'import Anthropic from "@anthropic-ai/sdk";\nexport const client = new Anthropic();\n');
      await seed("src/features/ai/server/pipeline.ts", 'import type { Message } from "@anthropic-ai/sdk/resources/messages";\nexport type M = Message;\n');
      await seed("src/features/ai/server/claude.test.ts", 'import Anthropic from "@anthropic-ai/sdk";\nvoid Anthropic;\n');
      await seed("src/features/ai/server/repair.ts", 'import { APIError } from "@anthropic-ai/sdk";\nvoid APIError;\n');
      await seed("src/features/ai/server/cost.ts", 'import { type Usage } from "@anthropic-ai/sdk/resources";\nexport type U = Usage;\n');
      await seed("src/features/ai/run-view.tsx", 'import type { Message } from "@anthropic-ai/sdk";\nexport type M = Message;\n');
      await seed("src/app/api/x/route.ts", 'export async function GET() {\n  const { default: Anthropic } = await import("@anthropic-ai/sdk");\n  return Response.json(Boolean(Anthropic));\n}\n');
      // 2 · stripe
      await seed("src/features/payments/server/stripe-payments.ts", 'import Stripe from "stripe";\nexport const stripe = new Stripe("sk");\n');
      await seed("src/features/payments/server/webhook.ts", 'import type Stripe from "stripe";\nexport type E = Stripe.Event;\n');
      await seed("src/features/payments/server/contracts.ts", 'const Stripe = require("stripe");\nvoid Stripe;\n');
      await seed("src/features/payments/checkout-pro.tsx", 'import Stripe from "stripe";\nvoid Stripe;\n');
      await seed("e2e/mocks/stripe.handler.mjs", 'import Stripe from "stripe";\nvoid Stripe;\n');
      // 3 · "use client" importing server modules
      await seed("src/features/app/home.tsx", '"use client";\n\nimport { requireUser } from "@/lib/server/user";\nvoid requireUser;\n');
      await seed("src/features/app/other.tsx", '// The client side.\n"use client";\nexport { pipeline } from "../ai/server";\n');
      await seed("src/app/api/y/route.ts", 'import { requireUser } from "@/lib/server/user";\nvoid requireUser;\n');
      // 4 · Stripe.js
      await seed("src/features/payments/stripe-js.tsx", 'export const SRC = "https://js.stripe.com/clover/stripe.js";\n');
      await seed("src/features/legal/texts.ts", 'export const TEXT = "Stripe.js wird von https://js.stripe.com geladen.";\n');
      await seed("src/features/marketing/sections.tsx", 'export const s = "https://js.stripe.com/v3";\n');
      // 5 · NEXT_PUBLIC_ secrets
      await seed(
        "src/lib/config.ts",
        [
          "export const a = process.env.NEXT_PUBLIC_STRIPE_SECRET_KEY;",
          "export const b = process.env.NEXT_PUBLIC_ANTHROPIC_KEY;",
          'export const c = process.env["NEXT_PUBLIC_WEBHOOK_SECRET"];',
          "export const d = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;",
          "export const e = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;",
          "export const f = process.env.NEXT_PUBLIC_SITE_URL;",
          "",
        ].join("\n"),
      );
      // 6 · secrets in client files
      await seed("src/features/app/leak.tsx", `"use client";\n${SECRETS.map((name, i) => `export const s${i} = process.env.${name};`).join("\n")}\n`);
      await seed("src/app/api/z/route.ts", "export const key = process.env.STRIPE_SECRET_KEY;\n");

      const found = check(collect(root, false))
        .map((violation) => `${violation.rule} ${violation.file} ${violation.detail}`)
        .sort();
      expect(found).toEqual(
        [
          "1 src/app/api/x/route.ts @anthropic-ai/sdk",
          "1 src/features/ai/run-view.tsx @anthropic-ai/sdk",
          "1 src/features/ai/server/cost.ts @anthropic-ai/sdk/resources",
          "1 src/features/ai/server/repair.ts @anthropic-ai/sdk",
          "2 src/features/payments/checkout-pro.tsx stripe",
          "2 src/features/payments/server/contracts.ts stripe",
          "3 src/features/app/home.tsx @/lib/server/user",
          "3 src/features/app/other.tsx ../ai/server",
          "4 src/features/marketing/sections.tsx https://js.stripe.com",
          "5 src/lib/config.ts NEXT_PUBLIC_ANTHROPIC_KEY",
          "5 src/lib/config.ts NEXT_PUBLIC_STRIPE_SECRET_KEY",
          "5 src/lib/config.ts NEXT_PUBLIC_WEBHOOK_SECRET",
          ...SECRETS.map((name) => `6 src/features/app/leak.tsx ${name}`),
        ].sort(),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
