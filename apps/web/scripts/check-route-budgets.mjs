#!/usr/bin/env node
/* eslint-disable no-console -- a command-line tool prints its result. */
/**
 * Route budgets (ADR 0008, restated as page code). Reads the production build in `.next` and fails
 * when a route ships more than its budget, so CI stops a change that makes creator pages, the
 * dashboard or the home page heavier.
 *
 *   npx next build && node scripts/check-route-budgets.mjs [--json <file>]
 *
 * What is counted, the same way before and after a change:
 * - A route's chunks: the JavaScript its HTML loads, read from the build: the client entry files of the
 *   route's layouts, page and boundaries (`entryJSFiles` in the page's client reference manifest, what
 *   `.next/diagnostics/route-bundle-stats.json` lists) without the global not-found page's own files,
 *   which only an address no route matches loads, plus the framework.
 * - Framework: Next's own code that every route loads: `rootMainFiles` in `.next/build-manifest.json`
 *   (React, React DOM, Next's router, the Turbopack runtime) and the files of Next's own client entries
 *   (its built-in not-found page and router parts, entries inside the `next` package).
 * - Page code: the route's chunks minus the framework.
 * - Sizes are gzip at zlib's default level, as `next start` serves them; 1 KB is 1,000 bytes.
 * Chunks a page loads later (a lazily loaded part, such as the picture viewer on its first press or
 * Laufbahn's index on a Laufbahn page) are not in its HTML and not counted here; the e2e check
 * (e2e/portfolio-perf-app.spec.ts) measures what a creator page really loads.
 *
 * Budgets:
 * - creator pages (`/u/<name>`, `/u/<name>/<project>`, `/<locale>/p/<slug>`, `/<locale>/p/<slug>/<project>`):
 *   page code at most 35 KB;
 * - the dashboard (`/<locale>/app`): first load (framework and page code) at most 350 KB, and in a demo build
 *   (no `NEXT_PUBLIC_SUPABASE_URL`) no Supabase code in any `/app` chunk;
 * - the home page (`/de`): its HTML at most 60 KB;
 * - every prerendered link preview card (`opengraph-image`): at most 300 KB.
 *
 * And one check of the server's files: every route that lays out or writes a Lebenslauf or an
 * Anschreiben (the six PDF routes and the two creator page routes that show the miniature) lists the
 * three Geist faces it reads at run time in its file trace (`.next/server/app/<route>.js.nft.json`),
 * so a serverless deployment carries them (ADR 0089).
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { gzipSync } from "node:zlib";

const KB = 1000;

/** The budgets, in bytes (gzip for code and HTML, the file itself for pictures). */
export const BUDGETS = Object.freeze({
  creatorPageCode: 35 * KB,
  appFirstLoad: 350 * KB,
  homeHtml: 60 * KB,
  ogImage: 300 * KB,
});

/** Creator pages: public pages and their projects, and the example pages and their projects. */
export const CREATOR_ROUTES = Object.freeze(["/u/[username]", "/u/[username]/[project]", "/[locale]/p/[slug]", "/[locale]/p/[slug]/[project]"]);
export const APP_ROUTE = "/[locale]/app";
/** The prerendered home page whose HTML is budgeted. */
export const HOME_HTML = "server/app/de.html";
/** Strings only Supabase's browser libraries carry (their client headers and the auth client's name). */
export const SUPABASE_SIGNATURE = /supabase-js|supabase-ssr|GoTrueClient/;

/** The faces the documents read at run time (features/documents/pdf/fonts.ts). */
export const DOCUMENT_FONTS = Object.freeze(["Geist-Regular.ttf", "Geist-SemiBold.ttf", "Geist-Bold.ttf"]);
/** The routes that lay out or write a PDF: the six document routes and the two creator page routes (their miniatures). */
export const DOCUMENT_ROUTES = Object.freeze(
  ["u/[username]", "[locale]/p/[slug]"].flatMap((base) => [`${base}/page`, ...["cv", "letter", "application"].map((kind) => `${base}/${kind}/route`)]),
);

/** gzip size of a buffer at zlib's default level (what `next start` sends). */
export const gzipSize = (buffer) => gzipSync(buffer).length;

