/**
 * The page someone built in the homepage's playground, carried into sign-up and the welcome flow so
 * nothing they typed is lost. The name and the look travel in the sign-up address; the links wait
 * here, in this tab's session storage only (no cookie, nothing sent anywhere), until the welcome
 * flow has picked them up, and are removed then.
 */
export interface TryDraft {
  name: string;
  links: string[];
}

const KEY = "linkyo.try";
const MAX_LINKS = 4;

export function saveTryDraft(draft: TryDraft): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ name: draft.name.slice(0, 60), links: draft.links.slice(0, MAX_LINKS) }));
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
    const { name, links } = raw as Record<string, unknown>;
    if (typeof name !== "string" || !Array.isArray(links)) return null;
    const urls = links.filter((link): link is string => typeof link === "string" && link.length <= 2048).slice(0, MAX_LINKS);
    return { name: name.slice(0, 60), links: urls };
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
