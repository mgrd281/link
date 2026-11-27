import { NO_IMAGE, type Block, type Page } from "@linkyo/blocks";

import { libraryClip } from "@/features/creator/motion-library";

/**
 * A fictional applicant for the Laufbahn template: Jonas Brandt, a warehouse logistics specialist in
 * Bremen (de, en), and Karim Nasser in Sharjah (ar), the same structure in Arabic. Nobody here is a
 * real person. Their pages are the bare surface for the page's screenshots and its first-screen
 * measurements, and the fixtures of the application's PDFs (features/documents): no real person's
 * data ever reaches a test. Contact data is fictional too: example.com addresses, and a phone number
 * from the range the Bundesnetzagentur keeps for film and television (030 23125 xxx), never one that
 * could be someone's. The pictures are Linkyo's own drawn warehouse clip ("Lagerarbeit").
 */

const block = { visible: true, highlight: false } as const;
const CLIP = "lagerarbeit";

function hero(locale: Page["profile"]["locale"]): Pick<Page["profile"], "hero" | "motion"> {
  const clip = libraryClip(`sample:motion-${CLIP}`);
  return clip ? { hero: { src: clip.poster, alt: clip.alt[locale], w: clip.w, h: clip.h }, motion: { src: `sample:motion-${CLIP}` } } : {};
}

const LETTER_DE = [
  "Sehr geehrte Frau Albers,",
  "mit großem Interesse bewerbe ich mich als Fachkraft für Lagerlogistik in Ihrem Logistikzentrum. Seit 2017 arbeite ich in Lagern von Handel und Industrie, seit 2021 als Fachkraft im Dreischichtbetrieb der Hafenlager Nord GmbH in Bremen.",
  "Dort nehme ich Ware an, prüfe sie gegen Lieferschein und Bestellung, lagere sie mit dem Schubmaststapler ein und kommissioniere mit dem Handscanner. Bestände und Buchungen pflege ich in SAP EWM. Meine Pickgenauigkeit lag 2025 bei 99,6 Prozent.",
  "Sicherheit hat für mich Vorrang: Ich sichere Ladungen nach Vorschrift und weise neue Kolleginnen und Kollegen am Stapler ein. Im Team bleibe ich ruhig, auch wenn am Freitagnachmittag drei Lkw gleichzeitig an der Rampe stehen.",
  "Ab dem 1. März 2027 kann ich bei Ihnen beginnen. Über eine Einladung zu einem persönlichen Gespräch freue ich mich.",
  "Mit freundlichen Grüßen\nJonas Brandt",
].join("\n\n");

const LETTER_EN = [
  "Dear Ms Albers,",
  "I am writing to apply for the position of warehouse logistics specialist at your distribution centre. I have worked in retail and industrial warehouses since 2017, and since 2021 as a specialist in three shifts at Hafenlager Nord GmbH in Bremen.",
  "There I receive goods, check them against the delivery note and the order, put them away with the reach truck and pick with a handheld scanner. I keep stock and postings up to date in SAP EWM. My picking accuracy in 2025 was 99.6 per cent.",
  "Safety comes first for me: I secure loads as the rules require and show new colleagues how to drive the forklift. I stay calm in the team, even when three lorries stand at the ramp at once on a Friday afternoon.",
  "I can start with you on 1 March 2027 and would welcome the chance to meet you in person.",
  "Kind regards\nJonas Brandt",
].join("\n\n");

const LETTER_AR = [
  "السيدة ريم العلي المحترمة،",
  "يسعدني أن أتقدّم لوظيفة أخصائي لوجستيات المستودعات في مركزكم. أعمل منذ 2017 في مستودعات التجارة والصناعة، ومنذ 2021 أخصائيًا في نظام الورديات الثلاث لدى مستودعات الميناء الشمالي في الشارقة.",
  "أستلم البضائع وأطابقها مع إشعار التسليم وأمر الشراء، وأخزّنها بالرافعة وأجهّز الطلبات بالماسح اليدوي، وأتابع المخزون في نظام SAP EWM. بلغت دقة تجهيزي للطلبات 99.6 في المئة في 2025.",
  "السلامة عندي أولًا: أؤمّن الحمولات وفق التعليمات وأدرّب الزملاء الجدد على الرافعة، وأبقى هادئًا حين تقف ثلاث شاحنات معًا عند الرصيف.",
  "يمكنني البدء معكم من 1 مارس 2027، ويسعدني أن تتاح لي فرصة لقاء شخصي.",
  "مع خالص التحية\nكريم ناصر",
].join("\n\n");