/** "/[locale]/app/(shell)/page" → "/[locale]/app": the route an app path serves (Next's normalizeAppPath). */
export function routeOf(appPath) {
  const segments = appPath.split("/").filter((segment) => segment !== "" && !/^\(.*\)$/.test(segment) && !segment.startsWith("@"));
  if (segments.at(-1) === "page" || segments.at(-1) === "route") segments.pop();
  return `/${segments.join("/")}`;
}

/** An entry of Next's own (its built-in not-found page and router parts), not of the app. */
const NEXT_ENTRY = /\/node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?next\/dist\//;

/**
 * The client entry files a page's HTML loads: every entry of its client reference manifest but the
 * global not-found page's, split into Next's own entries and the app's.
 */
function htmlEntryFiles(distDir, appPath) {
  const file = join(distDir, "server", "app", `${appPath}_client-reference-manifest.js`);
  if (!existsSync(file)) return null;
  const scope = { __RSC_MANIFEST: {} };
  new Function("globalThis", "self", readFileSync(file, "utf8"))(scope, scope);
  const manifest = scope.__RSC_MANIFEST[appPath];
  if (!manifest) return null;
  /** @type {Record<string, string[]>} */
  const entries = manifest.entryJSFiles;
  const js = (list) => [...new Set(list)].filter((name) => name.endsWith(".js"));
  const kept = Object.entries(entries).filter(([entry]) => !entry.endsWith("/app/global-not-found"));
  return {
    all: js(kept.flatMap(([, files]) => files)),
    next: js(kept.flatMap(([entry, files]) => (NEXT_ENTRY.test(entry) ? files : []))),
  };
}

/**
 * The framework's files as the browser asks for them (`/_next/static/chunks/…`): `rootMainFiles` and
 * the files of Next's own client entries in any page's manifest. e2e/portfolio-perf-app.spec.ts takes
 * them out of what a page really loads, to count its page code the same way as here.
 * @param {string} appDir the app's folder (the one holding `.next`)
 */
export function frameworkFiles(appDir) {
  const distDir = join(appDir, ".next");
  /** @type {{ rootMainFiles: string[] }} */
  const manifest = JSON.parse(readFileSync(join(distDir, "build-manifest.json"), "utf8"));
  const files = new Set(manifest.rootMainFiles);
  /** @type {Record<string, string>} */
  const appPaths = JSON.parse(readFileSync(join(distDir, "server", "app-paths-manifest.json"), "utf8"));
  for (const appPath of Object.keys(appPaths)) {
    if (!appPath.endsWith("/page")) continue;
    for (const name of htmlEntryFiles(distDir, appPath)?.next ?? []) files.add(name);
  }
  return new Set([...files].map((name) => `/_next/${name}`));
}

/**
 * The chunks of every route, split into framework and page code, with raw and gzip sizes.
 * @param {string} appDir the app's folder (the one holding `.next`)
 */
export function readRoutes(appDir) {
  const distDir = join(appDir, ".next");
  const statsFile = join(distDir, "diagnostics", "route-bundle-stats.json");
  if (!existsSync(statsFile)) throw new Error(`${relative(process.cwd(), statsFile)} is missing: run \`next build\` (Turbopack) first.`);
  /** @type {{ route: string, firstLoadChunkPaths: string[] }[]} */
  const stats = JSON.parse(readFileSync(statsFile, "utf8"));
  /** @type {{ rootMainFiles: string[] }} */
  const manifest = JSON.parse(readFileSync(join(distDir, "build-manifest.json"), "utf8"));
  const framework = new Set(manifest.rootMainFiles.map((file) => join(distDir, file)));
  /** @type {Record<string, string>} */
  const appPaths = JSON.parse(readFileSync(join(distDir, "server", "app-paths-manifest.json"), "utf8"));
  /** @type {Map<string, string[]>} */
  const html = new Map();
  for (const appPath of Object.keys(appPaths)) {
    if (!appPath.endsWith("/page")) continue;
    const files = htmlEntryFiles(distDir, appPath);
    if (!files) continue;
    html.set(routeOf(appPath), [...files.all, ...manifest.rootMainFiles].map((name) => join(distDir, name)));
    // Next's own entries (its built-in not-found page, the router's client parts) load on every route: framework.
    for (const name of files.next) framework.add(join(distDir, name));
  }
  /** @type {Map<string, { raw: number, gzip: number, supabase: boolean }>} */
  const sizes = new Map();
  const sizeOf = (file) => {
    let size = sizes.get(file);
    if (!size) {
      const buffer = readFileSync(file);
      size = { raw: buffer.length, gzip: gzipSize(buffer), supabase: SUPABASE_SIGNATURE.test(buffer.toString("utf8")) };
      sizes.set(file, size);
    }
    return size;
  };
  /** @type {Record<string, ReturnType<typeof summarize>>} */
  const routes = {};
  for (const { route, firstLoadChunkPaths } of stats) {
    // What the HTML loads (route-bundle-stats lists the global not-found page's files too); the stats'
    // own list where a route has no page manifest.
    const files = [...new Set(html.get(route) ?? firstLoadChunkPaths.map((file) => join(appDir, file)))];
    routes[route] = summarize(files, framework, sizeOf, appDir);
  }
  return routes;
}

