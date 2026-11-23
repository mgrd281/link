import { projectSlugsOf, usernameOf } from "@/features/creator/revalidate";
import { serviceSupabase } from "@/lib/supabase/server";

/** Where a customer's page answers: its address and its project addresses. */
export interface CustomerAddress {
  username: string | null;
  slugs: string[];
}

/**
 * A customer's page address and project addresses for the team's routes. Row-level security shows a
 * profile and a page only to their owner (and `public_page` answers nothing for a suspended account),
 * so these reads use the service client (server only). They never answer a caller: the routes use
 * them to drop the cached public page and project pages after the database allowed their action.
 * Null and [] when the profile, the page or the secret key is missing (then nothing is dropped and
 * the pages refresh within their minute, as before).
 */
export async function customerAddress(customer: string): Promise<CustomerAddress> {
  try {
    const db = serviceSupabase();
    return { username: await usernameOf(db, customer), slugs: await projectSlugsOf(db, customer) };
  } catch {
    return { username: null, slugs: [] };
  }
}
