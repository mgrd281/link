/**
 * The page someone built in the homepage's playground, carried into sign-up and the welcome flow so
 * nothing they made is lost. The name and the look travel in the sign-up address; the links and the
 * photo wait here, in this tab's session storage only (no cookie, nothing sent anywhere), until the
 * welcome flow has picked them up, and are removed then.
 */
export interface TryDraft {
  name: string;
  links: string[];
  /** Their photo, already resized in the browser (a JPEG or WebP data URL). */
  photo?: { src: string; tone: "light" | "dark" };
}

const KEY = "linkyo.try";
const MAX_LINKS = 4;
/** A resized avatar is far smaller; anything bigger is not one of ours. */
const MAX_PHOTO = 2_000_000;

function readPhoto(value: unknown): TryDraft["photo"] {
  if (!value || typeof value !== "object") return undefined;
  const { src, tone } = value as Record<string, unknown>;
  if (typeof src !== "string" || !/^data:image\/(?:jpeg|webp);base64,/.test(src) || src.length > MAX_PHOTO) return undefined;
  return { src, tone: tone === "light" ? "light" : "dark" };
}

export function saveTryDraft(draft: TryDraft): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ name: draft.name.slice(0, 60), links: draft.links.slice(0, MAX_LINKS), photo: readPhoto(draft.photo) }));
  } catch {
    // Storage can be off (private mode): the links are then simply added in the welcome flow.
  }
}

/** The draft, if there is one and it looks right. Reading leaves it in place (see clearTryDraft). */
export function readTryDraft(): TryDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw: unknown = JSON.parse(sessionStorage.getItem(KEY) ?? "null");
    if (!raw || typeof raw !== "object") return null;
    const { name, links, photo } = raw as Record<string, unknown>;
    if (typeof name !== "string" || !Array.isArray(links)) return null;
    const urls = links.filter((link): link is string => typeof link === "string" && link.length <= 2048).slice(0, MAX_LINKS);
    const picture = readPhoto(photo);
    return { name: name.slice(0, 60), links: urls, ...(picture ? { photo: picture } : {}) };
  } catch {
    return null;
  }
}

export function clearTryDraft(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
