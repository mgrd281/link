import type { Block, BlockOf, BlockType, Page } from "@linkyo/blocks";

type Translate = (key: string) => string;

const base = { visible: true, highlight: false } as const;
const header = (id: string, title: string): BlockOf<"header"> => ({ ...base, id, type: "header", title });

/**
 * The Poster sample: the same creator as the other directions, arranged in titled sections and
 * extended so every Poster feature shows: named shows across months (month tabs), a run of mixes
 * (two-row rail), partner tiles, a labelled affiliate product and a logo for the Marquee template.
 * Fictional creators; original artwork; real block schemas (validated in sample.test.ts).
 */
export function posterSamplePage(page: Page, t: Translate): Page {
  const ar = page.profile.locale === "ar";
  const profile: Page["profile"] = {
    ...page.profile,
    tagline: t("tagline"),
    bio: t("bioShort"),
    logo: { src: ar ? "sample:nour-logo" : "sample:mila-logo", alt: t("logoAlt") },
  };
  const site = `https://${profile.username}.com`;
  const take = <T extends BlockType>(id: string, type: T): BlockOf<T> | null => {
    const block = page.blocks.find((candidate) => candidate.id === id);
    return block?.type === type ? (block as BlockOf<T>) : null;
  };
  const links = (slug: string): BlockOf<"music">["links"] => [
    { platform: "spotify", url: `https://open.spotify.com/album/${slug}` },
    { platform: "applemusic", url: `https://music.apple.com/album/${slug}` },
    { platform: "youtubemusic", url: `https://music.youtube.com/playlist?list=${slug}` },
    { platform: "soundcloud", url: `https://soundcloud.com/${profile.username}/${slug}` },
  ];

  const release = take("release", "music");
  const story = take("story", "card");
  const tour = take("tour", "events");
  const booking = take("booking", "link");

  // Six named dates over five months: enough for the month tabs to earn their place.
  const named = ["showRelease", "showClub", "showFestival", "showOpenAir"] as const;
  const times = ["21:00", "23:00", "19:30", "18:00"] as const;
  const shows: BlockOf<"events"> | null = tour
    ? {
        ...tour,
        title: t("sectionShows"),
        items: [
          {
            date: "2026-11-28",
            city: ar ? "بيروت" : "Berlin",
            venue: "Kiezfunk 98.4",
            url: `${site}/radio`,
            status: "onsale",
            name: t("showRadio"),
            time: "20:00",
          },
          ...tour.items.map((item, i) => ({ ...item, name: t(named[i] ?? "showFinale"), time: times[i] ?? "20:00" })),
          {
            date: "2027-03-13",
            city: ar ? "بيروت" : "Berlin",
            venue: ar ? "مسرح المدينة" : "Halle am Fluss",
            url: `${site}/finale`,
            status: "onsale",
            name: t("showFinale"),
            time: "20:30",
          },
        ],
      }
    : null;

  const mixes: BlockOf<"card">[] = [1, 2, 3, 4].map((n) => ({
    ...base,
    id: `mix-${n}`,
    type: "card",
    title: `${t("mixTitle")} ${String(n).padStart(2, "0")}`,
    description: t("mixDesc"),
    url: `https://soundcloud.com/${profile.username}/late-night-selects-${n}`,
    image: { src: `sample:mix-0${n}`, alt: t("mixAlt") },
  }));

  const blocks: (Block | null)[] = [
    take("socials", "socials"),
    take("live", "live"),
    release ? { ...release, highlight: true } : null,

    shows,

    header("section-music", t("sectionMusic")),
    {
      ...base,
      id: "single-2",
      type: "music",
      title: t("single2"),
      artist: profile.displayName,
      kind: "single",
      releaseDate: "2026-06-12",
      cover: { src: ar ? "sample:cover-dune" : "sample:cover-lichtfeld", alt: t("cover2Alt") },
      links: links("single-2"),
    },
    {
      ...base,
      id: "playlist",
      type: "music",
      title: t("playlist"),
      artist: profile.displayName,
      kind: "playlist",
      cover: { src: ar ? "sample:cover-orbit" : "sample:cover-daw", alt: t("cover3Alt") },
      links: links("late-night-selects").slice(0, 3),
    },

    header("section-mixes", t("sectionMixes")),
    ...mixes,

    header("section-videos", t("sectionVideos")),
    take("video", "video"),
    {
      ...base,
      id: "video-2",
      type: "video",
      title: t("video2Title"),
      provider: "youtube",
      url: "https://www.youtube.com/watch?v=tour-diary",
      poster: { src: "sample:event-berlin", alt: "" },
      duration: 512,
    },
    {
      ...base,
      id: "video-3",
      type: "video",
      title: t("video3Title"),
      provider: "youtube",
      url: "https://www.youtube.com/watch?v=after-show",
      poster: { src: "sample:event-hamburg", alt: "" },
      duration: 305,
    },

    take("shorts", "shorts"),

    header("section-shop", t("sectionShop")),
    take("vinyl", "product"),
    {
      ...base,
      id: "print",
      type: "product",
      title: t("posterPrint"),
      price: 35,
      currency: "EUR",
      url: `https://shop.${profile.username}.com/products/print`,
      image: { src: ar ? "sample:merch-print" : "sample:merch-poster", alt: t("posterPrintAlt") },
    },

    {
      ...base,
      id: "partners",
      type: "brands",
      title: t("sectionPartners"),
      columns: 3,
      items: [
        { name: "Nordlicht Audio", logo: { src: "sample:partner-nordlicht", alt: "" }, url: "https://nordlicht-audio.example.com" },
        { name: "Kiezfunk 98.4", logo: { src: "sample:partner-kiezfunk", alt: "" }, url: "https://kiezfunk.example.com" },
        { name: "Werk Neun", logo: { src: "sample:partner-werk9", alt: "" }, url: "https://werk9.example.com" },
      ],
    },

    header("section-contact", t("sectionContact")),
    booking ? { ...booking, thumbnail: { src: ar ? "sample:nour-avatar" : "sample:mila-avatar", alt: "" } } : null,
    {
      ...base,
      id: "gear",
      type: "card",
      title: t("gear"),
      description: "nordlicht-audio.example.com",
      url: "https://nordlicht-audio.example.com/headphones?ref=milaaurel",
      image: { src: "sample:gear-headphones", alt: t("gearAlt") },
      affiliate: true,
    },
    take("pack", "link"),
    story ? { ...story, highlight: false } : null,
    { ...base, id: "website", type: "link", title: t("website"), url: site },
    take("newsletter", "newsletter"),
  ];

  return { profile, blocks: blocks.filter((block): block is Block => block !== null) };
}