/** The fictional phone number: Berlin, from the range kept for film and television. */
const PHONE = "tel:+49%2030%2023125%20457";

const JONAS_DE: Page = {
  profile: {
    username: "jonas-brandt",
    displayName: "Jonas Brandt",
    tagline: "Fachkraft für Lagerlogistik · Staplerfahrer",
    bio: "Ich sorge dafür, dass Ware stimmt, sicher lagert und pünktlich rausgeht – im Team und im Schichtbetrieb.",
    location: "Bremen",
    avatar: { src: NO_IMAGE, alt: "" },
    ...hero("de"),
    stats: [
      { value: "9", label: "Jahre im Lager" },
      { value: "99,6 %", label: "Pickgenauigkeit 2025" },
      { value: "seit 2019", label: "Staplerschein" },
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
      text: "Seit 2017 arbeite ich in Lagern von Handel und Industrie: Ich nehme Ware an, lagere sie ein, kommissioniere und verlade – mit Scanner, SAP und Stapler.\n\nMir ist wichtig, dass jede Lieferung stimmt und niemand sich verletzt. Neue Kolleginnen und Kollegen weise ich am Stapler ein, und wenn freitags drei Lkw gleichzeitig an der Rampe stehen, bleibe ich ruhig.",
      facts: [
        { label: "Bewerbung als", value: "Fachkraft für Lagerlogistik (m/w/d)" },
        { label: "Sprachen", value: "Deutsch, Englisch (B1)" },
        { label: "Führerschein", value: "Klasse B" },
        { label: "Arbeitszeit", value: "Schichtbetrieb, auch nachts" },
      ],
    },
    {
      ...block,
      id: "skills",
      type: "tools",
      title: "Kenntnisse",
      items: [
        "Wareneingang und Prüfung",
        "Kommissionierung mit Scanner",
        "Schubmaststapler",
        "Frontstapler",
        "SAP EWM",
        "Inventur",
        "Ladungssicherung",
        "Versanddokumente",
        "Schichtarbeit im Team",
      ],
    },
    {
      ...block,
      id: "career",
      type: "timeline",
      title: "Werdegang",
      items: [
        {
          role: "Fachkraft für Lagerlogistik",
          org: "Hafenlager Nord GmbH, Bremen",
          years: { from: 2021, to: "now" },
          note: "Wareneingang, Einlagerung mit dem Schubmaststapler und Kommissionierung im Dreischichtbetrieb.",
        },
        {
          role: "Lagerist",
          org: "Weser Getränkehandel GmbH, Achim",
          years: { from: 2020, to: 2021 },
          note: "Kommissionierung und Verladung, Touren mit der Disposition abgestimmt.",
        },
        { role: "Staplerschein (Flurförderzeuge)", org: "Schulungszentrum Hemelingen", years: { from: 2019 } },
        { role: "Ausbildung Fachkraft für Lagerlogistik", org: "Weser Getränkehandel GmbH · IHK-Abschluss", years: { from: 2017, to: 2020 } },
      ],
    },
    { ...block, id: "next-title", type: "header", title: "Als Nächstes" },
    { ...block, id: "next", type: "text", text: "Ich möchte die Ausbilder-Eignungsprüfung ablegen und Auszubildende im Lager begleiten." },
    { ...block, id: "letter-title", type: "header", title: "Anschreiben" },
    { ...block, id: "letter", type: "text", text: LETTER_DE },
    {
      ...block,
      id: "contact",
      type: "contact",
      title: "Ich freue mich auf ein Gespräch.",
      status: "Verfügbar ab 1. März 2027",
      primary: { label: "E-Mail schreiben", url: "mailto:jonas.brandt@example.com", icon: "mail" },
      links: [{ kind: "phone", url: PHONE }],
    },
  ],
};