function summarize(files, framework, sizeOf, appDir) {
  const part = (list) => list.reduce((sum, file) => ({ raw: sum.raw + sizeOf(file).raw, gzip: sum.gzip + sizeOf(file).gzip }), { raw: 0, gzip: 0 });
  const own = files.filter((file) => !framework.has(file));
  return {
    chunks: files.length,
    total: part(files),
    framework: part(files.filter((file) => framework.has(file))),
    page: part(own),
    supabaseChunks: files.filter((file) => sizeOf(file).supabase).map((file) => relative(appDir, file)),
    pageChunks: own.map((file) => ({ file: relative(appDir, file), ...sizeOf(file) })),
  };
}

/** Every prerendered link preview card in the build, with its size and type. */
export function readCards(appDir) {
  const root = join(appDir, ".next", "server", "app");
  /** @type {{ path: string, bytes: number, type: string }[]} */
  const cards = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "opengraph-image.body") {
        const meta = full.replace(/\.body$/, ".meta");
        const type = existsSync(meta) ? (JSON.parse(readFileSync(meta, "utf8")).headers?.["content-type"] ?? "") : "";
        cards.push({ path: `/${relative(root, dirname(full))}/opengraph-image`, bytes: statSync(full).size, type });
      }
    }
  };
  if (existsSync(root)) walk(root);
  return cards.sort((a, b) => a.path.localeCompare(b.path));
}

/** The home page's HTML as prerendered (`/de`), raw and gzip. */
export function readHome(appDir) {
  const file = join(appDir, ".next", HOME_HTML);
  if (!existsSync(file)) return null;
  const buffer = readFileSync(file);
  return { raw: buffer.length, gzip: gzipSize(buffer) };
}

/**
 * The document faces missing from each document route's file trace (an empty list: all there).
 * @param {string} appDir the app's folder (the one holding `.next`)
 * @returns {{ route: string, missing: string[] }[]}
 */
export function readTraces(appDir) {
  return DOCUMENT_ROUTES.map((route) => {
    const file = join(appDir, ".next", "server", "app", `${route}.js.nft.json`);
    if (!existsSync(file)) return { route, missing: ["the route's trace"] };
    /** @type {{ files: string[] }} */
    const trace = JSON.parse(readFileSync(file, "utf8"));
    const traced = trace.files.map((name) => name.split("\\").join("/"));
    return { route, missing: DOCUMENT_FONTS.filter((face) => !traced.some((name) => name.endsWith(`/geist/dist/fonts/geist-sans/${face}`))) };
  });
}

/**
 * Every budget with its measured value.
 * @param {string} appDir
 * @param {{ demo: boolean }} options a demo build must ship no Supabase code to the dashboard
 */
