import { z } from "zod";

import { ANONYMOUS_CATEGORIES, LIMITS, REPORT_CATEGORIES, type ReportCategory } from "./types";

/**
 * The public report form's rules, shared by the form in the browser and its route on the server, so
 * both refuse the same things the database refuses (`submit_report`).
 */

/** A page address in the database's shape: lower-case letters, digits and dashes. */
const PAGE = /^[a-z0-9][a-z0-9-]{0,59}$/;

/** Paths of the website that are no creator page (a report form never names them as the page). */
const NOT_A_PAGE = new Set(["de", "en", "ar", "u", "p"]);

/**
 * The page a visitor means, from what they typed or the footer's link carried: a name ("mila",
 * "@mila"), an address ("linkyo.app/mila", "https://linkyo.app/mila/hafenlicht") or the internal path
 * ("/u/mila"). Answers the page's name in lower case, or null when none can be read.
 */
export function pageFromInput(input: string): string | null {
  const text = input.trim().replace(/^@/, "");
  if (text === "") return null;
  let path = text;
  if (/^https?:\/\//i.test(text) || /^[^\s/]+\.[^\s/]+\//.test(text)) {
    try {
      path = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`).pathname;
    } catch {
      return null;
    }
  }
  const parts = path.split("/").filter(Boolean);
  // "/u/mila/…" (internal) and "/de/p/…" (examples are not creator pages: no page).
  while (parts.length > 0 && NOT_A_PAGE.has((parts[0] ?? "").toLowerCase())) {
    if ((parts[0] ?? "").toLowerCase() === "p") return null;
    parts.shift();
  }
  let name = (parts[0] ?? "").toLowerCase();
  try {
    name = decodeURIComponent(name);
  } catch {
    return null;
  }
  return PAGE.test(name) ? name : null;
}

/** The exact address, when what was typed is a web address (kept with the report), else null. */
export function urlFromInput(input: string): string | null {
  const text = input.trim();
  if (!/^https?:\/\//i.test(text) || text.length > LIMITS.url.max) return null;
  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString().slice(0, LIMITS.url.max) : null;
  } catch {
    return null;
  }
}

export const mayBeAnonymous = (category: ReportCategory | ""): boolean => category !== "" && ANONYMOUS_CATEGORIES.includes(category);

const trimmed = (max: number) => z.string().max(max * 2).transform((value) => value.trim());

/** What the form sends (`POST /api/reports`). */
export const reportInputSchema = z
  .object({
    page: trimmed(LIMITS.url.max),
    category: z.enum(REPORT_CATEGORIES),
    explanation: trimmed(LIMITS.explanation.max),
    name: trimmed(LIMITS.name.max).optional().default(""),
    email: trimmed(LIMITS.email.max).optional().default(""),
    goodFaith: z.boolean(),
    locale: z.enum(["de", "en", "ar"]).optional().default("de"),
  })
  .strict();

export type ReportInput = z.input<typeof reportInputSchema>;

/** The fields that are wrong, in the form's order (empty: the report can be sent). */
export type ReportField = "page" | "category" | "explanation" | "name" | "email" | "goodFaith";

const isEmail = (value: string) => value.length <= LIMITS.email.max && z.email().safeParse(value).success;

/** Checks a filled-in form as the database will (`submit_report`); answers the fields that are wrong. */
export function reportProblems(input: { page: string; category: ReportCategory | ""; explanation: string; name: string; email: string; goodFaith: boolean }): ReportField[] {
  const problems: ReportField[] = [];
  if (pageFromInput(input.page) === null) problems.push("page");
  if (input.category === "") problems.push("category");
  const words = input.explanation.trim().length;
  if (words < LIMITS.explanation.min || words > LIMITS.explanation.max) problems.push("explanation");
  const anonymous = mayBeAnonymous(input.category);
  const name = input.name.trim();
  if ((name === "" && !anonymous) || (name !== "" && (name.length < LIMITS.name.min || name.length > LIMITS.name.max))) problems.push("name");
  const email = input.email.trim();
  if ((email === "" && !anonymous) || (email !== "" && !isEmail(email))) problems.push("email");
  if (!input.goodFaith) problems.push("goodFaith");
  return problems;
}
