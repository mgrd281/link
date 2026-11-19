import { z } from "zod";

import { ipForLog, type RequestPlace } from "@/lib/request-context";
import type { Db } from "@/lib/supabase/server";

import type { AuthError, Result } from "../types";

/** What the browser says about itself at sign-in (the server adds address and place). */
export const deviceBody = z.object({
  device: z
    .object({
      type: z.enum(["mobile", "tablet", "desktop"]),
      os: z.string().max(40),
      browser: z.string().max(40),
    })
    .default({ type: "desktop", os: "", browser: "" }),
  deviceId: z.string().max(64).default("dev_unknown"),
  signature: z.string().max(128).optional(),
});
export type DeviceBody = z.infer<typeof deviceBody>;

export const json = (body: Result | (Result & { session?: unknown }), status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export const fail = (error: AuthError, status = 200) => json({ ok: false, error }, status);

/** The auth session id inside an access token (to sign one device out later). */
export function sessionIdOf(accessToken: string): string | null {
  try {
    const payload = accessToken.split(".")[1] ?? "";
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { session_id?: unknown };
    return typeof claims.session_id === "string" ? claims.session_id : null;
  } catch {
    return null;
  }
}

/** Writes one sign-in (or failed attempt) to the account's 30-day security log. Never throws. */
export async function recordSignIn(
  service: Db,
  input: { email: string; result: "success" | "failed"; place: RequestPlace; device: DeviceBody; sessionId?: string | null },
): Promise<void> {
  const { error } = await service.rpc("record_sign_in", {
    email: input.email,
    result: input.result,
    ip: ipForLog(input.place),
    device: input.device.device,
    device_id: input.device.deviceId,
    ...(input.place.country ? { country: input.place.country } : {}),
    ...(input.place.city ? { city: input.place.city } : {}),
    ...(input.device.signature ? { signature: input.device.signature } : {}),
    ...(input.sessionId ? { session_id: input.sessionId } : {}),
  });
  if (error) console.error("record_sign_in failed", error.message);
}

export async function isBlocked(service: Db, place: RequestPlace): Promise<boolean> {
  if (!place.ip) return false;
  const { data } = await service.rpc("is_ip_blocked", { address: place.ip });
  return data === true;
}

/** Only in-app destinations after a link from an email (no open redirects). */
export function safePath(value: string | null, fallback: string): string {
  if (!value) return fallback;
  return /^\/(?:de|en|ar)\/(?:app|admin|reset-password)(?:\/[\w/-]*)?$/.test(value) ? value : fallback;
}
