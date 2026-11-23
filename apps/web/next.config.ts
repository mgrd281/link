import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import { PROXIED_IMAGE_HOSTS, STORAGE_MEDIA_PATH } from "./src/features/directions/shared/remote-images";
import { legalReady } from "./src/features/legal/company";
import { assertLiveReady } from "./src/features/legal/live-guard";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// A build that would take real money with placeholder legal texts, or without a transport that really
// sends the contract e-mails, fails here (features/legal/live-guard.ts).
assertLiveReady({
  payments: process.env.NEXT_PUBLIC_PAYMENTS,
  legalReady,
  reviewed: process.env.LEGAL_REVIEWED,
  emailTransport: process.env.EMAIL_TRANSPORT,
});

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
];

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
    // Platform pictures (thumbnails, covers) are re-served by us, never loaded from the platform.
    remotePatterns: [
      ...PROXIED_IMAGE_HOSTS.map((hostname) => ({ protocol: "https" as const, hostname, pathname: "/**" })),
      ...(storage ? [storage.pattern] : []),
    ],
    ...(storage?.local ? { dangerouslyAllowLocalIP: true } : {}),
  },
  headers: () => Promise.resolve([{ source: "/:path*", headers: securityHeaders }]),
};

export default withNextIntl(config);
