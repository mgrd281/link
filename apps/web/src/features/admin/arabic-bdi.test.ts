import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import ar from "@/messages/ar.json";
import de from "@/messages/de.json";
import en from "@/messages/en.json";

/**
 * S1-R-04: in the team console's Arabic, Latin names (Pro, Free, Stripe, IP, CSV) and numbers sit
 * inside <bdi>, so they keep their direction and punctuation stays put (the rule of the
 * portfolioLanding test in features/marketing/portfolio/model.test.ts, for the admin namespaces the
 * Stage 1 review named). Call sites render them with t.rich / t.markup and a `bdi` tag.
 */

interface Tree {
  [key: string]: Tree | string;
}

/** Every string under `prefix`, by its dotted key. */
function strings(tree: Tree | string, prefix: string): [string, string][] {
  if (typeof tree === "string") return [[prefix, tree]];
  return Object.entries(tree).flatMap(([key, value]) => strings(value, `${prefix}.${key}`));
}

const at = (messages: unknown, key: string): Tree | string => key.split(".").reduce<unknown>((node, part) => (node as Tree)[part], messages) as Tree | string;

/**
 * The namespaces and keys the rule covers: since Stage 3 (WP3.4) every namespace of the console's
 * screens. Left out: `admin.gate` (the team-code screen, rendered by session.tsx, which keeps `t()`).
 */
const SCOPE = [
  "admin.meta",
  "admin.nav",
  "admin.shell",
  "admin.overview",
  "admin.charts",
  "admin.customers",
  "admin.customer",
  "admin.subscriptions",
  "admin.security",
  "admin.analytics",
  "admin.creators",
  "admin.creator",
  "admin.templates",
  "admin.referrals",
  "admin.team",
  "admin.roles",
  "admin.permissions",
  "admin.activity",
  "admin.status",
  "admin.locales",
  "admin.orders",
  "admin.preview",
];

it("leaves out only the namespaces it names", () => {
  const admin = Object.keys(ar.admin);
  const covered = new Set(SCOPE.map((key) => key.split(".")[1]));
  expect(admin.filter((key) => !covered.has(key))).toEqual(["gate"]);
});

/**
 * The literal text of a message outside <bdi>: without the isolated runs, the ICU structure
 * (`{count, plural, one {…}}`, `{name}`) and the plural's `#` (formatted in the reader's locale).
 */
function plain(message: string): string {
  return message
    .replace(/<bdi>[\s\S]*?<\/bdi>/g, "")
    .replace(/\{\s*\w+\s*,\s*(plural|select|selectordinal)\s*,/g, "{")
    .replace(/(^|[\s{}])(=\d+|zero|one|two|few|many|other)\s*\{/g, "$1{")
    .replace(/\{\w+\}/g, "")
    .replace(/#/g, "");
}

describe("Arabic team console strings", () => {
  const arabic = SCOPE.flatMap((key) => strings(at(ar, key), key));

  it("cover the namespaces of the review", () => {
    expect(arabic.length).toBeGreaterThan(150);
  });

  it("isolate Latin names and numbers in <bdi>", () => {
    const offenders = arabic.filter(([, message]) => /[A-Za-z0-9]/.test(plain(message))).map(([key, message]) => `${key}: ${message}`);
    expect(offenders).toEqual([]);
  });

  it("keep German and English free of the tag (it is only for Arabic)", () => {
    for (const messages of [de, en]) {
      const tagged = SCOPE.flatMap((key) => strings(at(messages, key), key)).filter(([, message]) => message.includes("<bdi>"));
      expect(tagged).toEqual([]);
    }
  });

  it.each([
    ["ar", ar],
    ["de", de],
    ["en", en],
  ] as const)("%s: every string in scope formats with the bdi tag", (locale, messages) => {
    const errors: string[] = [];
    const t = createTranslator({ locale, messages, onError: (error) => errors.push(`${error.code}: ${error.message}`) }) as unknown as {
      markup(key: string, values: Record<string, unknown>): string;
    };
    for (const [key, message] of SCOPE.flatMap((scope) => strings(at(messages, scope), scope))) {
      const values: Record<string, unknown> = { bdi: (chunks: string) => `[${chunks}]` };
      for (const [, name] of message.matchAll(/\{\s*(\w+)\s*\}/g)) if (name) values[name] = "X";
      for (const [, name] of message.matchAll(/\{\s*(\w+)\s*,\s*(plural|selectordinal)\b/g)) if (name) values[name] = 2;
      for (const [, name] of message.matchAll(/\{\s*(\w+)\s*,\s*select\b/g)) if (name) values[name] = "other";
      const text = t.markup(key, values);
      expect(text, key).not.toMatch(/[{}<>]/);
    }
    expect(errors).toEqual([]);
  });

  it("name the free plan one way: 'المجانية', as the creator's Plan pane and the pricing page's text do", () => {
    const named = arabic.filter(([, message]) => /<bdi>Free<\/bdi>|\bFree\b/.test(message)).map(([key]) => key);
    expect(named).toEqual([]);
    expect(ar.admin.customers.plans.free).toBe("المجانية");
    expect(ar.admin.overview.kpi.conversion).toBe(ar.admin.subscriptions.conversion);
  });

  it("render the isolated runs where the console shows them", () => {
    const t = createTranslator({ locale: "ar", messages: ar, namespace: "admin" });
    const tag = (chunks: string) => `[${chunks}]`;
    expect(t.markup("customer.toast.cancelScheduled", { date: "30 نوفمبر 2026", bdi: tag })).toBe("تنتهي [Pro] في [30 نوفمبر 2026]");
    expect(t.markup("customer.sources.stripe", { bdi: tag })).toBe("[Stripe] (مدفوع)");
    expect(t.markup("analytics.visited", { count: "12", bdi: tag })).toBe("صفحات لها زوار ([30] يومًا): [12]");
    expect(t.markup("permissions.customers_export", { bdi: tag })).toBe("تصدير قائمة العملاء ([CSV])");
    // A range of figures alone has no direction of its own: isolated (left to right) it reads 1–25, not 25–1.
    expect(t.markup("security.pageRange", { from: 1, to: 25, total: 853, bdi: tag })).toBe("[1–25] من [853]");
  });
});
