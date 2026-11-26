import type { Block, Page } from "@linkyo/blocks";
import { NO_IMAGE } from "@linkyo/blocks/rules";

import { MOTION_LIBRARY, withLibraryClip } from "@/features/creator/motion-library";

/**
 * The application example (Laufbahn): a fictional warehouse specialist applying for a job, in German
 * and English ("Jonas Brandt", Bremen), and the same structure in Arabic ("Karim Nasser", Sharjah).
 * Every fact is made up for the example; no employer is named. The e-mail address is example.com's and
 * the telephone number lies in the Bundesnetzagentur's block reserved for film and television, so it
 * reaches nobody. The header picture is Linkyo's own drawn warehouse clip (an illustration, not a
 * photo of the person), and there is no portrait: the page shows how the template stands without one.
 *
 * Shown at /{de,en}/p/jonas-brandt and /ar/p/karim-nasser (labelled as an example, unlisted), and at
 * /{locale}/directions/poster?page=application for reviews and the first-screen measurements.
 */

type Locale = Page["profile"]["locale"];

interface Copy {
  username: string;
  name: string;
  tagline: string;
  bio: string;
  location: string;
  stats: [value: string, label: string][];
  titles: { about: string; skills: string; career: string; note: string; letter: string };
  about: string;
  facts: [label: string, value: string][];
  skills: string[];
  career: { role: string; org: string; years: { from: number; to?: number | "now" }; note?: string }[];
  note: string;
  letter: string;
  contact: { title: string; text: string; status: string; primary: string; phone: string; email: string };
}

/** +49 30 23125 xxx: the Bundesnetzagentur keeps this block free for film and television. */
const PHONE = "tel:+493023125457";

const DE: Copy = {
  username: "jonas-brandt",
  name: "Jonas Brandt",
  tagline: "Fachkraft für Lagerlogistik · Staplerfahrer",
  bio: "Ich sorge dafür, dass Ware stimmt, sicher lagert und pünktlich rausgeht – im Team und im Schichtbetrieb.",
  location: "Bremen",
  stats: [
    ["9", "Jahre im Lager"],
    ["99,6 %", "Pickgenauigkeit 2025"],
    ["seit 2019", "Staplerschein"],
  ],
  titles: { about: "Über mich", skills: "Kenntnisse", career: "Werdegang", note: "Gut zu wissen", letter: "Anschreiben" },
  about:
    "Seit neun Jahren arbeite ich im Lager, die letzten fünf in einem Elektrogroßhandel in Bremen. Ich nehme Ware an, kommissioniere mit dem Scanner und fahre Stapler im Schichtbetrieb. Mir ist wichtig, dass jede Lieferung stimmt und niemand sich verletzt.\n\nNeue Systeme lerne ich schnell, und neue Kolleginnen und Kollegen arbeite ich gern ein.",
  facts: [
    ["Bewerbung als", "Fachkraft für Lagerlogistik (m/w/d)"],
    ["Sprachen", "Deutsch, Englisch (B1)"],
    ["Führerschein", "Klasse B"],
    ["Arbeitszeit", "Schichtbetrieb, auch nachts"],
  ],
  skills: [
    "Kommissionierung mit Scanner",
    "Wareneingang und Kontrolle",
    "Gabelstapler",
    "Schubmaststapler",
    "SAP EWM",
    "Inventur",
    "Ladungssicherung",
    "Gefahrgut (ADR-Schulung)",
    "Verpackung und Versand",
  ],
  career: [
    { role: "Lagerfachkraft", org: "Elektrogroßhandel, Bremen", years: { from: 2021, to: "now" }, note: "Wareneingang, Kommissionierung und Staplerfahrten im Schichtbetrieb." },
    { role: "Lagerhelfer", org: "Logistikzentrum eines Versandhändlers, Achim", years: { from: 2017, to: 2021 }, note: "Kommissionierung mit Scanner, Verpackung und Retouren." },
    { role: "Staplerschein", org: "Fahrausweis für Flurförderzeuge", years: { from: 2019 } },
    { role: "Ausbildung: Fachkraft für Lagerlogistik", org: "Speditionsbetrieb, Bremen", years: { from: 2014, to: 2017 } },
  ],
  note: "Ich kann kurzfristig zum Probearbeiten kommen. Sicherheitsschuhe und Warnweste bringe ich mit.",
  letter: [
    "Sehr geehrte Damen und Herren,",
    "mit großem Interesse habe ich Ihre Anzeige für eine Fachkraft für Lagerlogistik gelesen. Seit neun Jahren arbeite ich im Lager, die letzten fünf in einem Elektrogroßhandel in Bremen. Dort nehme ich Ware an, kommissioniere mit dem Scanner und fahre Gabel- und Schubmaststapler im Schichtbetrieb.",
    "Genauigkeit ist mir wichtig: 2025 lag meine Pickgenauigkeit bei 99,6 Prozent. Ich halte die Bestände in SAP EWM aktuell, packe bei Inventuren mit an und achte darauf, dass jede Ladung richtig gesichert ist.",
    "Neue Kolleginnen und Kollegen arbeite ich gern ein, und auch in vollen Wochen behalte ich den Überblick. Nachtschichten und Arbeit am Wochenende sind für mich kein Problem.",
    "Ab dem 1. März 2027 stehe ich Ihnen zur Verfügung. Über eine Einladung zu einem Gespräch oder zum Probearbeiten freue ich mich sehr.",
    "Mit freundlichen Grüßen\nJonas Brandt",
  ].join("\n\n"),
  contact: {
    title: "Ich freue mich auf ein Gespräch.",
    text: "Am schnellsten erreichen Sie mich per E-Mail oder nach 16 Uhr telefonisch.",
    status: "Verfügbar ab 1. März 2027",
    primary: "E-Mail schreiben",
    phone: "Anrufen",
    email: "mailto:jonas.brandt@example.com",
  },
};

