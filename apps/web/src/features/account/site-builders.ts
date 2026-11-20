import { NO_IMAGE, type Page } from "@linkyo/blocks";

import type { SignUpInput, Site } from "./types";
import { isProvisionalUsername, nameFromUsername } from "./username";

const now = () => new Date().toISOString();

/**
 * A brand-new creator page: the address, a first name made from it ("mila-aurel" → "Mila Aurel"; a
 * neutral address stays as it is until the welcome flow asks for the name), no photo yet (monogram),
 * no blocks.
 */
export function starterSite(username: string, email: string, locale: Page["profile"]["locale"]): Site {
  const displayName = isProvisionalUsername(username) ? username : nameFromUsername(username) || username;
  return {
    page: {
      profile: { username, displayName, bio: "", avatar: { src: NO_IMAGE, alt: "" }, verified: false, locale },
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

/**
 * The site a new account starts with: a prepared page, an example's (or the playground's) kind and
 * look with the name typed there, or a blank one.
 */
export function firstSite(input: Pick<SignUpInput, "prepared" | "start"> & { username: string; email: string; locale: Site["page"]["profile"]["locale"] }): Site {
  if (input.prepared) return preparedSite(input.username, input.email, input.prepared);
  const site = starterSite(input.username, input.email, input.locale);
  if (!input.start) return site;
  const displayName = input.start.displayName?.trim();
  return {
    ...site,
    kind: input.start.kind,
    theme: input.start.theme,
    page: displayName ? { ...site.page, profile: { ...site.page.profile, displayName } } : site.page,
  };
}
