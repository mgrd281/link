import type { Page } from "@linkyo/blocks";

import { examplePage } from "./build";

/**
 * Apps and skills (ADR 0055): a creator who explains apps in short videos and a developer who
 * writes skills for coding agents. Both people, their apps and their skills are fictional; every
 * store link, repository and install command points to example.com. The app icons and the video
 * picture are original Linkyo designs. Apps with a partner code carry the ad label.
 */
export const CATALOG_G: Record<string, Page> = {
  // Aura in sky blue: the apps from her videos as a store-like list, each with its own code.
  "merve-aksoy": examplePage(
    "merve-aksoy",
    "de",
    {
      name: "Merve Aksoy",
      tagline: "App-Tipps · Jeden Tag eine App, die dein Handy besser macht",
      bio: "Ich teste Apps, damit du es nicht musst. Hier findest du jede App aus meinen Videos, mit Codes, die nur hier gelten.",
      location: "Köln",
      photo: "ex9-merve-aksoy",
      focal: [0.47, 0.33],
      stats: [
        ["1,2 Mio.", "Follower"],
        ["412", "Apps getestet"],
      ],
    },
    (h) => [
      h.header("Aus dem neuen Video"),
      h.app("Fokuskreis", "ex9-app-fokuskreis", {
        developer: "Kreisel Labs",
        description: "Mein Lern-Timer: 25 Minuten Fokus, dann Pause. Mit Wochenstatistik.",
        rating: 4.8,
        category: "Produktivität",
        pricing: "freemium",
        code: "MERVE30",
        highlight: true,
        affiliate: true,
      }),
      h.video("Meine 10 Lieblings-Apps 2026", "youtube", "video-lieblings-apps", undefined, 642),
      h.header("Meine Lieblings-Apps"),
      h.app("Sprachfuchs", "ex9-app-sprachfuchs", {
        developer: "Fuchsbau Studio",
        description: "Fünf Minuten am Tag: Vokabeln, die wirklich hängen bleiben.",
        rating: 4.7,
        category: "Bildung",
        pricing: "free",
      }),
      h.app("Kassenklar", "ex9-app-kassenklar", {
        developer: "Klar & Co.",
        description: "Haushaltsbuch ohne Tabellen: jede Ausgabe in zwei Tipps erfasst.",
        rating: 4.6,
        category: "Finanzen",
        pricing: "freemium",
        code: "KLAR3",
        affiliate: true,
      }),
      h.app("Schlafwelle", "ex9-app-schlafwelle", {
        developer: "Nachtruhe Apps",
        description: "Regen, Meer, Nachtzug: Geräusche zum Einschlafen, auch offline.",
        rating: 4.9,
        category: "Gesundheit",
        pricing: "paid",
        stores: ["appstore"],
      }),
      h.app("Pixelnote", "ex9-app-pixelnote", {
        developer: "Pixelnote",
        description: "Fotos schneller bearbeiten als in der Kamera-App. Ohne Abo.",
        rating: 4.5,
        category: "Foto & Video",
        pricing: "free",
      }),
      h.newsletter("App der Woche", "Jeden Sonntag eine App, die sich lohnt, und eine, die du löschen kannst."),
      h.header("Mehr"),
      h.link("Alle Codes auf einen Blick", "codes", { icon: "percent", subtitle: "Jede Woche aktualisiert" }),
      h.mail("Kooperationen", "business", { icon: "mail", subtitle: "Für App-Studios und Marken" }),
      h.text("Transparenz: Apps mit „Anzeige“ sind bezahlte Kooperationen, die Codes kommen von den Studios. Meine Meinung bleibt meine."),
      h.socials("tiktok", "instagram", "youtube"),
    ],
  ),

  // Folio in ink blue: skills as cards with stars, language, license and a copyable install line.
  "arjun-mehta": examplePage(
    "arjun-mehta",
    "en",
    {
      name: "Arjun Mehta",
      tagline: "Agent skills · Open source · Workshops",
      bio: "I write small, sharp skills for coding agents: one folder, one job, tested. Open source and free to use.",
      location: "Amsterdam",
      photo: "ex9-arjun-mehta",
      focal: [0.67, 0.41],
      stats: [
        ["9.7k", "GitHub stars"],
        ["14", "skills"],
      ],
    },
    (h) => [
      h.header("Skills"),
      h.repo("Brand voice", "brand-voice", {
        kind: "skill",
        description: "Writes in your brand's voice: tone rules, words to avoid and real examples. For emails, docs and posts.",
        stars: 2140,
        license: "MIT",
        highlight: true,
      }),
      h.repo("PDF polish", "pdf-polish", {
        kind: "skill",
        description: "Turns rough PDFs into clean, accessible documents: real headings, tagged tables and alt text.",
        stars: 860,
        language: "Python",
        license: "MIT",
      }),
      h.repo("Test whisperer", "test-whisperer", {
        kind: "skill",
        description: "Reads a failing test, finds the cause and proposes the smallest fix that makes it pass.",
        stars: 1320,
        language: "TypeScript",
        license: "Apache-2.0",
      }),
      h.header("Everything at once"),
      h.repo("Agent skills", "agent-skills", {
        description: "All fourteen skills in one repository, with tests and a changelog. Install the whole set in one go.",
        stars: 5410,
        language: "Python",
        license: "MIT",
      }),
      h.video("Write a skill in 10 minutes", "youtube", "video-write-a-skill", "ex9-skill-video", 612),
      h.header("Work with me"),
      h.link("Skills workshop for teams", "workshop", { icon: "calendar", subtitle: "Half a day · remote or on site" }),
      h.mail("Custom skills", "hello", { icon: "mail", subtitle: "For your team's own tools and rules" }),
      h.link("Sponsor my open source work", "sponsor", { icon: "heart", subtitle: "From 5 € a month" }),
      h.newsletter("Skill of the month", "One new skill, how it works and what I learned writing it."),
      h.socials("github", "x", "linkedin", "youtube"),
    ],
  ),
};