export function checkBudgets(appDir, { demo }) {
  const routes = readRoutes(appDir);
  const cards = readCards(appDir);
  const home = readHome(appDir);
  /** @type {{ name: string, value: number, budget: number, ok: boolean, count?: boolean, detail?: string }[]} */
  const results = [];
  for (const route of CREATOR_ROUTES) {
    const stats = routes[route];
    if (!stats) {
      results.push({ name: `page code ${route}`, value: Number.NaN, budget: BUDGETS.creatorPageCode, ok: false, detail: "route missing from the build" });
      continue;
    }
    results.push({ name: `page code ${route}`, value: stats.page.gzip, budget: BUDGETS.creatorPageCode, ok: stats.page.gzip <= BUDGETS.creatorPageCode });
  }
  const app = routes[APP_ROUTE];
  results.push(
    app
      ? { name: `first load ${APP_ROUTE}`, value: app.total.gzip, budget: BUDGETS.appFirstLoad, ok: app.total.gzip <= BUDGETS.appFirstLoad }
      : { name: `first load ${APP_ROUTE}`, value: Number.NaN, budget: BUDGETS.appFirstLoad, ok: false, detail: "route missing from the build" },
  );
  if (demo) {
    const appRoutes = Object.entries(routes).filter(([route]) => route === APP_ROUTE || route.startsWith(`${APP_ROUTE}/`));
    const shipping = appRoutes.filter(([, stats]) => stats.supabaseChunks.length > 0).map(([route]) => route);
    results.push({ name: "demo build: no Supabase chunk in /app routes", value: shipping.length, budget: 0, ok: shipping.length === 0, ...(shipping.length ? { detail: shipping.join(", ") } : {}) });
  }
  results.push(
    home
      ? { name: "HTML /de", value: home.gzip, budget: BUDGETS.homeHtml, ok: home.gzip <= BUDGETS.homeHtml }
      : { name: "HTML /de", value: Number.NaN, budget: BUDGETS.homeHtml, ok: false, detail: `${HOME_HTML} missing (not prerendered?)` },
  );
  const heavy = cards.filter((card) => card.bytes > BUDGETS.ogImage);
  const largest = cards.reduce((max, card) => Math.max(max, card.bytes), 0);
  results.push({
    name: `link preview cards (${String(cards.length)}), largest`,
    value: largest,
    budget: BUDGETS.ogImage,
    ok: cards.length > 0 && heavy.length === 0,
    ...(heavy.length ? { detail: `${String(heavy.length)} over budget, e.g. ${heavy.slice(0, 5).map((card) => card.path).join(", ")}` } : cards.length ? {} : { detail: "no prerendered card found" }),
  });
  const traces = readTraces(appDir).filter((entry) => entry.missing.length > 0);
  results.push({
    name: `document fonts in the file traces of ${String(DOCUMENT_ROUTES.length)} routes, routes missing one`,
    value: traces.length,
    budget: 0,
    ok: traces.length === 0,
    count: true,
    ...(traces.length ? { detail: traces.map((entry) => `${entry.route}: ${entry.missing.join(", ")}`).join("; ") } : {}),
  });
  return { routes, cards, home, results };
}

const kb = (bytes) => (Number.isNaN(bytes) ? "?" : `${(bytes / KB).toFixed(1)} KB`);

function main() {
  const { values } = parseArgs({ options: { json: { type: "string" }, dir: { type: "string" } } });
  const appDir = values.dir ?? join(dirname(fileURLToPath(import.meta.url)), "..");
  const demo = !process.env.NEXT_PUBLIC_SUPABASE_URL;
  const report = checkBudgets(appDir, { demo });
  if (values.json) writeFileSync(values.json, `${JSON.stringify({ demo, budgets: BUDGETS, ...report }, null, 2)}\n`);
  console.log(`Route budgets (${demo ? "demo build" : "build with real accounts"}):`);
  for (const result of report.results) {
    const counted = result.name.startsWith("demo build") || result.count ? String(result.value) : `${kb(result.value)} of ${kb(result.budget)}`;
    console.log(`  ${result.ok ? "ok  " : "FAIL"}  ${result.name}: ${counted}${result.detail ? ` (${result.detail})` : ""}`);
  }
  const failed = report.results.filter((result) => !result.ok);
  if (failed.length) {
    console.error(`${String(failed.length)} budget(s) exceeded. See docs/DECISIONS/0008-public-page-rendering.md.`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
