import { isTemplate, type CreatorThemeConfig } from "@linkyo/tokens/creator";

/**
 * The page someone built in the homepage's playground, carried into sign-up and the welcome flow so
 * nothing they made is lost. The name and the look's template and accent travel in the sign-up
 * address; the rest waits here, in this tab's session storage only (no cookie, nothing sent anywhere),
 * until sign-up and the welcome flow have used it, and is removed then.
 */
export interface TryDraft {
  name: string;
  links: string[];
  /** The line under the name ("DJ · Producer · House & Disco"). */
  tagline?: string;
  /** Their photo, already resized in the browser (a JPEG or WebP data URL). */
  photo?: { src: string; tone: "light" | "dark" };
  /** The whole look on screen: template, accent, page color, type, buttons. */
  theme?: CreatorThemeConfig;
}

const KEY = "linkyo.try";
const MAX_LINKS = 6;
const COLOR = /^#[0-9a-f]{6}$/i;
const WORD = /^[a-z-]{1,24}$/;

/** A look as the playground writes it; anything else is dropped. */
function readTheme(value: unknown): CreatorThemeConfig | undefined {
  if (!value || typeof value !== "object") return undefined;
  const { template, accent, neutral, tint, mode, pairing, buttonStyle, buttonShape } = value as Record<string, unknown>;
  if (typeof template !== "string" || !isTemplate(template)) return undefined;
  const theme: Record<string, unknown> = { template };
  if (typeof accent === "string" && COLOR.test(accent)) theme.accent = accent;
  if (typeof neutral === "string" && COLOR.test(neutral)) theme.neutral = neutral;
  if (typeof tint === "number" && tint >= 0 && tint <= 1) theme.tint = tint;
  for (const [key, word] of Object.entries({ mode, pairing, buttonStyle, buttonShape })) if (typeof word === "string" && WORD.test(word)) theme[key] = word;
  return theme;
}

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
    sessionStorage.setItem(
      KEY,
      JSON.stringify({ name: draft.name.slice(0, 60), links: draft.links.slice(0, MAX_LINKS), tagline: draft.tagline?.slice(0, 80), photo: readPhoto(draft.photo), theme: readTheme(draft.theme) }),
    );
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
    const { name, links, tagline, photo, theme } = raw as Record<string, unknown>;
    if (typeof name !== "string" || !Array.isArray(links)) return null;
    const urls = links.filter((link): link is string => typeof link === "string" && link.length <= 2048).slice(0, MAX_LINKS);
    const picture = readPhoto(photo);
    const look = readTheme(theme);
    const line = typeof tagline === "string" ? tagline.trim().slice(0, 80) : "";
    return { name: name.slice(0, 60), links: urls, ...(line ? { tagline: line } : {}), ...(picture ? { photo: picture } : {}), ...(look ? { theme: look } : {}) };
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
