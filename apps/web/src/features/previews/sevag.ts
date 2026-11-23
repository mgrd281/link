import { NO_IMAGE, type BlockOf, type Page } from "@linkyo/blocks";

/**
 * A page prepared for Sevag Ghazarian, from the application letter he gave the Linkyo team
 * (Lagerist / Töner, Sales Center Lörrach). Every fact on it comes from that letter; nothing is
 * added. No photo of him yet: his initials stand in.
 *
 * Picture and moving picture: Linkyo's own illustration, drawn for this page (no stock material):
 * a forklift driver lifts a pallet of boxes into a high rack at night, a blue check confirms it, the
 * truck backs out and returns with the next pallet. In black, graphite and silver, like the page. A
 * 10 s seamless loop (public/media/motion/sevag-stapler-noir.mp4, source in
 * .claude/skills/linkyo-media-assets/scripts/forklift-scene-noir.html); the picture is its first frame, so nothing jumps when it starts, and
 * visitors who prefer less motion keep the still. No text in it.
 *
 * Not listed anywhere, not indexed, removed on request.
 */

export const SEVAG_SLUG = "sevag-ghazarian-2131af";

const LETTER = [
  "Sehr geehrter Herr Vitt,",
  "ich bewerbe mich bei Ihnen als Lagerist / Töner (w/m/d) im Sales Center Lörrach. Seit 2018 arbeite ich in der Logistik. Meinen Flurförderzeugschein besitze ich seit 2021 und fahre seitdem regelmäßig Stapler, insbesondere Seitenschubstapler.",
  "In meiner aktuellen Position liegt mein Schwerpunkt in der Kommissionierung, im Scannen von Waren sowie im Be- und Entladen von Lkw. Das sichere Ein- und Auslagern von Waren mit dem Seitenschubstapler gehört ebenfalls zu meinen täglichen Aufgaben. Außerdem arbeite ich mit SAP, um Bestände zu prüfen sowie Warenbewegungen zu quittieren und zu buchen. Ich wirke regelmäßig bei Inventuren mit und erstelle Versanddokumente. Dabei beachte ich die geltenden Vorschriften zur Ladungssicherung und zum Gefahrgut.",
  "Bei der Kommissionierung, beim Scannen und beim Verladen arbeite ich sorgfältig und zuverlässig. Sicherheit, Ordnung und Sauberkeit im Lager sind mir wichtig. Ich arbeite gerne im Team, unterstütze meine Kollegen im Tagesgeschäft und schätze den direkten Kontakt mit Kunden bei der Warenausgabe.",
  "Mit der Dosieranlage zum Tönen von Farben und Putzen habe ich bisher noch nicht gearbeitet. Ich bin aber bereit, mich schnell und gründlich in diese Aufgabe einzuarbeiten. Eine Farbenfehlsichtigkeit liegt bei mir nicht vor.",
  "Gerne möchte ich meine Erfahrung aus der Logistik in Ihr Team einbringen. Über eine Einladung zu einem persönlichen Gespräch freue ich mich.",
  "Mit freundlichen Grüßen\nSevag Ghazarian",
].join("\n\n");

const block = { visible: true, highlight: false } as const;

