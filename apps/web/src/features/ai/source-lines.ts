import type { AiSourceKind } from "./events";
import type { RunSource } from "./run-reducer";
import { classifySource, type ClassifiedSource } from "./server/sources/classify";

/**
 * The honest line under each source the owner adds ("Instagram shares no profile data. We take your
 * @name …"), and the line for each source the run read. Pure: the build screen and its tests call it
 * with the same classifier the server acts on (`classifySource`), so the promise on screen is exactly
 * what happens.
 */

/** Which `app.ai.platform.*` line a source gets. */
export type PlatformLine = "website" | "linkinbio" | "linktree" | "tiktok" | "instagram" | "youtube" | "x" | "other";

export interface SourceChip {
  /** What the owner typed, trimmed (sent to the server as is). */
  input: string;
  kind: AiSourceKind;
  /** Short and readable: "lio-vance.de", "instagram.com/lio.vance". */
  label: string;
  url: string;
  line: PlatformLine;
  /** The server reads it (website, link page, TikTok). */
  readable: boolean;
  /** Linktree: nothing is read, the owner pastes the links (the paste field opens). */
  pasteOnly: boolean;
}

const LINES: Record<AiSourceKind, PlatformLine> = {
  website: "website",
  linkinbio: "linkinbio",
  linktree: "linktree",
  tiktok: "tiktok",
  instagram: "instagram",
  youtube: "youtube",
  x: "x",
  social: "other",
  pasted: "other",
};

export const platformLine = (kind: AiSourceKind): PlatformLine => LINES[kind];

/** A typed source as a chip, or null when it is not an address. */
export function sourceChip(input: string): SourceChip | null {
  const text = input.trim();
  if (!text) return null;
  const source: ClassifiedSource | null = classifySource(text);
  if (!source) return null;
  return { input: text, kind: source.kind, label: source.label, url: source.url, line: LINES[source.kind], readable: source.readable, pasteOnly: source.pasteOnly };
}

/** At least one chip is read by the server (then the "about" sentence may stay empty). */
export const anyReadable = (chips: readonly SourceChip[]): boolean => chips.some((chip) => chip.readable);

/**
 * Splits what was pasted into the field into addresses (one per line, or separated by spaces or
 * commas), keeping the order and dropping repeats.
 */
export function splitSources(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of text.split(/[\s,]+/)) {
    const value = part.trim();
    if (!value || seen.has(value.toLowerCase())) continue;
    seen.add(value.toLowerCase());
    out.push(value);
  }
  return out;
}

/** The pasted-links field as the request's `pasted` list: one per line, at most 40, no repeats. */
export function pastedLinks(text: string, max = 40): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const value = line.trim();
    if (!value || value.length > 2048 || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
    if (out.length === max) break;
  }
  return out;
}

/** The `ai.run.source.*` message (and its values) for a source the run read, skipped or failed. */
export function sourceStatusLine(source: Pick<RunSource, "status" | "reason" | "label">): { key: "read" | "handleOnly" | "robots" | "paste" | "failed" | "notFound" | "tooLarge" | "blocked"; values: { source: string } } {
  const values = { source: source.label };
  if (source.status === "read") return { key: "read", values };
  if (source.status === "handleOnly") return { key: "handleOnly", values };
  switch (source.reason) {
    case "robots":
      return { key: "robots", values };
    case "paste":
      return { key: "paste", values };
    case "notFound":
      return { key: "notFound", values };
    case "tooLarge":
      return { key: "tooLarge", values };
    case "blocked":
    case "notAllowed":
      return { key: "blocked", values };
    default:
      // A time-out or any other failure: it did not answer, the run goes on without it.
      return { key: "failed", values };
  }
}
