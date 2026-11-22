import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { EmailMessage, EmailSender } from "./types";

/**
 * Tests only: writes each message as one JSON file instead of sending it, so end-to-end tests can
 * read what a customer would get. Refuses to run on Vercel, where nothing may be "sent" this way.
 * File name: `<time>-<tag>-<id>.json`, the time as ISO 8601 with `:` and `.` replaced by `-` (safe on
 * every file system and in CI artifacts).
 */
export class CaptureEmailSender implements EmailSender {
  constructor(private readonly dir: string) {}

  async send(message: EmailMessage): Promise<{ id: string }> {
    if (process.env.VERCEL) throw new Error("The capture e-mail transport is for local tests only");
    const id = randomUUID();
    const time = new Date().toISOString().replace(/[:.]/g, "-");
    await mkdir(this.dir, { recursive: true });
    await writeFile(path.join(this.dir, `${time}-${message.tag}-${id}.json`), `${JSON.stringify({ id, ...message }, null, 2)}\n`, "utf8");
    return { id };
  }
}