export const sevagDe: Page = {
  profile: {
    username: "sevag-ghazarian",
    displayName: "Sevag Ghazarian",
    tagline: "Lagerist · Staplerfahrer mit Flurförderzeugschein",
    bio: "Sorgfältig und zuverlässig im Lager. Sicherheit, Ordnung und Sauberkeit sind mir wichtig.",
    avatar: { src: NO_IMAGE, alt: "" },
    hero: {
      src: `/prepared/${SEVAG_SLUG}/stapler-noir.jpg`,
      alt: "Illustration: Ein Staplerfahrer hebt eine Palette mit Kartons in ein Hochregal",
      w: 1080,
      h: 1350,
    },
    motion: { src: "sample:motion-sevag-stapler-noir" },
    stats: [
      { value: "seit 2018", label: "in der Logistik" },
      { value: "seit 2021", label: "Staplerschein" },
      { value: "SAP", label: "Bestände & Buchungen" },
    ],
    verified: false,
    locale: "de",
  },
  blocks: [
    {
      ...block,
      id: "about",
      type: "about",
      title: "Über mich",
      text: "In meiner aktuellen Position liegt mein Schwerpunkt in der Kommissionierung, im Scannen von Waren und im Be- und Entladen von Lkw. Das sichere Ein- und Auslagern mit dem Seitenschubstapler gehört zu meinen täglichen Aufgaben.\n\nMit SAP prüfe ich Bestände und quittiere und buche Warenbewegungen. Ich wirke regelmäßig bei Inventuren mit, erstelle Versanddokumente und beachte die Vorschriften zur Ladungssicherung und zum Gefahrgut.\n\nIch arbeite gerne im Team, unterstütze meine Kollegen im Tagesgeschäft und schätze den direkten Kontakt mit Kunden bei der Warenausgabe.",
      facts: [
        { label: "Bewerbung als", value: "Lagerist / Töner (w/m/d)" },
        { label: "Für", value: "Sales Center Lörrach" },
        { label: "Stapler", value: "vor allem Seitenschubstapler" },
        { label: "Farbsehen", value: "keine Farbenfehlsichtigkeit" },
      ],
    },
    {
      ...block,
      id: "skills",
      type: "tools",
      title: "Was ich mitbringe",
      items: [
        "Seitenschubstapler",
        "Flurförderzeugschein",
        "Kommissionierung",
        "Scannen von Waren",
        "Be- und Entladen von Lkw",
        "Ein- und Auslagern",
        "SAP: Bestände & Buchungen",
        "Inventur",
        "Versanddokumente",
        "Ladungssicherung",
        "Gefahrgut",
        "Warenausgabe",
      ],
    },
    {
      ...block,
      id: "path",
      type: "timeline",
      title: "Werdegang",
      items: [
        {
          role: "Staplerfahrer mit Flurförderzeugschein",
          years: { from: 2021, to: "now" },
          note: "Regelmäßig auf dem Stapler, vor allem auf dem Seitenschubstapler",
        },
        {
          role: "Lager und Logistik",
          years: { from: 2018, to: "now" },
          note: "Kommissionierung, Scannen, Be- und Entladen von Lkw, SAP, Inventuren und Versanddokumente",
        },
      ],
    },
    { ...block, id: "toning-title", type: "header", title: "Neu für mich: das Tönen" },
    {
      ...block,
      id: "toning",
      type: "text",
      text: "Mit der Dosieranlage zum Tönen von Farben und Putzen habe ich bisher noch nicht gearbeitet. Ich bin aber bereit, mich schnell und gründlich einzuarbeiten. Eine Farbenfehlsichtigkeit liegt bei mir nicht vor.",
    },
    { ...block, id: "letter-title", type: "header", title: "Anschreiben" },
    { ...block, id: "letter", type: "text", text: LETTER },
  ],
};

/**
 * The closing band with his phone number and e-mail. Both come from the server's environment
 * (LINKYO_PREVIEW_PRIVATE, see ./private): they never enter this public repository. The line is his
 * own, from the letter. "Kontakt" (e-mail) leads: it works on every screen and fits the compact bar;
 * the number follows as "Anrufen" with the number beside it.
 */
export function sevagContact(details: { phone?: string | undefined; email?: string | undefined }): BlockOf<"contact"> | null {
  const { phone, email } = details;
  const primary = email ? { label: "Kontakt", url: `mailto:${email}`, icon: "mail" as const } : phone ? { label: "Anrufen", url: `tel:${phone}`, icon: "phone" as const } : null;
  if (!primary) return null;
  return {
    ...block,
    id: "contact",
    type: "contact",
    title: "Über eine Einladung zum Gespräch freue ich mich.",
    primary,
    ...(email && phone ? { links: [{ kind: "phone" as const, url: `tel:${phone}` }] } : {}),
  };
}
