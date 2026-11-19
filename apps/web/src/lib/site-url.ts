/**
 * The public address of the site, for absolute links in metadata (link preview images, canonical
 * URLs). An explicit NEXT_PUBLIC_SITE_URL wins; on Vercel the production domain; locally the dev port.
 */
export function siteUrl(): URL {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return new URL(explicit);
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return new URL(`https://${vercel}`);
  return new URL(`http://localhost:${process.env.PORT ?? "3100"}`);
}
