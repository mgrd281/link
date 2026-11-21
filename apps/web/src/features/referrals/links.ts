import { siteUrl } from "@/lib/site-url";

/*
 * Where an invite link points: `/i/<code>` on this site, which redirects to the sign-up with the code
 * (and adds the locale). NEXT_PUBLIC_SITE_URL wins; otherwise the origin this page is served from, so
 * the link works on every deployment today (linkyo.app is not live yet). One variable switches all.
 */

function base(): string {
  // An empty value counts as unset.
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit;
  return typeof window === "undefined" ? siteUrl().origin : window.location.origin;
}

/** The full invite link, for copying, sharing and the QR code. */
export const inviteUrl = (code: string): string => new URL(`/i/${code}`, base()).toString();

/** The host the link lives on, without the scheme ("link-web-one.vercel.app"). */
export const inviteHost = (): string => new URL(base()).host;

/** The link as people read it: no scheme ("link-web-one.vercel.app/i/k7m2q9xz"). */
export const inviteAddress = (code: string): string => `${inviteHost()}/i/${code}`;
