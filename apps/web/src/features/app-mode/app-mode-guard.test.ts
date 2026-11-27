/**
 * App mode (ADR 0087): static guards that keep the iPhone app free of purchase surfaces and
 * of dead download and share buttons. They read the code, so they also hold for builds the e2e suite
 * does not run (a payments build, where the buy buttons and contract rows exist).
 *
 * 1. Every dashboard link to a purchase or contract page (`/checkout`, `/service`, `/kuendigen`,
 *    `/widerruf`, an order, the team area) renders only behind the app-mode value: a condition that
 *    reads `app` (the `useAppMode()` result), directly or through a local that does, around the link or
 *    around every place its component is used.
 * 2. Every blob download (`link.download = …`) and every `navigator.share(…)` in the dashboard asks the
 *    bridge first (`bridgeAvailable`, `appDownload`, `appShare`): a WKWebView ignores both. A download
 *    link (`<a download>`, a file on Storage's host) renders only outside the app.
 * 3. The web chrome the app replaces carries `data-app-hide`, and the creator page's credit link the
 *    `data-credit` the dashboard previews hide it by.
 * 4. The not-found and error pages, in the dashboard and outside it, lead in the app only back to the
 *    dashboard: never to the website's home page or templates (they show the prices).
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { NextIntlClientProvider } from "next-intl";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

import ar from "@/messages/ar.json";
import de from "@/messages/de.json";
import en from "@/messages/en.json";

import { ErrorScreen, NotFoundScreen } from "../errors/error-screen";

/** What the error pages below are rendered with: the address and whether the page is in the app. */
const view = vi.hoisted(() => ({ pathname: "/app/nope", app: false }));

// The localized navigation needs Next's router, which Node alone does not have: links render plain.
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement("a", { href, ...rest }, children),
  usePathname: () => view.pathname,
}));
vi.mock("@/features/app-mode/use-app-mode", () => ({ useAppMode: () => view.app, useKeepAppSignal: () => undefined }));

const SRC = path.resolve(import.meta.dirname, "../..");
/** The dashboard, the AI builder (the homepage replay's recordings aside) and the error pages. */
const DIRS = ["features/app", "features/ai", "features/errors"];
const EXCEPT = ["features/ai/recordings/"];

interface Source {
  file: string;
  ast: ts.SourceFile;
}

function sources(dir: string): Source[] {
  return readdirSync(path.join(SRC, dir), { recursive: true, encoding: "utf8" })
    .filter((name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name))
    .map((name) => `${dir}/${name.split(path.sep).join("/")}`)
    .filter((file) => !EXCEPT.some((prefix) => file.startsWith(prefix)))
    .sort()
    .map((file) => ({ file, ast: ts.createSourceFile(file, readFileSync(path.join(SRC, file), "utf8"), ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS) }));
}

