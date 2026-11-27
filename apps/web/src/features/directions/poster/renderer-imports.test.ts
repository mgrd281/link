import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import ts from "typescript";
import { afterAll, describe, expect, it } from "vitest";

/**
 * Every creator page renders through renderer.tsx, so whatever it reaches by static imports ships with
 * every page of every template. Laufbahn's own code must not be among it: laufbahn.tsx (a server module,
 * but it imports the client index) and Laufbahn's "use client" modules come only through the
 * signposted-* entry points, client modules whose `next/dynamic` imports split their targets off into
 * chunks of Laufbahn's pages (signposted-blocks.tsx; ADR 0008's page budget, ADR 0069). One static
 * import from a shared module into laufbahn.tsx put Laufbahn's index on every creator page (63.1 KB of
 * 35 KB, round 6 review); this guard walks the imports and fails on such an edge.
 *
 * The walk follows `import … from` and `export … from` (a dynamic `import()` is not followed); only
 * `import type` and `export type` are left out: under `verbatimModuleSyntax` an import whose names are
 * all marked `type` inside the braces still loads its module.
 */

const SRC = path.resolve(import.meta.dirname, "../../..");
const POSTER = path.join(SRC, "features/directions/poster");

const EXTENSIONS = [".tsx", ".ts", "/index.tsx", "/index.ts"];

/** The code file an import names, for the app's own files (relative or `@/`); null for a package or an asset. */
function resolve(from: string, specifier: string, src: string): string | null {
  const base = specifier.startsWith("@/") ? path.join(src, specifier.slice(2)) : specifier.startsWith(".") ? path.resolve(path.dirname(from), specifier) : null;
  if (base === null) return null;
  if (existsSync(base) && statSync(base).isFile()) return /\.[cm]?[jt]sx?$/.test(base) ? base : null;
  for (const extension of EXTENSIONS) if (existsSync(`${base}${extension}`)) return `${base}${extension}`;
  throw new Error(`${path.relative(src, from)}: cannot resolve "${specifier}"`);
}

interface Module {
  client: boolean;
  /** The modules it loads when it loads. */
  statics: string[];
  /** The modules it loads later, by `import()`. */
  dynamics: string[];
}