// ─── The portfolio sample ─────────────────────────────────────────────────────────────────────

type Locale = Page["profile"]["locale"];
type Project = BlockOf<"project">;

/** The size and focal point of the sample's work pictures (as recorded with the files). */
const SHOT: Record<string, { w: number; h: number; focal: [number, number] }> = {
  "02": { w: 2240, h: 1493, focal: [0.3, 0.55] },
  "03": { w: 1067, h: 1600, focal: [0.5, 0.55] },
  "04": { w: 2240, h: 1493, focal: [0.55, 0.5] },
  "05": { w: 1067, h: 1600, focal: [0.47, 0.55] },
  "06": { w: 2240, h: 1399, focal: [0.62, 0.58] },
  "07": { w: 1600, h: 1600, focal: [0.48, 0.52] },
  "08": { w: 2240, h: 1493, focal: [0.62, 0.58] },
  "09": { w: 1067, h: 1600, focal: [0.45, 0.5] },
  "10": { w: 2240, h: 1493, focal: [0.42, 0.55] },
  "11": { w: 1600, h: 1600, focal: [0.5, 0.5] },
  "12": { w: 1600, h: 1067, focal: [0.45, 0.5] },
  "13": { w: 2240, h: 1493, focal: [0.5, 0.42] },
  "14": { w: 1600, h: 1067, focal: [0.62, 0.4] },
  "18": { w: 1600, h: 1066, focal: [0.5, 0.5] },
  "19": { w: 1200, h: 1600, focal: [0.5, 0.42] },
  "20": { w: 1600, h: 1200, focal: [0.5, 0.5] },
};

const shot = (key: string, alt: string): NonNullable<Project["cover"]> => {
  const meta = SHOT[key];
  return { src: `sample:ex-pf-ronja-${key}`, alt, ...(meta ? { w: meta.w, h: meta.h, focal: meta.focal } : {}) };
};

/** Twelve lines, as a project's code sample allows up to thirty. Shown left to right in every language. */
const CODE = `import { chart } from "rasterblick";

// One canvas, any number of rows: only what is on screen is drawn.
const orders = chart("#orders", {
  kind: "bars",
  x: "month",
  y: ["web", "app", "partner"],
  stacked: true,
});

orders.load("/api/orders.csv"); // streams, never blocks the page
orders.on("select", (range) => console.log(range));`;

interface PortfolioCopy {
  tagline: string;
  bio: string;
  stats: [string, string][];
  work: string;
  /** The harbour series: its eleven pictures after the cover, in order. */
  harbour: { title: string; summary: string; role: string; tags: string[]; cover: string; about: string; shots: [key: string, alt: string, caption?: string][] };
  bath: { title: string; summary: string; client: string; role: string; tags: string[]; cover: string; figure: [string, string]; problem: string; solution: string; result: string; shots: [string, string][] };
  booking: { title: string; summary: string; client: string; role: string; tags: string[]; figures: [string, string][]; problem: string; solution: string; result: string };
  charts: { summary: string; role: string; tags: string[]; cover: string; about: string };
  signs: { title: string; summary: string; client: string; role: string; tags: string[]; problem: string; solution: string };
  tailors: { title: string; summary: string; role: string; cover: string };
  about: { title: string; text: string; portrait: string; facts: [string, string][] };
  tools: { title: string; items: string[] };
  clients: { title: string; names: string[] };
  quotes: { title: string; items: [text: string, name: string, role: string, project?: string][] };
  timeline: { title: string; items: [role: string, org: string, from: number, to: number | "now" | undefined, note?: string][] };
  contact: { title: string; text: string; status: string; primary: string; steps: string[] };
}

