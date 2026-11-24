import path from "node:path";

import { paymentsMode } from "@/lib/flags";

import { CaptureEmailSender } from "./capture-sender";
import { ConsoleEmailSender } from "./console-sender";
import { TemEmailSender } from "./tem-sender";
import type { EmailSender } from "./types";

/** The transports that exist. "console" sends nothing (it logs one content-free line). */
export const EMAIL_TRANSPORTS = ["console", "capture", "tem"] as const;
export type EmailTransport = (typeof EMAIL_TRANSPORTS)[number];

/** The only transport that reaches a real mailbox: what live payments need. */
export const LIVE_EMAIL_TRANSPORT: EmailTransport = "tem";

/**
 * EMAIL_TRANSPORT as a transport: unset (or empty) means "console"; a value that names no transport
 * ("TEM", "smtp", a typo) is an error, never a silent fallback to sending nothing.
 */
export function readEmailTransport(value: string | undefined): EmailTransport {
  const name = value?.trim() ?? "";
  if (name === "") return "console";
  const transport = EMAIL_TRANSPORTS.find((candidate) => candidate === name);
  if (!transport) throw new Error(`EMAIL_TRANSPORT must be one of ${EMAIL_TRANSPORTS.join(", ")} (or unset)`);
  return transport;
}

/**
 * Whether a sent e-mail is handed on (EMAIL_TRANSPORT): "tem" delivers, "capture" hands it to the
 * tests' mailbox, "console" (also unset) sends nothing. Routes report `mailed` only when this is true,
 * so the team never reads "the customer has it" for an e-mail that did not go out.
 */
export const emailDelivers = (env: Record<string, string | undefined> = process.env): boolean => readEmailTransport(env.EMAIL_TRANSPORT) !== "console";

/**
 * The sender for this environment (EMAIL_TRANSPORT): "capture" writes JSON files for tests
 * (EMAIL_CAPTURE_DIR, default `.mail` in the working directory), "tem" sends through Scaleway (needs
 * its three settings and EMAIL_FROM), unset or "console" only logs a content-free line.
 *
 * Callers take a resolved `send` as "the customer has it": the webhook then lets a paid order into the
 * team's queue (§ 312f BGB) and the contract forms say "we sent you the confirmation". So this
 * throws instead of handing out a sender that sends nothing where that would be a lie that matters:
 * for an unknown transport name, and with live payments for anything but "tem". The webhook then
 * answers 500 (Stripe delivers again once the transport is fixed) and the forms store the declaration
 * and say the confirmation is held. The build guard (features/legal/live-guard.ts) stops such a
 * deployment earlier; this is the check at run time.
 */
export function getEmailSender(env: Record<string, string | undefined> = process.env): EmailSender {
  const transport = readEmailTransport(env.EMAIL_TRANSPORT);
  // Live by this server's environment, or by the build it runs (the flag is fixed at build time).
  const live = env.NEXT_PUBLIC_PAYMENTS === "live" || (env === process.env && paymentsMode === "live");
  if (live && transport !== LIVE_EMAIL_TRANSPORT) {
    throw new Error(`NEXT_PUBLIC_PAYMENTS=live needs EMAIL_TRANSPORT=${LIVE_EMAIL_TRANSPORT}: contract e-mails must really go out`);
  }
  if (transport === "capture") {
    const dir = env.EMAIL_CAPTURE_DIR?.trim() ?? "";
    return new CaptureEmailSender(dir === "" ? path.join(process.cwd(), ".mail") : dir);
  }
  if (transport === "tem") {
    const secretKey = env.SCW_SECRET_KEY ?? "";
    const projectId = env.SCW_PROJECT_ID ?? "";
    const region = env.SCW_REGION ?? "";
    const from = env.EMAIL_FROM ?? "";
    if (!secretKey || !projectId || !region || !from) throw new Error("EMAIL_TRANSPORT=tem needs SCW_SECRET_KEY, SCW_PROJECT_ID, SCW_REGION and EMAIL_FROM");
    return new TemEmailSender({ secretKey, projectId, region, from });
  }
  return new ConsoleEmailSender();
}