const JONAS_EN: Page = {
  profile: {
    ...JONAS_DE.profile,
    tagline: "Warehouse logistics specialist · Forklift driver",
    bio: "I make sure goods are right, stored safely and leave on time – in a team and in shifts.",
    ...hero("en"),
    stats: [
      { value: "9", label: "years in warehousing" },
      { value: "99.6 %", label: "picking accuracy 2025" },
      { value: "since 2019", label: "forklift licence" },
    ],
    locale: "en",
  },
  blocks: [
    {
      ...block,
      id: "about",
      type: "about",
      title: "About me",
      text: "Since 2017 I have worked in retail and industrial warehouses: I receive goods, put them away, pick and load – with scanner, SAP and forklift.\n\nWhat matters to me is that every delivery is right and nobody gets hurt. I show new colleagues how to drive the forklift, and when three lorries stand at the ramp at once on a Friday, I stay calm.",
      facts: [
        { label: "Applying for", value: "Warehouse logistics specialist" },
        { label: "Languages", value: "German, English (B1)" },
        { label: "Driving licence", value: "Class B" },
        { label: "Working hours", value: "Shifts, nights included" },
      ],
    },
    {
      ...block,
      id: "skills",
      type: "tools",
      title: "Skills",
      items: [
        "Goods receipt and checks",
        "Picking with scanner",
        "Reach truck",
        "Counterbalance forklift",
        "SAP EWM",
        "Stocktaking",
        "Load securing",
        "Shipping documents",
        "Shift work in a team",
      ],
    },
    {
      ...block,
      id: "career",
      type: "timeline",
      title: "Career",
      items: [
        {
          role: "Warehouse logistics specialist",
          org: "Hafenlager Nord GmbH, Bremen",
          years: { from: 2021, to: "now" },
          note: "Goods receipt, put-away with the reach truck and picking in three shifts.",
        },
        { role: "Warehouse operative", org: "Weser Getränkehandel GmbH, Achim", years: { from: 2020, to: 2021 }, note: "Picking and loading, routes agreed with dispatch." },
        { role: "Forklift licence", org: "Schulungszentrum Hemelingen", years: { from: 2019 } },
        { role: "Apprenticeship, warehouse logistics", org: "Weser Getränkehandel GmbH · IHK exam", years: { from: 2017, to: 2020 } },
      ],
    },
    { ...block, id: "next-title", type: "header", title: "Next" },
    { ...block, id: "next", type: "text", text: "I want to pass the trainer aptitude exam and guide apprentices in the warehouse." },
    { ...block, id: "letter-title", type: "header", title: "Cover letter" },
    { ...block, id: "letter", type: "text", text: LETTER_EN },
    {
      ...block,
      id: "contact",
      type: "contact",
      title: "I look forward to talking with you.",
      status: "Available from 1 March 2027",
      primary: { label: "Send an email", url: "mailto:jonas.brandt@example.com", icon: "mail" },
      links: [{ kind: "phone", url: PHONE }],
    },
  ],
};

const KARIM_BLOCKS: Block[] = [
  {
    ...block,
    id: "about",
    type: "about",
    title: "نبذة عني",
    text: "أعمل منذ 2017 في مستودعات التجارة والصناعة: أستلم البضائع وأخزّنها وأجهّز الطلبات وأحمّلها، بالماسح الضوئي ونظام SAP والرافعة الشوكية.\n\nيهمّني أن تصل كل شحنة كاملة وألّا يُصاب أحد. أدرّب الزملاء الجدد على الرافعة، وأبقى هادئًا حين تقف ثلاث شاحنات معًا عند الرصيف.",
    facts: [
      { label: "التقديم على", value: "أخصائي لوجستيات مستودعات" },
      { label: "اللغات", value: "العربية، الإنجليزية (B1)" },
      { label: "رخصة القيادة", value: "مركبة خفيفة" },
      { label: "أوقات العمل", value: "ورديات، والليلية أيضًا" },
    ],
  },
  {
    ...block,
    id: "skills",
    type: "tools",
    title: "المهارات",
    items: ["استلام البضائع وفحصها", "تجهيز الطلبات بالماسح", "رافعة ذات صاري متحرك", "رافعة شوكية أمامية", "SAP EWM", "الجرد", "تأمين الحمولة", "مستندات الشحن", "العمل بالورديات ضمن فريق"],
  },
  {
    ...block,
    id: "career",
    type: "timeline",
    title: "المسيرة المهنية",
    items: [
      { role: "أخصائي لوجستيات مستودعات", org: "مستودعات الميناء الشمالي، الشارقة", years: { from: 2021, to: "now" }, note: "استلام البضائع وتخزينها بالرافعة وتجهيز الطلبات في ثلاث ورديات." },
      { role: "أمين مستودع", org: "شركة الخليج لتوزيع المشروبات", years: { from: 2020, to: 2021 }, note: "تجهيز الطلبات وتحميلها وتنسيق الرحلات مع قسم التوزيع." },
      { role: "رخصة الرافعة الشوكية", org: "مركز التدريب المهني", years: { from: 2019 } },
      { role: "تدريب مهني في لوجستيات المستودعات", org: "شركة الخليج لتوزيع المشروبات", years: { from: 2017, to: 2020 } },
    ],
  },
  { ...block, id: "next-title", type: "header", title: "الخطوة التالية" },
  { ...block, id: "next", type: "text", text: "أريد أن أصبح مدرّبًا معتمدًا وأن أرافق المتدرّبين الجدد في المستودع." },
  { ...block, id: "letter-title", type: "header", title: "خطاب التقديم" },
  { ...block, id: "letter", type: "text", text: LETTER_AR },
  {
    ...block,
    id: "contact",
    type: "contact",
    title: "يسعدني أن نلتقي ونتحدث.",
    status: "متاح للعمل من 1 مارس 2027",
    primary: { label: "راسلني بالبريد", url: "mailto:karim.nasser@example.com", icon: "mail" },
  },
];