function read(file: string, src: string): Module {
  const text = readFileSync(file, "utf8");
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const statics: string[] = [];
  const dynamics: string[] = [];
  const first = source.statements[0];
  const client = first !== undefined && ts.isExpressionStatement(first) && ts.isStringLiteral(first.expression) && first.expression.text === "use client";
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.importClause?.phaseModifier !== ts.SyntaxKind.TypeKeyword) {
      const target = resolve(file, node.moduleSpecifier.text, src);
      if (target) statics.push(target);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) && !node.isTypeOnly) {
      const target = resolve(file, node.moduleSpecifier.text, src);
      if (target) statics.push(target);
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const [argument] = node.arguments;
      if (argument && ts.isStringLiteral(argument)) {
        const target = resolve(file, argument.text, src);
        if (target) dynamics.push(target);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { client, statics, dynamics };
}

/** Every module reached from `entry` by static imports, each with the chain that reaches it. */
function reach(entry: string, src: string): { modules: Map<string, Module>; chains: Map<string, string[]> } {
  const modules = new Map<string, Module>();
  const chains = new Map<string, string[]>([[entry, [entry]]]);
  const queue = [entry];
  for (let file = queue.shift(); file !== undefined; file = queue.shift()) {
    const parsed = read(file, src);
    modules.set(file, parsed);
    for (const next of parsed.statics) {
      if (chains.has(next)) continue;
      chains.set(next, [...(chains.get(file) ?? []), next]);
      queue.push(next);
    }
  }
  return { modules, chains };
}

/** The dynamic entry points: the client modules signposted-*.tsx in the poster folder. */
function entryPoints(poster: string, src: string): Map<string, Module> {
  const files = readdirSync(poster)
    .filter((file) => /^signposted-[\w-]+\.tsx$/.test(file))
    .map((file) => path.join(poster, file));
  return new Map(files.map((file) => [file, read(file, src)] as const).filter(([, parsed]) => parsed.client));
}

/**
 * The Laufbahn code a renderer reaches that should have come through a dynamic entry point: laufbahn.tsx,
 * each module an entry point imports dynamically, and every Laufbahn "use client" module (laufbahn-*.tsx
 * in the poster folder). Each as its chain of imports.
 */
function leaks(entry: string, src: string, poster: string): string[] {
  const { modules, chains } = reach(entry, src);
  const entries = entryPoints(poster, src);
  const lazy = new Set([...entries.values()].flatMap((parsed) => parsed.dynamics));
  const name = (file: string) => path.relative(src, file);
  return [...chains.keys()]
    .filter((file) => {
      if (entries.has(file)) return false;
      const laufbahn = path.dirname(file) === poster && /^laufbahn(?:-[\w-]+)?\.tsx$/.test(path.basename(file));
      return path.basename(file) === "laufbahn.tsx" || lazy.has(file) || (laufbahn && modules.get(file)?.client === true);
    })
    .map((file) => (chains.get(file) ?? []).map(name).join(" → "));
}

const RENDERER = path.join(POSTER, "renderer.tsx");

describe("the creator page's static imports keep Laufbahn's code to Laufbahn's pages (ADR 0008, 0069)", () => {
  const { modules } = reach(RENDERER, SRC);
  const entries = entryPoints(POSTER, SRC);

  it("walks the real graph: the renderer reaches the hero, Laufbahn's head and its dynamic entry points", () => {
    expect(modules.size).toBeGreaterThan(40);
    for (const file of ["hero.tsx", "laufbahn-hero.tsx", "laufbahn-content.ts", "signposted-blocks.tsx", "signposted-lazy.tsx"]) {
      expect(modules.has(path.join(POSTER, file)), file).toBe(true);
    }
    // The entry points (signposted-bar.tsx is reached behind signposted-lazy.tsx) are client modules
    // that load Laufbahn's code dynamically and nothing of the poster folder statically.
    expect([...entries.keys()].map((file) => path.basename(file)).sort()).toEqual(["signposted-bar.tsx", "signposted-blocks.tsx", "signposted-lazy.tsx"]);
    for (const [file, parsed] of entries) expect(parsed.statics.filter((target) => target.startsWith(POSTER)), file).toEqual([]);
    expect(new Set([...entries.values()].flatMap((parsed) => parsed.dynamics))).toEqual(new Set(["laufbahn.tsx", "laufbahn-index.tsx", "signposted.tsx"].map((file) => path.join(POSTER, file))));
  });

  it("reaches neither laufbahn.tsx nor a Laufbahn client module but through the dynamic entry points", () => {
    expect(leaks(RENDERER, SRC, POSTER)).toEqual([]);
  });

  describe("on a seeded tree", () => {
    const root = mkdtempSync(path.join(tmpdir(), "linkyo-renderer-imports-"));
    const poster = path.join(root, "features/directions/poster");
    const seed = (file: string, text: string) => writeFileSync(path.join(poster, file), text, "utf8");
    mkdirSync(poster, { recursive: true });
    seed("laufbahn-index.tsx", '"use client";\nexport const IndexList = () => null;\n');
    seed("laufbahn.tsx", 'import { IndexList } from "./laufbahn-index";\nexport const LatinRuns = IndexList;\nexport const LaufbahnAbout = IndexList;\n');
    seed("laufbahn-content.ts", "export const lineEms = 1;\n");
    seed("signposted-blocks.tsx", '"use client";\nimport dynamic from "next/dynamic";\nexport const LaufbahnAbout = dynamic(() => import("./laufbahn").then((m) => m.LaufbahnAbout));\n');
    seed("laufbahn-bar.tsx", "export interface DocumentLink { href: string }\n");
    seed("types-only.tsx", 'import type { LatinRuns } from "./laufbahn";\nimport { type DocumentLink } from "./laufbahn-bar";\nexport type T = typeof LatinRuns | DocumentLink;\n');
    seed("laufbahn-hero.tsx", 'import { LatinRuns } from "./laufbahn";\nimport { lineEms } from "./laufbahn-content";\nexport const DossierHero = [LatinRuns, lineEms];\n');
    seed("good-hero.tsx", 'import { lineEms } from "@/features/directions/poster/laufbahn-content";\nexport const DossierHero = lineEms;\n');
    seed("bad.tsx", 'import { DossierHero } from "./laufbahn-hero";\nimport { LaufbahnAbout } from "./signposted-blocks";\nimport "./types-only";\nexport const R = [DossierHero, LaufbahnAbout];\n');
    seed("good.tsx", 'import { DossierHero } from "./good-hero";\nimport { LaufbahnAbout } from "./signposted-blocks";\nimport "./types-only";\nexport { lineEms } from "./laufbahn-content";\nexport const R = [DossierHero, LaufbahnAbout];\n');
    afterAll(() => rmSync(root, { recursive: true, force: true }));

    it("names the chain of a static import into laufbahn.tsx and on to its client index", () => {
      const chain = ["features/directions/poster/bad.tsx", "features/directions/poster/laufbahn-hero.tsx", "features/directions/poster/laufbahn.tsx"];
      expect(leaks(path.join(poster, "bad.tsx"), root, poster)).toEqual([chain.join(" → "), [...chain, "features/directions/poster/laufbahn-index.tsx"].join(" → ")]);
    });

    it("passes a tree whose Laufbahn code comes only dynamically, through `@/` paths, re-exports and type-only imports", () => {
      expect(leaks(path.join(poster, "good.tsx"), root, poster)).toEqual([]);
      expect(reach(path.join(poster, "good.tsx"), root).modules.has(path.join(poster, "laufbahn-content.ts"))).toBe(true);
    });
  });
});
