import { detectLink, normalizeUrl, type Detection, type Platform } from "@linkyo/blocks";

import { importTarget, pasteOnlyHost } from "@/features/app/import-links";

import type { AiSourceKind } from "../../events";

/**
 * `detectLink`, except that a web address with an "@" in its path (tiktok.com/@lio.vance,
 * threads.net/@name.x) is never taken for an e-mail address (the shared detector checks for an
 * e-mail first and would match it). An empty fragment ("#") steers it to the address branch and is
 * dropped again by the detector.
 */
export function detectAddress(input: string): Detection | null {
  const text = input.trim();
  if (!/^mailto:/i.test(text) && /\/\S*@/.test(text) && !text.includes("#")) return detectLink(`${text}#`);
  return detectLink(text);
}

/**
 * What the AI builder does with a link the owner gives as a source. Pure, so the browser can show the
 * same honest line per platform ("we read your website", "we link your channel") as the server acts on.
 *
 * Only three kinds are read: a personal website, an allowed link-in-bio page and a TikTok profile (its
 * public oEmbed). Instagram, X, YouTube and the other platforms are login-walled or need API keys, so
 * their profiles only become social links on the page; Linktree's rules forbid reading it at all.
 */

export interface ClassifiedSource {
  kind: AiSourceKind;
  /** The address we use: normalized (https, no tracking parameters). */
  url: string;
  /** Short and readable, for the progress line: "lio-vance.de", "instagram.com/lio.vance". */
  label: string;
  /** Read by the server (website, link-in-bio page, TikTok). */
  readable: boolean;
  /** Only linked, nothing fetched (a social profile, a channel, any other link). */
  handleOnly: boolean;
  /** Set for paste-only services (Linktree): skipped, the owner pastes the links instead. */
  pasteOnly: boolean;
}

/** Kinds the server reads. */
export const READABLE_KINDS: readonly AiSourceKind[] = ["website", "linkinbio", "tiktok"];

/** Hosts whose pages are social profiles even though `detectLink` sees a plain website. */
const SOCIAL_HOSTS: Readonly<Record<string, Platform | undefined>> = {
  "facebook.com": "facebook",
  "fb.com": "facebook",
  "kick.com": "kick",
  "pinterest.com": undefined,
  "pinterest.de": undefined,
  "snapchat.com": undefined,
  "reddit.com": undefined,
  "patreon.com": undefined,
  "onlyfans.com": undefined,
};

const bareHost = (url: URL) => url.hostname.toLowerCase().replace(/^(www|m)\./, "");

/** "instagram.com/lio.vance": host and path without a trailing slash, at most 80 characters. */
export function sourceLabel(url: URL): string {
  const path = url.pathname.replace(/\/+$/, "");
  const label = `${bareHost(url)}${path}`;
  return label.length <= 80 ? label : `${label.slice(0, 79)}…`;
}

/**
 * The social platform of a profile address (instagram.com/name, tiktok.com/@name, a YouTube channel,
 * a Spotify artist, a SoundCloud account …), or null for anything else.
 */
export function socialPlatformOf(detection: Detection): Platform | null {
  const url = new URL(detection.url);
  const host = bareHost(url);
  const segments = url.pathname.split("/").filter(Boolean);
  switch (detection.platform) {
    case "instagram":
      return detection.type === "link" && segments.length === 1 ? "instagram" : null;
    case "tiktok":
      return detection.type === "link" && segments.length === 1 && segments[0]?.startsWith("@") ? "tiktok" : null;
    case "youtube":
      return detection.type === "shorts" ? "youtube" : null;
    case "spotify":
      return segments[0] === "artist" ? "spotify" : null;
    case "soundcloud":
      return segments.length === 1 ? "soundcloud" : null;
    case "bandcamp":
      return segments.length === 0 ? "bandcamp" : null;
    case "twitch":
      return detection.type === "live" ? "twitch" : null;
    case "x":
    case "threads":
    case "bluesky":
    case "linkedin":
    case "discord":
    case "telegram":
    case "whatsapp":
      return segments.length >= 1 ? detection.platform : null;
    case "github":
      return detection.type === "link" && segments.length === 1 ? "github" : null;
    default: {
      const social = SOCIAL_HOSTS[host];
      return social && segments.length >= 1 ? social : null;
    }
  }
}

const sourceKindOf = (platform: Platform): AiSourceKind => (platform === "instagram" ? "instagram" : platform === "x" ? "x" : platform === "youtube" ? "youtube" : "social");

/** How a source is treated, or null when it is not an address at all. */
export function classifySource(input: string): ClassifiedSource | null {
  const text = input.trim();
  const base = { readable: false, handleOnly: false, pasteOnly: false };

  if (pasteOnlyHost(text)) {
    const url = normalizeUrl(text);
    if (!url) return null;
    return { ...base, kind: "linktree", url: url.toString(), label: sourceLabel(url), pasteOnly: true };
  }

  const target = importTarget(text);
  if (target) return { ...base, kind: "linkinbio", url: target.toString(), label: sourceLabel(target), readable: true };

  const detection = detectAddress(text);
  if (!detection?.url.startsWith("https:")) {
    // mailto:, tel: or not an address: such a source is only a link on the page (or nothing).
    return detection ? { ...base, kind: "pasted", url: detection.url, label: detection.label, handleOnly: true } : null;
  }
  const url = new URL(detection.url);
  const label = sourceLabel(url);

  if (detection.platform === "tiktok" && socialPlatformOf(detection) === "tiktok") {
    return { ...base, kind: "tiktok", url: detection.url, label, readable: true };
  }
  const social = socialPlatformOf(detection);
  if (social) return { ...base, kind: sourceKindOf(social), url: detection.url, label, handleOnly: true };
  if (Object.hasOwn(SOCIAL_HOSTS, bareHost(url))) return { ...base, kind: "social", url: detection.url, label, handleOnly: true };
  if (detection.type === "card" && detection.platform === "website") {
    return { ...base, kind: "website", url: detection.url, label, readable: true };
  }
  // A song, a video, an app, an event: a link the page can show, nothing to read.
  return { ...base, kind: "pasted", url: detection.url, label, handleOnly: true };
}

/** Is at least one of these sources read by the server (so the "about" sentence may stay empty)? */
export const hasReadableSource = (sources: readonly string[]): boolean => sources.some((source) => classifySource(source)?.readable === true);
