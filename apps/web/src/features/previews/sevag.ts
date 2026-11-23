import { NO_IMAGE, type Page } from "@linkyo/blocks";

/**
 * A page prepared for Sevag Ghazarian, from the application letter he gave the Linkyo team
 * (Lagerist / Töner, Sales Center Lörrach). Every fact on it comes from that letter; nothing is
 * added. No photo of him yet: his initials stand in, and the large picture is a placeholder of a
 * warehouse until he sends his own.
 *
 * Picture: "A large empty warehouse" by Krisana Nakajo, Unsplash License
 * (https://unsplash.com/photos/a-large-empty-warehouse-CeRq-JzKGi4), cropped 4:5 and graded.
 * Moving picture (public/media/motion/sevag-lager.mp4): Linkyo's own motion graphic on that photo,
 * a 7 s loop — a slow camera move into the aisle, a scan beam across the racks, corner marks that
 * lock onto the aisle signs J and K. No text in it. Its first frame is the picture above, so nothing
 * jumps when it starts; visitors who prefer less motion keep the still.
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
      src: `/prepared/${SEVAG_SLUG}/lager.jpg`,
      alt: "Eine helle Lagerhalle mit Palettenregalen, die Gänge mit J und K beschriftet",
      w: 1080,
      h: 1350,
    },
    motion: { src: "sample:motion-sevag-lager" },
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