const KARIM_AR: Page = {
  profile: {
    username: "karim-nasser",
    displayName: "كريم ناصر",
    tagline: "أخصائي لوجستيات المستودعات · سائق رافعة شوكية",
    bio: "أحرص على أن تكون البضاعة صحيحة ومخزّنة بأمان وتخرج في موعدها، ضمن الفريق وفي نظام الورديات.",
    location: "الشارقة",
    avatar: { src: NO_IMAGE, alt: "" },
    ...hero("ar"),
    stats: [
      { value: "9", label: "سنوات في المستودعات" },
      { value: "99.6 %", label: "دقة تجهيز الطلبات" },
      { value: "منذ 2019", label: "رخصة الرافعة الشوكية" },
    ],
    verified: false,
    locale: "ar",
  },
  blocks: KARIM_BLOCKS,
};

/** The fictional applicant's page in a language: Jonas Brandt (de, en), Karim Nasser (ar). */
export function applicationSample(locale: "de" | "en" | "ar"): Page {
  return locale === "ar" ? KARIM_AR : locale === "en" ? JONAS_EN : JONAS_DE;
}

/** The fictional applicant's page without its contact block (the sample route's `page=application-no-contact`). */
export function withoutContact(page: Page): Page {
  return { ...page, blocks: page.blocks.filter((block) => block.type !== "contact") };
}

/** The languages fact at its longest, per language (`withLongValues`). */
const LONG_LANGUAGES: Record<Page["profile"]["locale"], string> = {
  de: "Deutsch (Muttersprache), Englisch (B1), Polnisch (A2)",
  en: "German (native speaker), English (B1), Polish (A2)",
  ar: "العربية (اللغة الأم)، الإنجليزية (B1)، الأردية (A2)",
};

/**
 * The fictional applicant with values as long as a real page holds them (the sample route's
 * `page=application-long`), for the reflow checks at 320 and 390 px (WCAG 1.4.10): a 40-character
 * e-mail address without a hyphen ("jonas.brandt.lagerlogistik42@example.com", still example.com)
 * and a languages fact that fills a line.
 */
export function withLongValues(page: Page): Page {
  const longer = (url: string) => (url.startsWith("mailto:") ? url.replace("@example.com", ".lagerlogistik42@example.com") : url);
  const locale = page.profile.locale;
  return {
    ...page,
    blocks: page.blocks.map((item): Block => {
      if (item.type === "contact") {
        return { ...item, primary: { ...item.primary, url: longer(item.primary.url) }, ...(item.links ? { links: item.links.map((link) => ({ ...link, url: longer(link.url) })) } : {}) };
      }
      if (item.type === "about" && item.facts) return { ...item, facts: item.facts.map((fact, index) => (index === 1 ? { ...fact, value: LONG_LANGUAGES[locale] } : fact)) };
      return item;
    }),
  };
}

/**
 * The fictional applicant with a drawn still from the library beside his facts in "About" (the sample
 * route's `page=application-portrait`): the layout a page with an About picture has, looked at and
 * measured on fictional data only.
 */
export function withPortrait(page: Page): Page {
  const clip = libraryClip("sample:motion-ware-scannen");
  if (!clip) return page;
  const portrait = { src: clip.poster, alt: clip.alt[page.profile.locale], focal: [0.3, 0.42] as [number, number] };
  return { ...page, blocks: page.blocks.map((item): Block => (item.type === "about" ? { ...item, portrait } : item)) };
}

/** Where the fictional applicants' pages live (features/previews/registry.ts). */
export const APPLICATION_SLUGS = { de: "jonas-brandt", en: "jonas-brandt", ar: "karim-nasser" } as const;
