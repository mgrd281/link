import type { Block, Page } from "@linkyo/blocks";

/**
 * Example page for journalists, sent to journalists who might like a Linkyo page. "Lea Hartmann" is
 * fictional: every link goes to example.com, the photo is a stock photo (see assets/samples/CREDITS.md),
 * and the page says so. One person, three languages: a page can speak to every audience.
 */
interface Copy {
  name: string;
  tagline: string;
  bio: string;
  location: string;
  stats: [string, string][];
  latest: string;
  stories: [string, string][];
  /** One line under each story (the dek). */
  deks: [string, string, string];
  contact: string;
  tips: string;
  press: string;
  appearances: string;
  events: { name: string; city: string; venue: string }[];
  newsletter: [string, string];
  /** Mailbox names in the reader's language (tips@ / hinweise@). */
  mail: { tips: string; press: string; desk: string };
}

const avatar = { src: "sample:journalist-avatar", alt: "", focal: [0.5, 0.35] as [number, number] };
const hero = { src: "sample:journalist-hero", alt: "", focal: [0.62, 0.3] as [number, number] };
/** Story pictures: stock photos (assets/examples/CREDITS.md). */
const STORY_IMAGES = ["sample:ex2-housing", "sample:ex2-documents", "sample:ex2-nurse"];
const link = (id: string, title: string, url: string, extra: Partial<Extract<Block, { type: "link" }>> = {}): Block => ({ id, type: "link", visible: true, highlight: false, title, url, ...extra });

function page(locale: Page["profile"]["locale"], copy: Copy): Page {
  return {
    profile: {
      username: "lea-hartmann",
      displayName: copy.name,
      tagline: copy.tagline,
      bio: copy.bio,
      location: copy.location,
      avatar: { ...avatar, alt: copy.name },
      hero: { ...hero, alt: copy.name },
      stats: copy.stats.map(([value, label]) => ({ value, label })),
      verified: false,
      locale,
    },
    blocks: [
      {
        id: "socials",
        type: "socials",
        visible: true,
        highlight: false,
        items: [
          { platform: "x", url: "https://example.com/lea-hartmann/x" },
          { platform: "bluesky", url: "https://example.com/lea-hartmann/bluesky" },
          { platform: "instagram", url: "https://example.com/lea-hartmann/instagram" },
          { platform: "email", url: `mailto:${copy.mail.desk}@example.com` },
        ],
      },
      { id: "latest", type: "header", visible: true, highlight: false, title: copy.latest },
      ...copy.stories.map(([title], i): Block => ({
        id: `story-${i + 1}`,
        type: "card",
        visible: true,
        highlight: false,
        title,
        description: copy.deks[i] ?? "",
        url: `https://example.com/lea-hartmann/recherche-${i + 1}`,
        image: { src: STORY_IMAGES[i] ?? "none:", alt: "" },
      })),
      { id: "contact", type: "header", visible: true, highlight: false, title: copy.contact },
      link("tips", copy.tips, `mailto:${copy.mail.tips}@example.com`, { highlight: true }),
      link("press", copy.press, `mailto:${copy.mail.press}@example.com`),
      {
        id: "appearances",
        type: "events",
        visible: true,
        highlight: false,
        title: copy.appearances,
        items: copy.events.map((event, i) => ({
          date: i === 0 ? "2027-02-11" : "2027-03-04",
          time: i === 0 ? "19:30" : "20:00",
          name: event.name,
          city: event.city,
          venue: event.venue,
          url: `https://example.com/lea-hartmann/termin-${i + 1}`,
          status: i === 0 ? ("onsale" as const) : ("few" as const),
        })),
      },
      { id: "newsletter", type: "newsletter", visible: true, highlight: false, title: copy.newsletter[0], description: copy.newsletter[1] },
    ],
  };
}