const COPY: Record<Locale, PortfolioCopy> = {
  de: {
    tagline: "Designerin & Fotografin für Marken, Orte und Werkzeuge",
    bio: "Ich gestalte Erscheinungsbilder und digitale Werkzeuge – und fotografiere die Menschen, die damit arbeiten.",
    stats: [
      ["9", "Jahre selbstständig"],
      ["40+", "Projekte"],
      ["3", "Open-Source-Werkzeuge"],
    ],
    work: "Ausgewählte Arbeiten",
    harbour: {
      title: "Hafenlicht",
      summary: "Zwölf Monate an Bord kleiner Küstenkutter: Arbeit, Wetter und das Licht dazwischen.",
      role: "Freie Serie",
      tags: ["Reportage", "Fotografie"],
      cover: "Ein grüner Kutter auf offener See unter weitem blauem Himmel, Möwen über dem Heck.",
      about: "Ein Jahr lang bin ich mit drei Besatzungen hinausgefahren, meist vor Sonnenaufgang. Die Serie zeigt keine Seefahrerromantik, sondern Handgriffe: Netze, Ketten, Kisten, und zwischendurch das Licht, das alles kurz still macht.",
      shots: [
        ["02", "Zwei Fischer in Ölzeug gehen am Kai entlang, neben ihnen liegen die Kutter mit hängenden Netzen.", "Kurz nach dem Anlegen"],
        ["03", "Ein Kutter liegt frontal am Steg, das Wasser ist glatt, der Himmel hell vor Sonnenaufgang."],
        ["04", "Ein Fischer in gelbem Ölzeug steht an der Reling, neben ihm hängt ein volles Schleppnetz über dem Meer."],
        ["05", "Ein Matrose steht unter dem Geschirr an Deck und zieht ein Tau ein."],
        ["07", "Ein Arbeiter in blauer Latzhose geht durch ein Hallentor ins tiefe Abendlicht.", "Schichtende in der Auktionshalle"],
        ["08", "Blick von oben auf das Deck: Netze, Kisten und drei Männer, die den Fang sortieren."],
        ["09", "Ein Arbeiter in Ölzeug hängt eine schwere Kette in das Netzgeschirr ein."],
        ["10", "Ein Fischer in Gelb kniet an der Reling, hinter ihm hängen zwei Netze über grüner See."],
        ["11", "Frischer Fisch auf Eis in einer gelben Kiste, von oben gesehen."],
        ["12", "Eine Hand hält einen Fisch in die Auktionshalle, im Hintergrund stapeln sich blaue Kisten.", "Der erste Fang des Tages"],
        ["13", "Blick vom Mast auf Steuerhaus und Heck eines Kutters in bewegter See."],
      ],
    },
    bath: {
      title: "Das alte Stadtbad",
      summary: "Neues Erscheinungsbild und Bildsprache für ein wiedereröffnetes Stadtbad von 1912.",
      client: "Städtische Bäderbetriebe",
      role: "Erscheinungsbild & Fotografie",
      tags: ["Erscheinungsbild", "Leitsystem", "Fotografie"],
      cover: "Ein Schwimmbecken mit türkisem Wasser in einem Innenhof mit weißen Bögen und Galerien.",
      figure: ["+38 %", "Besuche im ersten Jahr"],
      problem: "Nach der Sanierung kannte kaum jemand das Bad: Die Schilder stammten aus drei Jahrzehnten, die Website zeigte das Gebäude nur von außen.",
      solution: "Ich habe die Farben der Kacheln aufgenommen, eine klare Schrift für Schilder und Preise gewählt und das Haus an zwei Tagen ohne Gäste fotografiert.",
      result: "Das Bad hat heute ein Bild, das man wiedererkennt: auf Plakaten, an den Türen und auf der Eintrittskarte.",
      shots: [
        ["19", "Ein gekachelter Bogen in Blau und Braun über dem Rand eines türkisen Beckens."],
        ["20", "Ruhiges türkises Wasser über dunklen Bahnlinien, von oben gesehen."],
      ],
    },
    booking: {
      title: "Termine ohne Telefon",
      summary: "Online-Terminbuchung für eine Praxis für Physiotherapie: weniger Anrufe, kürzere Wartezeit.",
      client: "Eine Praxis für Physiotherapie",
      role: "UX-Design",
      tags: ["UX", "Service-Design"],
      figures: [
        ["9 → 3 Wochen", "Wartezeit auf Termine"],
        ["−41 %", "Anrufe am Empfang"],
      ],
      problem: "Termine gab es nur am Telefon, und das war zwischen acht und zehn Uhr besetzt. Wer arbeitete, kam nicht durch.",
      solution: "Mit dem Praxisteam habe ich die zwölf häufigsten Anliegen sortiert und daraus eine Buchung in drei Schritten gebaut, die auch auf einem alten Telefon funktioniert.",
      result: "Nach vier Monaten kamen sechs von zehn Buchungen online. Der Empfang hat wieder Zeit für die Menschen, die vor ihm stehen.",
    },
    charts: {
      summary: "Kleine Open-Source-Bibliothek für Diagramme, die auch mit einer Million Zeilen flüssig bleiben.",
      role: "Open Source",
      tags: ["TypeScript", "Canvas", "Open Source"],
      cover: "Eine helle Beispielseite mit Balkendiagramm, Ringdiagramm und einer Wärmekarte.",
      about: "Entstanden aus einem Kundenprojekt, in dem jede Tabelle zu groß für die üblichen Diagramme war. rasterblick zeichnet nur, was zu sehen ist.",
    },
    signs: {
      title: "Leitsystem Werkhalle 4",
      summary: "Wegweiser, Raumnamen und Piktogramme für eine Werkhalle, die zum Atelierhaus wurde.",
      client: "Ein Atelierhaus",
      role: "Leitsystem & Typografie",
      tags: ["Typografie", "Leitsystem"],
      problem: "Vierzig Ateliers auf drei Ebenen, und Besucher fanden nicht einmal den Aufzug.",
      solution: "Jede Ebene bekam eine Farbe des alten Hallenbodens, jedes Atelier eine Nummer, die man vom Hof aus lesen kann. Die Schilder sind aus dem Blech der alten Tore geschnitten.",
    },
    tailors: {
      title: "Die Schneiderinnen",
      summary: "Reportage aus einer Maßschneiderei, erschienen in einem Stadtmagazin.",
      role: "Reportage",
      cover: "Eine Schneiderin sitzt im Gegenlicht am Zuschneidetisch, vor ihr Stoff, Scheren und Schnittmuster.",
    },
    about: {
      title: "Über mich",
      text: "Ich arbeite seit neun Jahren selbstständig, meist für Häuser, die etwas Handfestes tun: Bäder, Werkstätten, Praxen.\n\nAm liebsten begleite ich ein Projekt von der ersten Frage bis zum letzten Schild. Deshalb fotografiere ich selbst, und deshalb schreibe ich die kleinen Werkzeuge, die mir fehlen, auch selbst.",
      portrait: "Mila Aurel im Porträt",
      facts: [
        ["Standort", "Berlin"],
        ["Sprachen", "Deutsch, Englisch"],
        ["Arbeitet für", "Kultur, Handwerk, Gesundheit"],
      ],
    },
    tools: { title: "Kenntnisse & Werkzeuge", items: ["Erscheinungsbilder", "Leitsysteme", "Reportagefotografie", "UX-Design", "Figma", "TypeScript", "Barrierefreiheit", "Workshops"] },
    clients: { title: "Kunden", names: ["Städtische Bäderbetriebe", "Atelierhaus Werkhalle 4", "Praxis am Kanal", "Kiezfunk 98.4", "Nordlicht Audio"] },
    quotes: {
      title: "Kundenstimmen",
      items: [
        ["Mila hat zugehört, bevor sie etwas gezeichnet hat. Unsere Gäste finden seitdem den Weg, und wir erkennen unser Haus auf jedem Plakat wieder.", "J. Brandt", "Betriebsleitung eines Stadtbads", "bath"],
        ["Drei Schritte statt einer Warteschleife. Unsere Patientinnen danken es uns jeden Tag.", "S. Okafor", "Inhaberin einer Praxis für Physiotherapie", "booking"],
      ],
    },
    timeline: {
      title: "Erfahrung",
      items: [
        ["Selbstständige Designerin", "Studio Mila Aurel", 2017, "now", "Erscheinungsbilder, Leitsysteme und digitale Werkzeuge."],
        ["Designerin", "Ein Büro für Ausstellungsgestaltung", 2014, 2017],
        ["Diplom Kommunikationsdesign", "Kunsthochschule", 2009, 2014],
      ],
    },
    contact: {
      title: "Lass uns über dein Projekt sprechen.",
      text: "Schreib mir zwei Sätze dazu, worum es geht. Ich antworte innerhalb von zwei Werktagen.",
      status: "Frei für neue Projekte",
      primary: "Projekt anfragen",
      steps: ["Du schreibst mir, worum es geht.", "Wir telefonieren eine halbe Stunde.", "Du bekommst ein Angebot mit festem Preis."],
    },
  },
  en: {
    tagline: "Designer & photographer for brands, places and tools",
    bio: "I design identities and digital tools, and photograph the people who work with them.",
    stats: [
      ["9", "years independent"],
      ["40+", "projects"],
      ["3", "open-source tools"],
    ],
    work: "Selected work",
    harbour: {
      title: "Hafenlicht",
      summary: "Twelve months on board small coastal trawlers: work, weather and the light in between.",
      role: "Personal series",
      tags: ["Reportage", "Photography"],
      cover: "A green trawler on the open sea under a wide blue sky, gulls over the stern.",
      about: "For a year I went out with three crews, mostly before sunrise. The series shows no romance of the sea, only handwork: nets, chains, crates, and now and then the light that makes everything still for a moment.",
      shots: [
        ["02", "Two fishermen in oilskins walk along the quay, the trawlers beside them with their nets hanging.", "Just after landing"],
        ["03", "A trawler seen head-on at the pier, the water smooth, the sky bright before sunrise."],
        ["04", "A fisherman in yellow oilskins stands at the rail, a full dredge hanging beside him over the sea."],
        ["05", "A deckhand stands under the rigging and hauls in a rope."],
        ["07", "A worker in blue overalls walks through a hall door into low evening light.", "End of a shift in the auction hall"],
        ["08", "The deck seen from above: nets, crates and three men sorting the catch."],
        ["09", "A worker in oilskins hooks a heavy chain into the net gear."],
        ["10", "A fisherman in yellow kneels at the rail, two nets hanging behind him over a green sea."],
        ["11", "Fresh fish on ice in a yellow crate, seen from above."],
        ["12", "A hand holds a fish up in the auction hall, blue crates stacked in the background.", "The first catch of the day"],
        ["13", "The view from the mast onto the wheelhouse and stern of a trawler in a rough sea."],
      ],
    },
    bath: {
      title: "The old public baths",
      summary: "A new identity and a visual language for public baths from 1912, reopened after years.",
      client: "A city's baths department",
      role: "Identity & photography",
      tags: ["Identity", "Wayfinding", "Photography"],
      cover: "A pool of turquoise water in a courtyard with white arches and galleries.",
      figure: ["+38 %", "visits in the first year"],
      problem: "After the renovation hardly anyone knew the baths: the signs came from three decades, and the website showed the building from the outside only.",
      solution: "I picked up the colours of the tiles, chose one clear typeface for signs and prices, and photographed the house on two days without guests.",
      result: "Today the baths have a look people recognise: on posters, on the doors and on the ticket.",
      shots: [
        ["19", "A tiled arch in blue and brown above the edge of a turquoise pool."],
        ["20", "Calm turquoise water over dark lane lines, seen from above."],
      ],
    },
    booking: {
      title: "Appointments without the phone",
      summary: "Online booking for a physiotherapy practice: fewer calls, a shorter wait.",
      client: "A physiotherapy practice",
      role: "UX design",
      tags: ["UX", "Service design"],
      figures: [
        ["12 → 4 weeks", "wait for an appointment"],
        ["−41 %", "calls at the front desk"],
      ],
      problem: "Appointments were made by phone only, and the phone was busy between eight and ten. People with a job never got through.",
      solution: "With the team I sorted the twelve most common requests and built a booking in three steps that also works on an old phone.",
      result: "After four months six in ten bookings came in online. The front desk has time again for the people standing at it.",
    },
    charts: {
      summary: "A small open-source library for charts that stay smooth with a million rows.",
      role: "Open source",
      tags: ["TypeScript", "Canvas", "Open source"],
      cover: "A light example page with a bar chart, a ring chart and a heat map.",
      about: "It grew out of a client project in which every table was too large for the usual charts. rasterblick only draws what is on screen.",
    },
    signs: {
      title: "Wayfinding for Werkhalle 4",
      summary: "Signs, room names and pictograms for a factory hall that became a house of studios.",
      client: "A house of studios",
      role: "Wayfinding & typography",
      tags: ["Typography", "Wayfinding"],
      problem: "Forty studios on three levels, and visitors could not even find the lift.",
      solution: "Each level got a colour from the old hall floor, each studio a number you can read from the yard. The signs are cut from the sheet metal of the old gates.",
    },
    tailors: {
      title: "The seamstresses",
      summary: "A reportage from a bespoke tailor's workshop, published in a city magazine.",
      role: "Reportage",
      cover: "A seamstress sits against the light at the cutting table, with cloth, scissors and patterns in front of her.",
    },
    about: {
      title: "About me",
      text: "I have worked independently for nine years, mostly for places that do something tangible: baths, workshops, practices.\n\nI like to stay with a project from the first question to the last sign. That is why I take the photographs myself, and why I write the small tools I am missing myself as well.",
      portrait: "Portrait of Mila Aurel",
      facts: [
        ["Based in", "Berlin"],
        ["Languages", "German, English"],
        ["Works for", "Culture, crafts, health"],
      ],
    },
    tools: { title: "Skills & tools", items: ["Identities", "Wayfinding", "Reportage photography", "UX design", "Figma", "TypeScript", "Accessibility", "Workshops"] },
    clients: { title: "Clients", names: ["A city's baths department", "Werkhalle 4 studios", "Praxis am Kanal", "Kiezfunk 98.4", "Nordlicht Audio"] },
    quotes: {
      title: "What clients say",
      items: [
        ["Mila listened before she drew anything. Our guests find their way now, and we recognise our house on every poster.", "J. Brandt", "Manager of public baths", "bath"],
        ["Three steps instead of a queue on the phone. Our patients thank us for it every day.", "S. Okafor", "Owner of a physiotherapy practice", "booking"],
      ],
    },
    timeline: {
      title: "Experience",
      items: [
        ["Independent designer", "Studio Mila Aurel", 2017, "now", "Identities, wayfinding and digital tools."],
        ["Designer", "An exhibition design office", 2014, 2017],
        ["Diploma in communication design", "University of the arts", 2009, 2014],
      ],
    },
    contact: {
      title: "Let's talk about your project.",
      text: "Write me two sentences about what you have in mind. I answer within two working days.",
      status: "Open for new projects",
      primary: "Ask about a project",
      steps: ["You tell me what it is about.", "We talk for half an hour.", "You get a quote with a fixed price."],
    },
  },
  ar: {
    tagline: "مصممة ومصوّرة للعلامات والأماكن والأدوات",
    bio: "أصمّم الهويات البصرية والأدوات الرقمية، وأصوّر الناس الذين يعملون بها.",
    stats: [
      ["9", "سنوات عمل مستقل"],
      ["40+", "مشروعًا"],
      ["3", "أدوات مفتوحة المصدر"],
    ],
    work: "أعمال مختارة",
    harbour: {
      title: "ضوء الميناء",
      summary: "اثنا عشر شهرًا على متن قوارب صيد صغيرة: العمل والطقس والضوء بينهما.",
      role: "سلسلة شخصية",
      tags: ["ريبورتاج", "تصوير"],
      cover: "قارب صيد أخضر في عرض البحر تحت سماء زرقاء واسعة، والنوارس فوق مؤخرته.",
      about: "خرجتُ عامًا كاملًا مع ثلاثة طواقم، غالبًا قبل شروق الشمس. لا تعرض السلسلة رومانسية البحر، بل حركة الأيدي: الشباك والسلاسل والصناديق، وبين حين وآخر ذلك الضوء الذي يُسكن كل شيء للحظة.",
      shots: [
        ["02", "صيادان بملابس مشمّعة يسيران على الرصيف، وإلى جانبهما القوارب وشباكها المعلّقة.", "بعد الرسوّ بقليل"],
        ["03", "قارب صيد يُرى من الأمام عند الرصيف، والماء ساكن والسماء مضيئة قبل الشروق."],
        ["04", "صياد بملابس صفراء يقف عند الحاجز، وإلى جانبه شبكة ممتلئة معلّقة فوق البحر."],
        ["05", "بحّار يقف تحت حبال السارية ويسحب حبلًا."],
        ["07", "عامل ببدلة زرقاء يعبر باب القاعة نحو ضوء المساء المنخفض.", "نهاية الوردية في قاعة المزاد"],
        ["08", "سطح القارب من الأعلى: شباك وصناديق وثلاثة رجال يفرزون الصيد."],
        ["09", "عامل بملابس مشمّعة يعلّق سلسلة ثقيلة في عدّة الشباك."],
        ["10", "صياد بالأصفر يجثو عند الحاجز، وخلفه شبكتان معلّقتان فوق بحر أخضر."],
        ["11", "سمك طازج على الثلج في صندوق أصفر، من الأعلى."],
        ["12", "يد ترفع سمكة في قاعة المزاد، وفي الخلفية صناديق زرقاء مرصوصة.", "أول صيد في اليوم"],
        ["13", "منظر من أعلى السارية على غرفة القيادة ومؤخرة القارب في بحر هائج."],
      ],
    },
    bath: {
      title: "الحمّام البلدي القديم",
      summary: "هوية بصرية ولغة صور جديدتان لحمّام بلدي من عام 1912 أُعيد افتتاحه.",
      client: "إدارة الحمّامات البلدية",
      role: "الهوية البصرية والتصوير",
      tags: ["هوية بصرية", "لوحات إرشادية", "تصوير"],
      cover: "مسبح بماء فيروزي في فناء داخلي تحيط به أقواس بيضاء وشرفات.",
      figure: ["+38 %", "زيارات في السنة الأولى"],
      problem: "بعد الترميم لم يكن أحد يعرف الحمّام تقريبًا: اللوحات تعود إلى ثلاثة عقود مختلفة، والموقع لا يعرض المبنى إلا من الخارج.",
      solution: "أخذتُ ألوان البلاط، واخترتُ خطًّا واحدًا واضحًا للوحات والأسعار، وصوّرتُ المكان في يومين خاليين من الزوّار.",
      result: "صار للحمّام اليوم مظهر يعرفه الناس: على الملصقات وعلى الأبواب وعلى تذكرة الدخول.",
      shots: [
        ["19", "قوس مكسوّ بالبلاط الأزرق والبنّي فوق حافة مسبح فيروزي."],
        ["20", "ماء فيروزي ساكن فوق خطوط المسارات الداكنة، من الأعلى."],
      ],
    },
    booking: {
      title: "مواعيد بلا هاتف",
      summary: "حجز المواعيد عبر الإنترنت لعيادة علاج طبيعي: اتصالات أقل وانتظار أقصر.",
      client: "عيادة للعلاج الطبيعي",
      role: "تصميم تجربة المستخدم",
      tags: ["تجربة المستخدم", "تصميم الخدمات"],
      figures: [
        ["9 ← 3 أسابيع", "انتظار الموعد"],
        ["−41 %", "اتصالات الاستقبال"],
      ],
      problem: "كانت المواعيد تُحجز بالهاتف فقط، والخط مشغول بين الثامنة والعاشرة. من يعمل لا يصل إلى أحد.",
      solution: "رتّبتُ مع فريق العيادة أكثر اثني عشر طلبًا شيوعًا، وبنيتُ منها حجزًا من ثلاث خطوات يعمل حتى على هاتف قديم.",
      result: "بعد أربعة أشهر صار ستة من كل عشرة حجوزات تأتي عبر الإنترنت، وعاد للاستقبال وقت لمن يقف أمامه.",
    },
    charts: {
      summary: "مكتبة صغيرة مفتوحة المصدر لرسوم بيانية تبقى سلسة حتى مع مليون صف.",
      role: "مفتوح المصدر",
      tags: ["TypeScript", "Canvas", "مفتوح المصدر"],
      cover: "صفحة أمثلة فاتحة فيها مخطط أعمدة ومخطط دائري وخريطة حرارية.",
      about: "نشأت من مشروع لعميل كانت كل جداوله أكبر من أن تتحملها الرسوم المعتادة. rasterblick لا يرسم إلا ما يظهر على الشاشة.",
    },
    signs: {
      title: "لوحات إرشادية لمبنى المراسم",
      summary: "لوحات وأسماء غرف ورموز لقاعة مصنع تحوّلت إلى بيت للمراسم.",
      client: "بيت للمراسم",
      role: "اللوحات الإرشادية والخطوط",
      tags: ["خطوط", "لوحات إرشادية"],
      problem: "أربعون مرسمًا في ثلاثة طوابق، والزوّار لا يجدون حتى المصعد.",
      solution: "أخذ كل طابق لونًا من أرضية القاعة القديمة، وكل مرسم رقمًا يُقرأ من الفناء. قُصّت اللوحات من صفيح البوابات القديمة.",
    },
    tailors: {
      title: "الخيّاطات",
      summary: "ريبورتاج من مشغل خياطة حسب الطلب، نُشر في مجلة المدينة.",
      role: "ريبورتاج",
      cover: "خيّاطة تجلس عكس الضوء إلى طاولة القصّ، وأمامها قماش ومقصّات وقوالب.",
    },
    about: {
      title: "نبذة عني",
      text: "أعمل مستقلةً منذ تسع سنوات، غالبًا لأماكن تصنع شيئًا ملموسًا: حمّامات ومشاغل وعيادات.\n\nأحبّ أن أرافق المشروع من السؤال الأول إلى اللوحة الأخيرة. لذلك ألتقط الصور بنفسي، ولذلك أكتب بنفسي الأدوات الصغيرة التي أفتقدها.",
      portrait: "صورة شخصية لنور حداد",
      facts: [
        ["المقرّ", "بيروت"],
        ["اللغات", "العربية، الإنجليزية"],
        ["تعمل لصالح", "الثقافة، الحِرف، الصحة"],
      ],
    },
    tools: { title: "المهارات والأدوات", items: ["الهويات البصرية", "اللوحات الإرشادية", "تصوير الريبورتاج", "تجربة المستخدم", "Figma", "TypeScript", "سهولة الوصول", "ورش العمل"] },
    clients: { title: "العملاء", names: ["إدارة الحمّامات البلدية", "بيت المراسم", "عيادة القناة", "Kiezfunk 98.4", "Nordlicht Audio"] },
    quotes: {
      title: "آراء العملاء",
      items: [
        ["أصغت نور قبل أن ترسم أي شيء. صار زوّارنا يجدون طريقهم، وصرنا نعرف مكاننا في كل ملصق.", "ج. برانت", "إدارة حمّام بلدي", "bath"],
        ["ثلاث خطوات بدل الانتظار على الهاتف. مرضانا يشكروننا على ذلك كل يوم.", "س. أوكافور", "صاحبة عيادة للعلاج الطبيعي", "booking"],
      ],
    },
    timeline: {
      title: "الخبرة",
      items: [
        ["مصممة مستقلة", "استوديو نور حداد", 2017, "now", "هويات بصرية ولوحات إرشادية وأدوات رقمية."],
        ["مصممة", "مكتب لتصميم المعارض", 2014, 2017],
        ["دبلوم في تصميم الاتصال", "كلية الفنون", 2009, 2014],
      ],
    },
    contact: {
      title: "لنتحدّث عن مشروعك.",
      text: "اكتب لي جملتين عمّا تفكّر فيه. أردّ خلال يومَي عمل.",
      status: "متاحة لمشاريع جديدة",
      primary: "اسأل عن مشروع",
      steps: ["تكتب لي ما المطلوب.", "نتحدّث نصف ساعة.", "يصلك عرض بسعر ثابت."],
    },
  },
};

