"use client";

import { browserSupabase } from "./browser";
import { supabaseEnabled } from "./config";

/**
 * The signed-in user's access token, for our own API routes (sent as `Authorization: Bearer …`).
 * Null in demo mode and when nobody is signed in.
 */
export async function accessToken(): Promise<string | null> {
  if (!supabaseEnabled) return null;
  const { data } = await browserSupabase().auth.getSession();
  return data.session?.access_token ?? null;
}
