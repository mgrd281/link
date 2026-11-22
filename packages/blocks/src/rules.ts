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
]);

/**
 * Image source of a creator who has not added a photo yet. Renderers show a monogram instead of an
 * image, so a brand-new page never shows a broken or borrowed picture.
 */
export const NO_IMAGE = "none:";
export const hasImage = (image: { src: string } | undefined | null): image is { src: string } => !!image && image.src !== NO_IMAGE && image.src.length > 0;
