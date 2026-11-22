import { createHmac } from "node:crypto";

/**
 * A visitor's IP address as a daily-salted HMAC, so limits ("5 AI runs a day per network", "10
 * withdrawals an hour") work without storing addresses: the same address gives the same hash all
 * day (Berlin), and a different one the next day, so hashes cannot be linked across days.
 *
 * The salt is AI_IP_SALT_SECRET plus the Berlin date. On Vercel the secret is required; elsewhere a
 * fixed development salt is used.
 */
const DEV_SALT = "dev-only-salt";

const berlinDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" });

export function ipHash(ip: string, now: Date = new Date()): string {
  const secret = process.env.AI_IP_SALT_SECRET ?? "";
  if (!secret && process.env.VERCEL) throw new Error("AI_IP_SALT_SECRET is not set");
  return createHmac("sha256", `${secret || DEV_SALT}${berlinDate.format(now)}`)
    .update(ip)
    .digest("hex");
}
