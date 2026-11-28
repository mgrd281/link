import { describe, expect, it } from "vitest";

import { REVIEW } from "@/features/legal/texts";
import ar from "@/messages/ar.json";
import de from "@/messages/de.json";
import en from "@/messages/en.json";

import { emailTranslator, type EmailLocale } from "./render";
import { reportDecision, reportReceipt, reportReference } from "./report-notices";
import { statementOfReasons } from "./statement-of-reasons";
import { teamDigest } from "./team-digest";

const MESSAGES = { de, en, ar } as const;
const LOCALES: readonly EmailLocale[] = ["de", "en", "ar"];
const SITE = "https://linkyo.app";
const decidedAt = new Date("2026-11-28T12:00:00Z");

const statement = (locale: EmailLocale, overrides: Partial<Parameters<typeof statementOfReasons>[0]> = {}) =>
  statementOfReasons(
    {
      to: "mila@example.com",
      locale,
      page: "linkyo.app/mila",
      action: "hide_block",
      blockLabel: "Über mich",
      ground: "illegal",
      reason: "Der Block nennt die Wohnadresse einer Nachbarin ohne ihre Einwilligung (Art. 6 DSGVO, § 201a StGB).",
      decidedAt,
      reportedAt: new Date("2026-11-27T09:00:00Z"),
      site: SITE,
      contact: "team@example.com",
      ...overrides,
    },
    emailTranslator(locale, MESSAGES[locale]),
  );

describe("the statement of reasons (Art. 17 DSA)", () => {
  it("says what was restricted, where and how long; why and after what; that a person decided; the ground; how to object", () => {
    const mail = statement("de");
    expect(mail.tag).toBe("statement-of-reasons");
    expect(mail.subject).toBe("Ein Inhalt deiner Linkyo-Seite ist ausgeblendet");
    const order = [
      "Wir haben am 28.11.2026 den Inhalt „Über mich“ auf deiner Seite linkyo.app/mila für Besucher ausgeblendet, überall und bis wir die Entscheidung aufheben.",
      "Anlass war eine Meldung, die am 27.11.2026 bei uns einging. Wer gemeldet hat, nennen wir nicht.",
      "„Der Block nennt die Wohnadresse einer Nachbarin",
      "Grundlage: Der Inhalt ist nach unserer Prüfung rechtswidrig.",
      "Diese Entscheidung hat ein Mensch aus unserem Team getroffen. Automatisierte Mittel haben wir dafür nicht eingesetzt.",
      "Schreib uns innerhalb von sechs Monaten an team@example.com",
      "außergerichtliche Streitbeilegungsstelle (Art. 21 DSA) oder an ein Gericht",
      REVIEW.check,
    ];
    let from = 0;
    for (const part of order) {
      const at = mail.text.indexOf(part, from);
      expect(at, part).toBeGreaterThanOrEqual(0);
      from = at;
    }
  });

  it("names the terms and their address for a contractual ground, and the team's own finding without a report", () => {
    const mail = statement("de", { action: "suspend", ground: "terms", reportedAt: null });
    expect(mail.subject).toBe("Dein Linkyo-Konto ist gesperrt");
    expect(mail.text).toContain("Anlass war eine eigene Prüfung unseres Teams.");
    expect(mail.text).toContain(`Allgemeinen Geschäftsbedingungen (${SITE}/de/agb)`);
    expect(statement("en", { action: "unpublish" }).subject).toBe("Your Linkyo page is offline");
  });

  it("is written in the creator's language, Arabic right to left", () => {
    const mail = statement("ar");
    expect(mail.html).toContain('dir="rtl"');
    expect(mail.subject).toBe("أُخفي محتوى على صفحتك في Linkyo");
    expect(mail.text).toContain("اتخذ هذا القرار شخص من فريقنا");
  });
});

