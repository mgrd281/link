import { NO_IMAGE, type Page } from "@linkyo/blocks";

import type { SignUpInput, Site } from "./types";

const now = () => new Date().toISOString();

/** A brand-new creator page: the address, no photo yet (monogram), no blocks. */
export function starterSite(username: string, email: string, locale: Page["profile"]["locale"]): Site {
  return {
    page: {
      profile: { username, displayName: username, bio: "", avatar: { src: NO_IMAGE, alt: "" }, verified: false, locale },
      blocks: [],
    },
    theme: { template: "nocturne" },
    legal: { name: "", address: "", email, phone: "" },
    onboarded: false,
    updatedAt: now(),
  };
}

/** A page the Linkyo team prepared: ready to share, no welcome flow, a one-time welcome on Home. */
export function preparedSite(username: string, email: string, prepared: NonNullable<SignUpInput["prepared"]>): Site {
  const page = prepared.page;
  return {
    ...starterSite(username, email, page.profile.locale),
    page: { profile: { ...page.profile, username }, blocks: page.blocks },
    theme: prepared.theme,
    onboarded: true,
    prepared: { at: now() },
  };
}

/** The site a new account starts with: a prepared page, an example's kind and look, or a blank one. */
export function firstSite(input: Pick<SignUpInput, "prepared" | "start" | "locale"> & { username: string; email: string }): Site {
  if (input.prepared) return preparedSite(input.username, input.email, input.prepared);
  const site = starterSite(input.username, input.email, input.locale);
  return input.start ? { ...site, kind: input.start.kind, theme: input.start.theme } : site;
}
