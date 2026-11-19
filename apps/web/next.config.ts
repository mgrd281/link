import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import { PROXIED_IMAGE_HOSTS } from "./src/features/directions/shared/remote-images";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
];

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@linkyo/ui", "@linkyo/tokens", "@linkyo/blocks"],
  images: {
    formats: ["image/avif", "image/webp"],
    // Platform pictures (thumbnails, covers) are re-served by us, never loaded from the platform.
    remotePatterns: PROXIED_IMAGE_HOSTS.map((hostname) => ({ protocol: "https" as const, hostname, pathname: "/**" })),
  },
  headers: () => Promise.resolve([{ source: "/:path*", headers: securityHeaders }]),
};

export default withNextIntl(config);
