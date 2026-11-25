import { analyticsEnabled, paymentsEnabled } from "@/lib/flags";
import { supabaseEnabled } from "@/lib/supabase/config";

import type { SiteState } from "./pricing";

/**
 * The switches the website's words depend on, as this build runs: whether Pro and the page service
 * can be bought (payments), and whether creator pages are counted (the demo's sample numbers, or real
 * accounts with the cookie-free counter on). Server only: the counter's switch is a server variable.
 * Static pages read it while they are built (it is a build variable in turbo.json).
 */
export function siteState(): SiteState {
  return { payments: paymentsEnabled, statistics: !supabaseEnabled || analyticsEnabled() };
}