describe("the reporter's e-mails (Art. 16(4) and (5) DSA)", () => {
  const t = emailTranslator("de", de);
  it("confirm the receipt with the page, the time and the number", () => {
    const mail = reportReceipt({ to: "kai@example.com", locale: "de", name: "Kai", page: "mila", id: "7c9e6679-7425-40de-944b-e07fc1f90ae7", receivedAt: new Date("2026-11-28T09:15:00Z") }, t);
    expect(mail.subject).toBe("Deine Meldung ist eingegangen (7C9E6679)");
    expect(mail.text).toContain("Hallo Kai,");
    expect(mail.text).toContain("Wir haben deine Meldung zur Seite mila am 28.11.2026 um 10:15 Uhr erhalten.");
    expect(mail.text).toContain("ohne automatische Entscheidung");
  });

  it("tell the decision; only a dismissal carries the team's reasons", () => {
    const base = { to: "kai@example.com", locale: "de" as const, name: null, page: "linkyo.app/mila", id: "7c9e6679-7425-40de-944b-e07fc1f90ae7", receivedAt: new Date("2026-11-27T09:00:00Z"), contact: "team@example.com" };
    const hidden = reportDecision({ ...base, decision: "hide_block", reason: "for the creator" }, t);
    expect(hidden.subject).toBe("Unsere Entscheidung zu deiner Meldung vom 27.11.2026 (7C9E6679)");
    expect(hidden.text).toContain("den gemeldeten Inhalt für Besucher ausgeblendet");
    expect(hidden.text).not.toContain("for the creator");
    const dismissed = reportDecision({ ...base, decision: "dismiss", reason: "Nichts auf der Seite ist rechtswidrig." }, t);
    expect(dismissed.text).toContain("„Nichts auf der Seite ist rechtswidrig.“");
    expect(dismissed.text).toContain("schreib uns an team@example.com");
    expect(reportReference("7c9e6679-7425-40de-944b-e07fc1f90ae7")).toBe("7C9E6679");
  });
});

describe("the team digest (A-17)", () => {
  it("counts what waits and what is late, and leads to the queue; no page, no reporter, no content", () => {
    const mail = teamDigest({ to: "olga@example.com", locale: "de", open: 3, overdue: 1, oldest: new Date("2026-11-26T08:00:00Z"), site: SITE }, emailTranslator("de", de));
    expect(mail.subject).toBe("Linkyo-Team: 3 Meldungen warten");
    expect(mail.text).toContain("3 Meldungen warten auf eine Entscheidung.");
    expect(mail.text).toContain("Eine davon ist über unserem Ziel.");
    expect(mail.text).toContain("Die älteste kam am Donnerstag, 26. November 2026.");
    expect(mail.text).toContain(`${SITE}/de/admin/reports`);
  });

  it.each(LOCALES)("%s: every report e-mail formats without a missing word", (locale) => {
    const t = emailTranslator(locale, MESSAGES[locale]);
    const digest = teamDigest({ to: "a@example.com", locale, open: 1, overdue: 0, oldest: decidedAt, site: SITE }, t);
    const mails = [
      statement(locale),
      statement(locale, { action: "unpublish", ground: "terms" }),
      statement(locale, { action: "suspend", reportedAt: null }),
      reportReceipt({ to: "a@example.com", locale, page: "mila", id: "7c9e6679-7425-40de-944b-e07fc1f90ae7", receivedAt: decidedAt }, t),
      ...(["hide_block", "unpublish", "suspend", "dismiss"] as const).map((decision) =>
        reportDecision({ to: "a@example.com", locale, page: "mila", id: "7c9e6679-7425-40de-944b-e07fc1f90ae7", receivedAt: decidedAt, decision, reason: "Nothing to restrict here.", contact: "team@example.com" }, t),
      ),
      digest,
    ];
    for (const mail of mails) {
      expect(`${mail.subject}\n${mail.text}`).not.toMatch(/email\.(statement|report|digest)\.|[{}]/);
      expect(mail.html).not.toMatch(/<img|<script|url\(|box-shadow|text-decoration:\s*underline/);
    }
  });
});