const EN: Copy = {
  username: "jonas-brandt",
  name: "Jonas Brandt",
  tagline: "Warehouse logistics specialist · Forklift driver",
  bio: "I make sure goods are right, stored safely and out on time – as part of the team and on shifts.",
  location: "Bremen",
  stats: [
    ["9", "Years in warehousing"],
    ["99.6 %", "Picking accuracy 2025"],
    ["since 2019", "Forklift licence"],
  ],
  titles: { about: "About me", skills: "Skills", career: "Career", note: "Good to know", letter: "Cover letter" },
  about:
    "I have worked in warehouses for nine years, the last five at an electrical wholesaler in Bremen. I receive goods, pick orders with a scanner and drive forklifts on shifts. What matters to me is that every delivery is right and nobody gets hurt.\n\nI pick up new systems quickly, and I like helping new colleagues find their feet.",
  facts: [
    ["Applying for", "Warehouse logistics specialist"],
    ["Languages", "German, English (B1)"],
    ["Driving licence", "Category B"],
    ["Working hours", "Shifts, nights included"],
  ],
  skills: [
    "Order picking with scanner",
    "Goods receipt and checks",
    "Counterbalance forklift",
    "Reach truck",
    "SAP EWM",
    "Stocktaking",
    "Load securing",
    "Dangerous goods (ADR course)",
    "Packing and shipping",
  ],
  career: [
    { role: "Warehouse specialist", org: "Electrical wholesaler, Bremen", years: { from: 2021, to: "now" }, note: "Goods receipt, order picking and forklift work on shifts." },
    { role: "Warehouse assistant", org: "Fulfilment centre of an online retailer, Achim", years: { from: 2017, to: 2021 }, note: "Scanner picking, packing and returns." },
    { role: "Forklift licence", org: "Operator's permit for industrial trucks", years: { from: 2019 } },
    { role: "Apprenticeship: warehouse logistics specialist", org: "Freight forwarder, Bremen", years: { from: 2014, to: 2017 } },
  ],
  note: "I can come in for a trial shift at short notice, with my own safety shoes and high-visibility vest.",
  letter: [
    "Dear Sir or Madam,",
    "I read your advertisement for a warehouse logistics specialist with great interest. I have worked in warehouses for nine years, the last five at an electrical wholesaler in Bremen, where I receive goods, pick orders with a scanner and drive counterbalance forklifts and reach trucks on shifts.",
    "Accuracy matters to me: in 2025 my picking accuracy was 99.6 per cent. I keep stock records in SAP EWM up to date, help with stocktaking and make sure every load is properly secured.",
    "I enjoy training new colleagues, and I keep track of things in busy weeks too. Night shifts and weekend work are no problem for me.",
    "I am available from 1 March 2027 and would be glad to come in for an interview or a trial shift.",
    "Kind regards\nJonas Brandt",
  ].join("\n\n"),
  contact: {
    title: "I look forward to talking with you.",
    text: "E-mail reaches me fastest; after 4 pm I can also take calls.",
    status: "Available from 1 March 2027",
    primary: "Send an e-mail",
    phone: "Call",
    email: "mailto:jonas.brandt@example.com",
  },
};

