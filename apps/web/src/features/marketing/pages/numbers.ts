import { USERNAME_MAX, USERNAME_MIN } from "@linkyo/blocks/rules";

import { STATS_DAYS } from "@/features/analytics/server/collect";
import { projectPictureLimit } from "@/features/app/images";
import { PORTFOLIO_STEPS, WELCOME_STEPS } from "@/features/app/kinds";
import { SITE_COUNTS } from "@/features/examples/looks";
import { CREATOR_DOMAIN } from "@/lib/page-url";
import { supabaseEnabled } from "@/lib/supabase/config";

/**
 * The numbers the site pages' words name, taken from the code that sets them, so no sentence goes
 * stale when one changes: the designs and example pages (`designs`, `pages`), the page address
 * (`domain`) and its length (`min`, `max`), the welcome flow's steps (`steps`, `portfolioSteps`), the
 * pictures a project holds as this build stores them (`pictures`), and the ranges of the statistics
 * (`week`, `month`, `quarter`). The help and features pages pass them to every message; the help
 * search test formats every article with them.
 */
export const SITE_NUMBERS = {
  ...SITE_COUNTS,
  domain: CREATOR_DOMAIN,
  min: USERNAME_MIN,
  max: USERNAME_MAX,
  steps: WELCOME_STEPS.length,
  portfolioSteps: PORTFOLIO_STEPS.length,
  pictures: projectPictureLimit(supabaseEnabled),
  week: STATS_DAYS[0],
  month: STATS_DAYS[1],
  quarter: STATS_DAYS[2],
};
