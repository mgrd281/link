import path from "node:path";

import { CaptureEmailSender } from "./capture-sender";
import { ConsoleEmailSender } from "./console-sender";
import { TemEmailSender } from "./tem-sender";
import type { EmailSender } from "./types";

/**
 * The sender for this environment (EMAIL_TRANSPORT): "capture" writes JSON files for tests
 * (EMAIL_CAPTURE_DIR, default `.mail` in the working directory), "tem" sends through Scaleway (needs
 * its three settings and EMAIL_FROM), anything else only logs a content-free line.
 */
export function getEmailSender(): EmailSender {
  const transport = process.env.EMAIL_TRANSPORT ?? "console";
  if (transport === "capture") {
    const dir = process.env.EMAIL_CAPTURE_DIR?.trim() ?? "";
    return new CaptureEmailSender(dir === "" ? path.join(process.cwd(), ".mail") : dir);
  }
  if (transport === "tem") {
    const secretKey = process.env.SCW_SECRET_KEY ?? "";
    const projectId = process.env.SCW_PROJECT_ID ?? "";
    const region = process.env.SCW_REGION ?? "";
    const from = process.env.EMAIL_FROM ?? "";
    if (!secretKey || !projectId || !region || !from) throw new Error("EMAIL_TRANSPORT=tem needs SCW_SECRET_KEY, SCW_PROJECT_ID, SCW_REGION and EMAIL_FROM");
    return new TemEmailSender({ secretKey, projectId, region, from });
  }
  return new ConsoleEmailSender();
}
