/**
 * The creator dashboard is black and grey (ADR 0062): the same semantic classes resolve to the console
 * palette through data-console. These static guards keep the dashboard's code from stepping around it.
 *
 * 1. No link inside running text (t.rich mapping a tag to <Link> or <a>): in the dashboard links are
 *    body coloured, so only standalone links (bold, with an icon) are recognisable as links.
 * 2. No "text-link" with "hover:text-fg": a link hovers with "hover:text-link-hover".
 * 3. No palette or tint colours (tokens.color.*, tint-*) under features/app: they would stay teal,
 *    violet or warm grey inside the console.
 * 4. No data-theme under features/app: a light subtree would bring the teal roles back.
 * 5. The creator page renderer never uses the app roles the console changes, so the live preview keeps
 *    the creator's own colours.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { tokens } from "@linkyo/tokens";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(import.meta.dirname, "../..");
const APP = "features/app";
/** The AI builder's views sit in the dashboard too (the homepage replay's recordings aside). */
const AI = "features/ai";
const AI_EXCEPT = "features/ai/recordings/";

/** Rule 3 allowances: a phone bezel and a QR code drawn on paper, which must look the same everywhere. */
const PALETTE_ALLOWED: Record<string, readonly string[]> = {
  "features/app/preview.tsx": ["bg-ink"],
  // The QR code and its sheet (loaded the first time a QR sheet opens).
  "features/app/share-qr.tsx": ["bg-white", "text-ink", "fill-white", "fill-ink"],
};

/** Rule 5: the files the creator page renderer is made of. */
const RENDERER_DIRS = ["features/directions/poster", "features/directions/shared"];
const RENDERER_EXCEPTIONS = new Set([
  // Dashboard chrome around the renderer, not part of the page.
  "features/directions/poster/template-picker.tsx",
  "features/directions/poster/dashboard.tsx",
  // Linkyo's own sign-up bar on public pages, mounted by the page routes, never by the renderer (its
  // server part and its island).
  "features/directions/shared/dock.tsx",
  "features/directions/shared/dock-island.tsx",
]);
const RENDERER_FORBIDDEN = ["bg-primary", "text-link", "bg-selected", "bg-tinted", "bg-canvas-muted"];

// ---------------------------------------------------------------------------------------------
// Reading the code

interface Source {
  /** Path relative to src, e.g. "features/app/shell.tsx". */
  file: string;
  text: string;
  ast: ts.SourceFile;
}

function parse(file: string, text: string): Source {
  const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return { file, text, ast: ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind) };
}

function sources(dir: string, recursive: boolean): Source[] {
  return readdirSync(path.join(SRC, dir), { recursive, encoding: "utf8" })
    .filter((name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name))
    .sort()
    .map((name) => {
      const file = `${dir}/${name.split(path.sep).join("/")}`;
      return parse(file, readFileSync(path.join(SRC, file), "utf8"));
    });
}

function walk(node: ts.Node, visit: (node: ts.Node) => void) {
  visit(node);
  node.forEachChild((child) => {
    walk(child, visit);
  });
}

const lineOf = (source: Source, node: ts.Node) => source.ast.getLineAndCharacterOfPosition(node.getStart(source.ast)).line + 1;

type Literal = ts.StringLiteral | ts.NoSubstitutionTemplateLiteral | ts.TemplateHead | ts.TemplateMiddle | ts.TemplateTail;
const isLiteral = (node: ts.Node): node is Literal =>
  ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node);

/** Every string in the code (module names aside), with its line. */
function strings(source: Source): { line: number; text: string }[] {
  const found: { line: number; text: string }[] = [];
  walk(source.ast, (node) => {
    if (!isLiteral(node)) return;
    const parent = node.parent;
    if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent) || ts.isExternalModuleReference(parent)) return;
    found.push({ line: lineOf(source, node), text: node.text });
  });
  return found;
}

/** A class list as one unit: a className attribute, a cn()/clsx()/cva() call, or a single string. */
function classGroups(source: Source): { line: number; classes: string[] }[] {
  const groups: { line: number; classes: string[] }[] = [];
  const collect = (node: ts.Node) => {
    const texts: string[] = [];
    walk(node, (inner) => {
      if (isLiteral(inner)) texts.push(inner.text);
    });
    groups.push({ line: lineOf(source, node), classes: texts.join(" ").split(/\s+/).filter(Boolean) });
  };
  walk(source.ast, (node) => {
    if (ts.isJsxAttribute(node) && node.name.getText(source.ast) === "className" && node.initializer) collect(node.initializer);
    else if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && ["cn", "clsx", "cva"].includes(node.expression.text)) collect(node);
    else if (isLiteral(node)) collect(node);
  });
  return groups;
}

