import type { ModerationTarget, Report } from "./types";

/**
 * Sample reports for the team console in demo mode: made-up pages, people and e-mail addresses on
 * example.com, so nothing here points to a real person or page. Times are relative to `now`, so the
 * queue shows one report past its target and others still inside it.
 */

const HOUR = 3_600_000;
const at = (now: number, hoursAgo: number) => new Date(now - hoursAgo * HOUR).toISOString();

interface Sample {
  report: (now: number) => Report;
  target: ModerationTarget | null;
}

const page = (id: string, username: string, blocks: ModerationTarget["blocks"]): ModerationTarget => ({ id, username, status: "active", locale: "de", blocks, inForce: [] });

export const SAMPLES: readonly Sample[] = [
  {
    report: (now) => ({
      id: "5a3e1c00-0000-4000-8000-000000000001",
      // Past the 72 hours of its category: the queue's one overdue report.
      receivedAt: at(now, 80),
      page: "nora-keramik",
      url: "https://linkyo.app/nora-keramik",
      category: "privacy",
      explanation: "Der Textblock „Über mich“ nennt die Wohnadresse einer Nachbarin mit Namen, ohne dass sie zugestimmt hat.",
      reporterName: "Jana Beispiel",
      reporterEmail: "jana@example.com",
      locale: "de",
      state: "open",
      decidedAt: null,
      purged: false,
      account: { id: "sample-nora", username: "nora-keramik", status: "active", offline: false },
      decision: null,
    }),
    target: page("sample-nora", "nora-keramik", [
      { id: "shop", type: "link", label: "Mein Shop", visible: true, hidden: false },
      { id: "about", type: "about", label: "Über mich", visible: true, hidden: false },
      { id: "kurse", type: "events", label: "Kurse im Winter", visible: true, hidden: false },
    ]),
  },
  {
    report: (now) => ({
      id: "5a3e1c00-0000-4000-8000-000000000002",
      receivedAt: at(now, 20),
      page: "flinke-tickets",
      url: "https://linkyo.app/flinke-tickets",
      category: "fraud",
      explanation: "The ticket link sells tickets for a concert that the venue says does not exist. I paid and got nothing.",
      reporterName: "Sam Example",
      reporterEmail: "sam@example.com",
      locale: "en",
      state: "open",
      decidedAt: null,
      purged: false,
      account: { id: "sample-flinke", username: "flinke-tickets", status: "active", offline: false },
      decision: null,
    }),
    target: page("sample-flinke", "flinke-tickets", [
      { id: "tickets", type: "link", label: "Tickets zum Sonderpreis", visible: true, hidden: false },
      { id: "insta", type: "socials", label: "socials", visible: true, hidden: false },
    ]),
  },
  {
    report: (now) => ({
      id: "5a3e1c00-0000-4000-8000-000000000003",
      receivedAt: at(now, 5),
      page: "studio-wellen",
      url: null,
      category: "rights",
      explanation: "يعرض معرض الصور على هذه الصفحة صوري التي التقطتها أنا، دون إذني ودون ذكر اسمي.",
      reporterName: "ليلى مثال",
      reporterEmail: "laila@example.com",
      locale: "ar",
      state: "open",
      decidedAt: null,
      purged: false,
      account: { id: "sample-wellen", username: "studio-wellen", status: "active", offline: false },
      decision: null,
    }),
    target: page("sample-wellen", "studio-wellen", [
      { id: "gallery", type: "gallery", label: "Arbeiten 2026", visible: true, hidden: false },
      { id: "contact", type: "contact", label: "Anfragen", visible: true, hidden: false },
    ]),
  },
  {
    report: (now) => ({
      id: "5a3e1c00-0000-4000-8000-000000000004",
      receivedAt: at(now, 2),
      page: "gibt-es-nicht",
      url: null,
      category: "other",
      explanation: "Ich habe einen Link zu dieser Seite bekommen, aber sie lädt nicht. Ist das Betrug?",
      reporterName: "Ole Beispiel",
      reporterEmail: "ole@example.com",
      locale: "de",
      state: "open",
      decidedAt: null,
      purged: false,
      account: null,
      decision: null,
    }),
    target: null,
  },
];
