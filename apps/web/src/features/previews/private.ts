import { createHash } from "node:crypto";

import { z } from "zod";

/**
 * Personal details of a prepared page that must not live in the public repository: a phone number,
 * an e-mail address, the e-mails that may take the page over. They come from the server's
 * environment, never from code:
 *
 *   LINKYO_PREVIEW_PRIVATE={"<slug>":{"phone":"+49…","email":"…","invite":["…"]}}
 *
 * Read on the server only (prerender and the claim). A missing or malformed value is ignored: the
 * page shows without them and nobody can take it over by e-mail.
 */
const details = z.object({
  /** E.164, e.g. +4917612345678. */
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/).optional(),
  email: z.email().max(254).optional(),
  /** The e-mails that open this page as their own account (stored only as SHA-256 in memory). */
  invite: z.array(z.email().max(254)).max(5).optional(),
});
export type PrivateDetails = z.infer<typeof details>;

const file = z.record(z.string().regex(/^[a-z0-9-]{3,64}$/), details);

export function privatePreviewDetails(value: string | undefined = process.env.LINKYO_PREVIEW_PRIVATE): Record<string, PrivateDetails> {
  if (!value) return {};
  try {
    const parsed = file.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

/** How invites are compared: SHA-256 of the trimmed, lower-cased address. */
export const emailHash = (email: string) => createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
