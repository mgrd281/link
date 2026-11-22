import { isIP } from "node:net";

import { supabaseEnabled } from "@/lib/supabase/config";

/**
 * When the AI builder runs at all. Its routes exist only with real accounts, the server switch
 * AI_ENABLED=1 and an API key; otherwise they answer 404 (the demo deployment has none of these).
 */
type Env = Readonly<Record<string, string | undefined>>;

export function aiConfigured(env: Env = process.env, accounts: boolean = supabaseEnabled): boolean {
  return accounts && env.AI_ENABLED === "1" && Boolean(env.ANTHROPIC_API_KEY);
}

const ANTHROPIC_HOST = "api.anthropic.com";

const isLoopback = (hostname: string): boolean => {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost") return true;
  if (isIP(host) === 4) return host.startsWith("127.");
  return host === "::1";
};

/**
 * The SDK reads ANTHROPIC_BASE_URL. Only two targets are allowed: Anthropic's own API, or a mock on
 * this machine (tests) while not on Vercel. Anything else throws before a client exists, so a preview
 * or production deployment can never send a request to a local mock or a stray proxy.
 */
export function assertAnthropicBaseUrl(env: Env = process.env): void {
  const value = env.ANTHROPIC_BASE_URL;
  if (!value) return;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("ANTHROPIC_BASE_URL is not a URL");
  }
  if (url.protocol === "https:" && url.hostname === ANTHROPIC_HOST && !url.username && !url.password) return;
  if (isLoopback(url.hostname) && !env.VERCEL) return;
  throw new Error("ANTHROPIC_BASE_URL may only point at api.anthropic.com (or a local mock off Vercel)");
}
