import { creatorTokens } from "@linkyo/tokens";
import { z } from "zod";

import { KINDS } from "./kinds";
import { LINK_ICONS } from "./schema";

/**
 * PagePlan v1: what the AI answers when it drafts a page. It is not the page itself: every field is
 * required and nothing is nullable (structured outputs allow few optional fields), links are only
 * referenced by id (the model never writes an address), and rich blocks (videos, songs, apps …) are
 * only chosen, then built by code from the link. Code turns a plan into a `Page`
 * (`apps/web/src/features/ai/plan-to-page.ts`) and validates that with `pageSchema`.
 *
 * The field order is the order the answer streams in: the look first, so the preview changes color
 * within the first second.
 */

type NonEmpty = [string, ...string[]];
const tuple = (values: readonly string[]): NonEmpty => {
  const [first, ...rest] = values;
  if (first === undefined) throw new Error("PagePlan: an enum needs at least one value");
  return [first, ...rest];
};

/** Template ids, as the design tokens define them. */
export const TEMPLATE_IDS = tuple(Object.keys(creatorTokens.templates));
/** Font pairings the AI may pick: the Arabic pairing is chosen by the page's language, never by the AI. */
export const PAIRING_IDS = tuple(Object.keys(creatorTokens.pairings).filter((id) => id !== "arabic"));
export const BUTTON_STYLES = tuple(creatorTokens.buttonStyles);
export const BUTTON_SHAPES = tuple(Object.keys(creatorTokens.buttonShapes));
export const SWATCH_NAMES = tuple(Object.keys(creatorTokens.swatches));

const ref = z
  .string()
  .regex(/^L[0-9]{1,2}$/)
  .describe("A link id from <sources>, such as L3.");
const ad = z.boolean().describe("Paid, sponsored, affiliate or referral link.");

export const aiBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("header"), title: z.string().max(80) }).strict().describe("Section title."),
  z
    .object({
      type: z.literal("link"),
      ref,
      title: z.string().max(120),
      subtitle: z.string().max(80).describe("Empty string for none."),
      icon: z.enum(["auto", ...LINK_ICONS]),
      highlight: z.boolean(),
      ad,
    })
    .strict()
    .describe("A button."),
  z
    .object({ type: z.literal("rich"), ref, highlight: z.boolean(), ad })
    .strict()
    .describe("A video, song, app, repository, event or product card that Linkyo builds from the link."),
  z.object({ type: z.literal("text"), text: z.string().max(400) }).strict().describe("A short paragraph."),
  z.object({ type: z.literal("socials"), refs: z.array(ref).max(12) }).strict().describe("Icons for social profiles."),
  z
    .object({ type: z.literal("newsletter"), title: z.string().max(80), description: z.string().max(200) })
    .strict()
    .describe("Email sign-up."),
]);
export type AiBlock = z.infer<typeof aiBlockSchema>;

export const pagePlanSchema = z
  .object({
    kind: z.enum(KINDS),
    theme: z
      .object({
        template: z.enum(TEMPLATE_IDS),
        accent: z.enum(["template", "photo_vibrant", "photo_dominant", ...SWATCH_NAMES]),
        pairing: z.enum(["template", ...PAIRING_IDS]),
        buttonShape: z.enum(["template", ...BUTTON_SHAPES]),
        buttonStyle: z.enum(["template", ...BUTTON_STYLES]),
      })
      .strict(),
    profile: z
      .object({
        displayName: z.string().max(60),
        tagline: z.string().max(80),
        bio: z.string().max(160),
        location: z.string().max(60),
      })
      .strict(),
    blocks: z.array(aiBlockSchema).max(30),
    notes: z
      .array(z.object({ topic: z.enum(["look", "order", "copy", "missing"]), text: z.string().max(140) }).strict())
      .max(4)
      .describe("Short notes for the page owner, in the owner's language."),
  })
  .strict();
export type PagePlan = z.infer<typeof pagePlanSchema>;
export const PAGE_PLAN_VERSION = "plan-v2";

type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject => typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Makes Zod's JSON Schema acceptable to structured outputs: `oneOf` becomes `anyOf` (the API rejects
 * `oneOf`), length limits move into the description (the API does not support them; our own Zod
 * schema still enforces every limit on the answer), `$schema` goes, and every object is closed with
 * every property required.
 */
function forStructuredOutputs(node: unknown): unknown {
  if (Array.isArray(node)) return (node as unknown[]).map(forStructuredOutputs);
  if (!isObject(node)) return node;
  const out: JsonObject = {};
  const limits: string[] = [];
  for (const [key, value] of Object.entries(node)) {
    if (key === "$schema") continue;
    if (key === "maxLength" && typeof value === "number") {
      limits.push(`(max ${value} characters)`);
      continue;
    }
    if (key === "maxItems" && typeof value === "number") {
      limits.push(`(max ${value} items)`);
      continue;
    }
    out[key === "oneOf" ? "anyOf" : key] = forStructuredOutputs(value);
  }
  if (limits.length) out.description = [typeof out.description === "string" ? out.description : "", ...limits].filter(Boolean).join(" ");
  if (out.type === "object" && isObject(out.properties)) {
    out.additionalProperties = false;
    out.required = Object.keys(out.properties);
  }
  return out;
}

/** The schema sent as `output_config.format.schema`: static, so the compiled grammar stays cached. */
export const PAGE_PLAN_JSON_SCHEMA = forStructuredOutputs(z.toJSONSchema(pagePlanSchema)) as JsonObject;
