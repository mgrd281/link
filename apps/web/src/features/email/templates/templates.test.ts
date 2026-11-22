import { describe, expect, it } from "vitest";

import { COMPANY } from "@/features/legal/company";
import ar from "@/messages/ar.json";
import de from "@/messages/de.json";
import en from "@/messages/en.json";

import { cancellationConfirmation } from "./cancellation-confirmation";
import { cancellationReceipt } from "./cancellation-receipt";
import { orderConfirmation } from "./order-confirmation";
import { proConfirmation } from "./pro-confirmation";
import { clockTime, emailTranslator, shortDate } from "./render";
import { withdrawalReceipt } from "./withdrawal-receipt";

const t = emailTranslator("de", de);
const SITE = "https://linkyo.app";
const ordered = new Date("2026-11-23T09:15:00Z"); // Monday, 10:15 Berlin
const due = new Date("2026-11-24T17:00:00Z"); // Tuesday, 18:00 Berlin

const order = (overrides: Partial<Parameters<typeof orderConfirmation>[0]> = {}) =>
  orderConfirmation(
    {
      to: "mila@example.com",
      name: "Mila",
      locale: "de",
      number: "LNK-2026-000123",
      package: "start",
      amountCents: 2499,
      vatMode: "standard19",
      orderedAt: ordered,
      dueAt: due,
      startAfter: ordered,
      earlyStart: true,
      earlyStartText: "Bitte fangt sofort an. (Wortlaut beim Bestellen)",
      orderId: "11111111-2222-3333-4444-555555555555",
      site: SITE,
      testMode: true,
      ...overrides,
    },
    t,
  );

/** Each needle's position in the text, in order; fails when one is missing or out of order. */
function inOrder(text: string, needles: string[]) {
  let from = 0;
  for (const needle of needles) {
    const at = text.indexOf(needle, from);
    expect(at, `"${needle}" after position ${String(from)}`).toBeGreaterThanOrEqual(0);
    from = at + needle.length;
  }
}

