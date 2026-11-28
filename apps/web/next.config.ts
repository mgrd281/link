import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import { PROXIED_IMAGE_HOSTS, STORAGE_MEDIA_PATH } from "./src/features/directions/shared/remote-images";
import { renamedExampleRedirects } from "./src/features/examples/renamed";
import { legalReady } from "./src/features/legal/company";
import { assertLiveReady } from "./src/features/legal/live-guard";
import { routing } from "./src/i18n/routing";
import { CSP_HEADER, CSP_REPORT_GROUP, CSP_REPORT_PATH, contentSecurityPolicy } from "./src/lib/csp";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// A build that would take real money with placeholder legal texts, or without a transport that really
// sends the contract e-mails, fails here; so does a launch build (LAUNCH=1) while the legal texts are
// still drafts (features/legal/live-guard.ts).
assertLiveReady({
  payments: process.env.NEXT_PUBLIC_PAYMENTS,
  legalReady,
  reviewed: process.env.LEGAL_REVIEWED,
  emailTransport: process.env.EMAIL_TRANSPORT,
  launch: process.env.LAUNCH,
});

// The Content-Security-Policy, report-only for now (src/lib/csp.ts says why each source is there).
// The same key on a later, more specific rule wins: example pages may be framed by our own gallery,
// and only checkout pages name Stripe's hosts.
const cspOptions = { supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL };
const languages = `:locale(${routing.locales.join("|")})`;

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: CSP_HEADER, value: contentSecurityPolicy(cspOptions) },
  { key: "Reporting-Endpoints", value: `${CSP_REPORT_GROUP}="${CSP_REPORT_PATH}"` },
];

const headers: Awaited<ReturnType<NonNullable<NextConfig["headers"]>>> = [
  { source: "/:path*", headers: securityHeaders },
  { source: `/${languages}/p/:path*`, headers: [{ key: CSP_HEADER, value: contentSecurityPolicy({ ...cspOptions, framable: true }) }] },
  { source: `/${languages}/checkout/:path*`, headers: [{ key: CSP_HEADER, value: contentSecurityPolicy({ ...cspOptions, checkout: true }) }] },
];

/**
 * Sign-in is a code by e-mail; there are no passwords any more. Old links to the password pages lead
 * to sign-in for good (308), before any route renders.
 */
const passwordRedirects = ["forgot", "reset-password"].map((page) => ({ source: `/${languages}/${page}`, destination: "/:locale/login", permanent: true as const }));

type RemotePattern = NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]>[number];

/**
 * Pictures creators upload live in the public `media` bucket of this deployment's Supabase project;
 * our optimizer re-serves them, so visitors never contact the Storage host. The local stack answers
 * on a loopback address, which the optimizer refuses unless told otherwise (local builds only).
 */
function storagePattern(): { pattern: RemotePattern; local: boolean } | null {
  const configured = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!configured) return null;
  const url = new URL(configured);
  const protocol = url.protocol === "http:" ? "http" : "https";
  return {
    pattern: { protocol, hostname: url.hostname, port: url.port, pathname: `${STORAGE_MEDIA_PATH}**` },
    local: url.hostname === "127.0.0.1" || url.hostname === "localhost",
  };
}

const storage = storagePattern();

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@linkyo/ui", "@linkyo/tokens", "@linkyo/blocks"],
  images: {
    formats: ["image/avif", "image/webp"],
    // A picture opened from its link shows in the browser instead of downloading (a project picture
    // links to its full size); SVG stays refused, so inline is safe.
    contentDispositionType: "inline",
    // Platform pictures (thumbnails, covers) are re-served by us, never loaded from the platform.
    remotePatterns: [
      ...PROXIED_IMAGE_HOSTS.map((hostname) => ({ protocol: "https" as const, hostname, pathname: "/**" })),
      ...(storage ? [storage.pattern] : []),
    ],
    ...(storage?.local ? { dangerouslyAllowLocalIP: true } : {}),
  },
  headers: () => Promise.resolve(headers),
  // The addresses of example people who gave way to others lead to the new pages (308), before any
  // route renders (features/examples/renamed.ts); so do the old password pages.
  redirects: () => Promise.resolve([...renamedExampleRedirects(routing.locales), ...passwordRedirects]),
  experimental: {
    // app/global-not-found.tsx is Linkyo's page for an address no route matches at all (the app has
    // several root layouts, [locale] and u/[username], so there is no single not-found). Today no
    // address reaches it: every first segment matches [locale], and an unknown one (/u/a/b/c, /api/nope,
    // /x.php) gets the language layout's own notFound(), which shows Next's built-in 404 (status 404).
    // Routing those here needs a change to app/[locale]/layout.tsx (ADR 0074); until then it is a net.
    globalNotFound: true,
  },
};

export default withNextIntl(config);
