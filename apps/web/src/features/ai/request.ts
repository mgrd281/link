import { KINDS } from "@linkyo/blocks";
import { z } from "zod";

/**
 * What the browser may ask for when it starts an AI run (`POST /api/ai/runs`). The only browser
 * contract: the route validates every request with it. Shared by the build screen and the route.
 */

/** The owner's sentence about themselves. A team briefing's wishes may be longer (`TEAM_ABOUT_MAX`). */
export const ABOUT_MAX = 600;
export const TEAM_ABOUT_MAX = 2000;
export const SOURCES_MAX = 5;
export const PASTED_MAX = 40;

const hex = z.string().regex(/^#[0-9a-f]{6}$/i);
const locale = z.enum(["de", "en", "ar"]);

const fields = {
  pageLocale: locale,
  ownerLocale: locale,
  name: z.string().trim().max(60).optional(),
  kind: z.enum(KINDS).nullable(),
  sources: z.array(z.string().trim().min(1).max(300)).max(SOURCES_MAX),
  pasted: z.array(z.string().trim().min(1).max(2048)).max(PASTED_MAX),
  /** Colors the browser measured from the owner's photo; the photo itself never leaves the browser. */
  photo: z.object({ vibrant: hex, dominant: hex, mode: z.enum(["light", "dark", "vivid"]) }).nullable(),
};

/** Something to work with: a sentence, a link or pasted links (the route adds the readable-source rule). */
const hasInput = (input: { about: string; sources: string[]; pasted: string[] }) => input.about.length > 0 || input.sources.length > 0 || input.pasted.length > 0;

export const aiRunRequestSchema = z
  .object({
    mode: z.enum(["welcome", "dashboard"]),
    ...fields,
    about: z.string().trim().max(ABOUT_MAX),
  })
  .refine(hasInput, { path: ["about"] });
export type AiRunRequest = z.infer<typeof aiRunRequestSchema>;

/** Who started the run: the welcome flow, the dashboard, or a team member working on an order. */
export const AI_ROUTES = ["welcome", "dashboard", "team"] as const;
export type AiRoute = (typeof AI_ROUTES)[number];

/**
 * What the pipeline runs on. Never accepted from the browser: the route builds it from a validated
 * request (`pipelineInput`), the team route from an order's briefing (whose wishes may be longer).
 */
export const pipelineInputSchema = z
  .object({
    route: z.enum(AI_ROUTES),
    ...fields,
    about: z.string().trim().max(TEAM_ABOUT_MAX),
  })
  .refine(hasInput, { path: ["about"] })
  .refine((input) => input.route === "team" || input.about.length <= ABOUT_MAX, { path: ["about"] });
export type PipelineInput = z.infer<typeof pipelineInputSchema>;

/** A browser request as pipeline input: its mode is the route. */
export function pipelineInput(request: AiRunRequest): PipelineInput {
  const { mode, ...rest } = request;
  return { route: mode, ...rest };
}
