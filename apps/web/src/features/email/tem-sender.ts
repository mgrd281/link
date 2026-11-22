import type { EmailMessage, EmailSender } from "./types";

/**
 * Scaleway Transactional Email (EU). Not used in phase 1: no e-mail leaves the machine yet. Selected
 * with EMAIL_TRANSPORT=tem; needs SCW_SECRET_KEY, SCW_PROJECT_ID and SCW_REGION.
 */
export interface TemConfig {
  secretKey: string;
  projectId: string;
  region: string;
  /** "Linkyo <address>" or a bare address. */
  from: string;
}

/** "Name <address>" → { email, name }; a bare address → { email }. */
export function parseSender(from: string): { email: string; name?: string } {
  const match = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from);
  if (!match) return { email: from.trim() };
  const name = (match[1] ?? "").replace(/^"|"$/g, "").trim();
  return { email: (match[2] ?? "").trim(), ...(name ? { name } : {}) };
}

export class TemEmailSender implements EmailSender {
  constructor(
    private readonly config: TemConfig,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async send(message: EmailMessage): Promise<{ id: string }> {
    const { secretKey, projectId, region, from } = this.config;
    const response = await this.fetcher(`https://api.scaleway.com/transactional-email/v1alpha1/regions/${encodeURIComponent(region)}/emails`, {
      method: "POST",
      headers: { "X-Auth-Token": secretKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: parseSender(from),
        to: [{ email: message.to }],
        subject: message.subject,
        text: message.text,
        html: message.html,
        project_id: projectId,
      }),
    });
    if (!response.ok) throw new Error(`Transactional e-mail failed with status ${response.status}`);
    const body = (await response.json()) as { emails?: { id?: string }[] };
    const id = body.emails?.[0]?.id;
    if (!id) throw new Error("Transactional e-mail answered without an id");
    return { id };
  }
}
