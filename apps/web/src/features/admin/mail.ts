import { emailDelivers, getEmailSender } from "@/features/email/send";
import type { EmailMessage, EmailSender } from "@/features/email/types";

export interface MailDeps {
  sender: () => EmailSender;
  delivers: () => boolean;
}

const fromEnvironment: MailDeps = { sender: () => getEmailSender(), delivers: () => emailDelivers() };

/**
 * Sends one e-mail of a team action (a refund, a cancellation, a delivered proposal) and answers what
 * the route reports as `mailed`: true only when the message was handed to a transport that delivers.
 * The console stand-in (EMAIL_TRANSPORT unset, as on production today) still logs its content-free
 * line, but the answer is false, so the console tells the team the e-mail did not go out (ADR 0073).
 * No message (no address on file) and any failure are false too; a failure is logged without the
 * address. Server only.
 */
export async function deliver(message: () => Promise<EmailMessage | null>, failure: string, deps: MailDeps = fromEnvironment): Promise<boolean> {
  try {
    const built = await message();
    if (!built) return false;
    await deps.sender().send(built);
    return deps.delivers();
  } catch (error) {
    console.error(JSON.stringify({ evt: failure, error: error instanceof Error ? error.message : "unknown" }));
    return false;
  }
}
