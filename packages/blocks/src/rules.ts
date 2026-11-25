/**
 * Rules the browser needs without the schemas (and without Zod): page addresses and "no picture yet".
 * The schemas in schema.ts use the same rules, so there is one source of truth; import from
 * "@linkyo/blocks/rules" in code that ships on public pages, to keep Zod out of their JavaScript.
 */

/** A page address: 3–30 lowercase letters, numbers and dashes, not starting or ending with a dash. */
export const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;

export const isUsernameFormat = (value: string): boolean => value.length >= USERNAME_MIN && value.length <= USERNAME_MAX && USERNAME_PATTERN.test(value);

/**
 * Names we never hand out as page addresses: product routes and words people could be misled by.
 * The database has the same list (public.reserved_usernames, filled by supabase/migrations);
 * apps/web/src/features/account/reserved.test.ts compares the two.
 */
export const RESERVED_USERNAMES = new Set([
  "about", "admin", "api", "app", "ar", "auth", "billing", "blog", "de", "design", "directions", "en", "forgot",
  "help", "imprint", "impressum", "legal", "linkyo", "login", "logout", "official", "preview", "pricing", "privacy",
  "report", "security", "settings", "signup", "status", "support", "terms", "welcome", "www",
  // v7: every first-level route, files at the root and the selling flows.
  "account", "agb", "ai", "build", "checkout", "dashboard", "datenschutz", "kontakt", "kuendigen", "manifest", "media",
  "orders", "pro", "robots", "reset-password", "service", "services", "sitemap", "studio", "team", "templates",
  "widerruf", "widerrufsbelehrung",
  // The portfolio section, the help and trust pages that follow it, and words of the claim and report flows.
  "arbeiten", "changelog", "claim", "contact", "features", "funktionen", "hilfe", "melden", "plan", "portfolio",
  "portfolios", "sicherheit", "ueber-uns",
]);

/**
 * Image source of a creator who has not added a photo yet. Renderers show a monogram instead of an
 * image, so a brand-new page never shows a broken or borrowed picture.
 */
export const NO_IMAGE = "none:";
export const hasImage = (image: { src: string } | undefined | null): image is { src: string } => !!image && image.src !== NO_IMAGE && image.src.length > 0;

/**
 * The platforms a social profile or a smart link can be on. `platformSchema` (./schema) is built from
 * this list; it lives here so the dashboard's editor can check a value without loading Zod.
 */
export const PLATFORMS = [
  "youtube",
  "youtubemusic",
  "spotify",
  "applemusic",
  "soundcloud",
  "deezer",
  "tidal",
  "bandcamp",
  "tiktok",
  "instagram",
  "twitch",
  "kick",
  "x",
  "threads",
  "bluesky",
  "discord",
  "whatsapp",
  "telegram",
  "facebook",
  "linkedin",
  "github",
  "email",
  "website",
] as const;

/**
 * A project's address part: /<username>/<slug>. 2–48 lowercase letters, numbers and single dashes.
 * Made by code from the title (`slugFor`, ./project), unique on its page, never a reserved word.
 */
export const PROJECT_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const PROJECT_SLUG_MIN = 2;
export const PROJECT_SLUG_MAX = 48;
/** A page holds at most this many projects (a quality cap, the same for every plan). */
export const MAX_PROJECTS = 24;
/** A run of projects shows this many; the rest sits under "Show all projects". */
export const FEATURED_PROJECTS = 6;
/**
 * Words a project address never takes: routes that exist or may come under a creator's name, and
 * words visitors could be misled by. `opengraph-image` must stay: it is a static sibling of the
 * project segment (apps/web/src/app/u/[username]/opengraph-image.tsx).
 */
export const RESERVED_PROJECT_SLUGS = new Set([
  "p", "w", "work", "projects", "projekte", "about", "contact", "kontakt", "cv", "services", "leistungen", "links",
  "shop", "feed", "rss", "og", "opengraph-image", "edit", "new", "admin", "api", "media", "imprint", "impressum",
  "privacy", "datenschutz", "legal", "report", "melden",
]);
export const isProjectSlug = (value: string): boolean =>
  value.length >= PROJECT_SLUG_MIN && value.length <= PROJECT_SLUG_MAX && PROJECT_SLUG.test(value) && !RESERVED_PROJECT_SLUGS.has(value);
