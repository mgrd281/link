/**
 * Where creator pages live: `linkyo.app/<username>` unless NEXT_PUBLIC_CREATOR_DOMAIN says otherwise
 * (a preview deployment, or `localhost:3100` in tests). Every page address in the app comes from here.
 */
const configured = process.env.NEXT_PUBLIC_CREATOR_DOMAIN?.trim() ?? "";
export const CREATOR_DOMAIN: string = configured === "" ? "linkyo.app" : configured;

/** The origin creator pages are served from: plain http only for a local address. */
export const creatorOrigin = (): string => `${/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(CREATOR_DOMAIN) ? "http" : "https"}://${CREATOR_DOMAIN}`;

/** Shown to people: "linkyo.app/mila". */
export const pageAddress = (username: string): string => `${CREATOR_DOMAIN}/${username}`;

/** For links, QR codes and sharing: "https://linkyo.app/mila". */
export const pageUrl = (username: string): string => `${creatorOrigin()}/${username}`;

/**
 * What a page's QR code holds: the address marked `?src=qr`, so a scan is counted as "QR-Code" by the
 * page's statistics (ADR 0081). People read the plain address beside the code (`pageAddress`).
 */
export const qrPageUrl = (username: string): string => `${pageUrl(username)}?src=qr`;

/** A project's own address, for canonical links and sharing: "https://linkyo.app/mila/hafenlicht". */
export const projectUrl = (username: string, slug: string): string => `${pageUrl(username)}/${slug}`;
