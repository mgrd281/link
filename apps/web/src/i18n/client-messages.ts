import type { AbstractIntlMessages } from "next-intl";

import { TRY_AI_ANY } from "@/features/marketing/try-ai";

/**
 * What a creator page's islands read: the picture viewer, the rail buttons, the code sample's copy
 * button, the way back from a missing project, the privacy notice and the players. Of a portfolio's
 * words only those travel; the rest is rendered on the server.
 */
const CREATOR_ISLANDS = [
  "creator",
  "!creator.portfolio",
  "creator.portfolio.pictureOf",
  "creator.portfolio.previousPicture",
  "creator.portfolio.nextPicture",
  "creator.portfolio.viewer",
  "creator.portfolio.closeViewer",
  "creator.portfolio.railBack",
  "creator.portfolio.railOn",
  "creator.portfolio.copyCodeSample",
  "creator.portfolio.toPage",
  "creator.portfolio.projectMissing",
] as const;

/**
 * The playground's AI tab (try-ai-panel.tsx) reads the AI run's words. The tab shows only where a real
 * recording exists (`TRY_AI_ANY`, none in phase 1); without it these words stay out of the page.
 */
const TRY_AI = TRY_AI_ANY ? (["ai.run", "app.ai.platform", "app.ai.review.topics"] as const) : (["!marketing.try.ai"] as const);

/**
 * What the website's client components read: the root layout of `/<locale>` passes it to the home page
 * and to every page without a group of its own below (templates, portfolio, service, the example pages
 * under /p, invitations, errors). Everything else on those pages is rendered on the server.
 */
const SITE = [
  "common",
  "errors",
  // The not-found page's sentence inside the iPhone app (features/errors/error-screen.tsx).
  "appMode.errors",
  "search",
  // The people search's filters and badges, the template gallery, the way back from a missing example.
  "examples",
  // The example pages under /p (their islands, as on creator pages), and the live page in the home
  // page's playground (a page of links: it reads none of a portfolio's server-rendered words).
  ...CREATOR_ISLANDS,
  // The home page's islands: the menu, the claim form, the hero deck, the playground (and its AI tab
  // where it shows, TRY_AI).
  "marketing.nav",
  "marketing.claim",
  "marketing.hero",
  "marketing.try",
  "marketing.paste",
  "marketing.features.look",
  // The playground edits a page with the dashboard's own parts (site-context, preview, forms, use-editor).
  "app.form",
  "app.preview",
  "app.editor",
  "app.errors",
  "app.undo",
  "app.added",
  "app.removed",
  "dashboard.types",
  "dashboard.added",
  "dashboard.addedShort",
  "dashboard.deleted",
  "dashboard.invalid",
  "dashboard.undo",
  ...TRY_AI,
] as const;

/**
 * Which messages reach the browser, per route group (E-03, ADR 0008). A page's server components read
 * every message on the server; only the words its client components read travel in the page (inside
 * the HTML, once per page). Each group's provider (`ClientMessages`) passes exactly its list:
 *
 * - `site`: the root layout of `/<locale>` (`SITE` above).
 * - `auth`, `legal`, `checkout`: sign-up and sign-in, the legal pages and the cancellation page, the
 *   checkouts; each layout passes the site's words and its own.
 * - `app`, `admin`, `design`, `directions`: the dashboard, the team console, the design system and the
 *   design prototypes, each in its own layout.
 * - `creator`: public creator pages (`/u/<name>`, their own root layout).
 *
 * A provider replaces the one above it, so a group lists everything its pages read in the browser. An
 * entry is a namespace ("search"), a path into one ("app.form"), `*` (every namespace), or a path to
 * leave out again, written `!path` ("!admin"). Entries apply in order.
 *
 * When a client component starts reading a namespace, add it to the group that renders it (a new site
 * page with a search island adds "help.search" to `SITE`, for example, or gets a group and a layout of
 * its own). A missing message shows its key on the page and logs MISSING_MESSAGE, which
 * e2e/portfolio-perf-app.spec.ts fails on.
 */
export const CLIENT_NAMESPACES = {
  site: SITE,
  // The help page (/hilfe): its search island reads `help.search` in the browser; the articles are
  // rendered on the server. A group of its own keeps those words off every other site page.
  help: [...SITE, "help.search"],
  auth: [...SITE, "auth"],
  legal: [...SITE, "legal", "orders.package"],
  checkout: [...SITE, "checkout", "orders.package", "service"],
  // `pwa`: the manifest's and the offline page's words, written on the server only (features/pwa).
  app: ["*", "!admin", "!email", "!design", "!pwa"],
  admin: ["*", "!email", "!pwa"],
  design: ["*", "!admin", "!email", "!pwa"],
  directions: ["*", "!admin", "!email", "!pwa"],
  // Of a portfolio's words only those its islands read travel (CREATOR_ISLANDS). The rest is server-rendered.
  creator: [...CREATOR_ISLANDS, "common"],
} as const satisfies Record<string, readonly string[]>;

export type ClientGroup = keyof typeof CLIENT_NAMESPACES;

type Messages = Record<string, unknown>;
const isRecord = (value: unknown): value is Messages => typeof value === "object" && value !== null && !Array.isArray(value);

function get(messages: Messages, path: readonly string[]): unknown {
  let node: unknown = messages;
  for (const key of path) {
    if (!isRecord(node) || !Object.hasOwn(node, key)) return undefined;
    node = node[key];
  }
  return node;
}

function set(target: Messages, path: readonly string[], value: unknown): void {
  let node = target;
  for (const key of path.slice(0, -1)) {
    const next = node[key];
    node = isRecord(next) ? next : (node[key] = {});
  }
  const last = path.at(-1);
  if (last !== undefined) node[last] = value;
}

function remove(target: Messages, path: readonly string[]): void {
  const parent = get(target, path.slice(0, -1));
  const last = path.at(-1);
  if (isRecord(parent) && last !== undefined) Reflect.deleteProperty(parent, last);
}

/** A deep copy of a message tree (JSON values only), so picking never shares objects with the catalogue. */
const copy = <T>(value: T): T => (isRecord(value) || Array.isArray(value) ? (JSON.parse(JSON.stringify(value)) as T) : value);

/** The messages a list of entries names (see `CLIENT_NAMESPACES`), copied out of the whole catalogue. */
export function pickMessages(all: AbstractIntlMessages, entries: readonly string[]): AbstractIntlMessages {
  const picked: Messages = {};
  for (const entry of entries) {
    if (entry === "*") {
      for (const [key, value] of Object.entries(all)) picked[key] = copy(value);
      continue;
    }
    if (entry.startsWith("!")) {
      remove(picked, entry.slice(1).split("."));
      continue;
    }
    const path = entry.split(".");
    const value = get(all, path);
    if (value !== undefined) set(picked, path, copy(value));
  }
  return picked as AbstractIntlMessages;
}

/** A route group's messages for the browser. */
export const clientMessages = (all: AbstractIntlMessages, group: ClientGroup): AbstractIntlMessages => pickMessages(all, CLIENT_NAMESPACES[group]);