/**
 * The portfolio sample: the sample creator as a designer and photographer, with everything a
 * portfolio page can show. Six projects, one of each kind of card: a series with twelve pictures
 * (the hero plate of Werkbogen), a project with a cover and three pictures, one whose cover is a
 * result figure of twelve characters, one read from a repository (facts, install command and a
 * twelve-line code sample), one whose cover is its title, and a thin one that only opens a link.
 * Then about, clients as names, quotes, tools, experience and the contact band.
 *
 * No hero picture: the plate shows the first project. Fictional people and clients; the pictures
 * are the bundled example pictures (credited in assets/examples/CREDITS.md).
 */
export function portfolioSample(locale: string): Page {
  const lang: Locale = locale === "ar" ? "ar" : locale === "de" ? "de" : "en";
  const copy = COPY[lang];
  const ar = lang === "ar";
  const user = ar ? "nourhaddad" : "milaaurel";
  const name = ar ? "نور حداد" : "Mila Aurel";
  const site = `https://${user}.com`;
  const profile: Page["profile"] = {
    username: user,
    displayName: name,
    tagline: copy.tagline,
    bio: copy.bio,
    location: ar ? "بيروت" : "Berlin",
    avatar: { src: ar ? "sample:nour-avatar" : "sample:mila-avatar", alt: name },
    stats: copy.stats.map(([value, label]) => ({ value, label })),
    verified: false,
    locale: lang,
  };
  const project = (id: string, slug: string, fields: Omit<Project, "id" | "type" | "slug" | "visible" | "highlight">): Project => ({ ...base, id, type: "project", slug, ...fields });

  const blocks: Block[] = [
    {
      ...base,
      id: "socials",
      type: "socials",
      items: [
        { platform: "instagram", url: `https://instagram.com/${user}` },
        { platform: "github", url: `https://github.com/${user}` },
        { platform: "linkedin", url: `https://www.linkedin.com/in/${user}` },
        { platform: "email", url: `mailto:hello@${user}.com` },
      ],
    },
    header("work", copy.work),
    project("harbour", "hafenlicht", {
      title: copy.harbour.title,
      summary: copy.harbour.summary,
      role: copy.harbour.role,
      year: { from: 2025 },
      tags: copy.harbour.tags,
      cover: shot("06", copy.harbour.cover),
      story: { about: copy.harbour.about },
      pictures: copy.harbour.shots.map(([key, alt, caption]) => ({ image: shot(key, alt), ...(caption ? { caption } : {}) })),
    }),
    project("bath", "stadtbad", {
      title: copy.bath.title,
      summary: copy.bath.summary,
      client: copy.bath.client,
      role: copy.bath.role,
      year: { from: 2024, to: 2025 },
      tags: copy.bath.tags,
      cover: shot("18", copy.bath.cover),
      results: [{ value: copy.bath.figure[0], label: copy.bath.figure[1] }],
      story: { problem: copy.bath.problem, solution: copy.bath.solution, result: copy.bath.result },
      pictures: copy.bath.shots.map(([key, alt]) => ({ image: shot(key, alt) })),
    }),
    project("booking", "termine", {
      title: copy.booking.title,
      summary: copy.booking.summary,
      client: copy.booking.client,
      role: copy.booking.role,
      year: { from: 2024 },
      tags: copy.booking.tags,
      results: copy.booking.figures.map(([value, label]) => ({ value, label })),
      story: { problem: copy.booking.problem, solution: copy.booking.solution, result: copy.booking.result },
    }),
    project("charts", "rasterblick", {
      title: "rasterblick",
      summary: copy.charts.summary,
      role: copy.charts.role,
      year: { from: 2023, to: "now" },
      tags: copy.charts.tags,
      cover: { src: "sample:ex-pf-tobin-03", alt: copy.charts.cover, w: 1600, h: 1000, focal: [0.62, 0.38] },
      story: { about: copy.charts.about },
      // A fictional page never hands out a command that installs someone's real code.
      source: { owner: user, repo: "rasterblick", stars: 1280, language: "TypeScript", license: "MIT", install: "npm install https://example.com/rasterblick.tgz", readAt: "2026-11-02" },
      code: { text: CODE, lang: "ts", file: "orders.ts" },
    }),
    project("signs", "werkhalle", {
      title: copy.signs.title,
      summary: copy.signs.summary,
      client: copy.signs.client,
      role: copy.signs.role,
      year: { from: 2023 },
      tags: copy.signs.tags,
      story: { problem: copy.signs.problem, solution: copy.signs.solution },
    }),
    project("tailors", "schneiderinnen", {
      title: copy.tailors.title,
      summary: copy.tailors.summary,
      role: copy.tailors.role,
      year: { from: 2025 },
      cover: shot("14", copy.tailors.cover),
      links: [{ url: "https://example.com/schneiderinnen" }],
    }),
    {
      ...base,
      id: "about",
      type: "about",
      title: copy.about.title,
      text: copy.about.text,
      portrait: { src: ar ? "sample:nour-hero" : "sample:mila-hero", alt: copy.about.portrait },
      facts: copy.about.facts.map(([label, value]) => ({ label, value })),
    },
    { ...base, id: "clients", type: "brands", title: copy.clients.title, columns: 3, items: copy.clients.names.map((client) => ({ name: client })) },
    {
      ...base,
      id: "quotes",
      type: "quotes",
      title: copy.quotes.title,
      items: copy.quotes.items.map(([text, who, role, about]) => ({ text, name: who, role, consent: true as const, ...(about ? { project: about } : {}) })),
    },
    { ...base, id: "tools", type: "tools", title: copy.tools.title, items: copy.tools.items },
    {
      ...base,
      id: "timeline",
      type: "timeline",
      title: copy.timeline.title,
      items: copy.timeline.items.map(([role, org, from, to, note]) => ({ role, org, years: to === undefined ? { from } : { from, to }, ...(note ? { note } : {}) })),
    },
    {
      ...base,
      id: "contact",
      type: "contact",
      title: copy.contact.title,
      text: copy.contact.text,
      status: copy.contact.status,
      primary: { label: copy.contact.primary, url: `mailto:hello@${user}.com`, icon: "mail" },
      links: [
        { kind: "cv", url: `${site}/cv.pdf` },
        { kind: "email", url: `mailto:hello@${user}.com` },
        { kind: "calendar", url: `${site}/call` },
      ],
      steps: copy.contact.steps,
    },
  ];
  return { profile, blocks };
}