export const journalistDe = page("de", {
  name: "Lea Hartmann",
  tagline: "Reporterin für Politik & Wirtschaft",
  bio: "Ich recherchiere zu Macht, Geld und Verantwortung. Hinweise gern vertraulich – auch anonym.",
  location: "Berlin",
  stats: [
    ["12", "Jahre Journalismus"],
    ["3", "Preise"],
    ["48 Tsd.", "Leser pro Woche"],
  ],
  latest: "Neueste Recherchen",
  stories: [
    ["Das Berliner Mieten-Kartell", "Neu"],
    ["300 Seiten Lobby-Mails", ""],
    ["Was Pflege wirklich verdient", ""],
  ],
  deks: ["Eine Datenrecherche zu 120.000 Wohnungen.", "Interne Mails zeigen, wer an Gesetzen mitschreibt.", "Gehälter aus 40 Kliniken im Vergleich."],
  contact: "Hinweise & Kontakt",
  tips: "Vertraulich einen Hinweis geben",
  press: "Interview- & Presseanfragen",
  appearances: "Auftritte",
  events: [
    { name: "Podium: Pressefreiheit", city: "Berlin", venue: "Literaturhaus" },
    { name: "Lesung: Mieten-Kartell", city: "Hamburg", venue: "Kulturforum" },
  ],
  newsletter: ["Recherche-Newsletter, jeden Freitag", "Was ich diese Woche herausgefunden habe – kurz und belegt."],
  mail: { tips: "hinweise", press: "presse", desk: "redaktion" },
});

export const journalistEn = page("en", {
  name: "Lea Hartmann",
  tagline: "Reporter for politics & business",
  bio: "I investigate power, money and accountability. Tips are welcome in confidence, anonymous too.",
  location: "Berlin",
  stats: [
    ["12", "years in journalism"],
    ["3", "awards"],
    ["48k", "readers a week"],
  ],
  latest: "Latest investigations",
  stories: [
    ["Berlin's rent cartel", "New"],
    ["300 pages of lobby emails", ""],
    ["What care work really pays", ""],
  ],
  deks: ["A data investigation into 120,000 flats.", "Internal emails show who helps write the bills.", "Pay at 40 hospitals, compared."],
  contact: "Tips & contact",
  tips: "Send a tip in confidence",
  press: "Interview & press requests",
  appearances: "Appearances",
  events: [
    { name: "Panel: press freedom", city: "Berlin", venue: "Literaturhaus" },
    { name: "Reading: Rent Cartel", city: "Hamburg", venue: "Kulturforum" },
  ],
  newsletter: ["Investigations newsletter, every Friday", "What I found out this week, short and sourced."],
  mail: { tips: "tips", press: "press", desk: "newsroom" },
});

export const journalistAr = page("ar", {
  name: "ليا هارتمان",
  tagline: "صحفية في السياسة والاقتصاد",
  bio: "أبحث في السلطة والمال والمسؤولية. يمكنكم إرسال المعلومات بسرّية، حتى دون ذكر الاسم.",
  location: "برلين",
  stats: [
    ["12", "عاماً في الصحافة"],
    ["3", "جوائز"],
    ["48 ألف", "قارئ أسبوعياً"],
  ],
  latest: "أحدث التحقيقات",
  stories: [
    ["كارتل الإيجارات في برلين", "جديد"],
    ["300 صفحة من رسائل اللوبي", ""],
    ["كم يكسب التمريض فعلاً؟", ""],
  ],
  deks: ["تحقيق بالبيانات في 120 ألف شقة.", "رسائل داخلية تكشف من يشارك في كتابة القوانين.", "مقارنة الرواتب في 40 مستشفى."],
  contact: "معلومات وتواصل",
  tips: "أرسل معلومة بسرّية",
  press: "طلبات المقابلات والصحافة",
  appearances: "مشاركات قادمة",
  events: [
    { name: "ندوة: حرية الصحافة", city: "برلين", venue: "Literaturhaus" },
    { name: "قراءة: كارتل الإيجارات", city: "هامبورغ", venue: "Kulturforum" },
  ],
  newsletter: ["نشرة التحقيقات، كل جمعة", "ما اكتشفته هذا الأسبوع، باختصار ومع المصادر."],
  mail: { tips: "tips", press: "press", desk: "newsroom" },
});
