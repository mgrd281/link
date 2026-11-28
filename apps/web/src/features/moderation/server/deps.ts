import "server-only";

import { customerAddress } from "@/app/api/admin/customers/username";
import { deliver } from "@/features/admin/mail";
import { revalidateCreatorPages } from "@/features/creator/revalidate";
import { COMPANY } from "@/features/legal/company";
import { pageAddress } from "@/lib/page-url";
import { siteUrl } from "@/lib/site-url";
import type { Database } from "@/lib/supabase/database.types";
import type { Db } from "@/lib/supabase/server";
import { serviceSupabase } from "@/lib/supabase/server";

import type { DecideDeps } from "./decide";
import { loadTranslator } from "./submit";

type ModerateArgs = Database["public"]["Functions"]["admin_moderate"]["Args"];

/** The account's own address, read as the server (never one a client sent). Null without the server key. */
async function accountEmail(customer: string): Promise<string | null> {
  try {
    const { data } = await serviceSupabase().auth.admin.getUserById(customer);
    return data.user?.email ?? null;
  } catch {
    return null;
  }
}

/** A decision's surroundings on this deployment: the member's own database client, the cache, the e-mail transport. */
export function decideDeps(db: Db): DecideDeps {
  return {
    moderate: async (input) =>
      db.rpc("admin_moderate", {
        // A dismissal of a report about no account sends null: the argument has no default, so it is
        // named (the generated type knows no null for a uuid without a default).
        customer: input.customer,
        decision: input.decision,
        why: input.reason,
        ...(input.ground ? { legal_ground: input.ground } : {}),
        ...(input.block ? { target_block: input.block } : {}),
        ...(input.report ? { for_report: input.report } : {}),
      } as ModerateArgs),
    address: customerAddress,
    revalidate: (usernames, slugs) => {
      revalidateCreatorPages(usernames, slugs);
    },
    accountEmail,
    deliver: (message) => deliver(message, "moderation_mail_failed"),
    translator: loadTranslator,
    pageAddress,
    site: siteUrl().origin,
    contact: COMPANY.email,
  };
}
