import type { Profile } from "@linkyo/blocks";
import { tokens } from "@linkyo/tokens";
import {
  Accessibility,
  Award,
  Baby,
  Calculator,
  Camera,
  Car,
  ChartColumn,
  ChefHat,
  ClipboardCheck,
  ClipboardList,
  Clock,
  CodeXml,
  Database,
  FileText,
  Forklift,
  GraduationCap,
  Hammer,
  Handshake,
  Headset,
  IdCard,
  Languages,
  Laptop,
  Megaphone,
  MousePointerClick,
  PackageCheck,
  PackageOpen,
  PaintBucket,
  Palette,
  Presentation,
  ScanBarcode,
  Scissors,
  ShieldCheck,
  ShoppingCart,
  Signpost,
  Sprout,
  Stethoscope,
  TriangleAlert,
  Truck,
  Users,
  Warehouse,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * What the Laufbahn template reads out of a page's words (ADR 0069): an icon for a skill or a title,
 * the joints of long German compounds, how tiles share a row, and what kind of text a section holds.
 * Pure functions, no rendering, all unit-tested (laufbahn-content.test.ts).
 */

type Locale = Profile["locale"];

/* ------------------------------------------------------------------------------------------------ */
/* Words                                                                                             */
/* ------------------------------------------------------------------------------------------------ */

const SOFT_HYPHEN = "\u00AD";
/** Arabic short vowels, other marks and the tatweel: never part of a word's spelling for matching. */
const ARABIC_MARKS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/gu;
const ARABIC = /\p{Script=Arabic}/u;
/** Arabic words carry their conjunction, preposition and article in front ("والفريق": "and the team"). */
const PROCLITICS = ["وال", "بال", "فال", "كال", "لل", "ال", "و", "ف", "ب", "ل", "ك"];

/** One spelling for matching: lower case, Arabic without marks, alef forms, alef maqsura and ta marbuta unified. */
function normalize(word: string): string {
  return word.normalize("NFC").toLowerCase().replace(ARABIC_MARKS, "").replace(/[أإآٱ]/gu, "ا").replace(/ى/gu, "ي").replace(/ة/gu, "ه");
}

/** The words of a text, normalized; a word is a run of letters (with their marks) and digits (soft hyphens are ignored). */
export function wordsOf(text: string): string[] {
  return text
    .replaceAll(SOFT_HYPHEN, "")
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .filter(Boolean)
    .map(normalize);
}

/** The forms a word is matched in: itself and, for Arabic, without its proclitics (two passes: "وبال" …). */
function formsOf(word: string): string[] {
  if (!ARABIC.test(word)) return [word];
  const forms = new Set([word]);
  for (let pass = 0; pass < 2; pass += 1) {
    for (const form of [...forms]) {
      for (const proclitic of PROCLITICS) {
        if (form.startsWith(proclitic) && form.length - proclitic.length >= 2) forms.add(form.slice(proclitic.length));
      }
    }
  }
  return [...forms];
}

/**
 * A pattern for one word: "sap" the whole word, "lager*" a word that starts with it, "*lager" a word
 * that ends with it (the head of a German compound), "*stapler*" a word that holds it. A pattern with
 * spaces is a phrase of such patterns on consecutive words ("first aid").
 */
type WordTest = (word: string) => boolean;

function wordTest(pattern: string): WordTest {
  const core = normalize(pattern.replace(/^\*|\*$/gu, ""));
  const [head, tail] = [pattern.startsWith("*"), pattern.endsWith("*")];
  if (head && tail) return (word) => word.includes(core);
  if (head) return (word) => word.endsWith(core);
  if (tail) return (word) => word.startsWith(core);
  return (word) => word === core;
}

interface CompiledRule {
  icon: LucideIcon;
  /** Per language: phrases, each a list of word tests. */
  patterns: Partial<Record<Locale, WordTest[][] | undefined>>;
  /** Words this rule never matches (same pattern syntax), whatever the language. */
  except: WordTest[];
}

/** An icon and the words that call for it, per language; `not` lists the look-alikes it must never take. */
interface Rule {
  icon: LucideIcon;
  de?: string[];
  en?: string[];
  ar?: string[];
  not?: string[];
}

/**
 * The curated icon map, most specific first: the first rule with a matching word wins, whatever the
 * word's place in the text, so "Staplerschein" is a licence before it is a forklift and
 * "Versanddokumente" are documents before they are shipping. German matches compounds by their head
 * (the last part names the thing: "Seitenschubstapler" is a forklift), English and Arabic whole words
 * and their usual forms. Each rule lists the look-alikes it must not take ("Schlager" is no warehouse,
 * "إفريقيا" no team). One icon set (lucide), one stroke.
 */
const RULES: Rule[] = [
  {
    icon: IdCard,
    de: ["schein", "führerschein*", "*führerschein", "*staplerschein", "*zeugschein", "*kranschein", "fahrerlaubnis*", "*fahrerlaubnis", "lizenz", "lizenzen"],
    en: ["licence", "licences", "license", "licenses", "licensed", "permit", "permits"],
    ar: ["رخصه", "رخص", "ترخيص"],
  },
  {
    icon: Award,
    de: ["zertifi*", "*zertifikat", "*zertifikate", "*zertifizierung", "meisterbrief", "gesellenbrief", "diplom*", "bachelor*", "*abschluss"],
    en: ["certificate", "certificates", "certified", "certification", "certifications", "accredited", "diploma", "diplomas", "degree", "bachelor*"],
    ar: ["شهاده", "شهادات", "معتمد", "معتمده", "دبلوم", "بكالوريوس", "ماجستير"],
    not: ["diplomat*", "diplomatie*"],
  },
  {
    icon: TriangleAlert,
    de: ["gefahr*", "adr"],
    en: ["hazard*", "hazmat", "dangerous"],
    ar: ["خطر", "خطره", "خطيره", "مخاطر"],
  },
  {
    icon: ScanBarcode,
    de: ["scan", "scann*", "*scanner", "barcode*", "*barcode"],
    en: ["scan", "scans", "scann*", "barcode*"],
    ar: ["باركود", "ماسح"],
  },
  {
    icon: Forklift,
    de: ["*stapler*", "flurförder*", "hubwagen*", "*hubwagen"],
    en: ["forklift*", "reach truck"],
    ar: ["رافعه", "رافعات", "شوكيه"],
  },
  {
    icon: FileText,
    de: ["*dokument*", "*papiere", "lieferschein*", "*lieferschein", "frachtbrief*", "*frachtbrief", "korrespondenz", "schriftverkehr"],
    en: ["document*", "paperwork", "correspondence"],
    ar: ["وثائق", "وثيقه", "مستندات", "مستند", "اوراق"],
    not: ["dokumentar*", "documentary", "documentaries"],
  },
  {
    icon: PackageOpen,
    de: ["warenausgabe", "*warenausgabe", "materialausgabe", "werkzeugausgabe", "warenausgang*"],
    en: ["dispatch*", "goods issue", "goods out"],
    ar: ["تسليم البضائع", "صرف البضائع"],
  },
  {
    icon: PackageCheck,
    de: ["*kommissionier*", "verpack*", "*verpackung", "wareneingang*"],
    en: ["picking", "packing", "fulfilment", "fulfillment", "fulfil", "fulfill"],
    ar: ["انتقاء", "تغليف"],
  },
  {
    icon: ClipboardCheck,
    de: ["inventur*", "*inventur", "bestandsaufnahme", "*kontrolle", "kontrolle", "*prüfung", "prüfung", "qualität*"],
    en: ["inventory", "inventories", "stocktak*", "quality", "inspection*", "audit*"],
    ar: ["جرد", "جوده", "فحص", "تدقيق"],
  },
  {
    icon: Truck,
    de: ["lkw*", "*lkw", "verlad*", "*verladung", "entlad*", "belad*", "versand*", "spedition*", "transport*", "*transport", "lieferung*", "*lieferung", "zustellung", "fuhrpark"],
    en: ["truck*", "lorry", "lorries", "loading", "unloading", "shipping", "freight*", "deliver*", "transport*", "haulage"],
    ar: ["شاحنه", "شاحنات", "تفريغ", "توصيل"],
    not: ["deliverable", "deliverables"],
  },
  {
    icon: Database,
    de: ["sap", "erp", "wms", "lvs", "crm", "sql", "datenbank*", "*datenbank", "warenwirtschaft*"],
    en: ["sap", "erp", "wms", "crm", "sql", "database*"],
    ar: ["ساب", "بيانات"],
  },
  {
    icon: Warehouse,
    de: ["lager*", "*lager", "*lagern", "*lagerung", "logistik*", "*logistik"],
    en: ["warehous*", "storage", "logistic*"],
    ar: ["مستودع", "مستودعات", "مخزن", "مخازن", "تخزين", "لوجستي*"],
    not: ["*schlager", "schlager*", "*kugellager", "*trainingslager", "*zeltlager", "*ferienlager", "*gleitlager", "*wälzlager", "lagerfeuer*"],
  },
  {
    icon: ShieldCheck,
    de: ["*sicherung", "sicherheit*", "*sicherheit", "*schutz", "arbeitsschutz*"],
    en: ["safety", "security", "secure", "securing", "secured"],
    ar: ["سلامه", "امان", "امن", "حمايه"],
    not: ["*versicherung", "versicherung*", "*unsicherheit", "unsicherheit*", "*selbstsicherheit"],
  },
  {
    icon: Headset,
    de: ["kundenservice", "kundendienst", "support", "*support", "callcenter", "call center", "hotline", "helpdesk", "telefon*", "*telefon"],
    en: ["helpdesk", "help desk", "call centre", "call center", "hotline", "customer service", "customer support", "tech support"],
    ar: ["خدمه العملاء", "دعم فني"],
  },
  {
    icon: Handshake,
    de: ["kunde*", "*kunden", "kundschaft", "beratung*", "*beratung"],
    en: ["customer*", "client", "clients", "clientele", "consulting", "advisory"],
    ar: ["عملاء", "عميل", "زبائن", "زبون", "استشارات"],
    not: ["*urkunde", "*urkunden", "urkunde*"],
  },
  {
    icon: Users,
    de: ["team*", "*team", "kolleg*", "zusammenarbeit"],
    en: ["team*", "collaborat*", "colleagues"],
    ar: ["فريق", "تعاون", "زملاء"],
  },
  {
    icon: Languages,
    de: ["sprach*", "*sprache", "*sprachen", "*sprachig", "deutsch", "englisch", "arabisch", "französisch", "spanisch", "türkisch", "russisch", "italienisch", "polnisch", "armenisch", "übersetz*", "dolmetsch*"],
    en: ["language*", "english", "german", "arabic", "french", "spanish", "turkish", "russian", "italian", "polish", "armenian", "bilingual", "multilingual", "translat*", "interpreting"],
    ar: ["لغه", "لغات", "عربي", "عربيه", "انجليزي", "انجليزيه", "الماني", "المانيه", "فرنسي", "فرنسيه", "ترجمه"],
  },
  {
    icon: Accessibility,
    de: ["barrierefrei*", "*barrierefreiheit", "inklusion", "inklusiv", "accessibility", "a11y"],
    en: ["accessibility", "accessible", "a11y", "inclusive", "inclusion"],
    ar: ["سهوله الوصول", "اتاحه"],
  },
  {
    icon: Signpost,
    de: ["leitsystem*", "*leitsystem*", "beschilderung", "orientierungssystem*", "*orientierungssystem*"],
    en: ["wayfinding", "signage", "signposting"],
    ar: ["ارشاديه"],
  },
  {
    icon: MousePointerClick,
    de: ["ux", "ui", "usability", "nutzerforschung", "interaktion*", "*interaktion", "nutzererfahrung", "benutzerfreundlich*"],
    en: ["ux", "ui", "usability", "interaction"],
    ar: ["تجربه المستخدم", "واجهات"],
  },
  {
    icon: Camera,
    de: ["*foto*", "photo*", "kamera*", "*kamera", "*video*", "film*", "*film"],
    en: ["photo*", "camera*", "video*", "film*"],
    ar: ["تصوير", "مصور", "فيديو"],
  },
  {
    icon: CodeXml,
    de: ["programmier*", "softwareentwicklung", "webentwicklung", "typescript", "javascript", "python", "java", "react", "html", "css", "php", "git", "github", "frontend", "backend", "devops", "coding"],
    en: ["programming", "coding", "developer", "developers", "typescript", "javascript", "python", "java", "react", "html", "css", "php", "git", "github", "frontend", "backend", "devops"],
    ar: ["برمجه", "برمجيات"],
  },
  {
    icon: Laptop,
    de: ["edv", "it", "computer*", "*computer", "office", "excel", "software", "hardware", "microsoft"],
    en: ["computer*", "software", "hardware", "microsoft", "office", "excel"],
    ar: ["حاسوب", "كمبيوتر", "حاسب"],
  },
  {
    icon: PaintBucket,
    de: ["tönen", "töner", "abtönen", "tönung", "*tönung", "farbmisch*", "*farbmischung", "maler", "malerin", "malerei", "malermeister*", "lackier*", "*lackierer", "anstrich*", "*anstrich", "streichen"],
    en: ["tinting", "tint", "paint", "painting", "painter", "painters", "decorating"],
    ar: ["دهان", "دهانات", "طلاء", "صباغه"],
  },
  {
    icon: Palette,
    de: ["design*", "*design", "gestaltung*", "*gestaltung", "grafik*", "*grafik", "erscheinungsbild*", "*erscheinungsbild*", "illustration*", "branding", "typografie", "layout*", "figma"],
    en: ["design*", "graphic*", "illustrat*", "branding", "identity", "identities", "typography", "layout*", "figma"],
    ar: ["تصميم", "هويه", "هويات"],
    not: ["designated"],
  },
  {
    icon: Presentation,
    de: ["workshop*", "präsentation*", "*präsentation*", "moderation*", "vortrag", "vorträge", "seminar*", "*seminar", "powerpoint"],
    en: ["workshop*", "presentation*", "presenting", "facilitat*", "seminar*", "public speaking", "powerpoint"],
    ar: ["ورش", "ورشه"],
  },
  {
    icon: Wrench,
    de: ["wartung*", "*wartung", "reparatur*", "*reparatur", "instandhaltung*", "*instandhaltung", "instandsetzung", "mechanik*", "*mechanik", "mechaniker*", "*mechaniker", "kfz*", "montage*", "*montage", "installation*", "*installation", "sanitär*", "klempner*", "heizung*"],
    en: ["maintenance", "repair*", "mechanic*", "servicing", "assembly", "installation*", "plumb*"],
    ar: ["صيانه", "تصليح", "اصلاح", "ميكانيك*"],
  },
  {
    icon: Zap,
    de: ["elektr*", "*elektrik", "*elektronik", "*elektriker"],
    en: ["electric*", "electronics", "wiring"],
    ar: ["كهرباء", "كهربائي*"],
  },
  {
    icon: Hammer,
    de: ["handwerk*", "*handwerk", "baustelle*", "hochbau", "tiefbau", "trockenbau", "maurer*", "schreiner*", "tischler*", "zimmerei", "zimmermann", "holzbearbeitung"],
    en: ["construction", "carpent*", "joiner*", "joinery", "masonry", "woodwork*", "drywall", "craftsmanship"],
    ar: ["بناء", "نجاره", "نجار"],
  },
  {
    icon: Stethoscope,
    de: ["pflege*", "*pflege", "medizin*", "*medizin", "ersthelfer*", "erste hilfe", "sanitäter*", "arzthelfer*", "*therapie", "therapeut*"],
    en: ["nursing", "nurse", "nurses", "medical", "medicine", "healthcare", "caregiving", "caregiver*", "paramedic*", "first aid"],
    ar: ["تمريض", "طبي", "طبيه", "اسعاف", "اسعافات"],
    not: ["*datenpflege", "*kundenpflege", "*gartenpflege", "*grünpflege", "*körperpflege"],
  },
  {
    icon: Baby,
    de: ["kinderbetreuung", "kita", "kindergarten", "erzieher*", "erziehung", "babysitt*", "tagesmutter"],
    en: ["childcare", "babysit*", "nanny", "nannies", "daycare"],
    ar: ["اطفال", "حضانه"],
  },
  {
    icon: GraduationCap,
    de: ["ausbildung*", "*ausbildung", "*bildung", "studium", "*studium", "lehre", "lehrer*", "lehrgang*", "unterricht*", "schulung*", "*schulung", "nachhilfe", "training*", "coaching"],
    en: ["teach*", "tutor*", "training", "trainer", "education*", "coaching", "mentoring"],
    ar: ["تعليم", "تدريس", "تدريب", "معلم"],
    not: ["*einbildung", "einbildung*"],
  },
  {
    icon: Calculator,
    de: ["buchhaltung*", "*buchhaltung", "rechnungswesen", "controlling", "lohnabrechnung*", "abrechnung*", "*abrechnung", "finanz*", "*finanzen", "steuererklärung*", "budget*", "kalkulation*"],
    en: ["accounting", "bookkeeping", "payroll", "financ*", "tax", "taxes", "taxation", "budget*", "invoic*"],
    ar: ["محاسبه", "ماليه", "ضرائب", "رواتب"],
  },
  {
    icon: Megaphone,
    de: ["marketing", "*marketing", "vertrieb*", "werbung", "*werbung", "social media", "öffentlichkeitsarbeit"],
    en: ["marketing", "sales", "selling", "advertising", "social media"],
    ar: ["تسويق", "مبيعات", "اعلان", "اعلانات"],
  },
  {
    icon: ShoppingCart,
    de: ["verkauf*", "*verkauf", "verkäufer*", "einzelhandel*", "kasse", "kassier*"],
    en: ["retail", "cashier*", "checkout"],
    ar: ["كاشير", "تجزئه", "بيع"],
  },
  {
    icon: ChefHat,
    de: ["koch", "köchin", "kochen", "küche*", "*küche", "gastronomie", "backen", "bäcker*", "konditor*"],
    en: ["cook", "cooks", "cooking", "chef", "chefs", "kitchen*", "culinary", "baking", "pastry"],
    ar: ["طبخ", "طهي", "مطبخ", "حلويات"],
  },
  {
    icon: Scissors,
    de: ["friseur*", "frisör*", "schneider*", "*schneiderei", "nähen"],
    en: ["hairdress*", "barber*", "tailor", "tailors", "tailoring", "sewing"],
    ar: ["حلاقه", "خياطه"],
  },
  {
    icon: Sprout,
    de: ["garten*", "*garten", "gärtner*", "landwirtschaft*", "*landwirtschaft", "landschaftsbau", "*landschaftsbau", "grünpflege"],
    en: ["garden*", "landscap*", "farming", "agricultur*", "horticultur*"],
    ar: ["زراعه", "حدائق", "حديقه", "بستنه"],
    not: ["*kindergarten", "kindergarten*", "*biergarten"],
  },
  {
    icon: Clock,
    de: ["schichtarbeit", "schichtdienst", "*schichtbetrieb", "nachtschicht", "frühschicht", "spätschicht", "wechselschicht", "pünktlich*", "zeitmanagement"],
    en: ["shift work", "shiftwork", "punctual*", "time management"],
    ar: ["مناوبات", "مناوبه"],
  },
  {
    icon: ChartColumn,
    de: ["analyse*", "*analyse", "analysen", "statistik*", "*statistik", "auswertung*", "*auswertung", "reporting", "berichtswesen", "kennzahlen"],
    en: ["analys*", "analyz*", "analytics", "statistic*", "reporting"],
    ar: ["تحليل", "احصاء", "احصائيات", "تقارير"],
  },
  {
    icon: ClipboardList,
    de: ["organisation*", "*organisation", "planung*", "*planung", "projektmanagement", "projektleitung", "disposition", "disponent*", "koordination*", "*koordination"],
    en: ["planning", "organisation", "organization", "organising", "organizing", "organisational", "organizational", "scheduling", "project management", "coordinat*"],
    ar: ["تنظيم", "تخطيط", "اداره المشاريع"],
  },
  {
    icon: Car,
    de: ["fahrer", "fahrerin", "*fahrer", "pkw*", "autofahr*", "kurier*"],
    en: ["driving", "driver", "drivers", "chauffeur", "courier*"],
    ar: ["قياده", "سائق", "سياقه"],
  },
];

const phrase = (pattern: string): WordTest[] => pattern.split(" ").map(wordTest);

const COMPILED: CompiledRule[] = RULES.map((rule) => ({
  icon: rule.icon,
  patterns: { de: rule.de?.map(phrase), en: rule.en?.map(phrase), ar: rule.ar?.map(phrase) },
  except: (rule.not ?? []).map(wordTest),
}));

/** Which patterns a page reads: its own language's, and English (the trade's own words: SAP, Excel). */
const READS: Record<Locale, Locale[]> = { de: ["de", "en"], en: ["en"], ar: ["ar", "en"] };

/** Whether a phrase matches the words starting at `start` (each word in any of its forms, none an exception). */
function phraseAt(tests: WordTest[], forms: string[][], start: number, except: WordTest[]): boolean {
  return tests.every((test, offset) => {
    const options = forms[start + offset];
    return options?.some((form) => test(form) && !except.some((no) => no(form))) === true;
  });
}

/**
 * The icon for a skill, a title or a role: the first rule of the curated map with a matching word, or
 * undefined (the caller has its own neutral icon). Matching never splits a word at a guess: whole
 * words, word starts, compound heads and listed stems only.
 */
export function iconFor(text: string, locale: Locale): LucideIcon | undefined {
  const forms = wordsOf(text).map(formsOf);
  if (forms.length === 0) return undefined;
  for (const rule of COMPILED) {
    for (const language of READS[locale]) {
      for (const tests of rule.patterns[language] ?? []) {
        for (let start = 0; start + tests.length <= forms.length; start += 1) {
          if (phraseAt(tests, forms, start, rule.except)) return rule.icon;
        }
      }
    }
  }
  return undefined;
}

/** The icons that say "licence" or "certificate": a timeline step that names one shows it on its node. */
export const CREDENTIAL_ICONS: readonly LucideIcon[] = [IdCard, Award];

/* ------------------------------------------------------------------------------------------------ */
/* Joints of German compounds                                                                        */
/* ------------------------------------------------------------------------------------------------ */

/**
 * The last parts of German compounds that a narrow tile may break before ("Versand|dokumente",
 * "Ladungs|sicherung", "Flurförder|zeug|schein"), longest first. Laufbahn never hyphenates on its own
 * (CSS `hyphens: manual`): a long word breaks only at these joints, where a German reader expects it,
 * and only when it must.
 */
const HEADS = [
  "fehlsichtigkeit",
  "sichtigkeit",
  "entwicklung",
  "fotografie",
  "kenntnisse",
  "verwaltung",
  "gestaltung",
  "dokumente",
  "sicherung",
  "management",
  "ausbildung",
  "erfahrung",
  "kontrolle",
  "logistik",
  "dokument",
  "betreuung",
  "beratung",
  "planung",
  "wartung",
  "technik",
  "systeme",
  "ausgabe",
  "stapler",
  "fahrer",
  "schein",
  "system",
  "bilder",
  "lager",
  "zeug",
].sort((a, b) => b.length - a.length);

/** Before the consonant of "-ierung" (Kommissio|nierung, Digitali|sierung): the syllable German breaks at. */
const IERUNG = /([aeiouäöü])([bcdfghklmnpqrstvwxz]ierung)$/u;

/** Shortest piece on either side of a joint, so no joint leaves a stub ("Ver|sand" never). */
const MIN_PIECE = 4;

function jointsOf(word: string): string {
  const lower = word.toLowerCase();
  for (const head of HEADS) {
    if (lower.endsWith(head) && lower.length - head.length >= MIN_PIECE) {
      const cut = word.length - head.length;
      return `${jointsOf(word.slice(0, cut))}${SOFT_HYPHEN}${word.slice(cut)}`;
    }
  }
  const ierung = IERUNG.exec(lower);
  if (ierung && ierung.index + 1 >= MIN_PIECE + 1) {
    const cut = ierung.index + 1;
    return `${word.slice(0, cut)}${SOFT_HYPHEN}${word.slice(cut)}`;
  }
  return word;
}

/**
 * The text with soft hyphens at the joints of its long German compounds (German pages only; words of
 * ten letters or more without a hyphen of their own). Invisible until a line must break there.
 */
export function softJoints(text: string, locale: Locale): string {
  if (locale !== "de") return text;
  return text.replace(/\p{L}{10,}/gu, (word) => jointsOf(word));
}

/* ------------------------------------------------------------------------------------------------ */
/* Tiles                                                                                             */
/* ------------------------------------------------------------------------------------------------ */

/** Inter's widths at the semibold weight, in em, by letter class (measured, rounded up). */
const NARROW = /[fijlrtI'’.,:;!|()/]/u;
const WIDE = /[mwMW@&]/u;
const LATIN = /\p{Script=Latin}|\p{N}/u;

/** How wide a piece of text that cannot break is, in em of the body face at semibold (an upper estimate). */
export function pieceEms(piece: string): number {
  return Array.from(piece).reduce((sum, glyph) => {
    if (!LATIN.test(glyph) && !/[&@()/]/u.test(glyph)) return sum + 0.58;
    if (NARROW.test(glyph)) return sum + 0.32;
    if (WIDE.test(glyph)) return sum + 0.9;
    return sum + (glyph === glyph.toUpperCase() && glyph !== glyph.toLowerCase() ? 0.7 : 0.59);
  }, 0);
}

/** The widest piece of a label that cannot break (between spaces, hyphens and soft hyphens), in em, a hyphen included. */
export function longestPieceEms(label: string): number {
  const pieces = label.split(/[\s\-\u00AD\u2010\u2011]+/u).filter(Boolean);
  return Math.max(0, ...pieces.map((piece) => pieceEms(piece) + (label.includes(SOFT_HYPHEN) ? 0.35 : 0)));
}

/** The narrowest phone a tile's label must fit without breaking a piece (common Android phones). */
const NARROW_PHONE = 360;
/** The body face's size in px (text-body), so a label's width in em can be compared with room in px. */
const BODY_PX = tokens.text.body.fontSize;

/**
 * The room for a label in half a phone's row, in em of the body face: a 360 px phone, its gutters, the
 * gap between the two tiles and each tile's padding ((360 − 2 × 20 − 8) / 2 − 2 × 12 = 132 px).
 */
export const HALF_ROW_EMS = ((NARROW_PHONE - 2 * tokens.spacing.creatorGutter - tokens.spacing["2"]) / 2 - 2 * tokens.spacing["3"]) / BODY_PX;

/**
 * The room for a fact's value in half the facts' sheet on a 360 px phone, in em of the body face: the
 * gutters, the hairline between the cells and each cell's padding ((360 − 2 × 20 − 1) / 2 − 2 × 16).
 */
export const HALF_CELL_EMS = ((NARROW_PHONE - 2 * tokens.spacing.creatorGutter - tokens.borderWidth.hairline) / 2 - 2 * tokens.spacing["4"]) / BODY_PX;

/**
 * How many columns each tile spans, in order and with no holes: a tile asks for `wants[i]` columns
 * (at most `columns`); when it does not fit the rest of its row, the tile before it widens to close
 * the row, and the last row's last tile widens to its end. Order is never changed.
 */
export function packSpans(wants: readonly number[], columns: number): number[] {
  const spans = wants.map((want) => Math.min(Math.max(1, want), columns));
  let used = 0;
  let last = -1;
  spans.forEach((span, index) => {
    if (used + span > columns && last >= 0) {
      spans[last] = (spans[last] ?? 1) + columns - used;
      used = 0;
    }
    used += span;
    last = index;
    if (used === columns) used = 0;
  });
  if (used > 0 && last >= 0) spans[last] = (spans[last] ?? 1) + columns - used;
  return spans;
}

/** From this many skills on, the first one leads as a wide tile. */
export const LEAD_FROM = 5;

/**
 * The spans of a list of skill tiles on phones (two columns) and from tablets on (three): the first
 * leads wide when the list is long enough, a label whose widest piece would not fit half a phone's
 * row takes the whole row, and every row is closed.
 */
export function skillSpans(labels: readonly string[]): { phone: number[]; wide: number[] } {
  const lead = labels.length >= LEAD_FROM;
  const phone = labels.map((label, index) => (lead && index === 0) || longestPieceEms(label) > HALF_ROW_EMS ? 2 : 1);
  const wide = labels.map((_, index) => (lead && index === 0 ? 2 : 1));
  return { phone: packSpans(phone, 2), wide: packSpans(wide, 3) };
}

/** The spans of the facts' cells (two columns): a value whose widest piece would not fit half the sheet takes the row. */
export const factSpans = (values: readonly string[]): number[] => packSpans(values.map((value) => (longestPieceEms(value) > HALF_CELL_EMS ? 2 : 1)), 2);

/* ------------------------------------------------------------------------------------------------ */
/* Text sections                                                                                    */
/* ------------------------------------------------------------------------------------------------ */

/** Under this many characters a text section is a short note (a callout card). */
export const SHORT_TEXT = 320;
/** Over this many characters a text section is a long read: on phones it opens with two paragraphs. */
export const LONG_TEXT = 900;
/** From this many paragraphs (or characters) on, a text is set as a reading tile with its reading time. */
const READING_PARAGRAPHS = 3;
const READING_CHARACTERS = 600;
/** Reading speed for the reading-time label (words a minute). */
const WORDS_A_MINUTE = 200;

/** A text's paragraphs (split at blank lines; a single line break stays inside its paragraph). */
export const paragraphsOf = (text: string): string[] =>
  text
    .split(/\n\s*\n/u)
    .map((part) => part.trim())
    .filter(Boolean);

export type TextKind = "note" | "plain" | "reading";

/** How a text section is set: a short note as a callout, a long read as a reading tile, the rest as paragraphs. */
export function textKind(text: string): TextKind {
  const length = text.trim().length;
  if (length < SHORT_TEXT) return "note";
  if (paragraphsOf(text).length >= READING_PARAGRAPHS || length >= READING_CHARACTERS) return "reading";
  return "plain";
}

/** Whether a reading tile opens with two paragraphs on phones and offers the rest behind a disclosure. */
export const opensShort = (text: string): boolean => text.trim().length > LONG_TEXT && paragraphsOf(text).length > 2;

/** Minutes to read a text, at least one. */
export const readingMinutes = (text: string): number => Math.max(1, Math.round(text.split(/\s+/u).filter(Boolean).length / WORDS_A_MINUTE));

/** Titles that name a letter (cover letter, motivation letter), in the three languages. */
const LETTER_TITLES = ["anschreiben", "bewerbungsschreiben", "motivationsschreiben", "begleitschreiben", "brief", "bewerbungsbrief", "motivationsbrief", "letter", "خطاب", "رساله"];
/** How letters open and close, in the three languages. */
const SALUTATION = /^(sehr geehrte|liebe[rs]?\b|hallo\b|guten tag|dear\b|hello\b|to whom|السيد|السيده|عزيزي|عزيزتي|حضره|تحيه)/u;
const CLOSING = /(mit freundlichen grüßen|freundliche grüße|viele grüße|beste grüße|hochachtungsvoll|kind regards|best regards|yours sincerely|yours faithfully|sincerely|مع خالص التحيه|مع التحيه|وتفضلوا بقبول|تحياتي)/u;

/**
 * Whether a section's text is a letter: a long read under a title that names one, or a long read that
 * opens with a salutation and closes with a greeting. The hero's first action then leads to it.
 */
export function isLetter(title: string | null, text: string): boolean {
  if (textKind(text) !== "reading") return false;
  const titled = title !== null && wordsOf(title).some((word) => LETTER_TITLES.some((pattern) => wordTest(pattern)(word)));
  const body = normalize(text.trim());
  return titled || (SALUTATION.test(body) && CLOSING.test(body.slice(-160)));
}