describe("order confirmation", () => {
  it("has every block of r3 §10.4 in order", () => {
    const mail = order();
    expect(mail.subject).toBe("Deine Bestellung bei Linkyo: Seitenservice Start (LNK-2026-000123)");
    expect(mail.tag).toBe("order-confirmation");
    for (const body of [mail.text, mail.html]) {
      inOrder(body, [
        "TESTMODUS",
        "Wer wir sind",
        COMPANY.address,
        "Was du bestellt hast",
        "Seitenservice Start · einmalig",
        "Gesamtpreis: 24,99",
        "inkl. 3,99",
        "Zahlungsart: Karte, Apple Pay, Google Pay, PayPal",
        "Bestellt am 23.11.2026 um 10:15 Uhr",
        "Fertig bis Dienstag, 24. November 2026, 18:00 Uhr",
        "Du hast verlangt, dass wir vor Ablauf der Widerrufsfrist beginnen",
        "Bitte fangt sofort an. (Wortlaut beim Bestellen)",
        "Unser Versprechen",
        "einmal pro Konto",
        "gesetzliche Gewährleistung",
        "Widerrufsbelehrung",
        "Muster-Widerrufsformular",
        "Vertrag widerrufen",
        "Unsere AGB",
        "§ 1 Geltungsbereich",
        "Die Rechnung kommt in einer eigenen E-Mail.",
        "Briefing ausfüllen",
      ]);
    }
    expect(mail.text).toContain(`${SITE}/de/widerruf`);
    expect(mail.text).toContain(`${SITE}/de/app/orders/11111111-2222-3333-4444-555555555555`);
    // The briefing deadline: 12:00 of the working day before the due day.
    expect(mail.text).toContain("wenn dein Briefing bis Montag, 23. November, 12:00 Uhr vollständig ist");
  });

  it("records a start after the withdrawal period without an early start", () => {
    const mail = order({ earlyStart: false, earlyStartText: null, startAfter: new Date("2026-12-07T23:00:00Z") });
    expect(mail.text).toContain("Du hast keinen Sofortstart gewählt. Wir beginnen am Dienstag, 8. Dezember 2026.");
    expect(mail.text).not.toContain("Du hast verlangt");
  });

  it("loads nothing remote and draws no line under links", () => {
    const { html } = order();
    expect(html).not.toMatch(/<img|<link|@import|url\(|<script/i);
    expect(html).not.toMatch(/https?:\/\/(?!linkyo\.app)/);
    expect(html).not.toMatch(/box-shadow|text-decoration:\s*underline/);
    expect(html).toContain('lang="de"');
  });

  it("escapes what the customer typed", () => {
    const mail = order({ name: "<b>Mila</b>" });
    expect(mail.html).toContain("&lt;b&gt;Mila&lt;/b&gt;");
    expect(mail.html).not.toContain("<b>Mila</b>");
  });
});

describe("Pro confirmation", () => {
  it("names the cycle, the next charge, the term and the cancellation link", () => {
    const mail = proConfirmation({ to: "ben@example.com", locale: "de", amountCents: 800, vatMode: "standard19", orderedAt: ordered, nextChargeAt: new Date("2026-12-23T09:15:00Z"), site: SITE }, t);
    expect(mail.subject).toBe("Deine Bestellung bei Linkyo: Linkyo Pro");
    expect(mail.tag).toBe("pro-confirmation");
    inOrder(mail.text, [
      "Wer wir sind",
      "Linkyo Pro · monatlich",
      "bis zu 5 im Monat",
      "8,00",
      "pro Monat",
      "Nächste Abbuchung am Mittwoch, 23. Dezember 2026",
      "SEPA-Lastschrift",
      "Laufzeit 1 Monat",
      `Verträge hier kündigen: ${SITE}/de/kuendigen`,
      "Widerrufsbelehrung",
      "Muster-Widerrufsformular",
      "Unsere AGB",
    ]);
    expect(mail.text).not.toContain("TESTMODUS");
  });
});

describe("withdrawal receipt", () => {
  it("states the content, the date and the time received", () => {
    const received = new Date("2026-11-22T13:32:00Z");
    const mail = withdrawalReceipt({ to: "mila@example.com", locale: "de", name: "Mila Berg", contract: "LNK-2026-000123", email: "mila@example.com", receivedAt: received }, t);
    expect(mail.subject).toBe("Eingangsbestätigung: dein Widerruf vom 22.11.2026, 14:32 Uhr");
    expect(mail.text).toContain("Wir haben deinen Widerruf erhalten am 22.11.2026 um 14:32 Uhr.");
    expect(mail.text).toContain("Mila Berg widerruft den Vertrag LNK-2026-000123. Bestätigung an: mila@example.com.");
    expect(shortDate(received, "de")).toBe("22.11.2026");
    expect(clockTime(received, "de")).toBe("14:32");
  });
});

describe("cancellation e-mails", () => {
  const received = new Date("2026-11-22T13:32:00Z");
  const receipt = (overrides: Partial<Parameters<typeof cancellationReceipt>[0]> = {}) =>
    cancellationReceipt({ to: "typed@example.com", locale: "de", kind: "ordinary", wantedDate: null, name: "Ben", accountEmail: "ben@example.com", receivedAt: received, ...overrides }, t);

  it("the neutral receipt is built only from the input and the time (no account fact)", () => {
    const one = receipt();
    expect(one.subject).toBe("Kündigungsbestätigung vom 22.11.2026, 14:32 Uhr");
    expect(one.text).toContain("Inhalt: Ordentliche Kündigung, Vertrag Linkyo Pro (monatlich), gewünscht zum nächstmöglichen Zeitpunkt.");
    expect(one.text).toContain("Besteht unter dieser Konto-Adresse ein Pro-Vertrag, endet er zum Ende des laufenden bezahlten Monats.");
    // The same text whether an account matched or not: the template takes no such input at all.
    const later = receipt({ receivedAt: new Date("2026-11-23T08:05:00Z") });
    const strip = (text: string) => text.replaceAll(/\d{2}\.\d{2}\.\d{4}/g, "D").replaceAll(/\d{2}:\d{2}/g, "T");
    expect(strip(later.text)).toBe(strip(one.text));
    expect(strip(later.html)).toBe(strip(one.html));
  });

  it("names the rule for a date and for an extraordinary cancellation", () => {
    expect(receipt({ wantedDate: "2027-02-10" }).text).toContain("endet er zum Ende des bezahlten Monats, in den der 10.02.2027 fällt");
    const extraordinary = receipt({ kind: "extraordinary" }).text;
    expect(extraordinary).toContain("Außerordentliche Kündigung");
    expect(extraordinary).toContain("Wir prüfen sie");
  });

  it("the account's own address gets the exact end date, or that the team reviews it", () => {
    const ends = cancellationConfirmation({ to: "ben@example.com", locale: "de", receivedAt: received, endsAt: new Date("2026-12-31T10:00:00Z") }, t);
    expect(ends.subject).toBe("Deine Kündigung von Linkyo Pro (22.11.2026)");
    expect(ends.text).toContain("Linkyo Pro endet am Donnerstag, 31. Dezember 2026.");
    expect(ends.text).toContain("Du hast nicht gekündigt?");
    const review = cancellationConfirmation({ to: "ben@example.com", locale: "de", receivedAt: received, endsAt: null }, t);
    expect(review.text).toContain("Wir prüfen sie und schreiben dir unsere Entscheidung.");
  });
});

describe("every locale renders (contracts are German in phase 1, the rest follows the person)", () => {
  it.each([
    ["en", en],
    ["ar", ar],
  ] as const)("%s", (locale, messages) => {
    const translate = emailTranslator(locale, messages);
    const mail = withdrawalReceipt({ to: "x@example.com", locale, name: "X", contract: "Linkyo Pro", email: "x@example.com", receivedAt: new Date("2026-11-22T13:32:00Z") }, translate);
    expect(mail.text).toContain("14:32");
    expect(mail.text).not.toMatch(/[٠-٩]/);
    expect(mail.html).toContain(locale === "ar" ? 'dir="rtl"' : 'dir="ltr"');
  });
});