const read = (file: string) => {
  const ast = ts.createSourceFile(file, readFileSync(path.join(SRC, file), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  return { file, ast };
};

function walk(node: ts.Node, visit: (node: ts.Node) => void) {
  visit(node);
  node.forEachChild((child) => {
    walk(child, visit);
  });
}

const lineOf = (source: Source, node: ts.Node) => source.ast.getLineAndCharacterOfPosition(node.getStart(source.ast)).line + 1;

const PURCHASE = /^\/(?:checkout|service|kuendigen|widerruf|admin)(?:[/?#]|$)|^\/app\/orders\//;

/** The address an href attribute names, where it is written out (a string or a template's start). */
function hrefText(attribute: ts.JsxAttribute): string | null {
  let value: ts.Node | undefined = attribute.initializer;
  if (value && ts.isJsxExpression(value)) value = value.expression;
  if (!value) return null;
  if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) return value.text;
  if (ts.isTemplateExpression(value)) return value.head.text;
  return null;
}

const FUNCTION = (node: ts.Node): node is ts.FunctionLikeDeclaration =>
  ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isMethodDeclaration(node);

/** The locals declared in a function (name → initializer text), for conditions such as `contracts && …`. */
function locals(fn: ts.Node, source: Source): Map<string, string> {
  const found = new Map<string, string>();
  walk(fn, (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) found.set(node.name.text, node.initializer.getText(source.ast));
  });
  return found;
}

/** A condition reads the app-mode value: `app` itself, or a local whose value reads it. */
function readsApp(condition: string, known: Map<string, string>): boolean {
  if (/\bapp\b/.test(condition)) return true;
  return [...condition.matchAll(/\b[A-Za-z_]\w*\b/g)].some(([name]) => /\bapp\b/.test(known.get(name) ?? ""));
}

/** A node's parent; the source file has none (the compiler's types say every node has one). */
const parentOf = (node: ts.Node): ts.Node | undefined => node.parent;

/** The nearest function around a node. */
function enclosingFunction(node: ts.Node): ts.FunctionLikeDeclaration | undefined {
  for (let at = parentOf(node); at; at = parentOf(at)) if (FUNCTION(at)) return at;
  return undefined;
}

/** Whether a node renders only behind an app-mode condition inside its own component. */
function guardedInComponent(node: ts.Node, source: Source): boolean {
  const fn = enclosingFunction(node);
  const known = fn ? locals(fn, source) : new Map<string, string>();
  for (let at = parentOf(node); at && at !== fn; at = parentOf(at)) {
    if (ts.isConditionalExpression(at) && readsApp(at.condition.getText(source.ast), known)) return true;
    if (ts.isBinaryExpression(at) && at.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken && readsApp(at.left.getText(source.ast), known)) return true;
  }
  return false;
}

/** The name of the component (a function declaration) a node is in. */
function componentOf(node: ts.Node): string | null {
  for (let at = parentOf(node); at; at = parentOf(at)) if (ts.isFunctionDeclaration(at) && at.name) return at.name.text;
  return null;
}

/** Guarded in its component, or every use of its component in the file is. */
function guarded(node: ts.Node, source: Source): boolean {
  if (guardedInComponent(node, source)) return true;
  const name = componentOf(node);
  if (!name) return false;
  const uses: ts.Node[] = [];
  walk(source.ast, (inner) => {
    if ((ts.isJsxSelfClosingElement(inner) || ts.isJsxOpeningElement(inner)) && inner.tagName.getText(source.ast) === name) uses.push(inner);
  });
  return uses.length > 0 && uses.every((use) => guardedInComponent(use, source));
}

describe("app mode: no purchase surface in the iPhone app", () => {
  const all = DIRS.flatMap(sources);

  it("renders every link to a purchase or contract page only outside the app", () => {
    const offences: string[] = [];
    let links = 0;
    for (const source of all) {
      walk(source.ast, (node) => {
        if (!ts.isJsxAttribute(node) || node.name.getText(source.ast) !== "href") return;
        const href = hrefText(node);
        if (!href || !PURCHASE.test(href)) return;
        links += 1;
        if (!guarded(node, source)) offences.push(`${source.file}:${String(lineOf(source, node))}  href="${href}" renders in the app`);
      });
    }
    expect(offences).toEqual([]);
    // The checkout, the service, withdrawal, cancellation (twice), an order and the team area: the guard
    // is looking at them, not at nothing.
    expect(links).toBeGreaterThanOrEqual(7);
  });

  it("hands every download and share in the dashboard, and on the creator page's two islands, to the bridge first", () => {
    const offences: string[] = [];
    let sites = 0;
    // The creator page's share button and live reminder, which "View my page" shows inside the app.
    const islands = ["features/directions/poster/share-island.tsx", "features/directions/poster/live-time.ts"].map(read);
    for (const source of [...all, ...islands]) {
      walk(source.ast, (node) => {
        const share = ts.isCallExpression(node) && node.expression.getText(source.ast) === "navigator.share";
        const download =
          ts.isBinaryExpression(node) &&
          node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
          ts.isPropertyAccessExpression(node.left) &&
          node.left.name.text === "download";
        if (!share && !download) return;
        sites += 1;
        const fn = enclosingFunction(node);
        const body = fn ? fn.getText(source.ast) : "";
        if (!/\b(?:bridgeAvailable|appDownload|appShare)\(/.test(body)) offences.push(`${source.file}:${String(lineOf(source, node))}  ${share ? "navigator.share" : "a blob download"} without the bridge`);
      });
    }
    expect(offences).toEqual([]);
    // Five downloads (export, CSV, story picture, QR PNG and SVG) and five shares (QR twice, story, page
    // link, invite) in the dashboard; the creator page's share and its live reminder.
    expect(sites).toBeGreaterThanOrEqual(11);
  });

  it("renders a download link only outside the app (the app gets the file through the bridge)", () => {
    const offences: string[] = [];
    let links = 0;
    for (const source of all) {
      walk(source.ast, (node) => {
        if (!ts.isJsxAttribute(node) || node.name.getText(source.ast) !== "download") return;
        links += 1;
        if (!guarded(node, source)) offences.push(`${source.file}:${String(lineOf(source, node))}  <a download> renders in the app`);
      });
    }
    expect(offences).toEqual([]);
    // The Premium kit's story pictures (proposals/proposal-screen.tsx).
    expect(links).toBeGreaterThanOrEqual(1);
  });

  it("hands the creator page's PDF links to the app: every <a download> there carries data-app-download, and the page renders the handler", () => {
    const offences: string[] = [];
    let links = 0;
    for (const source of sources("features/directions/poster")) {
      walk(source.ast, (node) => {
        if (!ts.isJsxAttribute(node) || node.name.getText(source.ast) !== "download") return;
        links += 1;
        const element = node.parent.parent;
        const names = element.attributes.properties.flatMap((property) => (ts.isJsxAttribute(property) ? [property.name.getText(source.ast)] : []));
        if (!names.includes("data-app-download")) offences.push(`${source.file}:${String(lineOf(source, node))}  <a download> without data-app-download`);
      });
    }
    expect(offences).toEqual([]);
    // The hero's CV, the bar's round button and pills, the contents sheet's rows, the Kontakt band's
    // rows, the Unterlagen cards and "Beides", the letter's pill.
    expect(links).toBeGreaterThanOrEqual(8);
    const bar = read("features/directions/poster/laufbahn-bar.tsx");
    expect(bar.ast.getText()).toMatch(/<AppDownloads \/>/u);
    expect(read("features/directions/poster/laufbahn-index.tsx").ast.getText()).toMatch(/appDownloadFrom\(/u);
  });
});

describe("app mode: the chrome the app replaces", () => {
  /** The attributes of every element that has `marker` (an attribute name, or a tag name). */
  function elements(file: string, marker: (element: ts.JsxOpeningElement | ts.JsxSelfClosingElement, source: Source) => boolean) {
    const source = read(file);
    const found: string[][] = [];
    walk(source.ast, (node) => {
      if (!ts.isJsxOpeningElement(node) && !ts.isJsxSelfClosingElement(node)) return;
      if (!marker(node, source)) return;
      found.push(node.attributes.properties.flatMap((property) => (ts.isJsxAttribute(property) ? [property.name.getText(source.ast)] : [])));
    });
    return found;
  }
  const has = (name: string) => (element: ts.JsxOpeningElement | ts.JsxSelfClosingElement, source: Source) =>
    element.attributes.properties.some((property) => ts.isJsxAttribute(property) && property.name.getText(source.ast) === name);
  const tag = (name: string) => (element: ts.JsxOpeningElement | ts.JsxSelfClosingElement, source: Source) => element.tagName.getText(source.ast) === name;

  it("hides the tab bar, the rail and the phone top bar", () => {
    for (const marker of [has("data-tabbar"), has("data-nav"), tag("header")]) {
      const found = elements("features/app/shell.tsx", marker);
      expect(found.length).toBeGreaterThan(0);
      for (const attributes of found) expect(attributes).toContain("data-app-hide");
    }
  });

  it("hides the loading frame's bars too, so the app never shows them for a moment", () => {
    const hidden = elements("features/app/gate.tsx", has("data-app-hide"));
    expect(hidden.length).toBeGreaterThanOrEqual(3);
  });

  it("hides the website's header and footer around help and legal pages", () => {
    for (const [file, name] of [
      ["features/marketing/header.tsx", "header"],
      ["features/marketing/footer.tsx", "footer"],
    ] as const) {
      const found = elements(file, tag(name));
      expect(found.length).toBe(1);
      expect(found[0]).toContain("data-app-hide");
    }
  });

  it("hides the sign-in and sign-up frame's link to the homepage and its legal foot", () => {
    // The homepage shows the prices; the foot links the AGB, Widerruf and Kündigen in a payments build.
    const [foot] = elements("features/account/auth/auth-shell.tsx", tag("footer"));
    expect(foot).toContain("data-app-hide");
    const source = read("features/account/auth/auth-shell.tsx");
    const home: string[][] = [];
    walk(source.ast, (node) => {
      if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.attributes.properties.some((property) => ts.isJsxAttribute(property) && property.name.getText(source.ast) === "href" && hrefText(property) === "/")) {
        home.push(node.attributes.properties.flatMap((property) => (ts.isJsxAttribute(property) ? [property.name.getText(source.ast)] : [])));
      }
    });
    expect(home).toHaveLength(1);
    expect(home[0]).toContain("data-app-hide");
  });

  it("hides the own page's floating bar, keeping its data-console (which hides the credit)", () => {
    const [bar] = elements("features/app/own-page-screen.tsx", has("data-console"));
    expect(bar).toEqual(expect.arrayContaining(["data-console", "data-app-hide"]));
  });

  it("marks the creator page's credit link, which the dashboard's previews hide in the app", () => {
    const credit = elements("features/directions/shared/creator-kit.tsx", has("data-credit"));
    expect(credit).toHaveLength(1);
    expect(credit[0]).toContain("href");
  });
});

describe("app mode: the not-found and error pages lead only back to the dashboard", () => {
  /** The page's links as rendered: where each leads, and whether the app hides it (`data-app-hide`). */
  function links(screen: ReactNode, pathname: string, app: boolean) {
    view.pathname = pathname;
    view.app = app;
    const markup = renderToStaticMarkup(createElement(NextIntlClientProvider, { locale: "de", messages: de, timeZone: "Europe/Berlin", children: screen }));
    return [...markup.matchAll(/<a\b([^>]*)>/g)].map(([, attributes = ""]) => ({
      href: /href="([^"]*)"/.exec(attributes)?.[1] ?? "",
      hidden: /\bdata-app-hide=/.test(attributes),
    }));
  }
  /** What a person sees in the app: the links the app does not hide. */
  const inApp = (found: { href: string; hidden: boolean }[]) => found.filter((link) => !link.hidden).map((link) => link.href);
  const notFound = createElement(NotFoundScreen);
  const failed = createElement(ErrorScreen, { error: new Error("x"), retry: () => undefined });

  it("a dashboard address that does not exist: only Zum Dashboard", () => {
    for (const pathname of ["/app/nope", "/app/orders/x", "/app/settings/nope"]) {
      expect(inApp(links(notFound, pathname, true)), pathname).toEqual(["/app"]);
      // The browser keeps both ways (the attribute does nothing there).
      expect(links(notFound, pathname, false).map((link) => link.href), pathname).toEqual(["/app", "/"]);
    }
    expect(inApp(links(failed, "/app/build", true))).toEqual(["/app"]);
  });

  it("a page outside the dashboard: the sentence names the dashboard, not the home page (appMode.errors.notFoundBody)", () => {
    const render = (app: boolean, locale: "de" | "en" | "ar" = "de") => {
      view.pathname = "/hilfe/nope";
      view.app = app;
      const messages = { de, en, ar }[locale];
      return renderToStaticMarkup(createElement(NextIntlClientProvider, { locale, messages, timeZone: "Europe/Berlin", children: createElement(NotFoundScreen) }));
    };
    /** The text a person sees in the app: what `data-app-hide` marks is gone. */
    const shownInApp = (markup: string) => markup.replace(/<(\w+)[^>]*data-app-hide[^>]*>.*?<\/\1>/g, "").replace(/<[^>]+>/g, " ");
    for (const [locale, messages, home] of [
      ["de", de, "Startseite"],
      ["en", en, "home page"],
      ["ar", ar, "الصفحة الرئيسية"],
    ] as const) {
      const app = shownInApp(render(true, locale));
      expect(app, locale).toContain(messages.appMode.errors.notFoundBody);
      expect(app, locale).not.toContain(home);
      expect(messages.appMode.errors.notFoundBody, locale).not.toContain(home);
      // A browser keeps the website's sentence; it is marked, so the app's CSS hides it before the page knows.
      const browser = render(false, locale);
      expect(browser, locale).toContain(messages.errors.notFound.body);
      expect(shownInApp(browser), locale).not.toContain(messages.errors.notFound.body);
    }
  });

  it("a page outside the dashboard: no home page and no templates, the dashboard instead", () => {
    expect(inApp(links(notFound, "/hilfe/nope", true))).toEqual(["/app"]);
    expect(inApp(links(failed, "/hilfe", true))).toEqual(["/app"]);
    // A browser: the home page and the templates, and no dashboard link added.
    expect(links(notFound, "/hilfe/nope", false).map((link) => link.href)).toEqual(["/", "/templates"]);
    expect(links(failed, "/hilfe", false).map((link) => link.href)).toEqual(["/"]);
  });
});
