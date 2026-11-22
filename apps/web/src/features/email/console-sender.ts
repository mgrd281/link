import { randomUUID } from "node:crypto";

import type { EmailMessage, EmailSender } from "./types";

/**
 * The default in development: sends nothing and logs one line without the address or the body
 * (only the kind of e-mail and the recipient's domain), so logs never hold personal data. Logged as
 * a warning: wherever this runs, the e-mail did not go out.
 */
export class ConsoleEmailSender implements EmailSender {
  send(message: EmailMessage): Promise<{ id: string }> {
    const id = randomUUID();
    const toDomain = message.to.includes("@") ? (message.to.split("@").pop() ?? "").toLowerCase() : "";
    console.warn(JSON.stringify({ evt: "email", tag: message.tag, toDomain }));
    return Promise.resolve({ id });
  }
}
