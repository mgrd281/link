import { normalizeUrl, type BlockOf, type CreatorKind, type LinkIcon } from "@linkyo/blocks";

/**
 * How a page's contact ways are written down: the address each way leads to, built by code from
 * what was typed, and the words the button can carry. Plain functions (no React), so the editor's
 * checks (validate.ts) and the forms share them; `reach-input.tsx` is the field built on them.
 */

/** The ways a page's one button (and a contact block's other ways) can reach its owner. */
export const REACH_WAYS = ["calendar", "email", "whatsapp", "phone"] as const;
export type ReachWay = (typeof REACH_WAYS)[number];

export const isReachWay = (value: string): value is ReachWay => (REACH_WAYS as readonly string[]).includes(value);

/** Label presets (`app.portfolio.contact.presets.*`). */
export type ReachPreset = "call" | "email" | "whatsapp" | "phone" | "project" | "shoot";

/** The page's one primary action, as the contact block stores it. */
export interface ReachValue {
  label: string;
  url: string;
  icon?: LinkIcon | undefined;
}

const ICONS: Record<ReachWay, LinkIcon> = { calendar: "calendar", email: "mail", whatsapp: "chat", phone: "phone" };

/** The icon a way's button carries on the page. */
export const reachIcon = (way: ReachWay): LinkIcon => ICONS[way];

/** At least this many digits make a phone number (a short service number has more than this). */
const MIN_DIGITS = 6;
const MAX_DIGITS = 15;
const EMAIL = /^[^\s@/:]+@[^\s@/:]+\.[^\s@/:]{2,}$/;

/**
 * The address a way leads to, built by code from what was typed: a booking link stays a web
 * address, an e-mail becomes `mailto:`, a WhatsApp number `https://wa.me/<digits>` and a phone
 * number `tel:`. Null when what was typed is not such an address (never a half-made link).
 *
 * WhatsApp opens a chat only for a full international number: "+49 151 …", "0049 151 …" and
 * "+49 (0)151 …" all become wa.me/49151…; a national number ("0151 …", no country code) is refused.
 */
export function reachUrl(way: ReachWay, typed: string): string | null {
  const raw = typed.trim();
  if (!raw) return null;
  switch (way) {
    case "calendar": {
      const url = normalizeUrl(raw);
      return url && /^https?:$/.test(url.protocol) ? url.toString() : null;
    }
    case "email": {
      const address = raw.replace(/^mailto:/i, "");
      return EMAIL.test(address) ? `mailto:${address}` : null;
    }
    case "whatsapp": {
      // A pasted wa.me link or a number with spaces, dashes, brackets or a leading + (or 00); the
      // trunk zero some write after the country code, "(0)", is not dialled from abroad.
      const number = raw.replace(/^(?:https?:\/\/)?(?:www\.)?wa\.me\//i, "").replace(/\(0\)/g, "");
      if (!/^\+?[\d\s()./-]+$/.test(number)) return null;
      const all = number.replace(/\D/g, "");
      const digits = !number.trim().startsWith("+") && all.startsWith("00") ? all.slice(2) : all;
      if (digits.startsWith("0")) return null;
      return digits.length >= MIN_DIGITS && digits.length <= MAX_DIGITS ? `https://wa.me/${digits}` : null;
    }
    case "phone": {
      const number = raw.replace(/^tel:/i, "");
      if (!/^\+?[\d\s()./-]+$/.test(number)) return null;
      const digits = number.replace(/\D/g, "");
      if (digits.length < MIN_DIGITS || digits.length > MAX_DIGITS) return null;
      return `tel:${number.trim().startsWith("+") ? "+" : ""}${digits}`;
    }
  }
}

/** Which way a stored address belongs to, and what to show in its field. */
export function reachFrom(url: string): { way: ReachWay; typed: string } {
  if (/^mailto:/i.test(url)) return { way: "email", typed: url.replace(/^mailto:/i, "") };
  if (/^tel:/i.test(url)) return { way: "phone", typed: url.replace(/^tel:/i, "") };
  const whatsapp = /^https?:\/\/(?:www\.)?wa\.me\/(\d+)/i.exec(url);
  if (whatsapp) return { way: "whatsapp", typed: `+${whatsapp[1] ?? ""}` };
  return { way: "calendar", typed: url };
}

/**
 * Whether a stored address is one this way builds: a WhatsApp way that leads to `tel:` (or a dead
 * wa.me link) would make the visitor's phone dial, an e-mail under "Phone" would open a mail.
 */
export const reachesBy = (way: ReachWay, url: string): boolean => {
  const read = reachFrom(url);
  if (read.way !== way || reachUrl(way, read.typed) === null) return false;
  // A booking link is stored with its scheme ("cal.example.com/…" is still as typed).
  return way !== "calendar" || /^https?:\/\//i.test(url);
};

type ContactWay = NonNullable<BlockOf<"contact">["links"]>[number];

/**
 * One of a contact block's other ways with the address its kind builds: e-mail, phone, WhatsApp and
 * booking ways get `reachUrl`'s address (as the page's button does), so a number under WhatsApp opens
 * a chat instead of dialling; a CV or another link stays as it is. What cannot be read as such an
 * address is left as typed, for the editor to point out (`reachesBy`).
 */
export function shapeWay(way: ContactWay): ContactWay {
  if (!isReachWay(way.kind) || reachesBy(way.kind, way.url)) return way;
  const url = reachUrl(way.kind, reachFrom(way.url).typed);
  return url ? { ...way, url } : way;
}

/** The label presets of a way, best first, by the kind of page: photographers are booked for shoots. */
export function reachPresets(way: ReachWay, kind: CreatorKind | undefined): ReachPreset[] {
  const work: ReachPreset = kind === "photographer" ? "shoot" : "project";
  if (way === "calendar") return kind === "photographer" ? ["shoot", "call"] : ["call", work];
  return [way, work];
}

export type PageLocale = "de" | "en" | "ar";

/**
 * The presets in the page's three languages: the button speaks to the page's visitors, while the
 * dashboard only has the messages of its own language. The same words as
 * `app.portfolio.contact.presets` in the message files (reach-input.test.ts holds them equal).
 */
const PRESETS: Record<PageLocale, Record<ReachPreset, string>> = {
  de: { call: "Erstgespräch buchen", email: "Nachricht schreiben", whatsapp: "Per WhatsApp schreiben", phone: "Anrufen", project: "Projekt anfragen", shoot: "Shooting anfragen" },
  en: { call: "Book an intro call", email: "Send a message", whatsapp: "Message me on WhatsApp", phone: "Call me", project: "Start a project", shoot: "Book a shoot" },
  ar: { call: "احجز جلسة تعريفية", email: "أرسل رسالة", whatsapp: "راسلني على واتساب", phone: "اتصل بي", project: "ابدأ مشروعك", shoot: "احجز جلسة تصوير" },
};

/** A preset's words in a page language. */
export const presetLabel = (preset: ReachPreset, locale: PageLocale): string => PRESETS[locale][preset];

/** Every preset in every language: a label that is one of them still follows the way chosen. */
export const isPresetLabel = (label: string): boolean => Object.values(PRESETS).some((words) => Object.values(words).includes(label));