const AR: Copy = {
  username: "karim-nasser",
  name: "كريم ناصر",
  tagline: "أخصائي لوجستيات مستودعات · سائق رافعة شوكية",
  bio: "أحرص على أن تكون البضائع صحيحة ومخزّنة بأمان وتخرج في موعدها، ضمن الفريق وفي نظام الورديات.",
  location: "الشارقة",
  stats: [
    ["9", "سنوات في المستودعات"],
    ["99,6 %", "دقة الانتقاء 2025"],
    ["منذ 2019", "رخصة الرافعة"],
  ],
  titles: { about: "نبذة عني", skills: "المهارات", career: "المسيرة المهنية", note: "معلومة مفيدة", letter: "خطاب التقديم" },
  about:
    "أعمل في المستودعات منذ تسع سنوات، آخر خمس منها لدى تاجر جملة للأدوات الكهربائية في الشارقة. أستلم البضائع وأنتقي الطلبات بالماسح الضوئي وأقود الرافعات الشوكية في نظام الورديات. أهم ما يعنيني أن تكون كل شحنة صحيحة وألا يُصاب أحد.\n\nأتعلم الأنظمة الجديدة بسرعة، وأحب مساعدة الزملاء الجدد في بداياتهم.",
  facts: [
    ["التقديم على", "أخصائي لوجستيات مستودعات"],
    ["اللغات", "العربية، الإنجليزية (B1)"],
    ["رخصة القيادة", "خفيفة"],
    ["أوقات العمل", "ورديات، بما فيها الليلية"],
  ],
  skills: [
    "انتقاء الطلبات بالماسح الضوئي",
    "استلام البضائع وفحصها",
    "الرافعة الشوكية",
    "رافعة الرفوف العالية",
    "SAP EWM",
    "الجرد",
    "تثبيت الحمولة",
    "المواد الخطرة (دورة ADR)",
    "التغليف والشحن",
  ],
  career: [
    { role: "أخصائي مستودعات", org: "تاجر جملة للأدوات الكهربائية، الشارقة", years: { from: 2021, to: "now" }, note: "استلام البضائع وانتقاء الطلبات وقيادة الرافعة في الورديات." },
    { role: "مساعد مستودع", org: "مركز توزيع لمتجر إلكتروني، دبي", years: { from: 2017, to: 2021 }, note: "الانتقاء بالماسح الضوئي والتغليف والمرتجعات." },
    { role: "رخصة الرافعة الشوكية", org: "تصريح تشغيل معدات المناولة", years: { from: 2019 } },
    { role: "تدريب مهني في لوجستيات المستودعات", org: "شركة شحن، الشارقة", years: { from: 2014, to: 2017 } },
  ],
  note: "أستطيع الحضور ليوم عمل تجريبي في وقت قصير، ومعي حذاء السلامة والسترة العاكسة.",
  letter: [
    "السادة الكرام،",
    "قرأت إعلانكم عن وظيفة أخصائي لوجستيات مستودعات باهتمام كبير. أعمل في المستودعات منذ تسع سنوات، آخر خمس منها لدى تاجر جملة للأدوات الكهربائية في الشارقة، حيث أستلم البضائع وأنتقي الطلبات بالماسح الضوئي وأقود الرافعات الشوكية في نظام الورديات.",
    "الدقة مهمة بالنسبة لي: في عام 2025 بلغت دقة الانتقاء لدي 99,6 بالمئة. أحدّث سجلات المخزون في نظام SAP EWM، وأشارك في الجرد، وأتأكد من تثبيت كل حمولة كما يجب.",
    "أحب تدريب الزملاء الجدد، وأحافظ على هدوئي وتنظيمي في الأسابيع المزدحمة. ولا مانع لدي من الورديات الليلية أو العمل في عطلة نهاية الأسبوع.",
    "أنا متاح للعمل اعتبارًا من 1 مارس 2027، ويسعدني الحضور لمقابلة شخصية أو ليوم عمل تجريبي.",
    "مع خالص التحية\nكريم ناصر",
  ].join("\n\n"),
  contact: {
    title: "يسعدني التواصل معكم.",
    text: "أسرع طريقة للوصول إليّ هي البريد الإلكتروني، ويمكنكم الاتصال بعد الرابعة عصرًا.",
    status: "متاح اعتبارًا من 1 مارس 2027",
    primary: "إرسال بريد إلكتروني",
    phone: "اتصال",
    email: "mailto:karim.nasser@example.com",
  },
};

