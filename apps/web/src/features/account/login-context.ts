"use client";

import { parseUserAgent } from "./device";
import type { DeviceInfo, LoginContext } from "./types";

/**
 * Where a sign-in comes from, for the account's security log: the address and rough location as the
 * server sees them (/api/session/context: request headers only, nothing stored there), the device
 * as the browser describes itself, a random per-browser id, and a short signature hash.
 */
const DEVICE_KEY = "linkyo.device";

function deviceId(): string {
  try {
    const known = window.localStorage.getItem(DEVICE_KEY);
    if (known) return known;
    const id = `dev_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
    window.localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    return "dev_unknown";
  }
}

async function signature(): Promise<string | undefined> {
  try {
    const parts = [navigator.userAgent, navigator.language, Intl.DateTimeFormat().resolvedOptions().timeZone, `${screen.width}x${screen.height}@${window.devicePixelRatio}`];
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(parts.join("|")));
    return Array.from(new Uint8Array(digest).slice(0, 8), (byte) => byte.toString(16).padStart(2, "0")).join("");
  } catch {
    return undefined;
  }
}

interface Where {
  ip?: string;
  country?: string;
  city?: string;
}

export async function browserLoginContext(): Promise<LoginContext> {
  const nowhere: Where = {};
  const [where, hash] = await Promise.all([
    fetch("/api/session/context", { cache: "no-store" })
      .then((response) => (response.ok ? (response.json() as Promise<Where>) : nowhere))
      .catch(() => nowhere),
    signature(),
  ]);
  return {
    ip: where.ip ?? "",
    ...(where.country ? { country: where.country } : {}),
    ...(where.city ? { city: where.city } : {}),
    device: parseUserAgent(navigator.userAgent),
    deviceId: deviceId(),
    ...(hash ? { signature: hash } : {}),
  };
}

/** The device part only, for real accounts: our server adds the address and place itself. */
export async function browserDevice(): Promise<{ device: DeviceInfo; deviceId: string; signature?: string }> {
  const hash = await signature();
  return { device: parseUserAgent(navigator.userAgent), deviceId: deviceId(), ...(hash ? { signature: hash } : {}) };
}
