import { describe, expect, it } from "vitest";

import ar from "@/messages/ar.json";
import de from "@/messages/de.json";
import en from "@/messages/en.json";

import { contractDecision, type ContractDecision } from "./contract-decision";
import { proposalDelivered, revisionOffer } from "./proposal-delivered";
import { refundIssued } from "./refund-issued";
import { emailTranslator } from "./render";
import { revisionReceived } from "./revision-received";

const t = emailTranslator("de", de);
const SITE = "https://linkyo.app";
const reviseUntil = new Date("2026-12-07T17:00:00Z");
/** When these e-mails are written: inside the 14 days. */
const now = new Date("2026-11-23T10:00:00Z");

const delivered = (overrides: Partial<Parameters<typeof proposalDelivered>[0]> = {}) =>
  proposalDelivered(
    {
      to: "mila@example.com",
      locale: "de",
      number: "LNK-2026-000123",
      aiAssisted: true,
      hasKit: false,
      revisionsLeft: 1,
      reviseUntil,
      now,
      proposalId: "11111111-2222-3333-4444-555555555555",
      site: SITE,
      ...overrides,
    },
    t,
  );

describe("proposal delivered", () => {
  it("Start with AI blocks: the AI wording, one round left, the link, no kit line", () => {
    const mail = delivered();
    expect(mail.tag).toBe("proposal-delivered");
    expect(mail.subject).toBe("Dein Seitenvorschlag ist da (LNK-2026-000123)");
    for (const body of [mail.text, mail.html]) {
      expect(body).toContain("Unsere KI hat deine Seite entworfen, unser Team hat sie geprüft und verfeinert.");
      expect(body).not.toContain("Unser Team hat deine Seite gestaltet.");
      expect(body).toContain("Noch 1 Änderungsrunde bis Montag, 7. Dezember 2026.");
      expect(body).not.toContain("Marketing-Paket");
      expect(body).toContain(`${SITE}/de/app/proposals/11111111-2222-3333-4444-555555555555`);
    }
    // No money in this e-mail: no test-mode note.
    expect(mail.text).not.toContain("TESTMODUS");
  });

  it("a proposal without AI says the team designed it (also for Start)", () => {
    const mail = delivered({ aiAssisted: false });
    expect(mail.text).toContain("Unser Team hat deine Seite gestaltet.");
    expect(mail.text).not.toContain("Unsere KI");
  });

  it("Premium: the kit line only with hasKit, plural rounds", () => {
    const premium = delivered({ aiAssisted: false, hasKit: true, revisionsLeft: 3 });
    expect(premium.text).toContain("Dein Marketing-Paket (zwei Bio-Texte, Posting-Plan für 4 Wochen, 3 Story-Bilder) findest du beim Vorschlag.");
    expect(premium.html).toContain("Dein Marketing-Paket");
    expect(premium.text).toContain("Noch 3 Änderungsrunden bis");
    expect(delivered({ revisionsLeft: 0 }).text).toContain("Keine Änderungsrunde mehr.");
  });

  it("a late round, delivered after the 14 days, promises no rounds 'until' a day that has passed", () => {
    // First delivery on 23 Nov, changes asked for on the last day, delivered two working days later.
    const late = new Date("2026-12-09T16:00:00Z");
    expect(revisionOffer({ revisionsLeft: 2, reviseUntil, now: late })).toBe("expired");
    expect(revisionOffer({ revisionsLeft: 2, reviseUntil, now })).toBe("open");
    expect(revisionOffer({ revisionsLeft: 0, reviseUntil, now })).toBe("none");
    const mail = delivered({ aiAssisted: false, hasKit: true, revisionsLeft: 2, now: late });
    for (const body of [mail.text, mail.html]) {
      expect(body).toContain("Die 14 Tage für Änderungen sind vorbei.");
      expect(body).not.toContain("Änderungsrunden bis");
      expect(body).not.toContain("7. Dezember");
      // Nothing to request any more: the e-mail does not invite to.
      expect(body).not.toContain("frag Änderungen an");
      expect(body).toContain("Unser Team hat deine Seite gestaltet. Schau sie dir an und übernimm sie mit einem Klick.");
    }
    expect(delivered({ now: late }).text).toContain("Unsere KI hat deine Seite entworfen, unser Team hat sie geprüft und verfeinert. Schau sie dir an und übernimm sie mit einem Klick.");
    const english = proposalDelivered({ ...baseData(), locale: "en", now: late }, emailTranslator("en", en));
    expect(english.text).toContain("The 14 days for changes are over.");
    expect(english.text).not.toMatch(/request changes|until/);
    const arabic = proposalDelivered({ ...baseData(), locale: "ar", now: late }, emailTranslator("ar", ar));
    expect(arabic.text).toContain(ar.email.proposal.roundsExpired);
    expect(arabic.text).not.toContain("اطلب تعديلات");
  });

  it("with every round used it does not invite to request changes either", () => {
    const mail = delivered({ revisionsLeft: 0 });
    expect(mail.text).toContain("Keine Änderungsrunde mehr.");
    expect(mail.text).not.toContain("frag Änderungen an");
    const arabic = proposalDelivered({ ...baseData(), locale: "ar", revisionsLeft: 0 }, emailTranslator("ar", ar));
    expect(arabic.text).not.toMatch(/: ?0/);
    expect(arabic.text).not.toContain("اطلب تعديلات");
  });

  it("renders in English and Arabic (right to left)", () => {
    const english = proposalDelivered({ ...baseData(), locale: "en" }, emailTranslator("en", en));
    expect(english.subject).toBe("Your page proposal is here (LNK-2026-000123)");
    expect(english.text).toContain("Our AI drafted your page");
    const arabic = proposalDelivered({ ...baseData(), locale: "ar" }, emailTranslator("ar", ar));
    expect(arabic.html).toContain('dir="rtl"');
    expect(arabic.text).toContain("/ar/app/proposals/");
  });
});

