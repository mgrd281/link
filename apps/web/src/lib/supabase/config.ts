/**
 * Real accounts (Supabase) are on when both public settings are present; without them the app runs
 * in demo mode and keeps everything in the browser. NEXT_PUBLIC_* values are public by design: the
 * publishable key only works within row-level security (supabase/migrations).
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabaseEnabled = SUPABASE_URL !== "" && SUPABASE_PUBLISHABLE_KEY !== "";
