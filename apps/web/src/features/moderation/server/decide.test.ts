import { describe, expect, it, vi } from "vitest";

import { emailTranslator, type EmailLocale } from "@/features/email/templates/render";
import type { EmailMessage } from "@/features/email/types";
import ar from "@/messages/ar.json";
import de from "@/messages/de.json";
import en from "@/messages/en.json";

import { decide, parseDecision, refusal, type DecideDeps, type DecideInput } from "./decide";

vi.mock("server-only", () => ({}));

const CUSTOMER = "11111111-2222-4333-8444-555555555555";
const REPORT = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const MESSAGES = { de, en, ar } as const;

const done = (overrides: Record<string, unknown> = {}) => ({
  decision: "d1d1d1d1-0000-4000-8000-000000000001",
  customer: CUSTOMER,
  username: "mila",
  locale: "en",
  blockLabel: "About me",
  decidedAt: "2026-11-28T12:00:00Z",
  report: { id: REPORT, email: "kai@example.com", name: "Kai", locale: "de", receivedAt: "2026-11-27T09:00:00Z", page: "mila", category: "privacy" },
  ...overrides,
});

function world(answer: { data: unknown; error: { code?: string; message?: string } | null } = { data: done(), error: null }, delivers = true) {
  const log: string[] = [];
  const sent: EmailMessage[] = [];
  const deps: DecideDeps = {
    moderate: (input) => {
      log.push(`moderate ${input.decision}`);
      return Promise.resolve(answer);
    },
    address: () => {
      log.push("address");
      return Promise.resolve({ username: "mila", slugs: ["hafenlicht"] });
    },
    revalidate: (usernames, slugs) => log.push(`revalidate ${usernames.join(",")} ${slugs.join(",")}`),
    accountEmail: () => Promise.resolve("mila@example.com"),
    deliver: async (message) => {
      const built = await message();
      if (built) sent.push(built);
      return delivers && built !== null;
    },
    translator: (locale: EmailLocale) => Promise.resolve(emailTranslator(locale, MESSAGES[locale])),
    pageAddress: (username) => `linkyo.app/${username}`,
    site: "https://linkyo.app",
    contact: "team@example.com",
  };
  return { deps, log, sent };
}

const hide: DecideInput = { decision: "hide_block", customer: CUSTOMER, reason: "The block names a private home address.", ground: "illegal", block: "about", report: REPORT };

describe("reading a decision request", () => {
  it("takes each decision with what it needs, and nothing it does not", () => {
    expect(parseDecision({ decision: "hide_block", customer: CUSTOMER, reason: hide.reason, ground: "illegal", block: "about", report: REPORT })).toEqual(hide);
    expect(parseDecision({ decision: "unpublish", customer: CUSTOMER, reason: hide.reason, ground: "terms", block: "about" })).toEqual({ ...hide, decision: "unpublish", ground: "terms", block: null, report: null });
    expect(parseDecision({ decision: "dismiss", reason: "Nothing on the page is illegal.", report: REPORT, ground: "terms" })).toEqual({ decision: "dismiss", customer: null, reason: "Nothing on the page is illegal.", ground: null, block: null, report: REPORT });
  });

  it("refuses a decision without its reason, ground, block, account or report", () => {
    expect(parseDecision({ ...hide, reason: "short" })).toBeNull();
    expect(parseDecision({ ...hide, ground: null })).toBeNull();
    expect(parseDecision({ ...hide, block: null })).toBeNull();
    expect(parseDecision({ ...hide, customer: "mila" })).toBeNull();
    expect(parseDecision({ decision: "dismiss", reason: "Nothing on the page is illegal." })).toBeNull();
    expect(parseDecision({ ...hide, decision: "delete" })).toBeNull();
    expect(parseDecision(null)).toBeNull();
  });

  it("answers each refusal of the database with its own word", () => {
    expect(refusal({ code: "42501", message: "linkyo:forbidden" })).toEqual({ status: 403, error: "forbidden" });
    expect(refusal({ code: "PGRST202", message: "Could not find the function" })).toEqual({ status: 409, error: "unavailable" });
    expect(refusal({ code: "P0001", message: "linkyo:alreadyDecided" })).toEqual({ status: 409, error: "alreadyDecided" });
    expect(refusal({ code: "P0001", message: "linkyo:blockNotFound" })).toEqual({ status: 409, error: "blockNotFound" });
    expect(refusal({ code: "P0001", message: "linkyo:reasonRequired" })).toEqual({ status: 400, error: "invalid" });
    expect(refusal({ code: "XX000", message: "boom" })).toEqual({ status: 500, error: "server" });
  });
});

describe("a decision on the server", () => {
  it("reads the addresses, decides as the member, drops the cache, then sends both e-mails", async () => {
    const { deps, log, sent } = world();
    expect(await decide(hide, deps)).toEqual({ status: 200, body: { ok: true, creatorMailed: true, reporterMailed: true } });
    expect(log).toEqual(["address", "moderate hide_block", "revalidate mila,mila hafenlicht"]);
    const [statement, notice] = sent;
    expect(statement?.to).toBe("mila@example.com");
    expect(statement?.tag).toBe("statement-of-reasons");
    expect(statement?.locale).toBe("en");
    expect(notice?.to).toBe("kai@example.com");
    expect(notice?.tag).toBe("report-decision");
    expect(notice?.locale).toBe("de");
    // The creator never learns who reported; the reporter never reads the reasons written for the creator.
    expect(statement?.text).not.toContain("kai@example.com");
    expect(statement?.text).not.toContain("Kai");
    expect(notice?.text).not.toContain(hide.reason);
  });

  it("drops nothing and tells only the reporter when a report is dismissed, with the team's reasons", async () => {
    const { deps, log, sent } = world({ data: done({ customer: null, username: "", blockLabel: null }), error: null });
    const input: DecideInput = { decision: "dismiss", customer: null, reason: "Nothing on the page is illegal.", ground: null, block: null, report: REPORT };
    expect((await decide(input, deps)).body).toEqual({ ok: true, creatorMailed: false, reporterMailed: true });
    expect(log).toEqual(["moderate dismiss"]);
    expect(sent.map((mail) => mail.tag)).toEqual(["report-decision"]);
    expect(sent[0]?.text).toContain("Nothing on the page is illegal.");
    expect(sent[0]?.text).toContain("linkyo.app/mila");
  });

  it("says no e-mail went out where the transport does not deliver (F1), and decides all the same", async () => {
    const { deps } = world(undefined, false);
    expect((await decide(hide, deps)).body).toEqual({ ok: true, creatorMailed: false, reporterMailed: false });
  });

  it("suspends from the customer screen without a report: the statement says it was the team's own finding", async () => {
    const { deps, sent } = world({ data: done({ report: null, blockLabel: null }), error: null });
    const input: DecideInput = { decision: "suspend", customer: CUSTOMER, reason: "Repeated fake ticket sales after a warning.", ground: "terms", block: null, report: null };
    expect((await decide(input, deps)).body).toEqual({ ok: true, creatorMailed: true, reporterMailed: false });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.text).toContain("It followed our team's own review.");
  });

  it("drops nothing and sends nothing when the database refuses", async () => {
    const { deps, log, sent } = world({ data: null, error: { code: "P0001", message: "linkyo:alreadyDecided" } });
    expect(await decide(hide, deps)).toEqual({ status: 409, body: { ok: false, error: "alreadyDecided" } });
    expect(log).toEqual(["address", "moderate hide_block"]);
    expect(sent).toEqual([]);
  });
});