/** Sixty characters, with one unbroken word of forty: the longest title a project takes. */
const LONG_TITLE: Record<Locale, string> = {
  de: "Donaudampfschifffahrtsgesellschaftskapitänsmütze – neu gedacht",
  en: "Pneumonoultramicroscopicsilicovolcanoconioses and a new start",
  ar: "إعادةتصميمالهويةالبصريةواللوحاتالإرشاديةلمبنىالمراسم من جديد",
};

/**
 * The same page with the longest texts the schema takes, for layout checks: a name of sixty
 * characters, a role line of eighty, titles of sixty with an unbroken word of forty, five tags of
 * twenty-four, figures of twelve unbroken characters, and eight projects (two wait behind "Show all").
 */
export function portfolioSampleLong(locale: string): Page {
  const page = portfolioSample(locale);
  const lang = page.profile.locale;
  const fit = (text: string, length: number): string =>
    Array.from(text.repeat(Math.ceil(length / Math.max(1, Array.from(text).length))))
      .slice(0, length)
      .join("")
      .replace(/[\s·]+$/u, "");
  const title = fit(LONG_TITLE[lang], 60);
  const tags = lang === "ar" ? ["هويةبصريةولوحاتإرشاديةجديدة", "تصويرريبورتاجللمشاغلوالحرف", "تجربةالمستخدموتصميمالخدمات", "TypeScript-Canvas-Charts", "مفتوحالمصدرللجميعدائماهنا"] : ["Erscheinungsbildentwurf", "Reportagefotografie-Serie", "Barrierefreiheitsprüfung", "TypeScript-Canvas-Charts", "Open-Source-Werkzeugbau"];
  const figure = lang === "ar" ? "9←3أسابيعفقط" : "9→3Wochen!!!";
  const projects = page.blocks.filter((block): block is Project => block.type === "project");
  const long = (block: Project, index: number): Project => ({
    ...block,
    title: index % 2 === 0 ? title : fit(`${block.title} · `, 60),
    summary: fit(`${block.summary} `, 140),
    role: fit(`${block.role ?? ""} · `, 60),
    tags: tags.map((tag) => fit(tag, 24)),
    ...(block.results ? { results: block.results.map((result) => ({ value: fit(figure, 12), label: fit(`${result.label} `, 24) })) } : {}),
  });
  const more: Project[] = projects.slice(2, 4).map((block, index) => ({ ...block, id: `${block.id}-2`, slug: `${block.slug}-2`, title: fit(`${block.title} ${String(index + 2)} · `, 60) }));
  let seen = 0;
  const blocks = page.blocks.flatMap((block): Block[] => {
    if (block.type !== "project") return [block];
    seen += 1;
    const out: Block[] = [long(block, seen - 1)];
    // The two extra projects follow the sixth.
    if (seen === projects.length) out.push(...more.map((extra, index) => long(extra, index + 1)));
    return out;
  });
  return {
    profile: {
      ...page.profile,
      displayName: fit(lang === "ar" ? "نور حداد للتصميم والتصوير " : "Mila Aurel-Wintersteinhausen und Partnerinnen ", 60),
      tagline: fit(`${page.profile.tagline ?? ""} · `, 80),
      bio: fit(`${page.profile.bio} `, 160),
    },
    blocks,
  };
}