const COPY: Record<Locale, Copy> = { de: DE, en: EN, ar: AR };

/** Linkyo's drawn warehouse clip (an illustration), with its first frame as the header picture. */
const CLIP = MOTION_LIBRARY.find((clip) => clip.key === "lagerarbeit");

const header = (id: string, title: string): Block => ({ id, type: "header", visible: true, highlight: false, title });

/** The application example in one language (de and en: Jonas Brandt; ar: Karim Nasser). */
export function applicationSample(locale: Locale): Page {
  const copy = COPY[locale];
  const profile: Page["profile"] = {
    username: copy.username,
    displayName: copy.name,
    tagline: copy.tagline,
    bio: copy.bio,
    location: copy.location,
    avatar: { src: NO_IMAGE, alt: "" },
    stats: copy.stats.map(([value, label]) => ({ value, label })),
    verified: false,
    locale,
  };
  return {
    profile: CLIP ? withLibraryClip(profile, CLIP) : profile,
    blocks: [
      { id: "about", type: "about", visible: true, highlight: false, title: copy.titles.about, text: copy.about, facts: copy.facts.map(([label, value]) => ({ label, value })) },
      { id: "skills", type: "tools", visible: true, highlight: false, title: copy.titles.skills, items: copy.skills },
      { id: "career", type: "timeline", visible: true, highlight: false, title: copy.titles.career, items: copy.career },
      header("note-title", copy.titles.note),
      { id: "note", type: "text", visible: true, highlight: false, text: copy.note },
      header("letter-title", copy.titles.letter),
      { id: "letter", type: "text", visible: true, highlight: false, text: copy.letter },
      {
        id: "contact",
        type: "contact",
        visible: true,
        highlight: false,
        title: copy.contact.title,
        text: copy.contact.text,
        status: copy.contact.status,
        primary: { label: copy.contact.primary, url: copy.contact.email, icon: "mail" },
        links: [{ kind: "phone", label: copy.contact.phone, url: PHONE }],
      },
    ],
  };
}
