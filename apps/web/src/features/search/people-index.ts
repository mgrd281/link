import { hasImage } from "@linkyo/blocks/rules";

import { LOOKS, PEOPLE_LOOKS, type LookId } from "@/features/examples/looks";
import { resolveMedia } from "@/features/directions/shared/media";
import { isProxiedImage } from "@/features/directions/shared/remote-images";
import { PREVIEWS } from "@/features/previews/registry";

import type { Person } from "./search";

type Locale = "de" | "en" | "ar";

/** The words for a page's category and kind, in the languages people may type them in. */
export interface PeopleLabels {
  category: (key: string) => string[];
  kind: (key: string) => string[];
}

/**
 * Well-known people come first when nothing is typed, in the order the homepage shows them
 * (ADR 0045); everyone else follows in the gallery's order.
 */
const LEAD = ["taylor-swift", "cristiano", "nadine-njeim", "mrbeast", "alshami", "jeff-bezos", "mo-salah", "elon-musk", "messi"];

/**
 * A picture the visitor's browser gets from Linkyo itself: one of our own files, or a platform
 * picture our image optimizer re-serves. Anything else (a picture that lives on someone else's
 * server) is left out; the result then shows initials.
 */
function ownPicture(src: string | undefined): string | null {
  if (!src || !hasImage({ src })) return null;
  const resolved = resolveMedia(src);
  if (typeof resolved !== "string") return resolved.src;
  return resolved.startsWith("/") || isProxiedImage(resolved) ? resolved : null;
}

/**
 * Everyone the people search can find, for one language: exactly the pages the gallery lists
 * (fictional examples, concept pages of well-known people, prepared previews), nothing private.
 * A page that exists in the visitor's language opens in it; otherwise in its own.
 */
export function buildPeople(locale: Locale, labels: PeopleLabels): Person[] {
  const listed = [...Object.keys(PEOPLE_LOOKS), ...Object.keys(LOOKS)];
  const ordered = [...LEAD.filter((slug) => listed.includes(slug)), ...listed.filter((slug) => !LEAD.includes(slug))];
  return ordered.flatMap((slug): Person[] => {
    const preview = PREVIEWS[slug];
    const person = Object.hasOwn(PEOPLE_LOOKS, slug) ? PEOPLE_LOOKS[slug] : undefined;
    const look = slug in LOOKS ? LOOKS[slug as LookId] : undefined;
    if (!preview || (!person && !look)) return [];
    const own = look?.locale ?? (Object.keys(preview.pages)[0] as Locale | undefined);
    const pageLocale = preview.pages[locale] ? locale : own;
    const page = pageLocale ? preview.pages[pageLocale] : undefined;
    if (!page || !pageLocale) return [];
    const { profile } = page;
    const name = profile.displayName;
    const others = [...Object.values(preview.pages).map((other) => other.profile.displayName), ...Object.values(preview.name)];
    const category = person ? "people" : (look?.category ?? "people");
    const kind = person?.kind ?? look?.kind ?? "other";
    return [
      {
        slug,
        name,
        aliases: [...new Set(others.filter((other): other is string => Boolean(other) && other !== name))],
        role: profile.tagline ?? profile.bio,
        category,
        keywords: [...new Set([...labels.category(category), ...labels.kind(kind), profile.location ?? ""].filter(Boolean))],
        locale: pageLocale,
        href: `/${pageLocale}/p/${slug}`,
        photo: ownPicture(profile.avatar.src) ?? ownPicture(profile.hero?.src),
        badge: preview.concept ? "concept" : preview.sample ? "example" : "preview",
      },
    ];
  });
}