function baseData() {
  return { to: "mila@example.com", number: "LNK-2026-000123", aiAssisted: true, hasKit: false, revisionsLeft: 1, reviseUntil, now, proposalId: "p1", site: SITE };
}

describe("revision received", () => {
  it("names the due date and time", () => {
    const mail = revisionReceived({ to: "mila@example.com", locale: "de", number: "LNK-2026-000123", dueAt: new Date("2026-11-25T17:00:00Z") }, t);
    expect(mail.tag).toBe("revision-received");
    expect(mail.subject).toBe("Wir haben deine Änderungswünsche (LNK-2026-000123)");
    expect(mail.text).toContain("Wir liefern die Änderungen bis Mittwoch, 25. November 2026, 18:00 Uhr.");
  });
});

describe("refund issued", () => {
  it("names the amount, with the test-mode note", () => {
    const mail = refundIssued({ to: "mila@example.com", locale: "de", number: "LNK-2026-000123", amountCents: 2499, testMode: true }, t);
    expect(mail.tag).toBe("refund-issued");
    expect(mail.subject).toBe("Erstattung für LNK-2026-000123");
    expect(mail.text.indexOf("TESTMODUS")).toBeLessThan(mail.text.indexOf("Wir haben 24,99"));
    expect(mail.text).toContain("Wir haben 24,99 € erstattet.");
  });
});

describe("contract decision", () => {
  const receivedAt = new Date("2026-11-20T09:15:00Z");
  const decide = (decision: ContractDecision) => contractDecision({ to: "mila@example.com", locale: "de", receivedAt, decision, site: SITE, testMode: true }, t);

  it("every variant has the request's date in the subject and its own sentence", () => {
    const cases: [ContractDecision, string][] = [
      [{ kind: "withdrawalAccepted", contract: "LNK-2026-000123", amountCents: 2499 }, "Wir haben deinen Widerruf für LNK-2026-000123 angenommen und 24,99 € erstattet."],
      [{ kind: "withdrawalRejected", contract: "Linkyo Pro", note: "Der Vertrag war vollständig erfüllt." }, "Wir können deinen Widerruf für Linkyo Pro nicht annehmen. Grund: Der Vertrag war vollständig erfüllt."],
      [{ kind: "cancellationEnded", endedAt: new Date("2026-11-22T10:00:00Z") }, "Linkyo Pro endet mit sofortiger Wirkung am Sonntag, 22. November 2026."],
      [{ kind: "cancellationRejected", note: "Kein wichtiger Grund." }, "Wir können deine außerordentliche Kündigung nicht annehmen. Grund: Kein wichtiger Grund."],
      [{ kind: "resumed", nextChargeAt: new Date("2026-12-12T08:00:00Z") }, "Linkyo Pro läuft weiter; nächste Abbuchung am Samstag, 12. Dezember 2026."],
    ];
    for (const [decision, sentence] of cases) {
      const mail = decide(decision);
      expect(mail.tag).toBe("contract-decision");
      expect(mail.subject).toBe("Deine Anfrage vom 20.11.2026: unsere Entscheidung");
      expect(mail.text).toContain(sentence);
      expect(mail.text).toContain("TESTMODUS");
    }
  });

  it("a rejected extraordinary cancellation links the cancellation page", () => {
    const mail = decide({ kind: "cancellationRejected", note: "x" });
    expect(mail.text).toContain(`Verträge hier kündigen: ${SITE}/de/kuendigen`);
    expect(decide({ kind: "resumed", nextChargeAt: receivedAt }).text).not.toContain("/kuendigen");
  });

  it("escapes the team's note in HTML", () => {
    const mail = decide({ kind: "withdrawalRejected", contract: "Pro", note: "<b>nein</b>" });
    expect(mail.html).toContain("&lt;b&gt;nein&lt;/b&gt;");
    expect(mail.html).not.toContain("<b>nein</b>");
  });
});