/** "max-lg:hover:!bg-teal-100/50" → "bg-teal-100/50": the utility without its variants. */
function utilityOf(token: string): string {
  let depth = 0;
  let cut = -1;
  for (let i = 0; i < token.length; i += 1) {
    const char = token[i];
    if (char === "[" || char === "(") depth += 1;
    else if (char === "]" || char === ")") depth -= 1;
    else if (char === ":" && depth === 0) cut = i;
  }
  return token.slice(cut + 1).replace(/^!|!$/g, "").replace(/^-/, "");
}

const COLOR_UTILITIES = "(?:bg|text|border(?:-[xytrbse])?|ring|ring-offset|outline|fill|stroke|from|via|to|divide|accent|caret|placeholder|decoration)";
/** Every palette colour in tokens.color: single colours (ink, paper, white) and the steps of each scale. */
const PALETTE = new RegExp(
  `^${COLOR_UTILITIES}-(?:${Object.entries(tokens.color)
    .map(([name, value]) => (typeof value === "string" ? name : `${name}-\\d+`))
    .join("|")})(?:/\\S+)?$`,
);
const TINT = new RegExp(`^${COLOR_UTILITIES}-tint-[a-z]+(?:/\\S+)?$`);

// ---------------------------------------------------------------------------------------------
// The rules (each returns "file:line  what", one per offence)

function richLinks(source: Source): string[] {
  const found: string[] = [];
  walk(source.ast, (node) => {
    if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression) || node.expression.name.text !== "rich") return;
    walk(node, (inner) => {
      const tag = ts.isJsxElement(inner) ? inner.openingElement.tagName : ts.isJsxSelfClosingElement(inner) ? inner.tagName : null;
      const name = tag?.getText(source.ast);
      if (name === "Link" || name === "a") {
        found.push(`${source.file}:${lineOf(source, inner)}  ${node.expression.getText(source.ast)}() maps a tag to <${name}>: a link inside running text. Make it a standalone link with an icon.`);
      }
    });
  });
  return found;
}

function linkHoverToFg(source: Source): string[] {
  const found = classGroups(source)
    .filter(({ classes }) => classes.some((token) => token === "text-link") && classes.some((token) => /(^|:)hover:text-fg$/.test(token)))
    .map(({ line }) => `${source.file}:${line}  "text-link" with "hover:text-fg": use "hover:text-link-hover"`);
  // A className attribute and the cn() call inside it are the same class list.
  return [...new Set(found)];
}

function paletteClasses(source: Source): string[] {
  const allowed = PALETTE_ALLOWED[source.file] ?? [];
  const found: string[] = [];
  for (const { line, text } of strings(source)) {
    for (const token of text.split(/\s+/)) {
      const utility = utilityOf(token);
      if ((PALETTE.test(utility) || TINT.test(utility)) && !allowed.includes(utility)) {
        found.push(`${source.file}:${line}  "${token}" is a palette colour: use a semantic role`);
      }
    }
  }
  return found;
}

function themeOverrides(source: Source): string[] {
  const found: string[] = [];
  walk(source.ast, (node) => {
    const at = () => `${source.file}:${lineOf(source, node)}`;
    if (ts.isJsxAttribute(node) && node.name.getText(source.ast) === "data-theme") found.push(`${at()}  data-theme= inside the dashboard`);
    else if (isLiteral(node) && /data-theme\s*=/.test(node.text)) found.push(`${at()}  "${node.text}" sets data-theme inside the dashboard`);
    else if (ts.isPropertyAccessExpression(node) && node.name.text === "theme" && node.expression.getText(source.ast).endsWith("dataset")) {
      found.push(`${at()}  ${node.getText(source.ast)}: data-theme inside the dashboard`);
    }
  });
  return found;
}

function rendererAppRoles(source: Source): string[] {
  const found: string[] = [];
  for (const { line, text } of strings(source)) {
    for (const token of text.split(/\s+/)) {
      const utility = utilityOf(token);
      const role = RENDERER_FORBIDDEN.find((name) => utility === name || utility.startsWith(`${name}-`) || utility.startsWith(`${name}/`));
      if (role) found.push(`${source.file}:${line}  "${token}" is an app role the dashboard recolours: the page renderer uses --creator-* only`);
    }
  }
  return found;
}

// ---------------------------------------------------------------------------------------------

describe("the guards themselves catch what they guard", () => {
  const sample = parse(
    "features/app/sample.tsx",
    [
      'const a = t.rich("terms", { link: (chunks) => <Link href="/legal">{chunks}</Link> });',
      'const b = <a className={cn("font-semibold text-link", "hover:text-fg")} />;',
      'const c = <div className="max-lg:hover:bg-teal-100 bg-tint-rose text-ink data-[x]:border-gray-200/50 bg-tinted text-success-strong bg-success-500" />;',
      'const d = <div data-theme="light" />;',
      "document.documentElement.dataset.theme = 'light';",
      'const e = <p className="bg-primary-hover text-link-hover bg-surface" />;',
      'import { x } from "teal-white";',
    ].join("\n"),
  );

  it("reads a class without its variants", () => {
    expect(utilityOf("max-lg:group-data-[grouped]/app:hover:!bg-teal-100/50")).toBe("bg-teal-100/50");
    expect(utilityOf("[&_svg]:text-ink")).toBe("text-ink");
    expect(utilityOf("-mt-2")).toBe("mt-2");
  });

  it("flags each kind of offence, and only those", () => {
    expect(richLinks(sample)).toHaveLength(1);
    expect(linkHoverToFg(sample)).toEqual([expect.stringContaining("features/app/sample.tsx:2")]);
    const palette = paletteClasses(sample).map((line) => /"([^"]+)"/.exec(line)?.[1]);
    expect(palette).toEqual(["max-lg:hover:bg-teal-100", "bg-tint-rose", "text-ink", "data-[x]:border-gray-200/50", "bg-success-500"]);
    expect(themeOverrides(sample)).toHaveLength(2);
    expect(rendererAppRoles(sample).map((line) => /"([^"]+)"/.exec(line)?.[1])).toEqual(["text-link", "bg-tinted", "bg-primary-hover", "text-link-hover"]);
  });
});

describe("console guard (ADR 0062)", () => {
  const app = sources(APP, true);
  const ai = sources(AI, true).filter((source) => !source.file.startsWith(AI_EXCEPT));
  const renderer = RENDERER_DIRS.flatMap((dir) => sources(dir, false)).filter((source) => !RENDERER_EXCEPTIONS.has(source.file));

  it("scans the dashboard and the page renderer", () => {
    expect(app.map((source) => source.file)).toEqual(expect.arrayContaining(["features/app/shell.tsx", "features/app/home/link-card.tsx"]));
    expect(ai.map((source) => source.file)).toEqual(expect.arrayContaining(["features/ai/run-view.tsx", "features/ai/build-screen.tsx"]));
    expect(renderer.map((source) => source.file)).toEqual(expect.arrayContaining(["features/directions/poster/renderer.tsx", "features/directions/shared/creator-kit.tsx"]));
    // The allowances are still needed (otherwise drop them).
    for (const [file, allowed] of Object.entries(PALETTE_ALLOWED)) {
      const source = app.find((candidate) => candidate.file === file);
      const used = new Set(source ? strings(source).flatMap(({ text }) => text.split(/\s+/).map(utilityOf)) : []);
      for (const utility of allowed) expect(used.has(utility), `${file} still uses ${utility}`).toBe(true);
    }
  });

  it("1. no link inside running text: t.rich() never maps a tag to <Link> or <a>", () => {
    expect([...app, ...ai].flatMap(richLinks)).toEqual([]);
  });

  it('2. links hover with "hover:text-link-hover", never "hover:text-fg"', () => {
    expect(app.flatMap(linkHoverToFg)).toEqual([]);
  });

  it("3. no palette or tint colours under features/app and features/ai", () => {
    expect([...app, ...ai].flatMap(paletteClasses)).toEqual([]);
  });

  it("4. no data-theme under features/app", () => {
    expect(app.flatMap(themeOverrides)).toEqual([]);
  });

  it("5. the page renderer uses none of the app roles the console changes", () => {
    expect(renderer.flatMap(rendererAppRoles)).toEqual([]);
  });
});
